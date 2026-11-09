#!/bin/zsh
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js LTS：https://nodejs.org/en/download'
  echo '安装后重新双击本文件。按回车关闭。'
  read
  exit 1
fi
node server.mjs
if [ $? -ne 0 ]; then
  echo '启动失败，请查看上方提示。按回车关闭。'
  read
fi
