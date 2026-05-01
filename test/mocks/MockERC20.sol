// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    bool public attackOn;
    address public attackTarget;
    bytes public attackData;

    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address target, bytes calldata data) external {
        attackOn = true;
        attackTarget = target;
        attackData = data;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attackOn && from != address(0) && to != address(0)) {
            (bool ok,) = attackTarget.call(attackData);
            ok;
        }
    }
}
