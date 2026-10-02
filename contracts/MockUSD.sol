// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test collateral only. Not a stablecoin or production asset.
contract MockUSD is ERC20 {
    mapping(address => bool) public claimed;

    constructor() ERC20("DeltaVault Test USD", "dvUSD") {
        require(block.chainid == 31337 || block.chainid == 46630, "testnet only");
    }

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice One 10,000 dvUSD claim per address for local/testnet use.
    function faucet() external {
        require(!claimed[msg.sender], "already claimed");
        claimed[msg.sender] = true;
        _mint(msg.sender, 10_000 * 1e6);
    }
}
