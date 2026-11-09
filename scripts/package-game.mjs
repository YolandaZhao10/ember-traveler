import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = join(root, 'release');
const name = 'EmberTraveler-play';
const folder = join(release, name);
const zip = join(release, name + '.zip');
// 仅拷贝生产构建与启动文件，不包含源码、密钥、依赖或浏览器存档。
await mkdir(release, { recursive: true });
await rm(folder, { recursive: true, force: true });
await rm(zip, { force: true });
await cp(join(root, 'dist'), join(folder, 'site'), {
  recursive: true, filter: (path) => !basename(path).startsWith('.'),
});
await cp(join(root, 'scripts/play'), folder, {
  recursive: true, filter: (path) => !basename(path).startsWith('.'),
});
await chmod(join(folder, 'play-macos.command'), 0o755);
const bat = join(folder, 'play-windows.bat');
await writeFile(bat, (await readFile(bat, 'utf8')).replace(/\r?\n/g, '\r\n'));
const result = spawnSync('zip', ['-qr', zip, name], { cwd: release, stdio: 'inherit' });
if (result.error || result.status !== 0) {
  throw new Error('ZIP 打包失败，需要系统 zip 命令；已生成的试玩文件夹：' + folder);
}
console.log('可直接转发的试玩包：' + zip);
