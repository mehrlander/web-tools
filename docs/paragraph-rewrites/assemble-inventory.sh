#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat inventory-parts/part-*.jsonl > inventory.jsonl
wc -l inventory.jsonl
