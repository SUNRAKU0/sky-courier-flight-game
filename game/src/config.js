// config.js — every tunable number for Sky Courier, in one place.
// The game reads these; nothing else hard-codes a magic number.

export const CONFIG = {
  // World
  seedDefault: 7,
  worldSize: 6000, // metres of flyable terrain, north (+) and east (+)
  runway: { x: 0, z0: 200, z1: 1100, width: 24 },
  terrainHillAmp: 7, // metres of rolling hill height
  terrainHillFreq: 0.004,

  // Flight model
  minSpeed: 22, // m/s — below this the plane stalls and sinks
  maxSpeed: 118, // m/s at full throttle
  cruiseSpeed: 62,
  climbSpeed: 14, // m/s of climb at full up-pitch and speed
  sinkSpeed: 16, // m/s of sink at full down-pitch
  turnRate: 0.85, // rad/s at full bank
  bankMax: 0.9, // radians of visual bank
  throttleStep: 0.45, // per second while Shift/Ctrl held
  boostSpeed: 26, // extra m/s while Space is held
  boostDrain: 6, // extra fuel per second while boosting

  // Fuel and damage
  fuelCapacity: 100,
  fuelBurn: 0.55, // fuel per second at full throttle
  fuelBurnIdle: 0.12, // fuel per second at zero throttle
  damageGroundHit: 34, // damage for smacking terrain
  damageHardLanding: 18, // damage for a too-fast touchdown
  maxDamage: 100,

  // Missions
  ringCount: 8,
  ringRadius: 18, // metres
  ringScore: 100,
  dropZone: { x: 260, z: 2400, radius: 55 },
  dropScore: 150,
  dropScoreNear: 60, // within 2x radius
  landingScore: 200,
  landingMaxSpeed: 55, // m/s — touch down slower than this
  landingMaxSink: 6, // m/s of vertical speed at touchdown

  // Rendering
  focal: 520, // perspective focal length in pixels
  horizonBase: 0.42, // fraction of canvas height where the horizon sits
  groundRows: 64, // scanline rows drawn for the ground
  groundCols: 40, // terrain samples across each row
  viewDistance: 2600, // metres of ground drawn ahead
};
