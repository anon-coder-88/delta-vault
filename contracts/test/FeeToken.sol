// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Adversarial fixture proves the vault rejects transfer-tax collateral.
contract FeeToken is ERC20 {
    constructor() ERC20("Fee fixture", "FEE") {
        require(block.chainid == 31337, "local fixture only");
        _mint(msg.sender, 1_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) { return 6; }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        uint256 fee = amount / 100;
        super._update(from, address(0), fee);
        super._update(from, to, amount - fee);
    }
}
