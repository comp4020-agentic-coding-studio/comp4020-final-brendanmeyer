// Mouse, touch and keyboard all drive the same normalized cursor state
// (planning.md section 9): 0,0 is the canvas's top-left, 1,1 its
// bottom-right, regardless of viewport size or input device.

export interface Vec2 {
  x: number;
  y: number;
}

const KEY_STEP = 0.02;
const KEY_POLL_MS = 50;

export function trackInput(canvas: HTMLCanvasElement, onMove: (pos: Vec2) => void): void {
  let current: Vec2 = { x: 0.5, y: 0.5 };
  const keys = { up: false, down: false, left: false, right: false };

  function setFromClient(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    current = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
    onMove(current);
  }

  canvas.addEventListener("mousemove", (e) => setFromClient(e.clientX, e.clientY));

  canvas.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0];
      if (touch) setFromClient(touch.clientX, touch.clientY);
      e.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      if (touch) setFromClient(touch.clientX, touch.clientY);
    },
    { passive: false },
  );

  function setKey(key: string, down: boolean): void {
    if (key === "arrowup" || key === "w") keys.up = down;
    else if (key === "arrowdown" || key === "s") keys.down = down;
    else if (key === "arrowleft" || key === "a") keys.left = down;
    else if (key === "arrowright" || key === "d") keys.right = down;
  }

  window.addEventListener("keydown", (e) => setKey(e.key.toLowerCase(), true));
  window.addEventListener("keyup", (e) => setKey(e.key.toLowerCase(), false));

  setInterval(() => {
    if (!keys.up && !keys.down && !keys.left && !keys.right) return;
    current = {
      x: Math.max(0, Math.min(1, current.x + (keys.right ? KEY_STEP : 0) - (keys.left ? KEY_STEP : 0))),
      y: Math.max(0, Math.min(1, current.y + (keys.down ? KEY_STEP : 0) - (keys.up ? KEY_STEP : 0))),
    };
    onMove(current);
  }, KEY_POLL_MS);
}
