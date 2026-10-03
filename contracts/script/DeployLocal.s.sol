// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {MarketVault} from "../src/MarketVault.sol";
import {DevelopmentAsset} from "../test/fixtures/DevelopmentAsset.sol";
import {DevelopmentPriceSource} from "../test/fixtures/DevelopmentPriceSource.sol";

/// @notice Local-only deployment with unlocked Anvil accounts. No private key is committed.
contract DeployLocal is Script {
    function run()
        external
        returns (DevelopmentAsset token, DevelopmentPriceSource source, MarketVault vault)
    {
        require(block.chainid == 31337, "Local chain only");
        address deployer = vm.envAddress("LOCAL_DEPLOYER");
        bytes32 id = keccak256("DEVELOPMENT:ETH-USD");
        vm.startBroadcast(deployer);
        token = new DevelopmentAsset();
        source = new DevelopmentPriceSource(id, deployer);
        source.publish(2_000e8, block.timestamp);
        vault = new MarketVault(token, source, id, deployer, localConfig());
        vm.stopBroadcast();
    }

    /// @dev Explicit engineering proposals, all configurable before positions open.
    function localConfig() public pure returns (MarketVault.Config memory) {
        return MarketVault.Config({
            depositCap: 1_000_000e6,
            maxPosition: 10_000e6,
            maxExposure: 100_000e6,
            minCollateral: 1e6,
            maxLeverageBps: 50_000,
            maintenanceBps: 500,
            profitCapBps: 2_000,
            maxUtilizationBps: 8_000,
            priceMaxAge: 300,
            positionDuration: 1 hours,
            refundDelay: 1 hours
        });
    }
}
