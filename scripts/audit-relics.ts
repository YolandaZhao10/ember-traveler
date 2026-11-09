import { RELIC_LIST } from '../src/data/relics';
import { relicMechanicDuplicates } from '../src/test/relicIdentityAudit';

const current = RELIC_LIST.filter(r => r.chapter !== 4);
const collisions = relicMechanicDuplicates();
const descriptions = new Map<string, string[]>();
for (const r of current) descriptions.set(r.description, [...(descriptions.get(r.description) ?? []), r.id]);
const identicalDescriptions = [...descriptions.values()].filter(ids => ids.length > 1);
console.log(JSON.stringify({
  catalog: RELIC_LIST.length,
  obtainable: current.length,
  retiredChapterFour: RELIC_LIST.length - current.length,
  mechanicCollisions: collisions,
  identicalDescriptions,
  scope: '忽略数值、阈值、名称、稀有度与来源；保留触发时机、频率类型、条件与资源种类。跨池覆盖和实际强度仍需人工及结算测试。',
}, null, 2));
if (collisions.length || identicalDescriptions.length) process.exitCode = 1;
