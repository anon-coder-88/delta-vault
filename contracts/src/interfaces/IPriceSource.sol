// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Each source is bound to exactly one immutable market and quote convention.
/// @dev Prices use 8 decimals. Implementations must not substitute spot UI data for settlement pricing.
interface IPriceSource {
    function marketId() external view returns (bytes32);
    function latestPrice() external view returns (uint256 price, uint256 updatedAt);
}
