import { useSyncExternalStore } from 'react';

/**
 * 位图贴图清单：public/art/manifest.json 由 scripts/gen-art.mjs 生成。
 * 没有清单或某张图缺失时，界面回退到内置 SVG 形象。
 */
let manifest: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();

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

export function useArt(): Record<string, string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => manifest,
  );
}

export function artUrl(id: string): string | undefined {
  return manifest[id];
}
