# Executed validation

Reviewed 3 October 2026; source build with local code revision `87640db54c17ef4e1feae50d020e7f011684e9f2` plus documentation-only additions. Eligible code inventory is recorded in language-stats.json. Final checks exercised the SafeCast revision and the final market-isolation/count-boundary tests, not an earlier implementation.

## Environment and actual results

Linux x86_64; Node 24.19.0; Solidity native `0.8.30+commit.73712a01`; Foundry forge/anvil 1.7.1 (commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`); OpenZeppelin 5.4.0; genuine forge-std 1.9.7. Optimizer 200 runs, via IR, Cancun. Native Solidity was downloaded from the official binary distribution and supplied with `--use /tmp/dv-solc-0.8.30` for initial compilation. Later build commands used the same cached compiler artifacts. No Solidity assertion shim or alternative claimed test runner was used.

| Check / command | Actual result | Coverage / evidence limit |
|---|---|---|
| `bash scripts/install-forge-std.sh` | Pinned upstream archive installed; checksum checked | Confirms library provenance and reproducible installer, not its audit status |
| `forge build --use /tmp/dv-solc-0.8.30 --sizes` and `npm run contracts:build` | Compile passed; MarketVault final runtime 12,738 bytes, below EIP-170 limit | Compiler/lints do not establish economic safety; timestamp-use warnings remain explicit |
| `forge fmt --check` / `npm run contracts:fmt` | Passed on final formatted source | Native Foundry formatter |
| `forge test --use /tmp/dv-solc-0.8.30` | **43 passed, 0 failed, 0 skipped**, 4 suites | 38 deterministic tests, 3 fuzz checks × 256 runs, 2 stateful invariants |
| Stateful invariants | Both passed, 128 runs × depth 64; 8,192 handler calls per invariant, zero unexpected reverts | Open/close/deposit/withdraw/claim sequences; modeled local asset/manual oracle only |
| `npm run build` | Generated ABIs, strict TypeScript and static Vite build passed | Console build only; no injected real wallet or browser acceptance claimed |
| `git diff --exit-code -- packages/abi` after regeneration | Passed | Generated interfaces match final compiler output |
| `npm run test:sdk` | **2 passed, 0 failed** | Exact amount/precision parsing and confirmed event ID/source decoding |
| `npm run journey` with local Anvil 31337 | **Passed**, successful local deployment and transactions through viem SDK | Real local EVM transactions; development tokens/manual oracle, not public testnet |
| `forge script contracts/script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast --unlocked --sender <local deployer>` | Script completed and broadcast successfully on local chain 31337 | Three local contract deployments; addresses are ephemeral and not public product deployments |
| GitHub Linguist 9.7.0 `--breakdown --json` plus language guard | **68.1245% eligible Solidity**, threshold passed | Full delivered protocol tree includes console/SDK/scripts; original website remains separate |
| Existing website `git status --short` | Clean before and after work | No writes to its source or hosted deployment |

## Risk-to-check register

| Spec / PRD basis | Executed evidence | Result |
|---|---|---|
| TRD 001–004 extension: collateral, leverage, execution, terminal states | Long/short fixtures, complete funding-to-redemption test, price/deadline rejection, repeated close/liquidate/expiry/refund checks | Passed for proposed local protocol rules |
| RSK 001 extension: position/exposure/count/reservation boundaries | Exact limit succeeds, next increment rejected; minimum collateral boundary; 64-position limit | Passed |
| RSK 002 extension: liquidation and source validity | Current-notional maintenance, inclusive boundary arithmetic, healthy liquidation rejected, source age exact bound, future/zero/oversized/failing source | Passed |
| VLT 002–003 extension: LP assets, shares, locked withdrawals | Preview/deposit fuzz agreement, delegated share allowance, zero/overdraw rejection, all four LP methods locked during open exposure | Passed |
| Isolation and custody | Independent second market unaffected; donations do not change trader claims; escrow and all claims excluded from LP assets | Passed |
| Adversarial token calls | Fee transfers, false returns, reentrant deposit callback, failed claim transfer with successful retry, taxed withdrawal rollback | Passed under supplied token fixtures |
| Permissions and privileged actions | Trader-only close; owner-only pause/config; two-step handover; config locked while exposure exists; pause preserves settlement, claims and redemption | Passed |
| Failure recovery | Stale/reverting oracle permits delayed principal refund; fresh quote blocks it; terminal state cannot repeat | Passed |
| Accounting conservation | Independent expected balances, bounded payouts, asset total and active position ledger invariants | Passed |
| SDK integration | Receipt IDs, approvals, deposits, opening, rejecting LP redemption while locked and rejecting nontrader close, settlement, claim and redemption | Passed on local chain |

These results do not mark the original website's FULL/DEMO/PLACEHOLDER acceptance criteria passed. PRD NFR-006 requires its demo to avoid wallet writes; this new local console explicitly writes and is a separate application.

## Full local journey

The SDK deployed development collateral, manual source and MarketVault; seeded price 2,000; minted/deposited 10,000 devUSD as LP; funded trader with 1,000; opened a 5× long; checked 1,000 reserve and 1,000 escrow; verified LP redemption and nontrader close were rejected; published 2,200; closed and credited 1,500; withdrew that claim; redeemed LP shares. Final LP 9,500, trader 1,500, vault 0, all in 6-decimal collateral units. Sum = original 11,000 minted assets. Final shares, escrow, reserves, exposure, open count and unwithdrawn claims were zero. `local-journey.json` contains actual ephemeral local addresses and transaction receipts from the run. Nothing there is represented as a public deployment or usage activity.

## Failures investigated and corrected

- Initial compilation hit stack depth; enabled Solidity's optimizer + via-IR pipeline, then compiled and ran the full suite. Assertions were unchanged.
- A test's one-call prank was consumed by an intervening share-balance read. Moved that read before the prank; redemption then ran as the intended LP.
- A future-timestamp fixture reused optimizer-cached `block.timestamp` after a cheatcode warp. Used `vm.getBlockTimestamp()` for the post-warp fixture; exact source-age boundary and actual future rejection both passed.
- Foundry rejects legacy `testFail*` names; renamed the failed-transfer test while keeping its explicit revert and retained-claim assertions. All six adversarial-asset cases then ran.
- TypeScript event-topic and account-query types were corrected against viem's installed interfaces. No type-check suppression was introduced.
- The tsx CLI's IPC socket was unavailable here; ran TypeScript with the maintained `node --import tsx` loader instead. The original RPC attempt was refused; starting Anvil and the journey within the same execution environment then passed.
- Removed npm Foundry wrappers after observing a wrapper return exit zero for a compiler failure. CI and contract npm scripts use native Foundry, so test/build failures remain real failures.
- Foundry formatting required a second pass for two compound blocks; final `forge fmt --check` passed. Authored CSS was expanded so genuine UI CSS remains counted by Linguist rather than treated as minified generated content.

## Unperformed checks and release status

No public Robinhood RPC, deployment, testnet transaction, fork, external oracle, funding/hedging integration, real injected-wallet browser journey, cross-browser/device/accessibility/performance audit, static analyzer, formal verification, economic stress review or independent security audit was executed. The original website's broader PRD quality and usability goals were not re-tested. Generated CI is prepared; remote workflow execution is reported separately in the pull request and should not be inferred from local passes.

Ready for source review and local experimentation within this documented scope. **Not ready for funded public financial use.** Production oracle, collateral, economic/liveness decisions and independent review remain material blockers. Default-branch language verification waits for reviewed merge; no main-branch changes are authorized by a local test pass.
