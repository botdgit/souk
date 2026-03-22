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

NODE_ABS="$(command -v node)"
XCODE_ENV_LOCAL="$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios/.xcode.env.local"

echo "=== ci_post_clone: installing JS dependencies ==="

# Xcode Cloud checks out into CI_PRIMARY_REPOSITORY_PATH.
cd "$CI_PRIMARY_REPOSITORY_PATH"

yarn install --frozen-lockfile

# Write .xcode.env.local after yarn install so node_modules are available for
# resolving ENTRY_FILE and CLI_PATH.
#
# NODE_BINARY: needed by "Bundle React Native code and images" because Xcode's
#   script-phase PATH omits Homebrew.
#
# PROJECT_ROOT: souk.xcodeproj is a symlink; Xcode sets PROJECT_DIR to the
#   symlink parent (repo root) and the bundle script computes
#   PROJECT_ROOT="$PROJECT_DIR/.." (parent of repo – wrong). We override it
#   here. The bundle script sources .xcode.env.local TWICE; the second
#   sourcing (after the bad override) also corrects PROJECT_ROOT.
#
# ENTRY_FILE / CLI_PATH: the bundle script resolves these between the two
#   .xcode.env.local sourcings using the wrong PROJECT_ROOT. Pre-setting them
#   here causes the "if [[ -z "$ENTRY_FILE" ]]" guard to skip re-resolution.
ENTRY_FILE_ABS="$(node -e "require('expo/scripts/resolveAppEntry')" \
  "${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile" ios absolute 2>/dev/null | tail -n 1)"
if [ -z "$ENTRY_FILE_ABS" ]; then
  ENTRY_FILE_ABS="${CI_PRIMARY_REPOSITORY_PATH}/node_modules/expo-router/entry.js"
fi
CLI_PATH_ABS="$(node --print \
  "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })" \
  2>/dev/null)"
{
  echo "export NODE_BINARY=${NODE_ABS}"
  echo "export PROJECT_ROOT=${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile"
  echo "export ENTRY_FILE=${ENTRY_FILE_ABS}"
  echo "export CLI_PATH=${CLI_PATH_ABS}"
} > "$XCODE_ENV_LOCAL"
echo "Wrote .xcode.env.local:"
echo "  NODE_BINARY=${NODE_ABS}"
echo "  PROJECT_ROOT=${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile"
echo "  ENTRY_FILE=${ENTRY_FILE_ABS}"
echo "  CLI_PATH=${CLI_PATH_ABS}"

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

ln -sfn "$IOS_DIR/Pods"        "$REPO_ROOT/Pods"
ln -sfn "$IOS_DIR/Souk"        "$REPO_ROOT/Souk"
# [CP] Check Pods Manifest.lock uses ${PODS_PODFILE_DIR_PATH}/Podfile.lock.
# PODS_PODFILE_DIR_PATH = ${SRCROOT}/. and SRCROOT = repo root when building
# from souk.xcodeproj, so the check looks for Podfile.lock at the repo root.
ln -sfn "$IOS_DIR/Podfile.lock" "$REPO_ROOT/Podfile.lock"
echo "  Pods        -> $IOS_DIR/Pods"
echo "  Souk        -> $IOS_DIR/Souk"
echo "  Podfile.lock -> $IOS_DIR/Podfile.lock"

# The "Bundle React Native code and images" build phase sources .xcode.env and
# .xcode.env.local relative to $PODS_ROOT/.. When building from souk.xcodeproj
# at the repo root, PODS_ROOT = $SRCROOT/Pods. Whether the kernel resolves that
# path through the Pods symlink or as a literal string, the lookup may land at
# either $REPO_ROOT/ or $IOS_DIR/. Copy both env files to the repo root so
# they are found regardless of how the path is traversed.
cp "$IOS_DIR/.xcode.env" "$REPO_ROOT/.xcode.env"
cp "$XCODE_ENV_LOCAL"    "$REPO_ROOT/.xcode.env.local"
echo "  .xcode.env       -> copied to $REPO_ROOT"
echo "  .xcode.env.local -> copied to $REPO_ROOT"

echo "=== ci_post_clone: done ==="
