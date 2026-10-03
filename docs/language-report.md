# Eligible-language report

Method: genuine **GitHub Linguist 9.7.0**, Ruby 3.2.3, `github-linguist --breakdown --json` against the committed Git tree. No file-count, line-count or custom extension approximation is used. Raw output is in language-stats.json. CI runs the same pinned upstream version and requires Solidity bytes × 2 ≥ all eligible bytes.

Measured local code revision: `87640db54c17ef4e1feae50d020e7f011684e9f2`. Subsequent documentation-only additions have no eligible language bytes. To match the delivered source independently, the sorted eligible paths and exact contents (each separated by NUL) have SHA-256 `1f76a67f2db341bf10a7aa76c6675f20a34f5f0d0916dfa372ac6902df54daf1`. This is a content inventory checksum, not a fabricated Git revision. GitHub publication commits preserve the existing remote history and therefore have different commit IDs from local preparation commits.

| Language | Eligible bytes | Share |
|---|---:|---:|
| Solidity | 48,709 | 68.1245% |
| TypeScript | 17,320 | 24.2238% |
| HTML | 2,404 | 3.3622% |
| CSS | 1,517 | 2.1217% |
| Python | 561 | 0.7846% |
| JavaScript | 500 | 0.6993% |
| Shell | 489 | 0.6839% |
| **Total** | **71,500** | **100%** |

`Solidity share = 48,709 / 71,500 × 100 = 68.1244755%`.

## Solidity composition

| Category | Eligible bytes | Excluded bytes |
|---|---:|---:|
| First-party protocol, interface and math library (`contracts/src`) | 17,153 | 0 |
| Meaningful unit/fuzz/invariant tests (`contracts/test`, excluding fixtures) | 29,912 | 0 |
| Reproducible local deployment (`contracts/script`) | 1,644 | 0 |
| Clearly separated development fixtures | 0 | 1,595 |
| Third-party Solidity | 0 | Dependencies absent from Git tree |

The tests check real rejected actions, independent financial fixtures, full settlement, market isolation and asset invariants. No duplicate/unrelated contracts or copied libraries were added to raise the share. There are only one vault contract, one required price interface and one bounded accounting library in protocol source. The result is above the requested 50% with margin; further source was not added solely to approach any target.

## Exclusions and complete-tree boundary

- `packages/abi/index.ts` (46,230 bytes) is actual compiler-generated ABI data. This is the only explicit `linguist-generated` attribute. No frontend/SDK files are relabeled.
- Genuine development fixtures are considered vendored by Linguist's built-in `fixtures` path rule; direct `--json` read showed `generated:false, vendored:true`. Their 1,595 Solidity bytes are excluded from the numerator and denominator, which reduces rather than inflates Solidity share.
- `node_modules`, installed `lib/forge-std`, compiler output, caches, broadcast logs and built browser bundles are untracked. Dependencies retain their original licenses and are not counted as first-party source.
- Markdown, TOML/YAML configuration, JSON/lock/evidence data and plain license text are handled by upstream Linguist's normal statistics rules; no custom exclusion changes those classifications. Authored CSS, TypeScript, HTML, JavaScript, Python and Shell are all included.
- The complete delivered **protocol** repository contains its actual console and SDK. The existing hosted website was available, inspected and preserved in its separate existing repository, not imported here. No claim is made about the Solidity ratio of a future combined full website/protocol tree. That would require a fresh measurement of all imported code.

Reproduce after checkout and installation of the upstream gem:

```bash
gem install github-linguist -v 9.7.0 --no-document
github-linguist --breakdown --json > /tmp/languages.json
python3 scripts/check-language.py /tmp/languages.json
```

## GitHub / default branch

Publication is on a review branch based on existing `main`, through a pull request. **No merge or default-branch replacement is performed.** Existing `main` is empty at the analyzed revision. The local 68.1245% result and feature-branch CI are not proof of a default-branch language majority.

After reviewed merge and GitHub language processing, read `https://api.github.com/repos/anon-coder-88/delta-vault/languages`, calculate Solidity bytes / total reported bytes and compare the default branch's actual SHA. If empty, processing has not established a result; if below 50%, investigate rather than claiming success. Default-branch verification remains pending until that action actually occurs. No public-chain deployment follows from merging.
