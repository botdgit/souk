#!/bin/sh
set -e

# Xcode Cloud shell scripts don't inherit the interactive shell PATH.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

# ---------------------------------------------------------------------------
# Pre-build all CocoaPods pod targets to the exact SYMROOT and OBJROOT that
# the subsequent xcodebuild archive will use.
#
# WHY: Xcode 16 introduced eager scheduling of PrecompileSwiftBridgingHeader
# and SwiftGeneratePch for the main app target (Souk). These phases run before
# implicit link-time dependencies (libPods-Souk.a) are fully built, so pod
# targets haven't yet written their .modulemap files to BUILT_PRODUCTS_DIR.
# This causes "module map file not found" and "No such module" errors.
#
# FIX: Pre-build the Pods-Souk aggregate target (which depends on all individual
# pod targets) into the archive's SYMROOT before xcodebuild archive starts. When
# the archive build begins, all .modulemap files already exist in the right place,
# so compilation succeeds regardless of the scheduling order.
# ---------------------------------------------------------------------------

# Only run on Xcode Cloud where CI_DERIVED_DATA_PATH is provided.
if [ -z "${CI_DERIVED_DATA_PATH}" ]; then
  echo "=== ci_pre_xcodebuild: CI_DERIVED_DATA_PATH not set – skipping pod pre-build ==="
  exit 0
fi

SCHEME="${CI_SCHEME:-souk}"
IOS_DIR="${CI_PRIMARY_REPOSITORY_PATH}/apps/mobile/ios"
PODS_PROJECT="${IOS_DIR}/Pods/Pods.xcodeproj"

if [ ! -d "${PODS_PROJECT}" ]; then
  echo "=== ci_pre_xcodebuild: ${PODS_PROJECT} not found – skipping pod pre-build ==="
  exit 0
fi

# Archive build intermediates live at this SYMROOT. Pre-built pod outputs written
# here will be found in-place when xcodebuild archive compiles the Souk target.
ARCHIVE_SYMROOT="${CI_DERIVED_DATA_PATH}/Build/Intermediates.noindex/ArchiveIntermediates/${SCHEME}/BuildProductsPath"
ARCHIVE_OBJROOT="${CI_DERIVED_DATA_PATH}/Build/Intermediates.noindex/ArchiveIntermediates/${SCHEME}/IntermediateBuildFilesPath"

echo "=== ci_pre_xcodebuild: pre-building pod targets ==="
echo "  Pods project : ${PODS_PROJECT}"
echo "  SYMROOT      : ${ARCHIVE_SYMROOT}"
echo "  OBJROOT      : ${ARCHIVE_OBJROOT}"

# Build Pods-Souk (a static-library aggregate that depends on every individual
# pod target). All pod targets build as a side-effect, writing their .modulemap
# files to ARCHIVE_SYMROOT/Release-iphoneos/<PodName>/<PodName>.modulemap.
# Code signing is disabled because static pod libraries don't need to be signed.
xcodebuild build \
  -project "${PODS_PROJECT}" \
  -target "Pods-Souk" \
  -configuration Release \
  -sdk iphoneos \
  ONLY_ACTIVE_ARCH=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=NO \
  SWIFT_ENABLE_EXPLICIT_MODULES=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  SYMROOT="${ARCHIVE_SYMROOT}" \
  OBJROOT="${ARCHIVE_OBJROOT}"

echo "=== ci_pre_xcodebuild: pod pre-build complete ==="
