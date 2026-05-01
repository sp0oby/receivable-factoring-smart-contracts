// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FactoringVault} from "../src/FactoringVault.sol";

/// @dev Live Sepolia deployment smoke test (fork). Run: `forge test --match-contract SepoliaForkSmokeTest -vv`
contract SepoliaForkSmokeTest is Test {
    FactoringVault internal constant VAULT = FactoringVault(0x4601B97eE914FDcd571546D48d6D5330B28928e4);
    address internal constant ASSET = 0xA46Af17d1B3C0DfeeD0E5D8d6CEb8d49698D4de1;

    function setUp() public {
        string memory url = vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com"));
        vm.createSelectFork(url);
    }

    function test_sepolia_fork_vault_asset_and_reads() public view {
        assertEq(VAULT.asset(), ASSET);
        VAULT.totalAssets();
        VAULT.totalFaceOutstanding();
    }
}
