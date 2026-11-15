// Keyboard and mouse, read once a frame. Keys are held state; actions are edge-triggered
// (pressed once, then forgotten at the end of the frame), so a menu button never fires twice.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';
export const ACTION_PRISM = 'prism';

/** Keys that map to each action. */
const ACTION_KEYS = {
  [ACTION_CONFIRM]: ['Enter', 'Space'],
  [ACTION_PAUSE]: ['KeyP', 'Escape'],
  [ACTION_RESTART]: ['KeyR'],
  [ACTION_MUTE]: ['KeyM'],
  [ACTION_PRISM]: ['KeyQ'],
};

/** Keys that steer: arrows and WASD, held down. */
const STEER_KEYS = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

/**
 * Listen on the window and the canvas. `toLogical` turns a client pixel into a playfield
 * point (the renderer owns the scale); the input keeps the last click for the menus.
 */
export function createInput(canvas, toLogical) {
  const keys = new Set();
  const pressed = new Set();
  let click = null;
  let mouse = null;
  let mouseHeld = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    for (const [action, codes] of Object.entries(ACTION_KEYS)) {
      if (codes.includes(event.code)) pressed.add(action);
    }
    if (STEER_KEYS[event.code] || ACTION_KEYS[ACTION_CONFIRM].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    mouse = toLogical(event.clientX, event.clientY);
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse = toLogical(event.clientX, event.clientY);
    mouseHeld = true;
    click = { x: mouse.x, y: mouse.y };
  });
  canvas.addEventListener('mouseup', () => {
    mouseHeld = false;
  });

  return {
    /** Steering from the held keys, as a unit-ish vector {x, y} (0,0 when nothing is held). */
    axis() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = STEER_KEYS[code];
        if (dir) {
          x += dir.x;
          y += dir.y;
        }
      }
      if (x !== 0 && y !== 0) {
        const len = Math.hypot(x, y);
        x /= len;
        y /= len;
      }
      return { x, y };
    },

    /** The mouse position in playfield points, or null before the mouse moves. */
    mouse() {
      return mouse;
    },

    /** True while the mouse button is held down (mouse-steer). */
    mouseDown() {
      return mouseHeld;
    },

    /** True when the action was pressed since the last frame. */
    pressed(action) {
      return pressed.has(action);
    },

    /** The last click in playfield points, or null; reading it does not clear it. */
    click() {
      return click;
    },

    /** Forget the last click (call once a menu has used it). */
    clearClick() {
      click = null;
    },

    /** Forget this frame's edge-triggered actions. Call at the end of every frame. */
    endFrame() {
      pressed.clear();
    },
  };
}
