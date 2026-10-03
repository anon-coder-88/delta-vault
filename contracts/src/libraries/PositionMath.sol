// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @notice Bounded linear exposure accounting in collateral base units.
library PositionMath {
    uint256 internal constant BPS = 10_000;

    /// @dev Truncate profit; round loss upward so dust never subsidizes traders.
    ///      Clamp before casting; allowed inputs are restricted by MarketVault.
    function payout(
        uint256 collateral,
        uint256 notional,
        uint256 entry,
        uint256 price,
        bool isLong,
        uint256 profitReserve
    ) internal pure returns (uint256 equity, int256 pnl) {
        bool gains = isLong ? price >= entry : price <= entry;
        uint256 delta = price >= entry ? price - entry : entry - price;
        uint256 magnitude =
            Math.mulDiv(notional, delta, entry, gains ? Math.Rounding.Floor : Math.Rounding.Ceil);
        if (gains) {
            magnitude = Math.min(magnitude, profitReserve);
            return (collateral + magnitude, SafeCast.toInt256(magnitude));
        }
        magnitude = Math.min(magnitude, collateral);
        return (collateral - magnitude, -SafeCast.toInt256(magnitude));
    }

    /// @dev Current marked exposure, rounded up twice to protect the maintenance boundary.
    function maintenance(uint256 notional, uint256 entry, uint256 price, uint256 rate)
        internal
        pure
        returns (uint256)
    {
        uint256 markedNotional = Math.mulDiv(notional, price, entry, Math.Rounding.Ceil);
        return Math.mulDiv(markedNotional, rate, BPS, Math.Rounding.Ceil);
    }
}
