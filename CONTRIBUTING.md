# Contributing

Use a working branch and Conventional Commits, for example `feat(vault): add bounded settlement` or `test(risk): reject stale oracle prices`. Keep commits about real changes, with no manufactured/backdated history. Submit reviewable pull requests; do not force-push or bypass branch protection.

First read docs/mvp-spec.md and docs/security.md. New economic, asset or oracle assumptions must be explicitly proposed and documented. Do not silently convert the hosted website's DEMO actions into live writes. Never check in secrets, private keys, node_modules, copied test shims or compiler output.

Run npm ci, the pinned forge-std installer, forge fmt --check, forge build, forge test, npm run build and npm run test:sdk. Regenerate compiler ABIs and include only the generated module. Run npm run journey against disposable Anvil and verify final balances. Language CI must preserve at least 50% eligible Solidity bytes using genuine Linguist; never pad Solidity, copy dependencies or relabel genuine UI code to meet the ratio.

Changes affecting accounting need explicit independent fixtures and conservation/stateful evidence. Changes affecting public deployment need a separate reviewed release scope; this repository's local tests are not deployment authorization.
