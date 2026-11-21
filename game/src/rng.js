// Seeded random helpers for Solara Bay: one deterministic stream per seed
// so screenshot scenes and the city layout reproduce exactly.

export function makeSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function rangeRandom(random, low, high) {
  return low + random() * (high - low);
}

export function intRandom(random, low, high) {
  return Math.floor(rangeRandom(random, low, high + 1));
}

export function shuffleCopy(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
