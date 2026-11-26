// shots.js — deterministic poses for Sky Courier's screenshots.
// ?scene=start|play|end&seed=7 puts the game into a fixed state so its
// maker can take honest screenshots of the real game running.
// This is a normal demo feature of the game itself, not a test hook.

export function applyScene(game, scene) {
  if (!scene) return;
  const world = game.world;

  if (scene === 'start') {
    // Title screen, the plane parked on the runway, engine idling.
    game.state = 'title';
    game.x = 0;
    game.y = 0;
    game.z = world.runway.z0 + 60;
    game.heading = 0;
    game.pitch = 0.02;
    game.bank = 0;
    game.speed = 0;
    game.throttle = 0;
    game.mission = 'rings';
  } else if (scene === 'play') {
    // Mid-flight, chasing the first ring, HUD lit, fuel healthy.
    const ring = world.rings[0];
    game.state = 'playing';
    game.mission = 'rings';
    game.x = ring.x - 40;
    game.y = ring.y + 6;
    game.z = ring.z - 260;
    game.heading = Math.atan2(ring.x - game.x, ring.z - game.z);
    game.pitch = 0.04;
    game.bank = 0.12;
    game.speed = 78;
    game.throttle = 0.72;
    game.fuel = 82;
    game.damage = 0;
    game.score = 100;
    game.ringsHit = 1;
    world.rings[0].hit = true;
    document.getElementById('title-screen').classList.add('hidden');
  } else if (scene === 'end') {
    // Just after a smooth landing: the end screen over the runway.
    game.state = 'ended';
    game.mission = 'landing';
    game.x = 0;
    game.y = 0;
    game.z = world.runway.z0 + 420;
    game.heading = 0;
    game.pitch = 0;
    game.bank = 0;
    game.speed = 0;
    game.throttle = 0;
    game.fuel = 41;
    game.damage = 0;
    game.score = 300;
    game.landed = true;
    document.getElementById('title-screen').classList.add('hidden');
    game.endFlight('Smooth landing! +200', true);
  }
}
