/**
 * Block-breaker simulation. Pure state and maths: no DOM, no listeners, no
 * canvas. `render` is the only function that touches a 2d context, and it is
 * handed one rather than looking one up.
 *
 * All velocities are per second. `step` accumulates real elapsed time and runs
 * fixed 1/60 s sub-steps, so a 60 Hz and a 120 Hz caller produce the same
 * trajectory.
 */

const BRICK_W = 20;
const BRICK_H = 5;
const GAP_X = 8;
const GAP_Y = 11;
const PITCH_X = BRICK_W + GAP_X; // 28
const PITCH_Y = BRICK_H + GAP_Y; // 16
const ROWS = 6;
const TOP = 70;
const SIDE_MARGIN = 40;

const PADDLE_W = 84;
const PADDLE_H = 7;
const PADDLE_LIFT = 40; // distance from the floor to the paddle's top edge
const PADDLE_SPEED = 520; // px/s for keyboard steering
const PADDLE_BAND = 10; // how far past the paddle top a hit still counts

const BALL_R = 4;
const LAUNCH_VX = 156; // 2.6 px/frame at 60 Hz
const LAUNCH_VY = -204; // -3.4 px/frame at 60 Hz
const MAX_VX = 300;

/**
 * The wireframe added `(ball.x - paddle.x) * 0.05` to a per-frame velocity.
 * Scaled to per-second units that is the same nudge times 60.
 */
const PADDLE_INFLUENCE = 0.05 * 60;

const BRICK_SCORE = 10;
const START_LIVES = 3;
const FIXED = 1 / 60;
const EPSILON = 1e-9;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function buildBricks(width) {
  const cols = Math.floor((width - SIDE_MARGIN) / PITCH_X);
  const offX = (width - (cols * PITCH_X - GAP_X)) / 2;
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: offX + c * PITCH_X,
        y: TOP + r * PITCH_Y,
        alive: true,
      });
    }
  }
  return { cols, offX, bricks };
}

/** Park the ball on the paddle and stop it. */
function dock(state) {
  state.ball.x = state.paddle.x;
  state.ball.y = state.paddleY - state.ball.r;
  state.ball.vx = 0;
  state.ball.vy = 0;
}

export function createGame(width, height) {
  const { cols, offX, bricks } = buildBricks(width);
  const state = {
    width,
    height,
    cols,
    rows: ROWS,
    offX,
    brickW: BRICK_W,
    brickH: BRICK_H,
    paddleY: height - PADDLE_LIFT,
    bricks,
    paddle: { x: width / 2, w: PADDLE_W, h: PADDLE_H },
    ball: { x: width / 2, y: 0, vx: 0, vy: 0, r: BALL_R },
    score: 0,
    lives: START_LIVES,
    phase: "ready",
    started: false,
    acc: 0,
  };
  dock(state);
  return state;
}

/** Rebuild the board from either end state. */
function restart(state) {
  const { cols, offX, bricks } = buildBricks(state.width);
  state.cols = cols;
  state.offX = offX;
  state.bricks = bricks;
  state.paddle.x = state.width / 2;
  state.score = 0;
  state.lives = START_LIVES;
  state.phase = "ready";
  state.started = false;
  dock(state);
}

function loseLife(state) {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = "lost";
    dock(state);
    return;
  }
  state.phase = "ready";
  state.started = false;
  dock(state);
}

/**
 * Resolve the ball against the bricks on one axis at a time. Testing x and y
 * separately is what keeps a corner hit from tunnelling through a brick.
 */
function hitBricks(state, axis) {
  const { ball } = state;
  for (const b of state.bricks) {
    if (!b.alive) continue;
    if (ball.x + ball.r <= b.x) continue;
    if (ball.x - ball.r >= b.x + BRICK_W) continue;
    if (ball.y + ball.r <= b.y) continue;
    if (ball.y - ball.r >= b.y + BRICK_H) continue;

    b.alive = false;
    state.score += BRICK_SCORE;
    if (axis === "x") {
      ball.x = ball.vx > 0 ? b.x - ball.r : b.x + BRICK_W + ball.r;
      ball.vx = -ball.vx;
    } else {
      ball.y = ball.vy > 0 ? b.y - ball.r : b.y + BRICK_H + ball.r;
      ball.vy = -ball.vy;
    }
    return true;
  }
  return false;
}

function substep(state, input, dt) {
  const { ball, paddle } = state;
  const half = paddle.w / 2;
  const lo = half;
  const hi = state.width - half;

  if (input.restart && (state.phase === "lost" || state.phase === "won")) {
    restart(state);
    return;
  }

  // Steering. A pointer position wins over the keys when it is present.
  if (typeof input.paddleX === "number" && Number.isFinite(input.paddleX)) {
    const next = clamp(input.paddleX, lo, hi);
    if (next !== paddle.x) {
      paddle.x = next;
      state.started = true;
    }
  } else if (input.left !== input.right) {
    const dir = input.left ? -1 : 1;
    const next = clamp(paddle.x + dir * PADDLE_SPEED * dt, lo, hi);
    if (next !== paddle.x) {
      paddle.x = next;
      state.started = true;
    }
  }
  if (input.launch) state.started = true;

  if (state.phase === "ready") {
    if (!state.started) {
      dock(state);
      return;
    }
    state.phase = "playing";
    ball.x = paddle.x;
    ball.y = state.paddleY - ball.r;
    ball.vx = LAUNCH_VX;
    ball.vy = LAUNCH_VY;
  }

  if (state.phase !== "playing") return;

  // --- x axis ---
  ball.x += ball.vx * dt;
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > state.width - ball.r) {
    ball.x = state.width - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }
  hitBricks(state, "x");

  // --- y axis ---
  ball.y += ball.vy * dt;
  if (ball.y < ball.r) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }
  hitBricks(state, "y");

  // --- paddle ---
  const top = state.paddleY;
  if (
    ball.vy > 0 &&
    ball.y > top - ball.r &&
    ball.y < top + PADDLE_BAND &&
    Math.abs(ball.x - paddle.x) < half
  ) {
    ball.vy = -Math.abs(ball.vy);
    ball.vx = clamp(
      ball.vx + (ball.x - paddle.x) * PADDLE_INFLUENCE,
      -MAX_VX,
      MAX_VX,
    );
  }

  if (state.bricks.every((b) => !b.alive)) {
    state.phase = "won";
    return;
  }

  if (ball.y - ball.r > state.height) loseLife(state);
}

export function step(state, input, dt) {
  const cmd = input || {};
  state.acc += dt;
  let guard = 0;
  while (state.acc >= FIXED - EPSILON && guard < 240) {
    state.acc -= FIXED;
    guard += 1;
    substep(state, cmd, FIXED);
  }
  if (guard >= 240) state.acc = 0; // a long stall must not fast-forward the game
  return state;
}

/**
 * Draw the board. The only function here that knows about a 2d context, and
 * it is given every colour it uses. Score, lives and messages are DOM.
 */
export function render(ctx, state, palette) {
  ctx.clearRect(0, 0, state.width, state.height);

  for (const b of state.bricks) {
    ctx.fillStyle = b.alive ? palette.brick : palette.track;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
  }

  const { paddle, ball } = state;
  ctx.fillStyle = palette.paddle;
  ctx.fillRect(paddle.x - paddle.w / 2, state.paddleY, paddle.w, paddle.h);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
}
