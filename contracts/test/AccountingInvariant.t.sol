// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MarketVault} from "../src/MarketVault.sol";
import {DeployLocal} from "../script/DeployLocal.s.sol";
import {DevelopmentAsset} from "./fixtures/DevelopmentAsset.sol";
import {DevelopmentPriceSource} from "./fixtures/DevelopmentPriceSource.sol";

/// @notice Stateful handler varies liquidity, direction, settlement order and claims.
/// @dev No exceptions are swallowed: the invariant runner fails on unexpected reverts.
contract AccountingHandler is Test {
    MarketVault public vault;
    DevelopmentAsset public token;
    DevelopmentPriceSource public oracle;
    uint256[] internal ids;
    uint256 public totalIssued;
    uint256 public opened;
    uint256 public closed;

    constructor() {
        bytes32 id = keccak256("DEVELOPMENT:INVARIANT");
        token = new DevelopmentAsset();
        oracle = new DevelopmentPriceSource(id, address(this));
        oracle.publish(2_000e8, block.timestamp);
        vault = new MarketVault(token, oracle, id, address(this), new DeployLocal().localConfig());
        totalIssued = 500_000e6;
        token.mint(address(this), totalIssued);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e6, address(this));
    }

    function open(uint96 seed, bool isLong) external {
        uint256 collateral = bound(seed, 1e6, 500e6);
        if (vault.openCount() >= 32 || token.balanceOf(address(this)) < collateral) return;
        if (vault.totalAssets() < vault.reservedProfit() + 1_000e6) return;
        oracle.publish(2_000e8, block.timestamp);
        ids.push(vault.openPosition(collateral, 20_000, isLong, 2_000e8, 2_000e8, block.timestamp));
        opened++;
    }

    function close(uint256 seed, uint64 priceSeed) external {
        if (ids.length == 0) return;
        uint256 index = seed % ids.length;
        uint256 id = ids[index];
        uint256 price = bound(priceSeed, 1_000e8, 3_000e8);
        oracle.publish(price, block.timestamp);
        vault.closePosition(id, price, price, block.timestamp);
        ids[index] = ids[ids.length - 1];
        ids.pop();
        closed++;
    }

    function claim() external {
        if (vault.claims(address(this)) != 0) vault.withdrawClaim(address(this));
    }

    function withdraw(uint96 seed) external {
        uint256 maximum = vault.maxWithdraw(address(this));
        if (maximum == 0) return;
        uint256 assets = bound(seed, 1, maximum);
        vault.withdraw(assets, address(this), address(this));
    }

    function deposit(uint96 seed) external {
        uint256 maximum = vault.maxDeposit(address(this));
        uint256 balance = token.balanceOf(address(this));
        if (maximum == 0 || balance == 0) return;
        uint256 assets = bound(seed, 1, maximum < balance ? maximum : balance);
        if (vault.previewDeposit(assets) == 0) return;
        vault.deposit(assets, address(this));
    }

    function expectedOpenState()
        external
        view
        returns (uint256 collateral, uint256 notional, uint256 reserve)
    {
        for (uint256 i; i < ids.length; i++) {
            (,,,, uint256 c, uint256 n,, uint256 r) = vault.positions(ids[i]);
            collateral += c;
            notional += n;
            reserve += r;
        }
    }
}

contract AccountingInvariantTest is StdInvariant, Test {
    AccountingHandler internal handler;
    MarketVault internal vault;
    DevelopmentAsset internal token;

    function setUp() public {
        vm.warp(1_000_000);
        handler = new AccountingHandler();
        vault = handler.vault();
        token = handler.token();
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.open.selector;
        selectors[1] = handler.close.selector;
        selectors[2] = handler.claim.selector;
        selectors[3] = handler.withdraw.selector;
        selectors[4] = handler.deposit.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariantAssetConservation() public view {
        assertEq(token.balanceOf(address(handler)) + token.balanceOf(address(vault)), handler.totalIssued());
        assertEq(
            token.balanceOf(address(vault)),
            vault.totalAssets() + vault.escrowedCollateral() + vault.totalClaims()
        );
    }

    function invariantReserveAndOpenLedgerAgree() public view {
        (uint256 collateral, uint256 notional, uint256 reserve) = handler.expectedOpenState();
        assertEq(collateral, vault.escrowedCollateral());
        assertEq(notional, vault.openExposure());
        assertEq(reserve, vault.reservedProfit());
        assertLe(reserve, vault.totalAssets());
        assertEq(vault.openCount(), handler.opened() - handler.closed());
        assertEq(vault.totalClaims(), vault.claims(address(handler)));
    }
}
