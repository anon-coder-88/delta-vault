// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DeltaVaultMVP} from "../DeltaVaultMVP.sol";
import {DeltaVaultLens} from "../DeltaVaultLens.sol";
import {MockUSD} from "../MockUSD.sol";
import {FeeToken} from "./FeeToken.sol";

/// @notice Separate callers exercise LP/trader permissions without impersonation.
contract TestActor {
    function claim(MockUSD token) external { token.faucet(); }
    function deposit(MockUSD token, DeltaVaultMVP vault, bytes32 market, uint256 amount) external {
        token.approve(address(vault), amount);
        vault.deposit(market, amount);
    }
    function withdraw(DeltaVaultMVP vault, bytes32 market, uint256 shares) external {
        vault.withdraw(market, shares);
    }
    function open(MockUSD token, DeltaVaultMVP vault, bytes32 market, uint256 amount, uint8 leverage, bool isLong)
        external returns (uint256)
    {
        token.approve(address(vault), amount);
        return vault.openPosition(market, amount, leverage, isLong);
    }
    function close(DeltaVaultMVP vault, uint256 id) external { vault.closePosition(id); }
}

/// @notice Executed by Hardhat on the local chain; every scenario deploys fresh state.
contract DeltaVaultScenarioTest {
    bytes32 private constant BTC = keccak256("BTC-USD");
    bytes32 private constant ETH = keccak256("ETH-USD");
    uint256 private constant USD = 1e6;
    uint256 private constant PRICE = 1e8;

    function fixture() private returns (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) {
        token = new MockUSD();
        vault = new DeltaVaultMVP(token, address(this));
        lp = new TestActor();
        trader = new TestActor();
        lp.claim(token);
        trader.claim(token);
        vault.createMarket(BTC, 60_000 * PRICE);
        lp.deposit(token, vault, BTC, 1_000 * USD);
    }

    function testLongSettlement() external {
        (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) = fixture();
        require(vault.shares(BTC, address(lp)) == 1_000 * USD, "share mint");
        trader.open(token, vault, BTC, 100 * USD, 3, true);
        vault.setPrice(BTC, 66_000 * PRICE);
        require(vault.pnl(1) == int256(30 * USD), "long pnl");
        trader.close(vault, 1);
        require(token.balanceOf(address(trader)) == 10_030 * USD, "trader payout");
        (uint256 liquidity,, uint256 reserved,,,) = vault.markets(BTC);
        require(liquidity == 970 * USD && reserved == 0, "LP settlement");
        lp.withdraw(vault, BTC, 1_000 * USD);
        require(token.balanceOf(address(lp)) == 9_970 * USD, "LP exit");
        require(token.balanceOf(address(vault)) == 0, "escrow conservation");
    }

    function testShortSettlement() external {
        (MockUSD token, DeltaVaultMVP vault,, TestActor trader) = fixture();
        trader.open(token, vault, BTC, 100 * USD, 3, false);
        vault.setPrice(BTC, 54_000 * PRICE);
        require(vault.pnl(1) == int256(30 * USD), "short pnl");
        trader.close(vault, 1);
        require(token.balanceOf(address(trader)) == 10_030 * USD, "short payout");
    }

    function testCapacityAndPause() external {
        (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) = fixture();
        try trader.open(token, vault, BTC, 200 * USD, 5, true) { revert("excess capacity accepted"); } catch {}
        trader.open(token, vault, BTC, 160 * USD, 5, true); // Exactly 80% capacity.
        try trader.open(token, vault, BTC, 1, 1, true) { revert("capacity increment accepted"); } catch {}
        try lp.withdraw(vault, BTC, 1_000 * USD) { revert("reserved exit accepted"); } catch {}
        vault.pause();
        try lp.deposit(token, vault, BTC, USD) { revert("paused deposit accepted"); } catch {}
        try trader.open(token, vault, BTC, USD, 1, true) { revert("paused trade accepted"); } catch {}
        trader.close(vault, 1); // Exits remain available during pause.
        lp.withdraw(vault, BTC, 1_000 * USD);
        require(token.balanceOf(address(vault)) == 0, "pause exit accounting");
    }

    function testLiquidationAndOwnership() external {
        (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) = fixture();
        trader.open(token, vault, BTC, 100 * USD, 5, true);
        try lp.close(vault, 1) { revert("foreign close accepted"); } catch {}
        try vault.liquidate(1) { revert("healthy liquidation accepted"); } catch {}
        vault.setPrice(BTC, 48_000 * PRICE);
        vault.liquidate(1);
        (,,,,,, bool active) = vault.positions(1);
        require(!active, "liquidation terminal state");
        (uint256 liquidity,,,,,) = vault.markets(BTC);
        require(liquidity == 1_100 * USD, "loss credits LP");
        require(token.balanceOf(address(trader)) == 9_900 * USD, "loss cap");
        try vault.liquidate(1) { revert("duplicate liquidation accepted"); } catch {}
        try trader.close(vault, 1) { revert("closed position settled twice"); } catch {}
    }

    function testMarketIsolation() external {
        (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) = fixture();
        vault.createMarket(ETH, 3_000 * PRICE);
        lp.deposit(token, vault, ETH, 500 * USD);
        trader.open(token, vault, BTC, 100 * USD, 3, true);
        vault.setPrice(BTC, 66_000 * PRICE);
        trader.close(vault, 1);
        (uint256 btc,,,,,) = vault.markets(BTC);
        (uint256 eth,,uint256 reserve,,,) = vault.markets(ETH);
        require(btc == 970 * USD && eth == 500 * USD && reserve == 0, "markets cross-subsidized");
        require(vault.shares(ETH, address(lp)) == 500 * USD, "ETH shares mutated");
    }

    function testFeeTokenRejection(FeeToken token) external {
        DeltaVaultMVP vault = new DeltaVaultMVP(token, address(this));
        vault.createMarket(BTC, 60_000 * PRICE);
        token.approve(address(vault), 1_000 * USD);
        try vault.deposit(BTC, 1_000 * USD) { revert("tax collateral accepted"); } catch {}
        (uint256 liquidity,,,,,) = vault.markets(BTC);
        require(liquidity == 0 && token.balanceOf(address(vault)) == 0, "failed deposit changed accounting");
    }

    function testLensQuotes(DeltaVaultLens lens) external {
        (MockUSD token, DeltaVaultMVP vault, TestActor lp, TestActor trader) = fixture();
        require(lens.quoteDeposit(vault, BTC, 100 * USD) == 100 * USD, "deposit quote");
        DeltaVaultLens.OpenQuote memory quote = lens.quoteOpen(vault, BTC, 100 * USD, 3);
        require(quote.notional == 300 * USD && quote.remainingCapacity == 500 * USD, "open quote");
        trader.open(token, vault, BTC, 100 * USD, 3, true);
        DeltaVaultLens.AccountState memory account = lens.accountState(vault, BTC, address(lp));
        require(account.shareValue == 1_000 * USD && account.redeemableShares == 700 * USD, "redeem quote");
        require(lens.quoteWithdraw(vault, BTC, address(lp), 700 * USD) == 700 * USD, "withdraw quote");
        vault.setPrice(BTC, 66_000 * PRICE);
        DeltaVaultLens.PositionState memory position = lens.positionState(vault, 1);
        require(position.pnl == int256(30 * USD) && position.payout == 130 * USD, "position quote");
        trader.close(vault, 1);
        position = lens.positionState(vault, 1);
        require(!position.active && position.payout == 0, "closed quote executable");
    }
}
