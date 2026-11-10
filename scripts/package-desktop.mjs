import { packager } from '@electron/packager';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = join(root, 'release');
const source = join(release, 'desktop-source');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const runtimeVersion = '45.2.3';
await mkdir(release, { recursive: true });
await rm(source, { recursive: true, force: true });
await mkdir(source, { recursive: true });
await cp(join(root, 'dist'), join(source, 'site'), { recursive: true });
await cp(join(root, 'scripts/desktop/main.cjs'), join(source, 'main.cjs'));
await writeFile(join(source, 'package.json'), JSON.stringify({ name: 'ember-traveler', productName: '余烬旅人', author: 'YolandaZhao10', version, main: 'main.cjs', description: '余烬旅人桌面试玩版' }, null, 2));
const selected = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const targets = [
  { platform: 'win32', arch: 'x64', label: 'Windows-x64', launch: '完整解压后，双击文件夹中的“余烬旅人.exe”。请保留旁边的所有文件，不要只转发 exe。' },
  { platform: 'darwin', arch: 'arm64', label: 'macOS-AppleSilicon', launch: '适用 M 系列芯片 Mac。解压后双击“余烬旅人.app”，也可以拖入“应用程序”文件夹。' },
  { platform: 'darwin', arch: 'x64', label: 'macOS-Intel', launch: '适用 Intel 芯片 Mac。解压后双击“余烬旅人.app”，也可以拖入“应用程序”文件夹。' },
];
for (const target of targets.filter(t => !selected || selected.includes(t.label))) {
  const [folder] = await packager({
    dir: source, name: '余烬旅人', platform: target.platform, arch: target.arch,
    electronVersion: runtimeVersion, appVersion: version, appBundleId: 'io.embertraveler.game',
    out: join(release, 'desktop-builds', version), overwrite: true, asar: true, prune: false,
    download: { cacheRoot: join(release, '.electron-cache') },
  });
  const instructions = `余烬旅人 v${version} · ${target.label}\n\n${target.launch}\n\n无需另外安装 Node.js 或浏览器，可离线游玩。\n这是未公证、未使用开发者证书签名的试玩版，首次打开可能出现系统确认提示。请仅从项目的 GitHub 发布页下载。\n桌面版存档独立保存在当前系统用户目录，重新解压更新仍可继续；它不会自动读取原浏览器里的存档。\n快捷键：1–9/0 选牌，Space 打出，E 结束回合，R 快速 SL；牌堆窗口数字选牌、Enter 确认、Esc 取消。奖励页1/2/3选牌、S跳过、Enter继续；地图WASD/方向键选点、Enter进入。\n\nhttps://github.com/YolandaZhao10/ember-traveler/releases\n`;
  await writeFile(join(folder, '开始游玩.txt'), instructions);
  const zip = join(release, `EmberTraveler-v${version}-${target.label}.zip`);
  await rm(zip, { force: true });
  const command = target.platform === 'darwin' ? 'ditto' : 'zip';
  const args = target.platform === 'darwin' ? ['-c', '-k', '--sequesterRsrc', '--keepParent', folder, zip] : ['-qr', zip, folder.slice(dirname(folder).length + 1)];
  const result = spawnSync(command, args, { cwd: dirname(folder), stdio: 'inherit' });
  if (result.error || result.status) throw new Error(`桌面打包失败：${target.label}`);
  console.log(zip);
}
