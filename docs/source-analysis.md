# Source analysis and scope

Reviewed 3 October 2026. This analysis concerns **DeltaVault / Team AP** only.

## Evidence hierarchy

1. Attached `DeltaVault-Website-PRD.docx`, Draft v1.0, 2 October 2026; all paragraphs and tables read. Draft priorities and acceptance conditions are proposals, not approved release results.
2. [DeltaVault token overview](https://docs.google.com/document/d/1sm24dXR0bXgNfQ3Ux-5dA2p_PEr04tgs9d1-X-QY9Nk/edit), read through the connected Drive on 3 October. Sections Trading, Vaults, Capacity, Risk Management, Price Infrastructure and Settlement establish the protocol concept. No collateral allowlist, fee schedule, ticker, approved economics, deployment or audit is specified.
3. Available website source at `/workspace/sites/deltavault`, inspected read-only: `components/deltavault`, `lib/deltavault`, route files, tests and package manifests. Its README records previous checks; those historical statements are not new test evidence.
4. Connected GitHub `anon-coder-88/delta-vault`: default `main` at `84b5d0bd78b2630220e6b72cfc2f3b83ef8c746f` has an empty tree. Existing history is retained as the publication parent. Branch listing showed main unprotected; repository ruleset listing returned empty. No new deletion or force push is needed.

The PRD means FULL = usable API/library behavior; DEMO = locally simulated execution with no usable protocol interface; PLACEHOLDER = dynamic information with no authoritative source. FULL* requires browser access verification. P0 and P1 remain the PRD's proposed website priorities. A contract unit test cannot change those website fidelity classifications.

## Feature inventory

| Area / PRD references | Confirmed product intent | Observed website code | Protocol extension / missing dependency |
|---|---|---|---|
| Navigation, UX 001–005, NFR-003/004/012 | Responsive accessible frontend, routes, motion, chart and fallback | Route files, native SiteLink, page curtain, aperture, CSS and static disclosures | Preserved in existing website; visual, keyboard, device and performance acceptance not re-run |
| WAL 001–003 | FULL injected-wallet connection, actual chain/address/native ETH | Wagmi injected and Coinbase connectors; WalletConnect conditional on public project ID; viem RPC for testnet 46630 | No protocol addresses in website; connector library availability is not verified wallet compatibility |
| MKT 001–003 | FULL UI over illustrative catalogs; Coinbase spot/candles are reference data | BTC/ETH fixtures, Coinbase normalization, Lightweight Charts, source labels | No approved tradable catalog or authoritative oracle mapping; spot data is not a settlement feed |
| TRD 001–004 | DEMO collateral, bounded leverage, review, exactly-once opening/closing | Versioned integer/decimal local engine and action deduplication | Proposed contracts implement a separate onchain local workflow, not website integration |
| RSK 001–002 | DEMO market capacity and liquidation from explicit scenario pricing | Scenario controls, margin calculation and terminal states | Proposed reservation limits, fresh-source checks, permissionless liquidation; production oracle/keepers missing |
| VLT 001–003 | PLACEHOLDER metrics; DEMO isolated deposit/withdrawal | Market vault cards, fixture liquidity, shares and redemption constraints | Proposed ERC-4626 shares with conservative lock while positions are open; production redemption policy missing |
| PRT 001–002 | DEMO device-local portfolio, persistence/reset | LocalStorage ledger, wallet-independent cash/holdings and reset | Contracts supply canonical onchain state; no indexer, database or cross-device portfolio added |
| DAT 001 | Every metric retains provenance | Reference, sample, demo and unavailable labels in source | Local console explicitly labels development assets/oracle and base units |
| TOK 001, GOV 001 | Conditional token utility; numerical economics missing; governance activity unavailable | Website ticker TBA and proposed 30/25/20/15/10 allocation array are later website changes | Not authority for protocol token issuance or fees; no tokenomics/governance contracts implemented |
| DOC 001, DSC 001–002 | Protocol education, losses, no unsupported claims/affiliation | Documentation and risk routes, conditional links and text | New protocol docs disclose actual contract powers, trust assumptions and unperformed review |
| NFR-001–012; section 11 | Proposed website quality and user-study criteria | Implementation includes some recovery/motion behaviors; README mentions prior checks and gaps | No claim that website QA or comprehension criteria passed; contract evidence is separate |

## Architectural boundary

PRD sections 1, 9 and 12 explicitly exclude proprietary smart-contract execution from the initial frontend release. The present user request authorizes a **new local protocol extension**. It does not approve changed website behavior, a backend, database, mainnet deployment or numerical economics.

The existing website remains in its existing repository and filesystem, without writes. This protocol repository uses `apps/web` for a focused static local contract console. The original frontend was available and inspected; it was **not imported** and is not claimed to be missing. This separation follows the independently authorized protocol scope: the original DEMO flows must continue to perform no wallet writes. It also avoids shipping platform deployment/auth/database template infrastructure inside the protocol package. If a later request combines the complete website source here, the entire combined tree must be measured again; the Solidity percentage reported for this repository would not apply to that combined source tree.

## Reference assessment

Both organizational references were accessible through GitHub on 3 October:

| Reference | Observed tree revision | Useful conventions | Intentionally not adopted |
|---|---|---|---|
| [kerberos-dev/kerberos](https://github.com/kerberos-dev/kerberos) | `352ef282b8b169300d8ed224201d4cf35306ea67` | contracts/test/script, apps/web, SDK/ABI packages, protocol/deployment/security docs; explicit scope extension discussion | Portfolio contracts, market adapters, backend/indexer, token mechanics and its tiny test shim |
| [zeroknow-dev/zeroknow](https://github.com/zeroknow-dev/zeroknow) | `e12e2ea380d67812d9c846eefa38e111a8ea81f2` | Similar monorepo organization and missing-deployment disclosure | Proof/prover logic, unrelated portfolio extension and production claims |

No reference code was copied. PRD visual references S04–S06 were reported inaccessible when authored; their current designs were not inspected because this task is protocol engineering. Papertrade's chain/leverage claims are not inherited.

## Verified primary implementation sources

- [Robinhood connecting documentation](https://docs.robinhood.com/chain/connecting/): rechecked 3 October; chain IDs 4663/46630, ETH gas, published public endpoints. Docs say public endpoints are rate limited and unsuitable for production. This is configuration evidence, not an RPC or deployment test.
- [OpenZeppelin ERC-4626 guidance](https://docs.openzeppelin.com/contracts/5.x/erc4626) and tagged [5.4.0 contract interface](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.4.0/contracts/token/ERC20/extensions/ERC4626.sol): virtual asset/share conversion, rounding and shared deposit/withdraw hooks inspected before overrides.
- [forge-std v1.9.7](https://github.com/foundry-rs/forge-std/tree/v1.9.7): genuine upstream Test/Script/StdInvariant; tag commit `77041d2ce690e692d6e03cc812b57d1ddaa4d505`, pinned archive checksum. No assertion shim.
- [GitHub Linguist v9.7.0](https://github.com/github-linguist/linguist/releases/tag/v9.7.0): upstream language statistics tool, not file or line counting.

## Open dependencies and decisions

PRD D-001 through D-010 remain unapproved: token details; live/demo boundary for a future integration; public environment; markets/collateral; economic/risk policy; provider access; design references; withdrawal/governance policies; audits/legal restrictions; delivery/measurement ownership. Local development choices below are proposals that unblock code, not resolutions of those production decisions. Supply a validated production oracle adapter, compatible collateral, keeper/liveness operation, reviewed market economics and independent security review before public financial use.
