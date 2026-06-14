/** Mulberry32 PRNG — deterministic from integer seed (e.g. training session id). */
export function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error("pick: empty array");
      }
      return arr[this.nextInt(0, arr.length - 1)]!;
    },
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = this.nextInt(0, i);
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}
