/** 第三章与终章素材清单；原始设计提示词保存在同目录 txt。 */
import { readFileSync } from 'node:fs';
const chapters = [[3, 'three'], [4, 'four']];
export const laterChapterArt = Object.fromEntries(chapters.flatMap(([chapter, word]) => {
  const spec = readFileSync(new URL(`./chapter-${word}-art.txt`, import.meta.url), 'utf8');
  const assets = [...spec.matchAll(/^\d+\s+(\w+)\.(png|jpg)\s+(.+)$/gm)].map(([,id,ext,subject]) => ({
    id, prompt: `${spec.split('精确文件名')[0].split('怪物清单')[0]}\n本次只生成这一张独立图片：${subject}`,
    size: ext === 'png' ? '1024x1024' : '1536x1024', transparent: ext === 'png',
  }));
  return [[`chapter${chapter}_enemies`, assets.filter(a => a.transparent)], [`chapter${chapter}_backgrounds`, assets.filter(a => !a.transparent)]];
}));
