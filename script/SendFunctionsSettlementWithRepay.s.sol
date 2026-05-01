// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console2} from "forge-std/console2.sol";
import {ScriptPk} from "./ScriptPk.sol";
import {FunctionsSettlement} from "../src/chainlink/FunctionsSettlement.sol";

/// @notice Broadcast `sendSettlementRequestWithRepay` — only for **newly deployed** `FunctionsSettlement` that includes this function.
/// @dev Default JS path expects **two** string args (tokenId, repayWei). Reference Sepolia `0xa061…` uses `SendFunctionsSettlement.s.sol` instead.
contract SendFunctionsSettlementWithRepay is ScriptPk {
    bytes32 internal constant DON_ID_ETH_SEPOLIA =
        0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

    function run() external {
        uint256 pk = envPrivateKey("PRIVATE_KEY");
        address settlementAddr = vm.envAddress("FUNCTIONS_SETTLEMENT");
        uint256 tid = vm.envUint("SETTLEMENT_TOKEN_ID");
        uint256 repayWei = vm.envUint("FUNCTIONS_REPAY_WEI");

        uint64 subId = uint64(vm.envUint("FUNCTIONS_SUBSCRIPTION_ID"));
        uint256 gasU = vm.envOr("FUNCTIONS_CALLBACK_GAS_LIMIT", uint256(500_000));
        if (gasU > type(uint32).max) revert("FUNCTIONS_CALLBACK_GAS_LIMIT too large");
        uint32 gasLimit = uint32(gasU);

        bytes32 donId = vm.envExists("FUNCTIONS_DON_ID") ? vm.envBytes32("FUNCTIONS_DON_ID") : DON_ID_ETH_SEPOLIA;

        string memory srcPath = vm.envOr("FUNCTIONS_JS_PATH", string("script/chainlink/functions-settlement-source.js"));
        string memory source = vm.readFile(srcPath);

        vm.startBroadcast(pk);
        bytes32 reqId = FunctionsSettlement(settlementAddr).sendSettlementRequestWithRepay(
            tid, repayWei, subId, gasLimit, donId, source
        );
        vm.stopBroadcast();

        console2.log("sendSettlementRequestWithRepay done");
        console2.log("subscriptionId:", subId);
        console2.log("tokenId:", tid);
        console2.log("repayWei:", repayWei);
        console2.log("requestId:");
        console2.logBytes32(reqId);
    }
}
