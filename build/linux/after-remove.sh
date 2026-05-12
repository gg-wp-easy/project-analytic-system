#!/bin/sh

set -e

APP_NAME="nk-invest-analytics"
BIN_DIR="/usr/local/bin"

echo "Cleaning up NK-Invest Analytics..."

if [ -L "$BIN_DIR/$APP_NAME" ]; then
    rm -f "$BIN_DIR/$APP_NAME"
    echo "Removed launcher: $BIN_DIR/$APP_NAME"
fi

echo "Cleanup complete."
