#!/bin/sh
set -e

# Xcode Cloud shell scripts don't inherit the interactive shell PATH.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

# ---------------------------------------------------------------------------
# Pre-build all CocoaPods pod targets to the exact SYMROOT/OBJROOT that the
# subsequent xcodebuild archive will use.
#
# WHY: Xcode 16 eagerly schedules PrecompileSwiftBridgingHeader/SwiftCompile
# for the Souk target before pod targets have finished writing their
# .modulemap files to BUILT_PRODUCTS_DIR, causing "module map file not found"
# errors. Pre-building into the archive SYMROOT ensures all .modulemap files
# already exist when the archive's compilation starts.
#
# WHY WORKSPACE (not Pods.xcodeproj directly): React Native / Expo pods
# (Codegen, Hermes, etc.) require the full workspace context — cross-project
# header search paths and xcconfigs that are not available when building
# Pods.xcodeproj in isolation — so the direct-project build fails (code 65).
#
# NON-FATAL: if Souk's own compilation fails during this pre-build (the same
# Xcode 16 scheduling issue can also affect regular builds), pod targets will
# already have written their .modulemap files before Souk was attempted. The
# archive then finds them in-place and compilation succeeds.
# ---------------------------------------------------------------------------

if [ -z "${CI_DERIVED_DATA_PATH}" ]; then
  echo "=== ci_pre_xcodebuild: CI_DERIVED_DATA_PATH not set – skipping ==="
  exit 0
fi

SCHEME="${CI_SCHEME:-souk}"
IOS_DIR="${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile/ios"
WORKSPACE="${IOS_DIR}/Souk.xcworkspace"

if [ ! -d "${WORKSPACE}" ]; then
  echo "=== ci_pre_xcodebuild: ${WORKSPACE} not found – skipping ==="
  exit 0
fi

# These paths must match what xcodebuild archive uses so pre-built outputs
# are found in-place (incremental build skips re-compilation).
ARCHIVE_SYMROOT="${CI_DERIVED_DATA_PATH}/Build/Intermediates.noindex/ArchiveIntermediates/${SCHEME}/BuildProductsPath"
ARCHIVE_OBJROOT="${CI_DERIVED_DATA_PATH}/Build/Intermediates.noindex/ArchiveIntermediates/${SCHEME}/IntermediateBuildFilesPath"

echo "=== ci_pre_xcodebuild: pre-building pod targets ==="
echo "  Workspace : ${WORKSPACE}"
echo "  Scheme    : ${SCHEME}"
echo "  SYMROOT   : ${ARCHIVE_SYMROOT}"
echo "  OBJROOT   : ${ARCHIVE_OBJROOT}"

xcodebuild build \
  -workspace "${WORKSPACE}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  ONLY_ACTIVE_ARCH=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=NO \
  SWIFT_ENABLE_EXPLICIT_MODULES=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  SKIP_INSTALL=YES \
  SYMROOT="${ARCHIVE_SYMROOT}" \
  OBJROOT="${ARCHIVE_OBJROOT}" \
  || echo "WARNING: pre-build did not complete cleanly; pod targets should have built, proceeding to archive"

echo "=== ci_pre_xcodebuild: done ==="
