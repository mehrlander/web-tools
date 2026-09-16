#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f by-file.tar.gz.b64 ]]; then
  base64 -d by-file.tar.gz.b64 | tar -xzf -
elif [[ -f by-file.tar.gz ]]; then
  tar -xzf by-file.tar.gz
fi
ls by-file | wc -l
