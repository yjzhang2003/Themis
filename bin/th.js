#!/bin/sh
# Follow symlink to find the actual package directory
SELF=$(readlink -f "$0")
PKGDIR=$(dirname "$SELF")
ROOTDIR=$(cd "$PKGDIR/.." && pwd)
cd "$ROOTDIR" && node --import tsx src/cli/index.tsx "$@"
