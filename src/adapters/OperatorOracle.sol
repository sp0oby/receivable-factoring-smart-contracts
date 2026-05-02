// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FactoringVault} from "../FactoringVault.sol";

/// @dev Local/dev oracle: operator transfers `asset` in, then settlement is applied on the vault.
contract OperatorOracle is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    FactoringVault public immutable vault;

    event RepaymentReported(uint256 indexed tokenId, uint256 amount, address indexed operator);

    constructor(address vault_, address admin) {
        vault = FactoringVault(vault_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /// @notice Pulls repayment from caller into the vault, then applies oracle settlement.
    function reportRepayment(uint256 tokenId, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        IERC20 a = IERC20(vault.asset());
        a.safeTransferFrom(msg.sender, address(vault), amount);
        vault.applyExternalSettlement(tokenId, amount);
        emit RepaymentReported(tokenId, amount, msg.sender);
    }
}
