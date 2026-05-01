// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Pricing} from "../src/lib/Pricing.sol";

contract PricingTest is Test {
    function test_discount_monotonic() public pure {
        Pricing.Params memory p =
            Pricing.Params({baseDiscountBps: 100, maxDiscountBps: 2000, slopeBps: 500});
        uint16 d0 = Pricing.discountBps(0, p);
        uint16 d5 = Pricing.discountBps(5000, p);
        uint16 d10 = Pricing.discountBps(10000, p);
        assertEq(d0, 100);
        assertTrue(d5 >= d0);
        assertTrue(d10 >= d5);
        assertEq(d10, 600);
    }

    function testFuzz_discount_capped(uint16 base, uint16 maxD, uint16 slope, uint256 util) public pure {
        vm.assume(maxD <= 2000);
        vm.assume(base <= maxD);
        vm.assume(slope <= 5000);
        Pricing.Params memory p = Pricing.Params({baseDiscountBps: base, maxDiscountBps: maxD, slopeBps: slope});
        uint16 d = Pricing.discountBps(bound(util, 0, 10000), p);
        assertTrue(d <= maxD);
    }
}
