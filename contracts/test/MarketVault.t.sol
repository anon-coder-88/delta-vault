// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MarketVault} from "../src/MarketVault.sol";
import {DeployLocal} from "../script/DeployLocal.s.sol";
import {DevelopmentAsset} from "./fixtures/DevelopmentAsset.sol";
import {DevelopmentPriceSource} from "./fixtures/DevelopmentPriceSource.sol";

contract MarketVaultTest is Test {
    DevelopmentAsset internal token;
    DevelopmentPriceSource internal oracle;
    MarketVault internal vault;
    MarketVault.Config internal config;
    bytes32 internal constant MARKET = keccak256("DEVELOPMENT:ETH-USD");
    address internal lp = makeAddr("lp");
    address internal trader = makeAddr("trader");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(1_000_000);
        token = new DevelopmentAsset();
        oracle = new DevelopmentPriceSource(MARKET, address(this));
        config = new DeployLocal().localConfig();
        vault = new MarketVault(token, oracle, MARKET, address(this), config);
        oracle.publish(2_000e8, block.timestamp);
        token.mint(lp, 20_000e6);
        token.mint(trader, 5_000e6);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);
        vm.prank(trader);
        token.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(10_000e6, lp);
    }

    function _open(bool isLong) internal returns (uint256) {
        vm.prank(trader);
        return vault.openPosition(1_000e6, 50_000, isLong, 2_000e8, 2_000e8, block.timestamp);
    }

    function _close(uint256 id, uint256 price) internal {
        oracle.publish(price, block.timestamp);
        vm.prank(trader);
        vault.closePosition(id, price, price, block.timestamp);
    }

    function testCompleteLongJourneyConservesAssets() public {
        uint256 id = _open(true);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(vault.escrowedCollateral(), 1_000e6);
        assertEq(vault.reservedProfit(), 1_000e6);
        _close(id, 2_200e8);
        assertEq(vault.claims(trader), 1_500e6);
        assertEq(vault.totalAssets(), 9_500e6);
        assertEq(vault.openCount(), 0);
        vm.prank(trader);
        vault.withdrawClaim(trader);
        assertEq(token.balanceOf(trader), 5_500e6);
        assertEq(vault.totalAssets(), 9_500e6);
        uint256 allShares = vault.balanceOf(lp);
        vm.prank(lp);
        uint256 redeemed = vault.redeem(allShares, lp, lp);
        // One virtual asset introduces at most one base unit of residual at this scale.
        assertApproxEqAbs(redeemed, 9_500e6, 1);
        assertEq(token.balanceOf(lp) + token.balanceOf(trader) + token.balanceOf(address(vault)), 25_000e6);
        assertEq(vault.totalClaims(), 0);
    }

    function testShortProfitAndLongLoss() public {
        uint256 shortId = _open(false);
        _close(shortId, 1_800e8);
        assertEq(vault.claims(trader), 1_500e6);
        oracle.publish(2_000e8, block.timestamp);
        uint256 longId = _open(true); // Refresh entry back to 2000 before opening.
        _close(longId, 1_800e8);
        assertEq(vault.claims(trader), 2_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
    }

    function testProfitAndLossCaps() public {
        uint256 id = _open(true);
        _close(id, 20_000e8);
        assertEq(vault.claims(trader), 2_000e6);
        oracle.publish(2_000e8, block.timestamp);
        id = _open(true);
        _close(id, 1);
        assertEq(vault.claims(trader), 2_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
    }

    function testLiquidationCreditsRemainingEquityAndCannotRepeat() public {
        uint256 id = _open(true);
        oracle.publish(1_600e8, block.timestamp);
        vm.prank(stranger);
        vault.liquidate(id);
        (,, MarketVault.Status status,,,,,) = vault.positions(id);
        assertEq(uint256(status), uint256(MarketVault.Status.Liquidated));
        assertEq(vault.claims(trader), 0);
        assertEq(vault.totalAssets(), 11_000e6);
        vm.expectRevert(MarketVault.PositionNotOpen.selector);
        vault.liquidate(id);
    }

    function testMaintenanceUsesCurrentExposure() public {
        uint256 id = _open(false);
        oracle.publish(2_300e8, block.timestamp);
        (uint256 equity,, bool eligible) = vault.quotePosition(id);
        assertEq(equity, 250e6);
        assertTrue(eligible); // Current notional 5750, maintenance 287.5.
        vault.liquidate(id);
        assertEq(vault.claims(trader), 250e6);
    }

    function testHealthyPositionRejectsLiquidation() public {
        uint256 id = _open(true);
        vm.expectRevert(MarketVault.HealthyPosition.selector);
        vault.liquidate(id);
        assertEq(vault.openCount(), 1);
    }

    function testOnlyTraderClosesAndOnlyOwnerChangesConfig() public {
        uint256 id = _open(true);
        vm.prank(stranger);
        vm.expectRevert(MarketVault.NotTrader.selector);
        vault.closePosition(id, 1, 3_000e8, block.timestamp);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setOpeningsPaused(true);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setConfig(config);
        vm.expectRevert(MarketVault.LiquidityLocked.selector);
        vault.setConfig(config);
    }

    function testTwoStepOwnershipTransfer() public {
        vault.transferOwnership(stranger);
        assertEq(vault.owner(), address(this));
        vm.prank(trader);
        vm.expectRevert();
        vault.acceptOwnership();
        vm.prank(stranger);
        vault.acceptOwnership();
        assertEq(vault.owner(), stranger);
    }

    function testPausePreservesSettlementClaimsAndRedemption() public {
        uint256 id = _open(true);
        vault.setOpeningsPaused(true);
        vm.prank(trader);
        vm.expectRevert(MarketVault.OpeningsPaused.selector);
        vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp);
        _close(id, 2_000e8);
        vm.prank(trader);
        vault.withdrawClaim(stranger);
        assertEq(token.balanceOf(stranger), 1_000e6);
        vm.prank(lp);
        vault.withdraw(1e6, lp, lp);
        assertEq(vault.maxDeposit(lp), 0);
    }

    function testEveryLpEntryAndExitIsFrozenWhileOpen() public {
        _open(true);
        assertEq(vault.maxDeposit(lp), 0);
        assertEq(vault.maxMint(lp), 0);
        assertEq(vault.maxWithdraw(lp), 0);
        assertEq(vault.maxRedeem(lp), 0);
        vm.startPrank(lp);
        vm.expectRevert();
        vault.deposit(1, lp);
        vm.expectRevert();
        vault.mint(1, lp);
        vm.expectRevert();
        vault.withdraw(1, lp, lp);
        vm.expectRevert();
        vault.redeem(1, lp, lp);
        vm.stopPrank();
        assertEq(vault.openCount(), 1);
    }

    function testZeroInputsAndInvalidReceiver() public {
        vm.startPrank(lp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.deposit(0, lp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.mint(0, lp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.withdraw(0, lp, lp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.redeem(0, lp, lp);
        vm.expectRevert(MarketVault.InvalidReceiver.selector);
        vault.deposit(1, address(vault));
        vm.stopPrank();
        vm.startPrank(trader);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.openPosition(0, 10_000, true, 1, 3_000e8, block.timestamp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.openPosition(1, 9_999, true, 1, 3_000e8, block.timestamp);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.openPosition(1, 50_001, true, 1, 3_000e8, block.timestamp);
        vm.stopPrank();
    }

    function testPriceAgeBoundaryAndFutureTimestamp() public {
        oracle.publish(2_000e8, block.timestamp - config.priceMaxAge);
        _open(true);
        vm.warp(block.timestamp + 1);
        vm.expectRevert(MarketVault.StalePrice.selector);
        vault.validatedPrice();
        oracle.publish(2_000e8, vm.getBlockTimestamp() + 1);
        vm.expectRevert(MarketVault.InvalidPrice.selector);
        vault.validatedPrice();
    }

    function testMalformedAndFailingPrices() public {
        oracle.publish(0, block.timestamp);
        vm.expectRevert(MarketVault.InvalidPrice.selector);
        vault.validatedPrice();
        oracle.publish(vault.MAX_PRICE() + 1, block.timestamp);
        vm.expectRevert(MarketVault.InvalidPrice.selector);
        vault.validatedPrice();
        oracle.publish(2_000e8, 0);
        vm.expectRevert(MarketVault.InvalidPrice.selector);
        vault.validatedPrice();
        oracle.setFailing(true);
        vm.expectRevert("Development source failure");
        vault.validatedPrice();
    }

    function testSlippageAndTransactionDeadline() public {
        vm.startPrank(trader);
        vm.expectRevert(MarketVault.PriceOutsideBounds.selector);
        vault.openPosition(1e6, 10_000, true, 2_001e8, 2_002e8, block.timestamp);
        vm.expectRevert(MarketVault.DeadlinePassed.selector);
        vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp - 1);
        vm.stopPrank();
        uint256 id = _open(true);
        vm.prank(trader);
        vm.expectRevert(MarketVault.PriceOutsideBounds.selector);
        vault.closePosition(id, 1, 1_999e8, block.timestamp);
        assertEq(vault.openCount(), 1);
    }

    function testPositionAndExposureLimitsExactBoundary() public {
        config.maxPosition = 5_000e6;
        config.maxExposure = 5_000e6;
        vault.setConfig(config);
        _open(true);
        vm.prank(trader);
        vm.expectRevert(MarketVault.CapacityExceeded.selector);
        vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp);
    }

    function testReserveCapacityExactBoundary() public {
        config.maxUtilizationBps = 1_000; // Exactly 1000 reserve against 10000 LP assets.
        vault.setConfig(config);
        _open(true);
        assertEq(vault.reservedProfit(), 1_000e6);
        vm.prank(trader);
        vm.expectRevert(MarketVault.CapacityExceeded.selector);
        vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp);
    }

    function testDepositCapBoundaryAndDonation() public {
        config.depositCap = 10_001e6;
        vault.setConfig(config);
        vm.prank(lp);
        vault.deposit(1e6, lp);
        assertEq(vault.maxDeposit(lp), 0);
        vm.prank(lp);
        token.transfer(address(vault), 1e6);
        assertEq(vault.maxDeposit(lp), 0);
        assertEq(vault.totalAssets(), 10_002e6);
    }

    function testExpiredSettlementAndSingleTerminalState() public {
        uint256 id = _open(true);
        vm.expectRevert(MarketVault.NotExpired.selector);
        vault.expire(id);
        vm.warp(block.timestamp + config.positionDuration);
        oracle.publish(2_100e8, block.timestamp);
        vault.expire(id);
        assertEq(vault.claims(trader), 1_250e6);
        vm.prank(trader);
        vm.expectRevert(MarketVault.PositionNotOpen.selector);
        vault.closePosition(id, 1, 3_000e8, block.timestamp);
        vm.expectRevert(MarketVault.PositionNotOpen.selector);
        vault.expire(id);
        vm.expectRevert(MarketVault.PositionNotOpen.selector);
        vault.refundAfterOracleFailure(id);
    }

    function testStaleOracleRecoveryAfterDelay() public {
        uint256 id = _open(true);
        vm.expectRevert(MarketVault.RecoveryUnavailable.selector);
        vault.refundAfterOracleFailure(id);
        vm.warp(block.timestamp + config.positionDuration + config.refundDelay);
        vault.refundAfterOracleFailure(id);
        assertEq(vault.claims(trader), 1_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(vault.reservedProfit(), 0);
        vm.prank(lp);
        vault.withdraw(1e6, lp, lp);
    }

    function testFreshQuotePreventsRecoveryAndFailedSourceAllowsIt() public {
        uint256 id = _open(true);
        vm.warp(block.timestamp + config.positionDuration + config.refundDelay);
        oracle.publish(2_000e8, block.timestamp);
        vm.expectRevert(MarketVault.RecoveryUnavailable.selector);
        vault.refundAfterOracleFailure(id);
        oracle.setFailing(true);
        vault.refundAfterOracleFailure(id);
        assertEq(vault.claims(trader), 1_000e6);
    }

    function testInsufficientBalanceAndAllowanceLeaveStateUntouched() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        vault.openPosition(100e6, 10_000, true, 1, 3_000e8, block.timestamp);
        vm.stopPrank();
        assertEq(vault.nextPositionId(), 1);
        assertEq(vault.openCount(), 0);
        assertEq(vault.escrowedCollateral(), 0);
    }

    function testDelegatedRedemptionNeedsShareAllowance() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.withdraw(10e6, stranger, lp);
        uint256 shares = vault.previewWithdraw(10e6);
        vm.prank(lp);
        vault.approve(stranger, shares);
        vm.prank(stranger);
        vault.withdraw(10e6, stranger, lp);
        assertEq(token.balanceOf(stranger), 10e6);
        assertEq(vault.allowance(lp, stranger), 0);
    }

    function testClaimsCannotBeStolenOrWithdrawnTwice() public {
        uint256 id = _open(true);
        _close(id, 2_000e8);
        vm.prank(stranger);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.withdrawClaim(stranger);
        vm.startPrank(trader);
        vm.expectRevert(MarketVault.InvalidReceiver.selector);
        vault.withdrawClaim(address(vault));
        vault.withdrawClaim(trader);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.withdrawClaim(trader);
        vm.stopPrank();
    }

    function testMarketIdentityIsEnforced() public {
        vm.expectRevert(MarketVault.InvalidConfig.selector);
        new MarketVault(token, oracle, bytes32(uint256(2)), address(this), config);
    }

    function testSecondMarketAccountingIsIsolated() public {
        bytes32 secondId = keccak256("DEVELOPMENT:BTC-USD");
        DevelopmentPriceSource secondSource = new DevelopmentPriceSource(secondId, address(this));
        secondSource.publish(60_000e8, block.timestamp);
        MarketVault second = new MarketVault(token, secondSource, secondId, address(this), config);
        vm.startPrank(lp);
        token.approve(address(second), 1_000e6);
        second.deposit(1_000e6, lp);
        vm.stopPrank();
        uint256 id = _open(true);
        _close(id, 2_200e8);
        assertEq(vault.totalAssets(), 9_500e6);
        assertEq(second.totalAssets(), 1_000e6);
        assertEq(second.escrowedCollateral(), 0);
        assertEq(second.totalClaims(), 0);
        assertEq(second.openExposure(), 0);
        assertEq(second.validatedPrice(), 60_000e8);
    }

    function testMaximumPositionCountRejectsNextPosition() public {
        for (uint256 i; i < vault.MAX_OPEN_POSITIONS(); i++) {
            vm.prank(trader);
            vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp);
        }
        assertEq(vault.openCount(), 64);
        vm.prank(trader);
        vm.expectRevert(MarketVault.CapacityExceeded.selector);
        vault.openPosition(1e6, 10_000, true, 1, 3_000e8, block.timestamp);
        assertEq(vault.nextPositionId(), 65);
    }

    function testSubMinimumCollateralFailsAndBoundaryPasses() public {
        vm.prank(trader);
        vm.expectRevert(MarketVault.InvalidAmount.selector);
        vault.openPosition(config.minCollateral - 1, 10_000, true, 1, 3_000e8, block.timestamp);
        vm.prank(trader);
        vault.openPosition(config.minCollateral, 10_000, true, 1, 3_000e8, block.timestamp);
        assertEq(vault.escrowedCollateral(), config.minCollateral);
    }

    function testDonationChangesSharesWithoutStealingTraderClaims() public {
        uint256 id = _open(true);
        _close(id, 2_000e8);
        uint256 before = vault.claims(trader);
        vm.prank(lp);
        token.transfer(address(vault), 10e6);
        assertEq(vault.claims(trader), before);
        assertEq(vault.totalAssets(), 10_010e6);
        assertEq(vault.totalClaims(), before);
        assertGt(vault.previewRedeem(vault.balanceOf(lp)), 10_000e6);
    }

    function testInvalidRiskConfigRejected() public {
        config.maxLeverageBps = 200_000;
        vm.expectRevert(MarketVault.InvalidConfig.selector);
        vault.setConfig(config);
        config.maxLeverageBps = 50_000;
        config.maintenanceBps = 2_000; // 20% at 5x allows no positive initial excess margin.
        vm.expectRevert(MarketVault.InvalidConfig.selector);
        vault.setConfig(config);
    }

    function testFuzzPreviewAndDepositAgree(uint96 amount) public {
        uint256 assets = bound(amount, 1, 9_000e6);
        uint256 expected = vault.previewDeposit(assets);
        vm.prank(lp);
        uint256 shares = vault.deposit(assets, lp);
        assertEq(shares, expected);
        assertLe(vault.previewRedeem(shares), assets);
    }

    function testFuzzSettlementSolvency(uint96 amount, uint64 priceSeed, bool isLong) public {
        uint256 collateral = bound(amount, 1e6, 1_000e6);
        vm.prank(trader);
        uint256 id = vault.openPosition(collateral, 50_000, isLong, 1, 3_000e8, block.timestamp);
        uint256 price = bound(priceSeed, 1, 4_000e8);
        _close(id, price);
        uint256 payout = vault.claims(trader);
        assertLe(payout, collateral * 2);
        assertEq(token.balanceOf(address(vault)), vault.totalAssets() + vault.totalClaims());
        assertEq(vault.reservedProfit(), 0);
        assertEq(vault.openExposure(), 0);
        assertGe(vault.totalAssets(), 10_000e6 - collateral);
    }
}
