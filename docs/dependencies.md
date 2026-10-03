# Dependency attribution

| Dependency | Pinned version | Use / license |
|---|---|---|
| OpenZeppelin contracts | 5.4.0 | ERC-20/ERC-4626, SafeERC20, Math/SafeCast, Ownable2Step, ReentrancyGuard; MIT |
| forge-std | 1.9.7 | Genuine Foundry Test, Script, StdInvariant; Apache-2.0 / MIT upstream licenses retained in installed lib directory |
| Foundry forge/anvil | 1.7.1 | Compiler orchestration, fuzz/invariant runner, local chain; Apache-2.0 / MIT upstream distribution |
| Solidity | 0.8.30 | Cancun target, optimizer 200 runs, via IR; upstream GPL-3.0 compiler tool, not vendored contract code |
| viem | 2.56.9 | Typed EVM reads, simulation, transactions and ABI decoding; MIT |
| TypeScript / tsx / Vite | 5.9.3 / 4.23.15 / 8.0.13 | Types, local TS execution, static browser bundle; upstream licenses retained by npm packages |
| GitHub Linguist | 9.7.0 | Eligible-language byte statistics; MIT |

Npm packages are pinned exactly and integrity-locked in package-lock.json. forge-std's upstream tag commit is `77041d2ce690e692d6e03cc812b57d1ddaa4d505`; archive SHA-256 `45157353ab49eab01d294565866731e599b32401757229689ee459aa26b7ee94`. Install with scripts/install-forge-std.sh. Third-party libraries remain under ignored lib/node_modules, and are absent from the delivered Git tree. Their Solidity is excluded entirely from the numerator as well as the denominator.

No code, branding, business logic or economic mechanics was copied from the organizational reference repositories. The original hosted website is unchanged and its source is not relicensed by this repository. MIT here covers newly authored implementation, not the supplied PRD or Google document.
