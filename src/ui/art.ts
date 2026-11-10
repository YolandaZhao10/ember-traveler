import { useSyncExternalStore } from 'react';
import { visualPreferences, type VisualPreferences } from '../engine/save';

/**
 * 位图贴图清单：public/art/manifest.json 由 scripts/gen-art.mjs 生成。
 * 没有清单或某张图缺失时，界面回退到内置 SVG 形象。
 */
let manifest: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();
const simpleArt: Record<string, string> = {};
let styles = visualPreferences({});

/** 切换整套美术；保留已加载清单，切回精细模式时不重新请求。 */
export function setArtStylePreference(value: VisualPreferences) {
  if (JSON.stringify(styles) === JSON.stringify(value)) return;
  styles = value;
  for (const listener of listeners) listener();
}

const selectedArt = (category: keyof VisualPreferences) => styles[category] === 'simple' ? simpleArt : manifest;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useCardStyle() { return useSyncExternalStore(subscribe, () => styles.cards); }

export function loadArtManifest() {
  if (loaded || typeof fetch === 'undefined') return;
  loaded = true;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
  fetch(`${base}art/manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: Record<string, string>) => {
      manifest = {};
      for (const [k, v] of Object.entries(m)) manifest[k] = base + v.replace(/^\//, '');
      for (const l of listeners) l();
    })
    .catch(() => {
      /* 无贴图，使用 SVG */
    });
}

export function useArt(category: keyof VisualPreferences): Record<string, string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selectedArt(category),
  );
}

export function artUrl(id: string): string | undefined {
  return selectedArt(id.startsWith('char_') ? 'characters' : id.startsWith('enemy_') ? 'enemies' : id.startsWith('art_') ? 'cards' : 'backgrounds')[id];
}
