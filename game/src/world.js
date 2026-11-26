// world.js — the valley Sky Courier flies over, built from one seed.
// Fields, a road, a river, hills and the runway are all pure functions of
// (x, z, seed), so the terrain never changes between runs and the plane
// can always find the runway where the map says it is.

import { CONFIG } from './config.js';
import { mulberry32, hash2, range, pick } from './random.js';

const FIELD_COLORS = [
  '#7fae4e', '#8fbf5a', '#a8b545', '#c2a94e', '#6f9e46',
  '#9dbb63', '#b5a04a', '#86ad52', '#7aa24f', '#c8b25e',
];

export class World {
  constructor(seed) {
    this.seed = seed;
    const rng = mulberry32(seed);

    // The runway is fixed so the landing challenge is always findable.
    this.runway = { ...CONFIG.runway };

    // A road that winds gently north, east of the runway.
    this.roadBaseX = 320;
    this.roadAmp = 90;
    this.roadFreq = 0.00045;
    this.roadPhase = rng() * 6.28;

    // A river that meanders west of the runway.
    this.riverBaseX = -360;
    this.riverAmp = 130;
    this.riverFreq = 0.00035;
    this.riverPhase = rng() * 6.28;

    // Rolling hill phases, so hills sit in the same places every run.
    this.hillPhaseX = rng() * 6.28;
    this.hillPhaseZ = rng() * 6.28;

    // Field patch colours, one per 140 m cell, from the seed.
    this.fieldSeed = Math.floor(rng() * 100000);

    // The Ring Run course: eight rings weaving north from the runway.
    this.rings = [];
    let rx = 0;
    let rz = this.runway.z1 + 220;
    for (let i = 0; i < CONFIG.ringCount; i++) {
      rx += range(rng, -180, 180);
      rx = Math.max(-420, Math.min(420, rx));
      const alt = range(rng, 60, 150);
      this.rings.push({ x: rx, z: rz, y: alt, r: CONFIG.ringRadius, hit: false });
      rz += range(rng, 260, 380);
    }

    // The cargo drop zone: a painted circle in a field north-east.
    this.dropZone = { ...CONFIG.dropZone };

    // A few puffy clouds, placed by the seed, drifting slowly.
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        x: range(rng, -1400, 1400),
        y: range(rng, 240, 420),
        z: range(rng, 200, 3600),
        s: range(rng, 60, 150),
      });
    }

    // Scattered trees as little dark-green dots the renderer draws.
    this.trees = [];
    for (let i = 0; i < 240; i++) {
      const x = range(rng, -1500, 1500);
      const z = range(rng, -200, 4200);
      if (Math.abs(x - this.roadX(z)) < 14) continue;
      if (Math.abs(x - this.riverX(z)) < 24) continue;
      if (Math.abs(x - this.runway.x) < 40 && z > this.runway.z0 - 60 && z < this.runway.z1 + 60) continue;
      this.trees.push({ x, z, s: range(rng, 3, 6) });
    }
  }

  roadX(z) {
    return this.roadBaseX + Math.sin(z * this.roadFreq + this.roadPhase) * this.roadAmp;
  }

  riverX(z) {
    return this.riverBaseX + Math.sin(z * this.riverFreq + this.riverPhase) * this.riverAmp;
  }

  // Gentle rolling hills, flattened to a pancake near the runway so
  // landings are fair.
  terrainHeight(x, z) {
    const nearRunway =
      Math.abs(x - this.runway.x) < 90 && z > this.runway.z0 - 120 && z < this.runway.z1 + 120;
    if (nearRunway) return 0;
    const h =
      Math.sin(x * CONFIG.terrainHillFreq + this.hillPhaseX) *
        Math.sin(z * CONFIG.terrainHillFreq * 0.8 + this.hillPhaseZ) *
        CONFIG.terrainHillAmp +
      Math.sin(x * 0.0011 + z * 0.0007) * 2.5;
    return h;
  }

  // What the ground looks like at (x, z): a tile type and a base colour.
  tileAt(x, z) {
    const rw = this.runway;
    if (Math.abs(x - rw.x) < rw.width / 2 && z >= rw.z0 && z <= rw.z1) {
      return { type: 'runway', color: '#3c3f45' };
    }
    if (Math.abs(x - this.roadX(z)) < 5) {
      return { type: 'road', color: '#5a5a5e' };
    }
    if (Math.abs(x - this.riverX(z)) < 13) {
      return { type: 'river', color: '#4d8fd1' };
    }
    const dx = x - this.dropZone.x;
    const dz = z - this.dropZone.z;
    if (dx * dx + dz * dz < this.dropZone.radius * this.dropZone.radius) {
      return { type: 'dropzone', color: '#d8b13a' };
    }
    // Patchwork fields: 140 m cells, colour picked by a hash of the cell.
    const cx = Math.floor(x / 140);
    const cz = Math.floor(z / 140);
    const idx = Math.floor(hash2(cx, cz, this.fieldSeed) * FIELD_COLORS.length);
    return { type: 'field', color: FIELD_COLORS[idx] };
  }

  // A short label for the nearest landmark, for the HUD's "nearest" line.
  nearestLandmark(x, z) {
    const rw = this.runway;
    const dRunway = Math.hypot(x - rw.x, z - (rw.z0 + rw.z1) / 2);
    const dDrop = Math.hypot(x - this.dropZone.x, z - this.dropZone.z);
    if (dRunway < dDrop) return { name: 'RUNWAY', dist: Math.round(dRunway) };
    return { name: 'DROP ZONE', dist: Math.round(dDrop) };
  }
}
