import type { RunState } from '../engine/types';

export function journeyClockRunning(run: RunState | null, showTitle: boolean, hidden: boolean): boolean {
  return !!run && !showTitle && !hidden && !['title', 'victory', 'gameover'].includes(run.screen);
}

/** 使用单调时钟计量前一采样区间，切换可见性时先结清再暂停。 */
export class JourneyClock {
  private previous: number;
  private running = false;
  constructor(now: number) { this.previous = now; }
  sample(now: number, running: boolean): number {
    const delta = this.running ? Math.max(0, now - this.previous) : 0;
    this.previous = now;
    this.running = running;
    return delta;
  }
}

export function formatJourneyTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms || 0) / 1000);
  const hours = Math.floor(seconds / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
