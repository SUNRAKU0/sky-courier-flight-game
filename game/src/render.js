// render.js — everything Sky Courier draws: sky, perspective ground,
// the plane, rings, trees and the instruments. All art is drawn here
// with canvas paths; there are no image assets at all.

import { CONFIG } from './config.js';
import { clamp, lerp } from './random.js';

function fog(color, amount, sky) {
  // Blend a ground colour toward the haze colour with distance.
  const c = parseInt(color.slice(1), 16);
  const s = parseInt(sky.slice(1), 16);
  const r = Math.round(lerp((c >> 16) & 255, (s >> 16) & 255, amount));
  const g = Math.round(lerp((c >> 8) & 255, (s >> 8) & 255, amount));
  const b = Math.round(lerp(c & 255, s & 255, amount));
  return `rgb(${r},${g},${b})`;
}

export class Renderer {
  constructor(canvas, attitudeCanvas, compassCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.att = attitudeCanvas.getContext('2d');
    this.compass = compassCanvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(640, Math.floor(r.width));
    this.h = Math.max(400, Math.floor(r.height));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  // Project a world point into screen space. Returns null behind camera.
  project(state, wx, wy, wz) {
    const dx = wx - state.x;
    const dz = wz - state.z;
    const ch = Math.cos(state.heading);
    const sh = Math.sin(state.heading);
    const rx = dx * ch - dz * sh;
    const rz = dx * sh + dz * ch;
    if (rz < 4) return null;
    const focal = CONFIG.focal;
    const horizonY = this.h * CONFIG.horizonBase - state.pitch * focal * 0.55;
    const sx = this.w / 2 + (rx / rz) * focal;
    const sy = horizonY - ((wy - state.y) / rz) * focal;
    return { x: sx, y: sy, depth: rz, scale: focal / rz };
  }

  drawSky(state, t) {
    const { ctx, w, h } = this;
    const horizonY = h * CONFIG.horizonBase - state.pitch * CONFIG.focal * 0.55;
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    sky.addColorStop(0, '#2f6fd0');
    sky.addColorStop(0.55, '#7fb2e8');
    sky.addColorStop(1, '#cfe6f7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizonY + 40);

    // Sun, upper right, with a soft halo.
    const sunX = w * 0.78;
    const sunY = h * 0.12;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    halo.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    halo.addColorStop(0.25, 'rgba(255, 236, 170, 0.55)');
    halo.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Clouds: soft white ellipses drifting with the world.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of state.world.clouds) {
      const p = this.project(state, c.x, c.y, c.z);
      if (!p) continue;
      const s = c.s * p.scale;
      if (s < 2 || p.x < -120 || p.x > w + 120 || p.y < -60) continue;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x + s * 0.5, p.y + s * 0.08, s * 0.7, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGround(state) {
    const { ctx, w, h } = this;
    const rows = CONFIG.groundRows;
    const cols = CONFIG.groundCols;
    const far = CONFIG.viewDistance;
    const horizonY = h * CONFIG.horizonBase - state.pitch * CONFIG.focal * 0.55;
    const ch = Math.cos(state.heading);
    const sh = Math.sin(state.heading);
    const camH = Math.max(2, state.y);
    // Rows are mapped across the visible ground (horizon to screen bottom),
    // so the ground always fills the view at any altitude: the depth of a
    // screen row follows from the projection, not the other way round.
    const groundTop = Math.max(0, horizonY);
    for (let i = 0; i < rows; i++) {
      const yTop = groundTop + ((h - groundTop) * i) / rows;
      const yBot = groundTop + ((h - groundTop) * (i + 1)) / rows;
      const yMid = (yTop + yBot) / 2;
      const rowH = yBot - yTop;
      const depth = clamp((camH * CONFIG.focal) / Math.max(1, yMid - horizonY), 8, far);
      const halfW = ((w / 2) * depth) / CONFIG.focal;
      const colW = w / cols;
      const fogAmt = clamp(depth / far, 0, 0.85);
      for (let j = 0; j < cols; j++) {
        const lateral = (j / (cols - 1) - 0.5) * 2 * halfW;
        const wx = state.x + lateral * ch + depth * sh;
        const wz = state.z - lateral * sh + depth * ch;
        const tile = state.world.tileAt(wx, wz);
        let color = tile.color;
        if (tile.type === 'runway') {
          // White centreline dashes and edge lines on the runway.
          if (Math.abs(wx - state.world.runway.x) < 2.2 && ((wz % 44) + 44) % 44 < 22) {
            color = '#e8e8e8';
          } else if (Math.abs(Math.abs(wx - state.world.runway.x) - 11) < 1.2) {
            color = '#dfe3e6';
          }
        }
        if (tile.type === 'river') {
          // A little sparkle on the water.
          const sparkle = Math.sin(wx * 0.35 + wz * 0.21) > 0.86;
          if (sparkle) color = '#8fc3ee';
        }
        ctx.fillStyle = fog(color, fogAmt, '#cfe6f7');
        ctx.fillRect(j * colW, yTop, colW + 1, rowH + 1);
      }
    }
  }

  drawTrees(state) {
    const { ctx } = this;
    const near = state.world.trees.filter((tr) => {
      const dz = tr.z - state.z;
      return dz > 25 && dz < 700 && Math.abs(tr.x - state.x) < 500;
    });
    near.sort((a, b) => b.z - a.z);
    for (const tr of near.slice(0, 120)) {
      const gy = state.world.terrainHeight(tr.x, tr.z);
      const p = this.project(state, tr.x, gy + 4, tr.z);
      if (!p || p.x < -20 || p.x > this.w + 20 || p.y > this.h + 20) continue;
      const s = clamp(tr.s * p.scale, 1.5, 22);
      ctx.fillStyle = '#2d5a24';
      ctx.beginPath();
      ctx.arc(p.x, p.y - s * 0.7, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2f18';
      ctx.fillRect(p.x - s * 0.1, p.y - s * 0.5, s * 0.2, s * 0.6);
    }
  }

  drawRings(state, t) {
    const { ctx } = this;
    const next = state.rings.find((r) => !r.hit);
    for (const ring of state.rings) {
      if (ring.hit) continue;
      const p = this.project(state, ring.x, ring.y, ring.z);
      if (!p || p.x < -160 || p.x > this.w + 160 || p.y < -120 || p.y > this.h + 120) continue;
      const rad = ring.r * p.scale;
      if (rad < 2) continue;
      const isNext = ring === next;
      const pulse = isNext ? 0.75 + 0.25 * Math.sin(t * 5) : 0.55;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = isNext ? '#ffd23e' : '#ff9d2e';
      ctx.lineWidth = Math.max(2, rad * 0.14);
      ctx.shadowColor = '#ffd23e';
      ctx.shadowBlur = isNext ? 22 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // Ring number, so the pilot knows the order.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${Math.max(11, Math.min(20, rad * 0.5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(state.rings.indexOf(ring) + 1), p.x, p.y);
    }
  }

  drawDropZone(state, t) {
    if (state.mission !== 'cargo') return;
    const { ctx } = this;
    const dz = state.world.dropZone;
    const p = this.project(state, dz.x, 2, dz.z);
    if (!p) return;
    const rad = dz.radius * p.scale;
    if (rad < 2) return;
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(6, rad), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // A beacon column so the zone is visible from far away.
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 4);
    ctx.fillStyle = '#ffe14d';
    const beamW = Math.max(4, rad * 0.12);
    ctx.fillRect(p.x - beamW / 2, 0, beamW, p.y);
    ctx.restore();
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP ZONE', p.x, Math.max(18, p.y - rad - 12));
  }

  drawCrate(state) {
    if (!state.crate || state.crate.done) return;
    const p = this.project(state, state.crate.x, state.crate.y, state.crate.z);
    if (!p) return;
    const s = Math.max(3, 5 * p.scale);
    this.ctx.fillStyle = '#b07a2e';
    this.ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    this.ctx.strokeStyle = '#5d3f14';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  }

  drawPlane(state, t) {
    const { ctx, w, h } = this;
    const px = w / 2 + (state.mouseNudge || 0) * 26;
    // On the title screen the plane sits low, on the runway, clear of the text.
    const py = h * (state.planeYFrac ?? 0.6) - state.pitch * 90;
    const bank = state.bank;
    const scale = 1 + clamp(state.speed / 400, 0, 0.25);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bank);
    ctx.scale(scale, scale);

    // Tail fin.
    ctx.fillStyle = '#c22f2f';
    ctx.beginPath();
    ctx.moveTo(-34, -4);
    ctx.lineTo(-52, -26);
    ctx.lineTo(-40, -26);
    ctx.lineTo(-24, -6);
    ctx.closePath();
    ctx.fill();

    // Main wings, swept back a little.
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-78, 16);
    ctx.lineTo(-72, 24);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(78, 16);
    ctx.lineTo(72, 24);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c22f2f';
    ctx.fillRect(-78, 15, 10, 4);
    ctx.fillRect(68, 15, 10, 4);

    // Fuselage: a rounded red-and-white body.
    const body = ctx.createLinearGradient(0, -12, 0, 12);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.55, '#f2f2f2');
    body.addColorStop(0.56, '#c22f2f');
    body.addColorStop(1, '#8f1d1d');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.quadraticCurveTo(30, -11, 0, -11);
    ctx.quadraticCurveTo(-34, -10, -44, -2);
    ctx.quadraticCurveTo(-46, 4, -36, 8);
    ctx.quadraticCurveTo(0, 12, 34, 8);
    ctx.quadraticCurveTo(46, 5, 46, 0);
    ctx.closePath();
    ctx.fill();

    // Cockpit windows, lit cyan.
    ctx.fillStyle = '#bfefff';
    ctx.beginPath();
    ctx.ellipse(24, -6, 12, 5, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(26, -7, 5, 2, -0.12, 0, Math.PI * 2);
    ctx.fill();

    // Spinning propeller: a translucent disc with two thin blades.
    const prop = t * (6 + state.speed * 0.35);
    ctx.save();
    ctx.translate(48, 0);
    ctx.fillStyle = 'rgba(60,60,66,0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(prop);
    ctx.fillStyle = 'rgba(40,40,44,0.6)';
    ctx.fillRect(-1.5, -24, 3, 48);
    ctx.restore();
    ctx.fillStyle = '#2b2b2e';
    ctx.beginPath();
    ctx.arc(48, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Boost streaks at the screen edges.
    if (state.boosting) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = ((i * 97 + t * 900) % h + h) % h;
        const x = (i % 2 === 0 ? 18 : w - 18) + Math.sin(i * 7) * 8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 46);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawAttitude(state) {
    const c = this.att;
    const s = 120;
    const cx = s / 2;
    const cy = s / 2;
    c.clearRect(0, 0, s, s);
    c.save();
    c.beginPath();
    c.arc(cx, cy, 56, 0, Math.PI * 2);
    c.clip();
    // Sky and ground halves, rotated by bank, shifted by pitch.
    c.translate(cx, cy);
    c.rotate(-state.bank);
    c.translate(0, state.pitch * 60);
    c.fillStyle = '#3f8fd2';
    c.fillRect(-70, -70, 140, 70);
    c.fillStyle = '#7a5230';
    c.fillRect(-70, 0, 140, 70);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(-70, -1, 140, 2);
    c.restore();
    // Fixed aircraft symbol.
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx - 26, cy);
    c.lineTo(cx + 26, cy);
    c.moveTo(cx, cy - 6);
    c.lineTo(cx, cy + 6);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, 56, 0, Math.PI * 2);
    c.stroke();
  }

  drawCompass(state) {
    const c = this.compass;
    const w = 340;
    const h = 30;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(10,18,32,0.55)';
    c.fillRect(0, 0, w, h);
    const hdg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    const pxPerDeg = 3;
    c.fillStyle = '#eaf6ff';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(hdg + d);
      const norm = ((deg % 360) + 360) % 360;
      const x = w / 2 + d * pxPerDeg;
      const major = norm % 45 === 0;
      const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[norm];
      c.fillStyle = major ? '#ffd23e' : 'rgba(234,246,255,0.6)';
      c.fillRect(x, major ? 4 : 10, 1, major ? 12 : 6);
      if (label) c.fillText(label, x, 23);
      else if (major) c.fillText(String(norm).padStart(3, '0'), x, 23);
    }
    // Centre marker.
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.moveTo(w / 2 - 6, 0);
    c.lineTo(w / 2 + 6, 0);
    c.lineTo(w / 2, 7);
    c.closePath();
    c.fill();
  }

  draw(state, t) {
    this.drawSky(state, t);
    this.drawGround(state);
    this.drawTrees(state);
    this.drawDropZone(state, t);
    this.drawRings(state, t);
    this.drawCrate(state);
    this.drawPlane(state, t);
    this.drawAttitude(state);
    this.drawCompass(state);
  }
}
