// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DeltaVaultMVP} from "./DeltaVaultMVP.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Read-only quotes for the testnet utility. Quotes are not execution guarantees.
contract DeltaVaultLens {
    uint256 private constant BPS = 10_000;

    struct MarketState {
        uint256 liquidity;
        uint256 totalShares;
        uint256 reserved;
        uint256 availableLiquidity;
        uint256 capacity;
        uint256 remainingCapacity;
        uint256 utilizationBps;
        uint256 price;
        uint64 updatedAt;
        bool enabled;
        bool fresh;
        bool paused;
    }

    struct AccountState {
        uint256 walletCollateral;
        uint256 allowance;
        uint256 shares;
        uint256 shareValue;
        uint256 redeemableShares;
    }

    struct PositionState {
        address trader;
        bytes32 marketId;
        uint256 collateralAmount;
        uint256 notional;
        uint256 entryPrice;
        uint256 markPrice;
        uint256 payout;
        int256 pnl;
        bool isLong;
        bool active;
        bool fresh;
        bool liquidatable;
    }

    struct OpenQuote {
        uint256 notional;
        uint256 entryPrice;
        uint256 maximumProfit;
        uint256 maximumPayout;
        uint256 remainingCapacity;
    }

    /// @notice Reserve units are maximum capped trader profit, not trader collateral.
    function marketState(DeltaVaultMVP vault, bytes32 id)
        public view returns (MarketState memory state)
    {
        (state.liquidity, state.totalShares, state.reserved, state.price,
            state.updatedAt, state.enabled) = vault.markets(id);
        state.availableLiquidity = state.liquidity - state.reserved;
        state.capacity = Math.mulDiv(state.liquidity, 80, 100);
        state.remainingCapacity = state.capacity > state.reserved
            ? state.capacity - state.reserved : 0;
        state.utilizationBps = state.liquidity == 0 ? 0
            : Math.mulDiv(state.reserved, BPS, state.liquidity);
        state.fresh = state.updatedAt != 0
            && block.timestamp - state.updatedAt <= vault.MAX_AGE();
        state.paused = vault.paused();
    }

    /// @notice Floor share value; ceil required backing prevents an excessive exit quote.
    function accountState(DeltaVaultMVP vault, bytes32 id, address account)
        external view returns (AccountState memory state)
    {
        MarketState memory market = marketState(vault, id);
        state.walletCollateral = vault.collateral().balanceOf(account);
        state.allowance = vault.collateral().allowance(account, address(vault));
        state.shares = vault.shares(id, account);
        if (market.totalShares == 0 || market.liquidity == 0) return state;
        state.shareValue = Math.mulDiv(state.shares, market.liquidity, market.totalShares);
        // Largest share burn whose floor-rounded assets fit the unreserved liquidity.
        uint256 boundary = Math.mulDiv(
            market.availableLiquidity + 1, market.totalShares, market.liquidity,
            Math.Rounding.Ceil
        );
        state.redeemableShares = Math.min(state.shares, boundary == 0 ? 0 : boundary - 1);
    }

    function quoteDeposit(DeltaVaultMVP vault, bytes32 id, uint256 amount)
        external view returns (uint256 mintedShares)
    {
        MarketState memory market = marketState(vault, id);
        require(market.enabled && !market.paused, "market unavailable");
        require(amount > 0 && amount <= vault.MAX_AMOUNT(), "invalid deposit");
        mintedShares = market.totalShares == 0 ? amount
            : Math.mulDiv(amount, market.totalShares, market.liquidity);
        require(mintedShares > 0, "deposit too small");
    }

    /// @notice Withdrawals remain quotable while the vault is paused.
    function quoteWithdraw(DeltaVaultMVP vault, bytes32 id, address account, uint256 burned)
        external view returns (uint256 amount)
    {
        MarketState memory market = marketState(vault, id);
        require(burned > 0 && burned <= vault.shares(id, account), "invalid shares");
        amount = Math.mulDiv(burned, market.liquidity, market.totalShares);
        require(amount > 0 && amount <= market.availableLiquidity, "liquidity reserved");
    }

    /// @notice Quotes use exactly the same fixed MVP capacity and leverage bounds.
    function quoteOpen(DeltaVaultMVP vault, bytes32 id, uint256 amount, uint8 leverage)
        external view returns (OpenQuote memory quote)
    {
        MarketState memory market = marketState(vault, id);
        require(market.enabled && market.fresh && !market.paused, "market unavailable");
        require(amount > 0 && amount <= vault.MAX_AMOUNT(), "invalid size");
        require(leverage >= 1 && leverage <= vault.MAX_LEVERAGE(), "invalid leverage");
        quote.notional = amount * leverage;
        require(quote.notional <= market.remainingCapacity, "capacity exceeded");
        quote.entryPrice = market.price;
        quote.maximumProfit = quote.notional;
        quote.maximumPayout = amount + quote.notional;
        quote.remainingCapacity = market.remainingCapacity - quote.notional;
    }

    /// @notice Inactive positions retain identity but do not advertise an executable payout.
    function positionState(DeltaVaultMVP vault, uint256 id)
        external view returns (PositionState memory state)
    {
        (state.trader, state.marketId, state.collateralAmount, state.notional,
            state.entryPrice, state.isLong, state.active) = vault.positions(id);
        require(state.trader != address(0), "unknown position");
        MarketState memory market = marketState(vault, state.marketId);
        state.markPrice = market.price;
        state.fresh = market.fresh;
        if (!state.active) return state;
        state.pnl = vault.pnl(id);
        state.payout = state.pnl >= 0
            ? state.collateralAmount + uint256(state.pnl)
            : state.collateralAmount - uint256(-state.pnl);
        state.liquidatable = state.fresh
            && state.pnl <= -int256(Math.mulDiv(state.collateralAmount, 80, 100));
    }
}
