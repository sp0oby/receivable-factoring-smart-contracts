// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AutomationCompatibleInterface} from "chainlink/automation/interfaces/AutomationCompatibleInterface.sol";
import {FactoringVault} from "../FactoringVault.sol";

/// @notice Minimal upkeep contract: marks overdue receivables as defaulted.
contract FactoringAutomation is AutomationCompatibleInterface {
    FactoringVault public immutable vault;

    constructor(address vault_) {
        vault = FactoringVault(vault_);
    }

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        bool needed;
        uint256 tokenId;
        (needed, tokenId) = vault.peekNextDefaultable();
        upkeepNeeded = needed;
        performData = abi.encode(tokenId);
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256 tokenId = abi.decode(performData, (uint256));
        vault.markDefaulted(tokenId);
    }
}
