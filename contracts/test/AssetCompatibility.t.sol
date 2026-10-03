// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MarketVault} from "../src/MarketVault.sol";
import {DeployLocal} from "../script/DeployLocal.s.sol";
import {DevelopmentPriceSource} from "./fixtures/DevelopmentPriceSource.sol";

/// @dev Adversarial token fixture. Never included in deployed protocol source.
contract AdversarialAsset is ERC20 {
    bool public fee;
    bool public fail;
    bool public callback;
    bool public reentrySucceeded;
    address public target;

    constructor() ERC20("Adversarial test asset", "BAD") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function configure(bool fee_, bool fail_, bool callback_, address target_) external {
        fee = fee_;
        fail = fail_;
        callback = callback_;
        target = target_;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (fail) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (fail) return false;
        if (callback) {
            (reentrySucceeded,) = target.call(abi.encodeCall(MarketVault.withdrawClaim, (address(this))));
        }
        return super.transferFrom(from, to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (fee && from != address(0) && to != address(0) && amount != 0) {
            uint256 tax = amount / 100 + 1;
            super._update(from, address(0), tax);
            super._update(from, to, amount - tax);
        } else {
            super._update(from, to, amount);
        }
    }
}

contract AssetCompatibilityTest is Test {
    AdversarialAsset internal token;
    DevelopmentPriceSource internal oracle;
    MarketVault internal vault;

    function setUp() public {
        vm.warp(1_000_000);
        bytes32 id = keccak256("DEVELOPMENT:TEST");
        token = new AdversarialAsset();
        oracle = new DevelopmentPriceSource(id, address(this));
        oracle.publish(2_000e8, block.timestamp);
        vault = new MarketVault(token, oracle, id, address(this), new DeployLocal().localConfig());
        token.mint(address(this), 20_000e6);
        token.approve(address(vault), type(uint256).max);
    }

    function testFeeOnTransferLpDepositRevertsAtomically() public {
        token.configure(true, false, false, address(vault));
        vm.expectRevert(MarketVault.UnsupportedAsset.selector);
        vault.deposit(10_000e6, address(this));
        assertEq(token.balanceOf(address(this)), 20_000e6);
        assertEq(vault.totalSupply(), 0);
    }

    function testFeeOnTransferTraderCollateralRevertsAtomically() public {
        vault.deposit(10_000e6, address(this));
        token.configure(true, false, false, address(vault));
        vm.expectRevert(MarketVault.UnsupportedAsset.selector);
        vault.openPosition(100e6, 10_000, true, 1, 3_000e8, block.timestamp);
        assertEq(vault.escrowedCollateral(), 0);
        assertEq(vault.nextPositionId(), 1);
    }

    function testFalseReturnTransferRejectsDeposit() public {
        token.configure(false, true, false, address(vault));
        vm.expectRevert();
        vault.deposit(10_000e6, address(this));
        assertEq(vault.totalSupply(), 0);
    }

    function testReentrantCallbackCannotWithdrawClaimDuringDeposit() public {
        token.configure(false, false, true, address(vault));
        vault.deposit(10_000e6, address(this));
        assertFalse(token.reentrySucceeded());
        assertEq(vault.totalAssets(), 10_000e6);
    }

    function testClaimTransferFailurePreservesClaimAndCanRetry() public {
        vault.deposit(10_000e6, address(this));
        uint256 id = vault.openPosition(100e6, 10_000, true, 1, 3_000e8, block.timestamp);
        vault.closePosition(id, 1, 3_000e8, block.timestamp);
        token.configure(false, true, false, address(vault));
        vm.expectRevert();
        vault.withdrawClaim(address(this));
        assertEq(vault.claims(address(this)), 100e6);
        assertEq(vault.totalClaims(), 100e6);
        token.configure(false, false, false, address(vault));
        vault.withdrawClaim(address(this));
        assertEq(vault.totalClaims(), 0);
    }

    function testOutgoingTransferFeeRejectsWithdrawal() public {
        vault.deposit(10_000e6, address(this));
        token.configure(true, false, false, address(vault));
        uint256 shares = vault.balanceOf(address(this));
        vm.expectRevert(MarketVault.UnsupportedAsset.selector);
        vault.withdraw(100e6, address(this), address(this));
        assertEq(vault.balanceOf(address(this)), shares);
        assertEq(vault.totalAssets(), 10_000e6);
    }
}
