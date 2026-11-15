// A tiny seeded random generator (mulberry32), so a screenshot seed always stages the
// same scene and a replayed game always deals the same shards. No Math.random in the world.

/** Make a generator from an integer seed; every call returns a number in [0, 1). */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max). */
export function randRange(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max]. */
export function randInt(random, min, max) {
  return Math.floor(randRange(random, min, max + 1));
}

/** One element of an array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
