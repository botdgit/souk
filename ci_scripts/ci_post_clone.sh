#!/bin/sh
set -e

echo "=== ci_post_clone: installing JS dependencies ==="

# Xcode Cloud checks out into CI_PRIMARY_REPOSITORY_PATH.
# The monorepo root contains a yarn workspaces setup.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Enable Corepack so the correct yarn version is used
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi

# Install Node dependencies for the whole monorepo.
# This is required before `pod install` because the Podfile resolves
# expo and react-native package paths via `node --print require.resolve(...)`.
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
else
  npm ci
fi

echo "=== ci_post_clone: running pod install ==="

cd "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
pod install

echo "=== ci_post_clone: done ==="
