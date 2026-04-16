#!/bin/sh
# Capture the directory from which th was invoked (before we cd)
ORIGINAL_PWD="$(pwd)"
# Follow symlink to find the actual package directory
SELF=$(readlink -f "$0")
PKGDIR=$(dirname "$SELF")
ROOTDIR=$(cd "$PKGDIR/.." && pwd)
cd "$ROOTDIR" && ORIGINAL_PWD="$ORIGINAL_PWD" node --import tsx src/cli/index.tsx "$@"
