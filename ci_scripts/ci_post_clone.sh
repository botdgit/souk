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

# The repo uses yarn.lock; install yarn if not already present.
if ! command -v yarn >/dev/null 2>&1; then
  echo "yarn not found – installing via npm"
  npm install -g yarn
fi

echo "yarn: $(yarn --version)"

# Write .xcode.env.local so that Xcode script phases can find node and the
# correct project root even when Xcode Cloud does not inherit Homebrew PATH.
#
# NODE_BINARY: needed by "Bundle React Native code and images" and
#   with-node.sh because Xcode's script-phase PATH omits Homebrew.
#
# PROJECT_ROOT: souk.xcodeproj is a symlink at the repo root, so Xcode
#   sets PROJECT_DIR to the repo root and the script computes
#   PROJECT_ROOT="$PROJECT_DIR/.." (parent of repo – wrong).
#   The bundle script sources .xcode.env.local a SECOND TIME after
#   setting PROJECT_ROOT, so we can override it here.
NODE_ABS="$(command -v node)"
XCODE_ENV_LOCAL="$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios/.xcode.env.local"
{
  echo "export NODE_BINARY=${NODE_ABS}"
  echo "export PROJECT_ROOT=${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile"
} > "$XCODE_ENV_LOCAL"
echo "Wrote .xcode.env.local: NODE_BINARY=${NODE_ABS}, PROJECT_ROOT=${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile"

echo "=== ci_post_clone: installing JS dependencies ==="

# Xcode Cloud checks out into CI_PRIMARY_REPOSITORY_PATH.
cd "$CI_PRIMARY_REPOSITORY_PATH"

yarn install --frozen-lockfile

echo "=== ci_post_clone: running pod install ==="

cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"

# Retry pod install up to 4 times with exponential backoff to handle transient
# network errors when CocoaPods fetches remote git dependencies.
POD_ATTEMPT=1
POD_BACKOFF=2
while true; do
  if pod install; then
    break
  fi
  if [ "$POD_ATTEMPT" -ge 4 ]; then
    echo "pod install failed after $POD_ATTEMPT attempts" >&2
    exit 1
  fi
  echo "pod install failed (attempt $POD_ATTEMPT) – retrying in ${POD_BACKOFF}s..."
  sleep "$POD_BACKOFF"
  POD_ATTEMPT=$((POD_ATTEMPT + 1))
  POD_BACKOFF=$((POD_BACKOFF * 2))
done

# ---------------------------------------------------------------------------
# The Xcode Cloud workflow uses souk.xcodeproj at the repo root for the
# archive build. That project's file references resolve relative to the
# repo root, so it expects:
#   $REPO_ROOT/Pods/                 (CocoaPods xcconfigs, frameworks)
#   $REPO_ROOT/Souk/                 (app source files)
#
# Pod install ran inside apps/mobile/ios/, so we create symlinks that make
# these paths available at the repo root without duplicating any files.
# ---------------------------------------------------------------------------
echo "=== ci_post_clone: creating root-level symlinks for souk.xcodeproj ==="
REPO_ROOT="$CI_PRIMARY_REPOSITORY_PATH"
IOS_DIR="$REPO_ROOT/apps/mobile/ios"

ln -sfn "$IOS_DIR/Pods"  "$REPO_ROOT/Pods"
ln -sfn "$IOS_DIR/Souk"  "$REPO_ROOT/Souk"
echo "  Pods  -> $IOS_DIR/Pods"
echo "  Souk  -> $IOS_DIR/Souk"

echo "=== ci_post_clone: done ==="
