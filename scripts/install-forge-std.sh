#!/usr/bin/env bash
set -euo pipefail
# Genuine upstream test library, pinned archive and checksum. Never committed as first-party code.
mkdir -p lib/forge-std
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
curl --fail --location https://codeload.github.com/foundry-rs/forge-std/tar.gz/refs/tags/v1.9.7 -o "$archive"
printf '%s  %s\n' 45157353ab49eab01d294565866731e599b32401757229689ee459aa26b7ee94 "$archive" | sha256sum --check
tar -xzf "$archive" --strip-components=1 -C lib/forge-std
