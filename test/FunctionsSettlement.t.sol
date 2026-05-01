// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReceivableNFT} from "../src/ReceivableNFT.sol";
import {FactoringVault} from "../src/FactoringVault.sol";
import {FunctionsSettlement} from "../src/chainlink/FunctionsSettlement.sol";
import {Pricing} from "../src/lib/Pricing.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockFunctionsRouter} from "./mocks/MockFunctionsRouter.sol";

contract FunctionsSettlementTest is Test {
    MockERC20 internal asset;
    ReceivableNFT internal receivable;
    FactoringVault internal vault;
    MockFunctionsRouter internal router;
    FunctionsSettlement internal settlement;

    address internal admin = address(0xA11);
    address internal lp = address(0xB00);
    address internal seller = address(0xC00);
    address internal debtor = address(0xD00);

    uint256 internal tid;

    function setUp() public {
        vm.startPrank(admin);
        asset = new MockERC20();
        receivable = new ReceivableNFT(admin);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: 200, maxDiscountBps: 1500, slopeBps: 800});
        vault = new FactoringVault(IERC20(address(asset)), receivable, admin, p, 9500);
        router = new MockFunctionsRouter();
        settlement = new FunctionsSettlement(address(router), address(vault), admin);
        vault.grantRole(vault.ORACLE_ROLE(), address(settlement));
        vm.stopPrank();

        asset.mint(lp, 1_000_000e18);
        vm.prank(lp);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(100_000e18, lp);

        vm.prank(admin);
        tid = receivable.mint(seller, 10_000e18, uint48(block.timestamp + 30 days), debtor, keccak256("c"), "");
        vm.prank(seller);
        IERC721(address(receivable)).setApprovalForAll(address(vault), true);
        vm.prank(seller);
        vault.purchaseReceivable(tid);
    }

    function test_fulfill_applies_settlement() public {
        vm.prank(admin);
        asset.mint(address(vault), 8000e18);

        vm.prank(admin);
        bytes32 requestId = settlement.sendSettlementRequestWithRepay(
            tid, 1e18, 1, 300_000, bytes32(uint256(1)), "function x(){return '';}"
        );

        bytes memory response = abi.encode(tid, uint256(8000e18));
        router.fulfill(address(settlement), requestId, response, "");

        (,,, uint256 rem) = vault.positions(tid);
        assertEq(rem, 2000e18);
    }

    function test_fulfill_rejects_wrong_token() public {
        vm.prank(admin);
        bytes32 requestId = settlement.sendSettlementRequestWithRepay(
            tid, 1e18, 1, 300_000, bytes32(uint256(1)), "function x(){return '';}"
        );

        bytes memory bad = abi.encode(tid + 1, uint256(1e18));
        vm.expectRevert();
        router.fulfill(address(settlement), requestId, bad, "");
    }

    function test_legacy_send_then_fulfill() public {
        vm.prank(admin);
        asset.mint(address(vault), 5000e18);
        vm.prank(admin);
        bytes32 requestId =
            settlement.sendSettlementRequest(tid, 1, 300_000, bytes32(uint256(1)), "function x(){return '';}");
        bytes memory response = abi.encode(tid, uint256(5000e18));
        router.fulfill(address(settlement), requestId, response, "");
        (,,, uint256 rem) = vault.positions(tid);
        assertEq(rem, 5000e18);
    }

    function test_fulfill_reverts_on_err() public {
        vm.prank(admin);
        bytes32 requestId = settlement.sendSettlementRequestWithRepay(
            tid, 1e18, 1, 300_000, bytes32(uint256(1)), "function x(){return '';}"
        );
        vm.expectRevert();
        router.fulfill(address(settlement), requestId, "", "oops");
    }
}
