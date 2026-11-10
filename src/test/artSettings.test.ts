import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRun, loadSettings, saveRun, saveSettings, visualPreferences } from '../engine/save';
import { newRun } from '../engine/run';

const key = 'ember-traveler:settings';
function storage(raw?: string) {
  const data = new Map<string, string>(raw === undefined ? [] : [[key, raw]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  return data;
}
afterEach(() => vi.unstubAllGlobals());

describe('画风偏好独立保存', () => {
  it('人物、怪物、背景、三档卡牌可以混用，旧全局简易设置不覆盖新选择', () => {
    const visuals = { characters: 'detailed', enemies: 'simple', backgrounds: 'simple', cards: 'ornate' } as const;
    storage(JSON.stringify({ sound: false, fastAnim: true, artStyle: 'simple', visuals }));
    expect(visualPreferences(loadSettings())).toEqual(visuals);
    saveSettings({ ...loadSettings(), visuals: { ...visuals, cards: 'normal' } });
    expect(loadSettings().visuals).toEqual({ ...visuals, cards: 'normal' });
    expect(visualPreferences({ artStyle: 'simple' })).toEqual({ characters: 'simple', enemies: 'simple', backgrounds: 'simple', cards: 'simple' });
  });
  it('旧设置缺少画风字段时沿用精细画风并保留音效动画偏好', () => {
    storage(JSON.stringify({ sound: false, fastAnim: true }));
    expect(loadSettings()).toEqual({ sound: false, fastAnim: true, artStyle: 'detailed', visuals: visualPreferences({}) });
  });
  it.each(['{', 'null', '{"artStyle":"unknown"}'])('损坏或未知设置安全回退：%s', raw => {
    storage(raw);
    expect(loadSettings()).toEqual({ sound: true, fastAnim: false, artStyle: 'detailed', visuals: visualPreferences({}) });
  });
  it('两套画风均可恢复，切换不改动对局与随机状态', () => {
    const data = storage();
    const run = newRun('ART-SETTINGS', 'picker'); saveRun(run);
    const before = data.get('ember-traveler:save');
    for (const artStyle of ['simple', 'detailed'] as const) {
      saveSettings({ sound: false, fastAnim: true, artStyle });
      expect(loadSettings()).toEqual({ sound: false, fastAnim: true, artStyle, visuals: visualPreferences({ artStyle }) });
      expect(data.get('ember-traveler:save')).toBe(before);
      expect(loadRun()).toEqual(run);
    }
  });
  it('禁止写入本地存储时仍可使用设置', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } });
    expect(loadSettings().artStyle).toBe('detailed');
    expect(() => saveSettings({ sound: true, fastAnim: false, artStyle: 'simple' })).not.toThrow();
  });
});
