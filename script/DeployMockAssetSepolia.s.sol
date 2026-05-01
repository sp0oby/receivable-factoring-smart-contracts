// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console2} from "forge-std/console2.sol";
import {ScriptPk} from "./ScriptPk.sol";
import {SepoliaMockAsset} from "../src/mocks/SepoliaMockAsset.sol";

/// @notice Deploy `SepoliaMockAsset` on Sepolia (or any RPC you pass), mint to deployer, print address for `ASSET_TOKEN`.
contract DeployMockAssetSepolia is ScriptPk {
    function run() external {
        uint256 pk = envPrivateKey("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        uint256 initialMint = vm.envOr("MOCK_ASSET_MINT_AMOUNT", uint256(1_000_000 ether));

        vm.startBroadcast(pk);
        token = new SepoliaMockAsset(deployer);
        token.mint(deployer, initialMint);
        vm.stopBroadcast();

        console2.log("");
        console2.log("=== SepoliaMockAsset deployed ===");
        console2.logAddress(address(token));
        console2.log("Set ASSET_TOKEN in root .env to the address above.");
        console2.log("Then: forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast");
    }

    SepoliaMockAsset public token;
}
