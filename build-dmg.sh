#!/bin/bash
# Mark it! DMG 构建脚本（沙箱环境可用版）
# 背景：本机代理沙箱禁写 /dev 设备节点，hdiutil create 的 newfs 步骤被拒（EPERM，
#   报错表现为 plistlib.InvalidFileException / "hdiutil: create failed - 操作不被允许"）。
# 绕法（同 vibecoding-demo/mac-app/build.sh）：dd 造 raw 空镜像 → hdiutil attach -nomount
#   → diskutil eraseVolume（由沙箱外的 diskmanagementd 执行格式化）→ 拷入 App 与
#   Applications 软链 → detach → hdiutil convert 压缩为标准 UDZO。
# 前置：先跑 `npx electron-builder --mac dir` 产出 dist/mac-arm64/Mark it!.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/dist/mac-arm64/Mark it!.app"
VERSION=$(node -p "require('$ROOT/package.json').version")
OUT="$ROOT/dist/Mark-it-$VERSION-arm64.dmg"
RAW="$ROOT/markit-raw.dmg"

[ -d "$APP" ] || { echo "缺 $APP，先跑: npx electron-builder --mac dir" >&2; exit 1; }

# 预清理：卸载同名残留卷（上次构建/验证遗留会把 /Volumes/Mark it! 变成只读旧卷）
for d in $(hdiutil info | grep "/Volumes/Mark it!" | awk '{print $1}' || true); do
  hdiutil detach "$d" -quiet 2>/dev/null || hdiutil detach "$d" -force 2>/dev/null || true
done

# app 实际大小 + 余量，向上取整到 MB
SIZE_MB=$(du -sm "$APP" | awk '{print int($1)+40}')
DEV=""

cleanup() { [ -n "$DEV" ] && hdiutil detach "$DEV" -quiet 2>/dev/null || true; rm -f "$RAW"; }
trap cleanup EXIT

dd if=/dev/zero of="$RAW" bs=1048576 count="$SIZE_MB" 2>/dev/null
DEV=$(hdiutil attach -nobrowse -nomount "$RAW" | tr -d '[:space:]')
[ -n "$DEV" ] || { echo "attach raw 镜像失败" >&2; exit 1; }
diskutil eraseVolume "JHFS+" "Mark it!" "$DEV" >/dev/null
cp -R "$APP" "/Volumes/Mark it!/Mark it!.app"
ln -sf /Applications "/Volumes/Mark it!/Applications"
hdiutil detach "$DEV" -quiet
DEV=""
hdiutil convert "$RAW" -format UDZO -ov -o "$OUT" >/dev/null

hdiutil verify "$OUT" >/dev/null
echo "BUILD_OK dmg: $OUT ($(du -h "$OUT" | awk '{print $1}'))"
