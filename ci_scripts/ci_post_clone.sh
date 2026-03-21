#!/bin/sh
set -e

# Xcode Cloud shell scripts don't inherit the interactive shell PATH.
# Add Homebrew paths for both Apple Silicon (/opt/homebrew) and Intel (/usr/local).
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

echo "=== ci_post_clone: ensuring Node.js is available ==="

if ! command -v node >/dev/null 2>&1; then
  echo "Node not found – installing via Homebrew"
  brew install node
fi

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

echo "=== ci_post_clone: installing JS dependencies ==="

# Xcode Cloud checks out into CI_PRIMARY_REPOSITORY_PATH.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Prefer yarn if available (enables workspace-aware installs); fall back to npm.
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
else
  npm ci
fi

echo "=== ci_post_clone: running pod install ==="

cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo "=== ci_post_clone: done ==="
