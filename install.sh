#!/bin/bash
set -e

echo "Installing Themis..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Install from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Themis requires Node.js 20+"
    echo "Current version: $(node -v)"
    exit 1
fi

# Check tmux (optional but recommended)
if ! command -v tmux &> /dev/null; then
    echo "Warning: tmux is not installed."
    echo "Install with: brew install tmux"
    echo "Some features may not work without tmux."
fi

# Install the package globally
cd "$(dirname "$0")" && npm install -g .

# Verify installation
if command -v themis &> /dev/null; then
    echo ""
    echo "Themis installed successfully!"
    echo ""
    echo "Usage:"
    echo "  themis              # Start interactive mode"
    echo "  themis --help       # Show help"
    echo "  themis init         # Initialize workspace"
    echo "  themis new <name>   # Create a new task"
    echo ""
    echo "Get started:"
    echo "  themis init"
else
    echo "Error: Installation failed. Try again or check permissions."
    exit 1
fi
