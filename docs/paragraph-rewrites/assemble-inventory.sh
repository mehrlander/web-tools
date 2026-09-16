#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f inventory-index.csv.gz.b64 ]]; then
  base64 -d inventory-index.csv.gz.b64 | gunzip -c > inventory-index.csv
  echo "inventory-index.csv: $(wc -l < inventory-index.csv) lines"
fi
if [[ -f inventory.jsonl.gz.b64 ]]; then
  base64 -d inventory.jsonl.gz.b64 | gunzip -c > inventory.jsonl
elif [[ -d inventory-b64-shards ]]; then
  cat inventory-b64-shards/shard-*.b64 | base64 -d | gunzip -c > inventory.jsonl
elif [[ -d inventory-parts ]]; then
  cat inventory-parts/part-*.jsonl > inventory.jsonl
fi
if [[ -f inventory.jsonl ]]; then
  wc -l inventory.jsonl
  echo "sha256: $(sha256sum inventory.jsonl | awk '{print $1}')"
fi
if [[ -d drafts-parts ]]; then
  cat drafts-parts/part-*.jsonl > drafts.jsonl
  echo "drafts.jsonl: $(wc -l < drafts.jsonl) lines"
fi
