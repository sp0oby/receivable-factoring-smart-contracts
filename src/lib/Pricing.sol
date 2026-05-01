// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Utilization-dependent factoring discount curve.
library Pricing {
    struct Params {
        /// @dev Discount when utilization is 0 (basis points).
        uint16 baseDiscountBps;
        /// @dev Maximum total discount (basis points).
        uint16 maxDiscountBps;
        /// @dev Extra bps added per 1% utilization (100 bps steps).
        uint16 slopeBps;
    }

    /// @param utilizationBps utilization in basis points (0 - 10000).
    function discountBps(uint256 utilizationBps, Params memory p) internal pure returns (uint16) {
        if (utilizationBps > 10_000) utilizationBps = 10_000;
        uint256 extra;
        uint256 d;
        unchecked {
            extra = (utilizationBps * uint256(p.slopeBps)) / 10_000;
            d = uint256(p.baseDiscountBps) + extra;
        }
        if (d > p.maxDiscountBps) d = p.maxDiscountBps;
        // Explicit bound for static analyzers — value already capped by params in normal configs.
        if (d > type(uint16).max) d = type(uint16).max;
        return uint16(d);
    }
}
