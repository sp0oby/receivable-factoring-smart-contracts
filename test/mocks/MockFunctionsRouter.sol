// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFunctionsClient} from "chainlink/functions/v1_0_0/interfaces/IFunctionsClient.sol";

/// @dev Minimal router stub for unit tests (implements only the send path used by FunctionsClient).
contract MockFunctionsRouter {
    function sendRequest(uint64 subscriptionId, bytes calldata data, uint16 dataVersion, uint32 callbackGasLimit, bytes32 donId)
        external
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(msg.sender, subscriptionId, data, dataVersion, callbackGasLimit, donId));
    }

    function fulfill(address client, bytes32 requestId, bytes memory response, bytes memory err) external {
        IFunctionsClient(client).handleOracleFulfillment(requestId, response, err);
    }
}
