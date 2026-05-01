// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple Sepolia-only style test asset: **only the owner** can mint. Use when no public faucet token is in your wallet.
/// @dev Deploy via `script/DeployMockAssetSepolia.s.sol`, set `ASSET_TOKEN` to the logged address, then run `DeploySepolia`.
contract SepoliaMockAsset is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Sepolia Mock Asset", "SMA") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
