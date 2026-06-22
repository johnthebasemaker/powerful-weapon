#!/bin/bash
# Double-click this file in Finder to launch Powerful Weapon (development mode).
# The first time you launch, macOS will ask for permission — click "Open" in the dialog.

cd "$(dirname "$0")"

# Make sure Node is on the PATH even when launched from Finder (Homebrew installs to /opt/homebrew/bin)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# If dependencies aren't installed, do it on first launch
if [ ! -d "node_modules" ]; then
  echo ""
  echo "First-time setup: installing dependencies. This takes a few minutes."
  echo ""
  npm install || { echo "Install failed. Press Enter to close."; read; exit 1; }
fi

echo ""
echo "Starting Powerful Weapon..."
echo "(Close this Terminal window to stop the app.)"
echo ""

npm run dev
