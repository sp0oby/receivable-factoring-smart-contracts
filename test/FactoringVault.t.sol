// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReceivableNFT} from "../src/ReceivableNFT.sol";
import {FactoringVault} from "../src/FactoringVault.sol";
import {OperatorOracle} from "../src/adapters/OperatorOracle.sol";
import {Pricing} from "../src/lib/Pricing.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract FactoringVaultTest is Test {
    MockERC20 internal asset;
    ReceivableNFT internal receivable;
    FactoringVault internal vault;
    OperatorOracle internal oracle;

    address internal admin = address(0xA11);
    address internal lp = address(0xB00);
    address internal seller = address(0xC00);
    address internal debtor = address(0xD00);
    address internal operator = address(0xE00);

    uint256 internal tid;

    function setUp() public {
        vm.startPrank(admin);
        asset = new MockERC20();
        receivable = new ReceivableNFT(admin);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: 200, maxDiscountBps: 1500, slopeBps: 800});
        vault = new FactoringVault(IERC20(address(asset)), receivable, admin, p, 9500);
        oracle = new OperatorOracle(address(vault), admin);
        vault.grantRole(vault.ORACLE_ROLE(), address(oracle));
        oracle.grantRole(oracle.OPERATOR_ROLE(), operator);
        vm.stopPrank();

        asset.mint(lp, 1_000_000e18);
        asset.mint(debtor, 500_000e18);
        vm.prank(lp);
        asset.approve(address(vault), type(uint256).max);

        vm.prank(lp);
        vault.deposit(100_000e18, lp);

        vm.prank(admin);
        tid = receivable.mint(seller, 10_000e18, uint48(block.timestamp + 30 days), debtor, keccak256("commit"), "");

        vm.prank(seller);
        IERC721(address(receivable)).setApprovalForAll(address(vault), true);

        vm.prank(seller);
        vault.purchaseReceivable(tid);
    }

    function test_purchase_sets_position_and_pay_seller() public view {
        (FactoringVault.Status st, uint48 maturity, address deb, uint256 rem) = vault.positions(tid);
        assertEq(uint256(st), uint256(FactoringVault.Status.Active));
        assertEq(rem, 10_000e18);
        assertEq(deb, debtor);
        assertEq(maturity, receivable.getTerms(tid).due);
        uint256 expectedAdvance = 10_000e18 * (10_000 - 200) / 10_000;
        assertEq(asset.balanceOf(seller), expectedAdvance);
    }

    function test_repay_closes_and_burns() public {
        vm.startPrank(debtor);
        asset.approve(address(vault), type(uint256).max);
        vault.repay(tid, 10_000e18);
        vm.stopPrank();

        (FactoringVault.Status st,,,) = vault.positions(tid);
        assertEq(uint256(st), uint256(FactoringVault.Status.Repaid));
        vm.expectRevert();
        IERC721(address(receivable)).ownerOf(tid);
    }

    function test_operator_oracle_path() public {
        vm.prank(admin);
        asset.mint(operator, 10_000e18);
        vm.startPrank(operator);
        asset.approve(address(oracle), type(uint256).max);
        oracle.reportRepayment(tid, 10_000e18);
        vm.stopPrank();

        (FactoringVault.Status st,,,) = vault.positions(tid);
        assertEq(uint256(st), uint256(FactoringVault.Status.Repaid));
    }

    function test_mark_default_after_maturity() public {
        vm.warp(block.timestamp + 31 days);
        vault.markDefaulted(tid);
        (FactoringVault.Status st,,,) = vault.positions(tid);
        assertEq(uint256(st), uint256(FactoringVault.Status.Defaulted));
    }
}
