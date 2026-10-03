// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {PositionMath} from "./libraries/PositionMath.sol";

/// @notice One isolated, bounded market funded by ERC-4626 LP shares.
/// @dev Proposed local MVP: no hedging, funding, governance token, upgrade proxy or live oracle adapter.
///      Book-value LP entry/exit is frozen while exposure exists to avoid stale-NAV arbitrage.
contract MarketVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_PRICE = 1e18;
    uint256 public constant MAX_COLLATERAL = 1e24;
    uint256 public constant MAX_OPEN_POSITIONS = 64;

    enum Status {
        Missing,
        Open,
        Closed,
        Liquidated,
        Expired,
        Refunded
    }

    struct Config {
        uint256 depositCap;
        uint256 maxPosition;
        uint256 maxExposure;
        uint256 minCollateral;
        uint32 maxLeverageBps;
        uint32 maintenanceBps;
        uint32 profitCapBps;
        uint32 maxUtilizationBps;
        uint32 priceMaxAge;
        uint32 positionDuration;
        uint32 refundDelay;
    }

    struct Position {
        address trader;
        bool isLong;
        Status status;
        uint64 deadline;
        uint256 collateral;
        uint256 notional;
        uint256 entryPrice;
        uint256 reserve;
    }

    bytes32 public immutable marketId;
    IPriceSource public immutable priceSource;
    Config public config;
    bool public openingsPaused;
    uint256 public nextPositionId = 1;
    uint256 public openCount;
    uint256 public openExposure;
    uint256 public reservedProfit;
    uint256 public escrowedCollateral;
    uint256 public totalClaims;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256) public claims;

    error InvalidConfig();
    error InvalidAmount();
    error InvalidReceiver();
    error InvalidPrice();
    error StalePrice();
    error OpeningsPaused();
    error LiquidityLocked();
    error CapacityExceeded();
    error UnsupportedAsset();
    error PositionNotOpen();
    error NotTrader();
    error HealthyPosition();
    error NotExpired();
    error RecoveryUnavailable();
    error PriceOutsideBounds();
    error DeadlinePassed();

    event PositionOpened(
        uint256 indexed id,
        address indexed trader,
        bool isLong,
        uint256 collateral,
        uint256 notional,
        uint256 price,
        uint256 reserve,
        uint256 deadline
    );
    event PositionSettled(uint256 indexed id, Status status, uint256 price, int256 pnl, uint256 payout);
    event ClaimWithdrawn(address indexed trader, address indexed receiver, uint256 amount);
    event OpeningsPauseChanged(bool paused);
    event ConfigChanged(Config newConfig);

    constructor(
        IERC20 collateralAsset,
        IPriceSource source,
        bytes32 id,
        address admin,
        Config memory initialConfig
    ) ERC20("DeltaVault Market Liquidity", "dvLP") ERC4626(collateralAsset) Ownable(admin) {
        if (address(collateralAsset).code.length == 0 || address(source).code.length == 0 || id == bytes32(0))
        {
            revert InvalidConfig();
        }
        if (source.marketId() != id) revert InvalidConfig();
        marketId = id;
        priceSource = source;
        _validateConfig(initialConfig);
        config = initialConfig;
    }

    /// @notice LP book assets exclude trader escrow and settled claims, including unwithdrawn claims.
    /// @dev Donations accrue to LPs. Rebasing assets are unsupported; balance deficit reverts loudly.
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) - escrowedCollateral - totalClaims;
    }

    function availableLiquidity() public view returns (uint256) {
        return totalAssets() - reservedProfit;
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (openCount != 0 || openingsPaused) return 0;
        uint256 assets = totalAssets();
        return assets >= config.depositCap ? 0 : config.depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _convertToShares(maxDeposit(receiver), Math.Rounding.Floor);
    }

    function maxWithdraw(address account) public view override returns (uint256) {
        return openCount == 0 ? super.maxWithdraw(account) : 0;
    }

    function maxRedeem(address account) public view override returns (uint256) {
        return openCount == 0 ? balanceOf(account) : 0;
    }

    /// @dev Extra virtual-share precision is inherited through standard OZ conversions.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// @dev Guard all four inherited ERC-4626 entry points through their shared hooks.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        if (openCount != 0) revert LiquidityLocked();
        if (receiver == address(0) || receiver == address(this)) revert InvalidReceiver();
        if (assets == 0 || shares == 0) revert InvalidAmount();
        uint256 beforeBalance = IERC20(asset()).balanceOf(address(this));
        super._deposit(caller, receiver, assets, shares);
        if (IERC20(asset()).balanceOf(address(this)) != beforeBalance + assets) revert UnsupportedAsset();
    }

    function _withdraw(address caller, address receiver, address account, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        if (openCount != 0) revert LiquidityLocked();
        if (receiver == address(0) || receiver == address(this)) revert InvalidReceiver();
        if (assets == 0 || shares == 0) revert InvalidAmount();
        uint256 beforeReceiver = IERC20(asset()).balanceOf(receiver);
        super._withdraw(caller, receiver, account, assets, shares);
        if (IERC20(asset()).balanceOf(receiver) != beforeReceiver + assets) revert UnsupportedAsset();
    }

    /// @notice Admin can change risk only with no open positions; claims remain unaffected.
    function setConfig(Config calldata next) external onlyOwner {
        if (openCount != 0) revert LiquidityLocked();
        _validateConfig(next);
        config = next;
        emit ConfigChanged(next);
    }

    /// @notice Stops new exposure and LP deposits, never settlement or withdrawals.
    function setOpeningsPaused(bool paused) external onlyOwner {
        openingsPaused = paused;
        emit OpeningsPauseChanged(paused);
    }

    /// @notice Caller funds their own position. Bounds and transaction deadline protect order execution.
    function openPosition(
        uint256 collateral,
        uint32 leverageBps,
        bool isLong,
        uint256 minPrice,
        uint256 maxPrice,
        uint256 validUntil
    ) external nonReentrant returns (uint256 id) {
        if (openingsPaused) revert OpeningsPaused();
        if (block.timestamp > validUntil) revert DeadlinePassed();
        Config memory c = config;
        if (
            collateral < c.minCollateral || collateral > MAX_COLLATERAL || leverageBps < BPS
                || leverageBps > c.maxLeverageBps
        ) revert InvalidAmount();
        uint256 price = validatedPrice();
        if (minPrice == 0 || minPrice > maxPrice || price < minPrice || price > maxPrice) {
            revert PriceOutsideBounds();
        }
        uint256 notional = Math.mulDiv(collateral, leverageBps, BPS);
        uint256 reserve = Math.mulDiv(notional, c.profitCapBps, BPS, Math.Rounding.Ceil);
        uint256 capacity = Math.mulDiv(totalAssets(), c.maxUtilizationBps, BPS);
        if (
            openCount >= MAX_OPEN_POSITIONS || notional > c.maxPosition
                || openExposure + notional > c.maxExposure || reservedProfit + reserve > capacity
        ) revert CapacityExceeded();
        if (collateral <= PositionMath.maintenance(notional, price, price, c.maintenanceBps)) {
            revert InvalidAmount();
        }
        id = nextPositionId++;
        uint64 maturity = SafeCast.toUint64(block.timestamp + c.positionDuration);
        positions[id] =
            Position(msg.sender, isLong, Status.Open, maturity, collateral, notional, price, reserve);
        openCount++;
        openExposure += notional;
        reservedProfit += reserve;
        escrowedCollateral += collateral;
        uint256 beforeBalance = IERC20(asset()).balanceOf(address(this));
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), collateral);
        if (IERC20(asset()).balanceOf(address(this)) != beforeBalance + collateral) {
            revert UnsupportedAsset();
        }
        emit PositionOpened(id, msg.sender, isLong, collateral, notional, price, reserve, maturity);
    }

    function closePosition(uint256 id, uint256 minPrice, uint256 maxPrice, uint256 validUntil)
        external
        nonReentrant
    {
        Position memory p = _open(id);
        if (msg.sender != p.trader) revert NotTrader();
        if (block.timestamp > validUntil) revert DeadlinePassed();
        uint256 price = validatedPrice();
        if (minPrice == 0 || minPrice > maxPrice || price < minPrice || price > maxPrice) {
            revert PriceOutsideBounds();
        }
        _settle(id, p, price, Status.Closed);
    }

    /// @notice Anyone may submit a liquidation; no automatic scheduler or keeper reward exists.
    function liquidate(uint256 id) external nonReentrant {
        Position memory p = _open(id);
        uint256 price = validatedPrice();
        (uint256 equity,) =
            PositionMath.payout(p.collateral, p.notional, p.entryPrice, price, p.isLong, p.reserve);
        if (equity > PositionMath.maintenance(p.notional, p.entryPrice, price, config.maintenanceBps)) {
            revert HealthyPosition();
        }
        _settle(id, p, price, Status.Liquidated);
    }

    /// @notice Settle using the current fresh quote after maturity. Not a historical expiry oracle.
    function expire(uint256 id) external nonReentrant {
        Position memory p = _open(id);
        if (block.timestamp < p.deadline) revert NotExpired();
        _settle(id, p, validatedPrice(), Status.Expired);
    }

    /// @notice Liveness escape: refund principal after maturity + delay only if pricing is unavailable.
    /// @dev Forgives unrealized PnL; an explicit oracle-outage tradeoff, not a production settlement policy.
    function refundAfterOracleFailure(uint256 id) external nonReentrant {
        Position memory p = _open(id);
        if (block.timestamp < uint256(p.deadline) + config.refundDelay) revert RecoveryUnavailable();
        try this.validatedPrice() returns (uint256) {
            revert RecoveryUnavailable();
        } catch {}
        _release(id, p, Status.Refunded, p.collateral);
        emit PositionSettled(id, Status.Refunded, 0, 0, p.collateral);
    }

    /// @notice Pull-based payout so a blocked recipient cannot prevent position finalization.
    function withdrawClaim(address receiver) external nonReentrant {
        if (receiver == address(0) || receiver == address(this)) revert InvalidReceiver();
        uint256 amount = claims[msg.sender];
        if (amount == 0) revert InvalidAmount();
        claims[msg.sender] = 0;
        totalClaims -= amount;
        uint256 beforeReceiver = IERC20(asset()).balanceOf(receiver);
        IERC20(asset()).safeTransfer(receiver, amount);
        if (IERC20(asset()).balanceOf(receiver) != beforeReceiver + amount) revert UnsupportedAsset();
        emit ClaimWithdrawn(msg.sender, receiver, amount);
    }

    function validatedPrice() public view returns (uint256 price) {
        uint256 updated;
        (price, updated) = priceSource.latestPrice();
        if (price == 0 || price > MAX_PRICE || updated == 0 || updated > block.timestamp) {
            revert InvalidPrice();
        }
        if (block.timestamp - updated > config.priceMaxAge) revert StalePrice();
    }

    function quotePosition(uint256 id) external view returns (uint256 equity, int256 pnl, bool liquidatable) {
        Position memory p = _open(id);
        uint256 price = validatedPrice();
        (equity, pnl) =
            PositionMath.payout(p.collateral, p.notional, p.entryPrice, price, p.isLong, p.reserve);
        liquidatable =
            equity <= PositionMath.maintenance(p.notional, p.entryPrice, price, config.maintenanceBps);
    }

    function _open(uint256 id) internal view returns (Position memory p) {
        p = positions[id];
        if (p.status != Status.Open) revert PositionNotOpen();
    }

    function _settle(uint256 id, Position memory p, uint256 price, Status terminal) internal {
        (uint256 equity, int256 pnl) =
            PositionMath.payout(p.collateral, p.notional, p.entryPrice, price, p.isLong, p.reserve);
        _release(id, p, terminal, equity);
        emit PositionSettled(id, terminal, price, pnl, equity);
    }

    function _release(uint256 id, Position memory p, Status terminal, uint256 equity) internal {
        positions[id].status = terminal;
        openCount--;
        openExposure -= p.notional;
        reservedProfit -= p.reserve;
        escrowedCollateral -= p.collateral;
        claims[p.trader] += equity;
        totalClaims += equity;
    }

    function _validateConfig(Config memory c) internal pure {
        if (
            c.depositCap == 0 || c.depositCap > MAX_COLLATERAL || c.maxPosition == 0 || c.minCollateral == 0
                || c.minCollateral > c.maxPosition || c.maxExposure < c.maxPosition
                || c.maxExposure > MAX_COLLATERAL * 10 || c.maxLeverageBps < BPS || c.maxLeverageBps > 100_000
                || c.maintenanceBps == 0 || uint256(c.maintenanceBps) * c.maxLeverageBps >= BPS * BPS
                || c.profitCapBps == 0 || c.profitCapBps > BPS || c.maxUtilizationBps == 0
                || c.maxUtilizationBps > 9_000 || c.priceMaxAge == 0 || c.priceMaxAge > 1 days
                || c.positionDuration == 0 || c.positionDuration > 30 days || c.refundDelay == 0
                || c.refundDelay > 7 days
        ) revert InvalidConfig();
    }
}
