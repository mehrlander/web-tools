#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f inventory.jsonl.gz.b64 ]]; then
  base64 -d inventory.jsonl.gz.b64 | gunzip -c > inventory.jsonl
elif [[ -d inventory-b64-parts ]]; then
  cat inventory-b64-parts/part-*.b64 | base64 -d | gunzip -c > inventory.jsonl
elif [[ -d inventory-parts ]]; then
  cat inventory-parts/part-*.jsonl > inventory.jsonl
fi
wc -l inventory.jsonl
echo "sha256: $(sha256sum inventory.jsonl | awk '{print $1}')"
