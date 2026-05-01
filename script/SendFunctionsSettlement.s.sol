// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {console2} from "forge-std/console2.sol";
import {ScriptPk} from "./ScriptPk.sol";
import {FunctionsSettlement} from "../src/chainlink/FunctionsSettlement.sol";

/// @notice Calls **legacy** `sendSettlementRequest(tokenId, subId, gas, donId, source)` — matches reference Sepolia bytecode.
/// @dev JS is built inline so `FUNCTIONS_REPAY_WEI` is included without a second Functions arg (old contracts only pass tokenId).
///      For **new** contracts with `sendSettlementRequestWithRepay`, use `SendFunctionsSettlementWithRepay.s.sol`.
contract SendFunctionsSettlement is ScriptPk {
    /// @dev Ethereum Sepolia 1 — confirm on https://docs.chain.link/chainlink-functions/supported-networks
    bytes32 internal constant DON_ID_ETH_SEPOLIA =
        0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

    /// @notice Minimal JS: `args[0]` = token id; repayment wei is injected as a decimal string literal.
    /// @dev MUST return `Uint8Array` (64 bytes = ABI `(uint256,uint256)`). Hex strings fail DON validation.
    function _inlineLegacySource(uint256 repayWei) internal pure returns (string memory) {
        return string.concat(
            'function u256word(s){const x=BigInt(s);let h=x.toString(16);if(h.length>64)throw Error("e");return h.padStart(64,"0");}const hex=u256word(args[0])+u256word("',
            Strings.toString(repayWei),
            '");if(hex.length!==128)throw Error("len");const out=new Uint8Array(64);for(let i=0;i<64;i++){const v=parseInt(hex.slice(i*2,i*2+2),16);if(Number.isNaN(v))throw Error("h");out[i]=v;}return out;'
        );
    }

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

        string memory source = vm.envExists("FUNCTIONS_JS_LEGACY_FILE")
            ? vm.readFile(vm.envString("FUNCTIONS_JS_LEGACY_FILE"))
            : _inlineLegacySource(repayWei);

        vm.startBroadcast(pk);
        bytes32 reqId = FunctionsSettlement(settlementAddr).sendSettlementRequest(tid, subId, gasLimit, donId, source);
        vm.stopBroadcast();

        console2.log("sendSettlementRequest (legacy 5-arg) done");
        console2.log("subscriptionId:", subId);
        console2.log("tokenId:", tid);
        console2.log("repayWei (embedded in JS if inline):", repayWei);
        console2.log("requestId:");
        console2.logBytes32(reqId);
    }
}
