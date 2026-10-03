// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceSource} from "../../src/interfaces/IPriceSource.sol";

/// @notice Development-only manual price publisher; not a verified market data feed.
contract DevelopmentPriceSource is IPriceSource, Ownable {
    bytes32 public immutable marketId;
    uint256 public price;
    uint256 public updatedAt;
    bool public failing;
    event DevelopmentPricePublished(uint256 price, uint256 timestamp);

    constructor(bytes32 id, address publisher) Ownable(publisher) {
        marketId = id;
    }

    function publish(uint256 value, uint256 timestamp) external onlyOwner {
        price = value;
        updatedAt = timestamp;
        emit DevelopmentPricePublished(value, timestamp);
    }

    function setFailing(bool value) external onlyOwner {
        failing = value;
    }

    function latestPrice() external view returns (uint256, uint256) {
        require(!failing, "Development source failure");
        return (price, updatedAt);
    }
}
