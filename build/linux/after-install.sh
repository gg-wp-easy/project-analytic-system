#!/bin/sh

set -e

APP_NAME="nk-invest-analytics"
INSTALL_DIR=""
# Install dir follows the product name (renamed from NK-Invest-Analytics to NK-Tech ...).
for candidate in /opt/NK-Tech* /opt/NK-Invest-Analytics; do
    if [ -f "$candidate/$APP_NAME" ]; then
        INSTALL_DIR="$candidate"
        break
    fi
done
BIN_DIR="/usr/local/bin"

echo "Configuring NK-Tech Investment Analytics..."

if [ -n "$INSTALL_DIR" ]; then
    ln -sf "$INSTALL_DIR/$APP_NAME" "$BIN_DIR/$APP_NAME"
    chmod +x "$INSTALL_DIR/$APP_NAME"
    echo "Created launcher: $BIN_DIR/$APP_NAME"
fi

mkdir -p /opt/nk-invest-data
chmod 755 /opt/nk-invest-data

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime || true
fi

echo "Configuration complete."
