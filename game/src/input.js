// input.js — keyboard and mouse state for Sky Courier.
// The game polls this each frame; nothing here touches the game itself.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0.5; // 0..1 across the canvas
    this.mouseY = 0.5;
    this.clicked = false; // true for one frame after a click
    this._pressed = new Set(); // keys pressed since last poll

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) this._pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) / r.width;
      this.mouseY = (e.clientY - r.top) / r.height;
    });
    canvas.addEventListener('mousedown', () => {
      this.clicked = true;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  pressed(code) {
    if (this._pressed.has(code)) {
      this._pressed.delete(code);
      return true;
    }
    return false;
  }

  consumeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  endFrame() {
    this._pressed.clear();
  }
}
