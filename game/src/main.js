// main.js — Sky Courier's game loop: state machine, flight physics,
// the three missions, fuel and damage, scoring, HUD and sound.
// The world is deterministic from ?seed=; ?scene= picks a screenshot pose.

import { CONFIG } from './config.js';
import { World } from './world.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { clamp, lerp } from './random.js';
import { applyScene } from './shots.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || String(CONFIG.seedDefault), 10) || CONFIG.seedDefault;
    this.scene = params.get('scene') || null;
    this.world = new World(this.seed);

    this.canvas = $('game');
    this.renderer = new Renderer(
      this.canvas,
      $('attitude'),
      $('compass'),
    );
    this.input = new Input(this.canvas);

    // Flight state. x east, y altitude above the valley floor, z north.
    this.state = 'title'; // title | playing | ended
    this.x = 0;
    this.y = 0;
    this.z = this.world.runway.z0 + 60;
    this.heading = 0;
    this.pitch = 0; // radians, + nose up
    this.bank = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = CONFIG.fuelCapacity;
    this.damage = 0;
    this.score = 0;
    this.mission = 'rings'; // rings | cargo | landing
    this.boosting = false;
    this.crate = null;
    this.dropped = false;
    this.landed = false;
    this.endReason = '';
    this.time = 0;
    this.ringsHit = 0;
    this.mouseNudge = 0;
    this.audio = null;
    this.engineOsc = null;
    this.engineGain = null;

    this.bindUI();
    applyScene(this, this.scene);
    this.updateHUD();

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.step(dt);
      this.renderer.draw(this.viewState(), this.time);
      this.updateHUD();
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    window.addEventListener('resize', () => this.renderer.resize());
  }

  viewState() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      heading: this.heading,
      pitch: this.pitch,
      bank: this.bank,
      speed: this.speed,
      throttle: this.throttle,
      fuel: this.fuel,
      damage: this.damage,
      score: this.score,
      mission: this.mission,
      rings: this.world.rings,
      crate: this.crate,
      boosting: this.boosting,
      mouseNudge: this.mouseNudge,
      planeYFrac: this.state === 'playing' ? 0.6 : 0.86,
      world: this.world,
    };
  }

  bindUI() {
    const start = (mission) => {
      this.mission = mission;
      this.startFlight();
    };
    $('btn-rings').addEventListener('click', () => start('rings'));
    $('btn-cargo').addEventListener('click', () => start('cargo'));
    $('btn-landing').addEventListener('click', () => start('landing'));
    $('btn-restart').addEventListener('click', () => this.resetToTitle());
    $('btn-again').addEventListener('click', () => this.startFlight());
    this.canvas.addEventListener('mousedown', () => {
      if (this.state === 'title') this.startFlight();
      else if (this.state === 'ended') this.resetToTitle();
    });
  }

  resetToTitle() {
    this.state = 'title';
    this.x = 0;
    this.y = 0;
    this.z = this.world.runway.z0 + 60;
    this.heading = 0;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = CONFIG.fuelCapacity;
    this.damage = 0;
    this.score = 0;
    this.crate = null;
    this.dropped = false;
    this.landed = false;
    this.endReason = '';
    for (const r of this.world.rings) r.hit = false;
    this.ringsHit = 0;
    $('title-screen').classList.remove('hidden');
    $('end-screen').classList.add('hidden');
  }

  startFlight() {
    this.ensureAudio();
    this.resetToTitle();
    this.state = 'playing';
    $('title-screen').classList.add('hidden');
    $('end-screen').classList.add('hidden');
    this.throttle = 0.55;
    this.speed = 30;
  }

  ensureAudio() {
    if (this.audio) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audio = new AC();
      this.engineOsc = this.audio.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.audio.createGain();
      this.engineGain.gain.value = 0.0;
      const filter = this.audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.audio.destination);
      this.engineOsc.start();
    } catch (e) {
      this.audio = null;
    }
  }

  beep(freq, dur = 0.12, type = 'sine', vol = 0.12) {
    if (!this.audio) return;
    try {
      const o = this.audio.createOscillator();
      const g = this.audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + dur);
    } catch (e) {
      /* no sound, no problem */
    }
  }

  step(dt) {
    const inp = this.input;
    // Mouse position nudges the camera a touch, left and right.
    this.mouseNudge = (inp.mouseX - 0.5) * 2;

    if (this.state === 'title') {
      // The plane sits on the runway, prop ticking over, world alive.
      this.time += 0;
      return;
    }
    if (this.state === 'ended') {
      if (inp.pressed('Enter') || inp.consumeClick()) this.resetToTitle();
      return;
    }

    // --- Controls ---
    const pitchIn = (inp.down('ArrowUp') || inp.down('KeyW') ? 1 : 0) -
      (inp.down('ArrowDown') || inp.down('KeyS') ? 1 : 0);
    const bankIn = (inp.down('ArrowRight') || inp.down('KeyD') ? 1 : 0) -
      (inp.down('ArrowLeft') || inp.down('KeyA') ? 1 : 0);
    if (inp.down('ShiftLeft') || inp.down('ShiftRight')) {
      this.throttle = clamp(this.throttle + CONFIG.throttleStep * dt, 0, 1);
    }
    if (inp.down('ControlLeft') || inp.down('ControlRight')) {
      this.throttle = clamp(this.throttle - CONFIG.throttleStep * dt, 0, 1);
    }
    this.boosting = inp.down('Space') && this.fuel > 0;

    // --- Flight model ---
    const targetSpeed = lerp(CONFIG.minSpeed, CONFIG.maxSpeed, this.throttle) +
      (this.boosting ? CONFIG.boostSpeed : 0);
    this.speed = lerp(this.speed, targetSpeed, clamp(dt * 0.6, 0, 1));
    // Pitch is capped so the plane can't flip nose-over-tail in one hard yank of the stick.
    const pitchLimit = 0.5;
    this.pitch = clamp(this.pitch + pitchIn * 0.7 * dt, -pitchLimit, pitchLimit);
    const targetBank = bankIn * CONFIG.bankMax;
    this.bank = lerp(this.bank, targetBank, clamp(dt * 5, 0, 1));
    this.heading += -this.bank * CONFIG.turnRate * dt;

    const climb = Math.sin(this.pitch) * (this.speed > CONFIG.minSpeed ? CONFIG.climbSpeed : -CONFIG.sinkSpeed);
    // Below minimum speed the plane stalls and sinks.
    const stall = this.speed < CONFIG.minSpeed ? -CONFIG.sinkSpeed * 0.7 : 0;
    this.y += (climb + stall) * dt;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    // --- Fuel ---
    const burn = lerp(CONFIG.fuelBurnIdle, CONFIG.fuelBurn, this.throttle) +
      (this.boosting ? CONFIG.boostDrain : 0);
    this.fuel = Math.max(0, this.fuel - burn * dt);

    // --- Cargo drop ---
    if (this.mission === 'cargo' && !this.dropped && inp.pressed('KeyC')) {
      this.dropped = true;
      this.crate = { x: this.x, y: this.y, z: this.z, vy: 0, done: false };
      this.beep(520, 0.08, 'square', 0.08);
    }
    if (this.crate && !this.crate.done) {
      this.crate.vy += 9.8 * dt;
      this.crate.y -= this.crate.vy * dt;
      this.crate.z += this.speed * 0.55 * dt;
      const gy = this.world.terrainHeight(this.crate.x, this.crate.z);
      if (this.crate.y <= gy) {
        this.crate.done = true;
        const dz = this.world.dropZone;
        const d = Math.hypot(this.crate.x - dz.x, this.crate.z - dz.z);
        if (d < dz.radius) {
          this.score += CONFIG.dropScore;
          this.showToast(`Direct hit! +${CONFIG.dropScore}`);
          this.beep(880, 0.2, 'sine', 0.15);
        } else if (d < dz.radius * 2) {
          this.score += CONFIG.dropScoreNear;
          this.showToast(`Close — near the zone +${CONFIG.dropScoreNear}`);
        } else {
          this.showToast('Crate missed the zone');
        }
        this.crate = null;
      }
    }

    // --- Rings ---
    if (this.mission === 'rings') {
      for (const ring of this.world.rings) {
        if (ring.hit) continue;
        const d = Math.hypot(this.x - ring.x, this.y - ring.y, this.z - ring.z);
        if (d < ring.r) {
          ring.hit = true;
          this.ringsHit += 1;
          this.score += CONFIG.ringScore;
          this.showToast(`Ring ${this.ringsHit}/${this.world.rings.length} +${CONFIG.ringScore}`);
          this.beep(1040, 0.15, 'sine', 0.15);
          if (this.ringsHit === this.world.rings.length) {
            this.endFlight('Ring Run complete!', true);
            return;
          }
        }
      }
    }

    // --- Ground contact ---
    const ground = this.world.terrainHeight(this.x, this.z);
    const onRunway =
      Math.abs(this.x - this.world.runway.x) < this.world.runway.width / 2 &&
      this.z >= this.world.runway.z0 &&
      this.z <= this.world.runway.z1;
    if (this.y <= ground + 0.5) {
      this.y = ground;
      if (onRunway) {
        const sink = -(climb + stall);
        if (this.mission === 'landing' && this.speed < CONFIG.landingMaxSpeed && sink < CONFIG.landingMaxSink) {
          this.landed = true;
          this.score += CONFIG.landingScore;
          this.beep(660, 0.25, 'sine', 0.15);
          this.endFlight(`Smooth landing! +${CONFIG.landingScore}`, true);
        } else if (this.speed < CONFIG.landingMaxSpeed + 12) {
          this.damage += CONFIG.damageHardLanding;
          this.showToast('Hard landing — airframe damaged');
          this.beep(180, 0.2, 'sawtooth', 0.12);
          this.speed = Math.max(0, this.speed - 20);
          if (this.damage >= CONFIG.maxDamage) this.endFlight('Airframe gave out', false);
        } else {
          this.damage += CONFIG.damageGroundHit;
          this.showToast('Too fast for the runway!');
          if (this.damage >= CONFIG.maxDamage) this.endFlight('Crashed on the runway', false);
        }
        // Roll out along the runway.
        this.y = ground;
        this.speed = Math.max(0, this.speed - 30 * dt);
        this.pitch = 0;
        if (this.speed <= 0.5 && this.mission === 'landing' && !this.landed) {
          this.endFlight('Stopped on the runway', this.landed);
        }
      } else {
        this.damage += CONFIG.damageGroundHit;
        this.beep(120, 0.3, 'sawtooth', 0.15);
        this.endFlight('Crashed into the terrain', false);
        return;
      }
    }

    // --- Fuel out ---
    if (this.fuel <= 0) {
      this.throttle = 0;
      this.endFlight('Out of fuel', false);
      return;
    }

    // --- Stay inside the valley ---
    if (Math.abs(this.x) > 2800 || this.z < -400 || this.z > 4800) {
      this.heading += Math.PI;
      this.showToast('Turning back — edge of the valley');
    }

    // --- Engine hum follows the throttle ---
    if (this.audio && this.engineOsc) {
      this.engineOsc.frequency.value = 45 + this.throttle * 70 + (this.boosting ? 30 : 0);
      this.engineGain.gain.value = 0.02 + this.throttle * 0.03;
    }
  }

  showToast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  endFlight(reason, success) {
    this.state = 'ended';
    this.endReason = reason;
    this.speed = 0;
    $('end-title').textContent = success ? 'Sortie complete!' : 'Sortie over';
    $('end-reason').textContent = reason;
    $('end-score').textContent = `Score: ${this.score}`;
    $('end-screen').classList.remove('hidden');
    if (this.engineGain) this.engineGain.gain.value = 0;
  }

  updateHUD() {
    const hdg = ((this.state === 'title' ? 0 : this.heading) * 180 / Math.PI % 360 + 360) % 360;
    $('hud-alt').textContent = `${Math.max(0, Math.round(this.y))} m`;
    $('hud-spd').textContent = `${Math.round(this.speed * 3.6)} km/h`;
    $('hud-hdg').textContent = `${String(Math.round(hdg)).padStart(3, '0')}°`;
    $('hud-fuel').style.width = `${clamp(this.fuel, 0, 100)}%`;
    $('hud-fuel').classList.toggle('low', this.fuel < 25);
    $('hud-dmg').style.width = `${clamp(this.damage, 0, 100)}%`;
    $('hud-score').textContent = String(this.score);
    const lm = this.world.nearestLandmark(this.x, this.z);
    $('hud-near').textContent = `${lm.name} ${lm.dist} m`;
    const missionNames = {
      rings: `Ring Run — ${this.ringsHit}/${this.world.rings.length} rings`,
      cargo: this.dropped ? 'Cargo dropped — check the zone' : 'Cargo Drop — press C over the yellow zone',
      landing: 'Landing Challenge — touch down under 198 km/h',
    };
    $('hud-mission').textContent = missionNames[this.mission];
    $('hud-thr').style.width = `${Math.round(this.throttle * 100)}%`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
