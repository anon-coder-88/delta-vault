// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local/test collateral only. Public minting is intentionally unsuitable for production.
contract DevelopmentAsset is ERC20 {
    constructor() ERC20("Development USD", "devUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}
