// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {PositionMath} from "../src/libraries/PositionMath.sol";

contract PositionMathTest is Test {
    function testRoundingFavorsSolvency() public pure {
        (uint256 profit, int256 gain) = PositionMath.payout(10, 10, 3, 4, true, 10);
        (uint256 loss, int256 drawdown) = PositionMath.payout(10, 10, 3, 2, true, 10);
        assertEq(profit, 13);
        assertEq(gain, 3);
        assertEq(loss, 6);
        assertEq(drawdown, -4);
        assertEq(PositionMath.maintenance(10, 3, 4, 500), 1);
    }

    function testFlatQuotePreservesPrincipal() public pure {
        (uint256 equity, int256 pnl) = PositionMath.payout(1_000, 5_000, 200, 200, true, 1_000);
        assertEq(equity, 1_000);
        assertEq(pnl, 0);
    }

    function testExactMaintenanceBoundary() public pure {
        (uint256 equity,) = PositionMath.payout(100, 100, 100, 50, true, 20);
        assertEq(equity, PositionMath.maintenance(100, 100, 50, 10_000));
    }

    function testFuzzBoundedPayout(uint96 collateralSeed, uint64 entrySeed, uint64 priceSeed, bool isLong)
        public
    {
        uint256 collateral = bound(collateralSeed, 1, 1e24);
        uint256 entry = bound(entrySeed, 1, 1e18);
        uint256 price = bound(priceSeed, 1, 1e18);
        uint256 reserve = collateral / 2;
        (uint256 equity, int256 pnl) =
            PositionMath.payout(collateral, collateral * 5, entry, price, isLong, reserve);
        assertLe(equity, collateral + reserve);
        assertEq(int256(equity), int256(collateral) + pnl);
        assertGe(pnl, -int256(collateral));
        assertLe(pnl, int256(reserve));
    }
}
