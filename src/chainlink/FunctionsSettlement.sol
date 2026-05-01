// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {FunctionsClient} from "chainlink/functions/v1_3_0/FunctionsClient.sol";
import {FunctionsRequest} from "chainlink/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {FactoringVault} from "../FactoringVault.sol";

/// @title Chainlink Functions consumer that settles receivables from ABI-encoded responses.
/// @dev Response must be `abi.encode(uint256 tokenId, uint256 repaidAmount)` from the DON JS.
contract FunctionsSettlement is FunctionsClient, AccessControl {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public constant REQUESTER_ROLE = keccak256("REQUESTER_ROLE");

    FactoringVault public immutable vault;
    mapping(bytes32 requestId => uint256 tokenId) public pendingTokenByRequest;

    error UnexpectedRequestID(bytes32 requestId);
    error FulfillmentError(bytes err);

    constructor(address functionsRouter, address vault_, address admin) FunctionsClient(functionsRouter) {
        vault = FactoringVault(vault_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REQUESTER_ROLE, admin);
    }

    /// @notice **Legacy** entrypoint (reference Sepolia deployment): only `args[0]` = token id is passed to JS — embed repayment in the source string (see `SendFunctionsSettlement.s.sol`).
    // slither-disable-start reentrancy-benign
    function sendSettlementRequest(
        uint256 tokenId,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 donId,
        string calldata javaScriptSource
    ) external onlyRole(REQUESTER_ROLE) returns (bytes32 requestId) {
        string[] memory reqArgs = new string[](1);
        reqArgs[0] = Strings.toString(tokenId);
        FunctionsRequest.Request memory req = FunctionsRequest.Request({
            codeLocation: FunctionsRequest.Location.Inline,
            secretsLocation: FunctionsRequest.Location.Inline,
            language: FunctionsRequest.CodeLanguage.JavaScript,
            source: javaScriptSource,
            encryptedSecretsReference: "",
            args: reqArgs,
            bytesArgs: new bytes[](0)
        });

        bytes memory cbor = req.encodeCBOR();
        requestId = _sendRequest(cbor, subscriptionId, callbackGasLimit, donId);
        pendingTokenByRequest[requestId] = tokenId;
    }

    /// @notice New deploys: passes `args[0]` = token id and `args[1]` = repayment in wei as decimal strings.
    function sendSettlementRequestWithRepay(
        uint256 tokenId,
        uint256 repaidAmountWei,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 donId,
        string calldata javaScriptSource
    ) external onlyRole(REQUESTER_ROLE) returns (bytes32 requestId) {
        string[] memory reqArgs = new string[](2);
        reqArgs[0] = Strings.toString(tokenId);
        reqArgs[1] = Strings.toString(repaidAmountWei);
        FunctionsRequest.Request memory req = FunctionsRequest.Request({
            codeLocation: FunctionsRequest.Location.Inline,
            secretsLocation: FunctionsRequest.Location.Inline,
            language: FunctionsRequest.CodeLanguage.JavaScript,
            source: javaScriptSource,
            encryptedSecretsReference: "",
            args: reqArgs,
            bytesArgs: new bytes[](0)
        });

        bytes memory cbor = req.encodeCBOR();
        requestId = _sendRequest(cbor, subscriptionId, callbackGasLimit, donId);
        pendingTokenByRequest[requestId] = tokenId;
    }

    // slither-disable-end reentrancy-benign

    function _fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        if (err.length != 0) revert FulfillmentError(err);
        uint256 expectedToken = pendingTokenByRequest[requestId];
        if (expectedToken == 0) revert UnexpectedRequestID(requestId);
        delete pendingTokenByRequest[requestId];

        (uint256 tokenId, uint256 repaid) = abi.decode(response, (uint256, uint256));
        if (tokenId != expectedToken) revert UnexpectedRequestID(requestId);

        vault.applyExternalSettlement(tokenId, repaid);
    }
}
