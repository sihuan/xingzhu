#!/usr/bin/env bash
# 将 Web 版所需数据（语料 + 字典）实体化到 web/data/。
#
# 仓库内 web/data/ 默认以符号链接引用 app / engine 下的原始数据，本地开发无需运行。
# 以下场景需要运行：
#   - 部署 / 打包 web 目录（如 Cloudflare Pages 构建命令）
#   - 把 web/ 单独拷走
#   - Windows 等不支持符号链接的环境
set -euo pipefail
cd "$(dirname "$0")/.."          # -> web/
REPO_DIR="$(cd .. && pwd)"

CORPUS_SRC="$REPO_DIR/app/src/main/assets/corpus"
KXHC_SRC="$REPO_DIR/engine/src/main/resources/kxhc1983.txt"
RUSHU_SRC="$REPO_DIR/engine/src/main/resources/rushu.txt"

if [ ! -f "$CORPUS_SRC/tang.json.gz" ] || [ ! -f "$KXHC_SRC" ] || [ ! -f "$RUSHU_SRC" ]; then
  echo "找不到源数据（app/src/main/assets/corpus 与 engine/src/main/resources）。" >&2
  echo "本脚本需在完整仓库中运行；若只部署 web/，请先把实体数据一并复制。" >&2
  exit 1
fi

rm -f data/corpus data/kxhc1983.txt data/rushu.txt
mkdir -p data/corpus
cp -f "$CORPUS_SRC"/* data/corpus/
cp -f "$KXHC_SRC" data/kxhc1983.txt
cp -f "$RUSHU_SRC" data/rushu.txt

echo "已实体化到 web/data/（语料 $(ls data/corpus | wc -l) 个文件 + 字典 2 个）"
