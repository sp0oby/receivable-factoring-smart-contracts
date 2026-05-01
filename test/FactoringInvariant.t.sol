// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReceivableNFT} from "../src/ReceivableNFT.sol";
import {FactoringVault} from "../src/FactoringVault.sol";
import {Pricing} from "../src/lib/Pricing.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract FactoringHandler is Test {
    MockERC20 public immutable asset;
    ReceivableNFT public immutable receivable;
    FactoringVault public immutable vault;
    address public immutable admin;
    address public immutable lp;
    address public immutable seller;
    address public immutable debtor;

    constructor(
        MockERC20 asset_,
        ReceivableNFT receivable_,
        FactoringVault vault_,
        address admin_,
        address lp_,
        address seller_,
        address debtor_
    ) {
        asset = asset_;
        receivable = receivable_;
        vault = vault_;
        admin = admin_;
        lp = lp_;
        seller = seller_;
        debtor = debtor_;
    }

    function fundRandomInvoice(uint256 salt) external {
        uint256 nominal = bound(salt, 1e18, 50_000e18);
        vm.startPrank(admin);
        uint256 id = receivable.mint(seller, nominal, uint48(block.timestamp + 200 days), debtor, bytes32(salt), "");
        vm.stopPrank();
        vm.prank(seller);
        IERC721(address(receivable)).setApprovalForAll(address(vault), true);
        vm.prank(seller);
        try vault.purchaseReceivable(id) {} catch {}
    }
}

contract FactoringInvariantTest is StdInvariant, Test {
    FactoringHandler internal h;

    function setUp() public {
        address admin = address(0xA11);
        address lp = address(0xB00);
        address seller = address(0xC00);
        address debtor = address(0xD00);

        vm.startPrank(admin);
        MockERC20 asset = new MockERC20();
        ReceivableNFT receivable = new ReceivableNFT(admin);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: 50, maxDiscountBps: 1000, slopeBps: 200});
        FactoringVault vault = new FactoringVault(IERC20(address(asset)), receivable, admin, p, 9800);
        vm.stopPrank();

        asset.mint(lp, 10_000_000e18);
        vm.prank(lp);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(500_000e18, lp);

        h = new FactoringHandler(asset, receivable, vault, admin, lp, seller, debtor);
        targetContract(address(h));
    }

    function invariant_totalAssets_formula() public view {
        FactoringVault v = h.vault();
        assertEq(v.totalAssets(), IERC20(v.asset()).balanceOf(address(v)) + v.totalFaceOutstanding());
    }
}
