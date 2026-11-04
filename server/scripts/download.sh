#!/usr/bin/env bash
# Downloads the PocketBase version pinned in server/.pocketbase-version into server/bin/
# and verifies its SHA-256 checksum against the official release.
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(tr -d '[:space:]' < .pocketbase-version)"

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  MINGW* | MSYS* | CYGWIN*) os=windows ;;
  *) echo "Unsupported operating system: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

exe=pocketbase
if [ "$os" = windows ]; then
  exe=pocketbase.exe
fi

if [ -x "bin/$exe" ] && [ "$("bin/$exe" --version)" = "pocketbase version $version" ]; then
  echo "PocketBase $version is already in server/bin/"
  exit 0
fi

asset="pocketbase_${version}_${os}_${arch}.zip"
base_url="https://github.com/pocketbase/pocketbase/releases/download/v${version}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $asset"
curl -fsSL -o "$tmp/$asset" "$base_url/$asset"
curl -fsSL -o "$tmp/checksums.txt" "$base_url/checksums.txt"

expected="$(awk -v name="$asset" '$2 == name { print $1 }' "$tmp/checksums.txt")"
if command -v sha256sum > /dev/null; then
  actual="$(sha256sum "$tmp/$asset" | cut -d ' ' -f 1)"
else
  actual="$(shasum -a 256 "$tmp/$asset" | cut -d ' ' -f 1)"
fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Checksum mismatch for $asset (expected '$expected', got '$actual')" >&2
  exit 1
fi

mkdir -p bin
if command -v unzip > /dev/null; then
  unzip -o -q "$tmp/$asset" "$exe" -d bin
elif command -v bsdtar > /dev/null; then
  bsdtar -xf "$tmp/$asset" -C bin "$exe"
else
  python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extract(sys.argv[2], "bin")' "$tmp/$asset" "$exe"
fi
chmod +x "bin/$exe"

echo "PocketBase $version installed in server/bin/$exe"
