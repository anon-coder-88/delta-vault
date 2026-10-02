// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Testnet MVP. An owner controls prices; do not use with real funds.
contract DeltaVaultMVP is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_LEVERAGE = 5;
    uint256 public constant MAX_AGE = 1 hours;
    uint256 public constant MAX_AMOUNT = 1_000_000 * 1e6;
    IERC20 public immutable collateral;

    struct Market {
        uint256 liquidity;     // Collateral backing LP shares, in 6-decimal units.
        uint256 totalShares;
        uint256 reserved;      // Worst-case capped profit for open positions.
        uint256 price;         // Owner-set 8-decimal test price.
        uint64 updatedAt;
        bool enabled;
    }
    struct Position {
        address trader;
        bytes32 marketId;
        uint256 collateralAmount;
        uint256 notional;
        uint256 entryPrice;
        bool isLong;
        bool active;
    }

    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => mapping(address => uint256)) public shares;
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId = 1;

    event MarketCreated(bytes32 indexed marketId, uint256 price);
    event PriceUpdated(bytes32 indexed marketId, uint256 price);
    event Deposited(bytes32 indexed marketId, address indexed account, uint256 amount, uint256 mintedShares);
    event Withdrawn(bytes32 indexed marketId, address indexed account, uint256 amount, uint256 burnedShares);
    event PositionOpened(uint256 indexed positionId, address indexed trader, bytes32 indexed marketId, bool isLong, uint256 collateralAmount, uint256 notional);
    event PositionSettled(uint256 indexed positionId, address indexed trader, uint256 payout, int256 pnl, bool liquidated);

    constructor(IERC20 token, address admin) Ownable(admin) {
        require(block.chainid == 31337 || block.chainid == 46630, "testnet only");
        require(address(token) != address(0), "zero token");
        collateral = token;
    }

    function createMarket(bytes32 id, uint256 price) external onlyOwner {
        require(id != bytes32(0) && markets[id].updatedAt == 0, "invalid market");
        _checkPrice(price);
        markets[id].price = price;
        markets[id].updatedAt = uint64(block.timestamp);
        markets[id].enabled = true;
        emit MarketCreated(id, price);
    }

    /// @notice Trusted test price. There is no external oracle in this MVP.
    function setPrice(bytes32 id, uint256 price) external onlyOwner {
        require(markets[id].updatedAt != 0, "unknown market");
        _checkPrice(price);
        markets[id].price = price;
        markets[id].updatedAt = uint64(block.timestamp);
        emit PriceUpdated(id, price);
    }

    function setMarketEnabled(bytes32 id, bool enabled) external onlyOwner {
        require(markets[id].updatedAt != 0, "unknown market");
        markets[id].enabled = enabled;
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function deposit(bytes32 id, uint256 amount) external nonReentrant whenNotPaused returns (uint256 minted) {
        Market storage m = markets[id];
        require(m.enabled && amount > 0 && amount <= MAX_AMOUNT, "invalid deposit");
        minted = m.totalShares == 0 ? amount : Math.mulDiv(amount, m.totalShares, m.liquidity);
        require(minted > 0, "deposit too small");
        // Reject fee-on-transfer tokens: accounting must equal the real balance.
        uint256 beforeBalance = collateral.balanceOf(address(this));
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        require(collateral.balanceOf(address(this)) - beforeBalance == amount, "unsupported token");
        m.liquidity += amount;
        m.totalShares += minted;
        shares[id][msg.sender] += minted;
        emit Deposited(id, msg.sender, amount, minted);
    }

    /// @notice Exits stay available during a pause, subject to reserved liquidity.
    function withdraw(bytes32 id, uint256 burned) external nonReentrant returns (uint256 amount) {
        Market storage m = markets[id];
        require(burned > 0 && burned <= shares[id][msg.sender], "invalid shares");
        amount = Math.mulDiv(burned, m.liquidity, m.totalShares);
        require(amount > 0 && amount <= m.liquidity - m.reserved, "liquidity reserved");
        shares[id][msg.sender] -= burned;
        m.totalShares -= burned;
        m.liquidity -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit Withdrawn(id, msg.sender, amount, burned);
    }

    function openPosition(bytes32 id, uint256 amount, uint8 leverage, bool isLong)
        external nonReentrant whenNotPaused returns (uint256 positionId)
    {
        Market storage m = markets[id];
        require(m.enabled && _fresh(m), "market unavailable");
        require(amount > 0 && amount <= MAX_AMOUNT && leverage >= 1 && leverage <= MAX_LEVERAGE, "invalid size");
        uint256 notional = amount * leverage;
        require(m.reserved + notional <= Math.mulDiv(m.liquidity, 80, 100), "capacity exceeded");
        uint256 beforeBalance = collateral.balanceOf(address(this));
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        require(collateral.balanceOf(address(this)) - beforeBalance == amount, "unsupported token");
        m.reserved += notional;
        positionId = nextPositionId++;
        positions[positionId] = Position(msg.sender, id, amount, notional, m.price, isLong, true);
        emit PositionOpened(positionId, msg.sender, id, isLong, amount, notional);
    }

    function closePosition(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.active && p.trader == msg.sender, "not your position");
        require(_fresh(markets[p.marketId]), "stale price");
        _settle(positionId, false);
    }

    /// @notice Anyone can liquidate when the mark loss reaches 80% of collateral.
    function liquidate(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.active && _fresh(markets[p.marketId]), "unavailable");
        require(pnl(positionId) <= -int256(Math.mulDiv(p.collateralAmount, 80, 100)), "healthy position");
        _settle(positionId, true);
    }

    function pnl(uint256 positionId) public view returns (int256 result) {
        Position storage p = positions[positionId];
        require(p.active, "closed position");
        uint256 mark = markets[p.marketId].price;
        int256 change = p.isLong ? int256(mark) - int256(p.entryPrice) : int256(p.entryPrice) - int256(mark);
        result = int256(p.notional) * change / int256(p.entryPrice);
        if (result > int256(p.notional)) result = int256(p.notional);
        if (result < -int256(p.collateralAmount)) result = -int256(p.collateralAmount);
    }

    function _settle(uint256 id, bool liquidated) private {
        Position storage p = positions[id];
        Market storage m = markets[p.marketId];
        int256 result = pnl(id);
        p.active = false;
        m.reserved -= p.notional;
        uint256 payout;
        if (result >= 0) {
            uint256 profit = uint256(result);
            m.liquidity -= profit;
            payout = p.collateralAmount + profit;
        } else {
            uint256 loss = uint256(-result);
            m.liquidity += loss;
            payout = p.collateralAmount - loss;
        }
        if (payout > 0) collateral.safeTransfer(p.trader, payout);
        emit PositionSettled(id, p.trader, payout, result, liquidated);
    }

    function _fresh(Market storage m) private view returns (bool) {
        return m.updatedAt != 0 && block.timestamp - m.updatedAt <= MAX_AGE;
    }
    function _checkPrice(uint256 price) private pure {
        require(price > 0 && price <= 1e20, "invalid price");
    }
}
