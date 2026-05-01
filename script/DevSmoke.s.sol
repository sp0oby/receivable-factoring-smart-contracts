// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console2} from "forge-std/console2.sol";
import {ScriptPk} from "./ScriptPk.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReceivableNFT} from "../src/ReceivableNFT.sol";
import {FactoringVault} from "../src/FactoringVault.sol";

/// @dev Mint + fund one receivable (issuer must be pranked deployer).
contract DevSmoke is ScriptPk {
    function run() external {
        uint256 pk = envPrivateKeyOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);
        address receivableAddr = vm.envAddress("RECEIVABLE");
        address vaultAddr = vm.envAddress("VAULT");
        address seller = vm.envOr("SELLER", deployer);

        ReceivableNFT receivable = ReceivableNFT(receivableAddr);
        FactoringVault vault = FactoringVault(vaultAddr);

        vm.startPrank(deployer);
        uint256 id = receivable.mint(seller, 5000e18, uint48(block.timestamp + 30 days), seller, keccak256("smoke"), "");
        vm.stopPrank();

        vm.startPrank(seller);
        IERC721(receivableAddr).setApprovalForAll(vaultAddr, true);
        vault.purchaseReceivable(id);
        vm.stopPrank();

        console2.log("Minted and funded tokenId:", id);
    }
}
