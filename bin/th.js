#!/bin/sh
BASEDIR=$(dirname "$0")
cd "$BASEDIR/.." && npx tsx src/cli/index.tsx "$@"
