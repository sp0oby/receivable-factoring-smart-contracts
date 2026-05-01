// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

/// @dev Load `PRIVATE_KEY`-style env vars as `uint256`; accepts hex **with or without** `0x` (Forge `envUint` requires `0x`).
abstract contract ScriptPk is Script {
    function envPrivateKey(string memory name) internal view returns (uint256) {
        return _parsePk(vm.envString(name));
    }

    function envPrivateKeyOr(string memory name, uint256 defaultPk) internal view returns (uint256) {
        if (!vm.envExists(name)) return defaultPk;
        return _parsePk(vm.envString(name));
    }

    function _parsePk(string memory k) internal view returns (uint256) {
        bytes memory b = bytes(k);
        if (b.length >= 2 && b[0] == 0x30 && (b[1] == 0x78 || b[1] == 0x58)) {
            return vm.parseUint(k);
        }
        return vm.parseUint(string.concat("0x", k));
    }
}
