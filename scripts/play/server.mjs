import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('./site/', import.meta.url));
const address = 'http://127.0.0.1:5199/';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, address).pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(resolve(root) + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': data.length, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404).end();
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? '5199 端口已被占用。若游戏已经启动，请直接打开 ' + address + '；否则请先关闭占用该端口的程序。'
    : '启动失败：' + error.message);
  process.exitCode = 1;
});

server.listen(5199, '127.0.0.1', () => {
  console.log('余烬旅人已启动：' + address + '\n游玩时保留此窗口，按 Ctrl+C 停止。');
  if (process.env.EMBER_NO_OPEN === '1') return;
  const [command, args] = process.platform === 'darwin' ? ['open', [address]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', address]]
      : ['xdg-open', [address]];
  const browser = spawn(command, args, { stdio: 'ignore', detached: true });
  browser.on('error', () => console.log('请在浏览器手动打开：' + address));
  browser.unref();
});
