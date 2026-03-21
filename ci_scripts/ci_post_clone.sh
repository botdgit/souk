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

# Write .xcode.env.local with the absolute node path so that Xcode script
# phases (e.g. "Bundle React Native code and images") can find node even when
# Xcode Cloud does not inherit the Homebrew PATH during PhaseScriptExecution.
NODE_ABS="$(command -v node)"
XCODE_ENV_LOCAL="$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios/.xcode.env.local"
echo "export NODE_BINARY=${NODE_ABS}" > "$XCODE_ENV_LOCAL"
echo "Wrote .xcode.env.local: NODE_BINARY=${NODE_ABS}"

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

echo "=== ci_post_clone: done ==="
