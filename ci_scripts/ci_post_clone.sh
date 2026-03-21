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

echo "=== ci_post_clone: adding Pods-Souk explicit target dependency ==="

# Xcode 16 eagerly schedules PrecompileSwiftBridgingHeader/SwiftGeneratePch
# before implicit link dependencies (libPods-Souk.a) are fully built. Adding an
# explicit PBXTargetDependency from Souk -> Pods-Souk forces the build system to
# complete all pod targets before any Swift compilation phase in Souk starts.
#
# Runs AFTER pod install so CocoaPods cannot overwrite the change.
# Non-fatal: ci_pre_xcodebuild.sh (pod pre-build to archive SYMROOT) is the
# primary module-map fix; this xcodeproj step is belt-and-suspenders.
#
# Uses unquoted heredoc (<<RUBY not <<'RUBY') so the shell expands
# $CI_PRIMARY_REPOSITORY_PATH inline — avoids the fragile "ruby - ARGS <<'RUBY'"
# pattern for passing ARGV via stdin. require 'rubygems' is explicit because
# xcodeproj may not be on the load path outside the CocoaPods process.
ruby <<RUBY || echo "WARNING: Target dependency injection skipped (non-fatal)"
require 'rubygems'
require 'xcodeproj'

ios_dir       = "$CI_PRIMARY_REPOSITORY_PATH/apps/mobile/ios"
main_path     = File.join(ios_dir, 'Souk.xcodeproj')
pods_path     = File.join(ios_dir, 'Pods', 'Pods.xcodeproj')

unless File.exist?(pods_path)
  warn "#{pods_path} not found - skipping"
  exit 0
end

main_project   = Xcodeproj::Project.open(main_path)
pods_project   = Xcodeproj::Project.open(pods_path)
pods_aggregate = pods_project.targets.find { |t| t.name == 'Pods-Souk' }
souk_target    = main_project.targets.find { |t| t.name == 'Souk' }

unless pods_aggregate && souk_target
  warn "Pods-Souk or Souk target not found - skipping"
  exit 0
end

# Find or create PBXFileReference for Pods/Pods.xcodeproj.
# container_portal must be this object's UUID, not a path string.
pods_proj_ref = main_project.files.find { |f| f.path&.end_with?('Pods.xcodeproj') }
unless pods_proj_ref
  pods_proj_ref = main_project.new(Xcodeproj::Project::Object::PBXFileReference)
  pods_proj_ref.path = 'Pods/Pods.xcodeproj'
  pods_proj_ref.name = 'Pods.xcodeproj'
  pods_proj_ref.source_tree = '<group>'
  pods_proj_ref.last_known_file_type = 'wrapper.pb-project'
  main_project.main_group << pods_proj_ref
end

# Remove stale dependencies (UUIDs shift on each pod install with
# deterministic_uuids => false).
souk_target.dependencies.select { |dep|
  dep.name == 'Pods-Souk' || dep.target_proxy&.remote_info == 'Pods-Souk'
}.each { |dep|
  dep.target_proxy.remove_from_project if dep.target_proxy
  dep.remove_from_project
}

container_proxy = main_project.new(Xcodeproj::Project::Object::PBXContainerItemProxy)
container_proxy.container_portal        = pods_proj_ref.uuid
container_proxy.proxy_type              = '1'
container_proxy.remote_global_id_string = pods_aggregate.uuid
container_proxy.remote_info             = pods_aggregate.name

dependency = main_project.new(Xcodeproj::Project::Object::PBXTargetDependency)
dependency.name         = pods_aggregate.name
dependency.target_proxy = container_proxy

souk_target.dependencies << dependency
main_project.save

puts "Souk -> Pods-Souk target dependency added (uuid: #{pods_aggregate.uuid})"
RUBY

echo "=== ci_post_clone: done ==="
