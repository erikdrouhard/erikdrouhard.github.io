import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createGame, step } from "../src/scripts/breakout.js";

const SOURCE_URL = new URL("../src/scripts/breakout.js", import.meta.url);

const BRICK_W = 20;
const BRICK_H = 5;
const GAP_X = 8;
const GAP_Y = 11;
const PITCH_X = BRICK_W + GAP_X; // 28
const PITCH_Y = BRICK_H + GAP_Y; // 16
const TOP = 70;

const idle = { left: false, right: false, launch: false, restart: false };

function aliveCount(state) {
  return state.bricks.filter((b) => b.alive).length;
}

test("1. brick grid geometry", () => {
  const state = createGame(1200, 800);
  const cols = Math.floor((1200 - 40) / PITCH_X);
  assert.equal(cols, 41);
  assert.equal(state.cols, 41);
  assert.equal(state.rows, 6);
  assert.equal(state.bricks.length, 41 * 6);

  // centered: offX = (W - (cols * pitch - gap)) / 2
  const offX = (1200 - (cols * PITCH_X - GAP_X)) / 2;
  assert.equal(state.offX, offX);
  assert.equal(offX, 30);

  for (const b of state.bricks) {
    assert.equal((b.x - offX) % PITCH_X, 0, `brick x ${b.x} off the column grid`);
    assert.equal((b.y - TOP) % PITCH_Y, 0, `brick y ${b.y} off the row grid`);
    assert.ok(b.alive);
  }

  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.phase, "ready");
  assert.equal(state.started, false);
});

test("2. ball is still while ready and no input arrives", () => {
  const state = createGame(600, 400);
  const x0 = state.ball.x;
  const y0 = state.ball.y;

  for (let i = 0; i < 60; i++) step(state, idle, 1 / 60);

  assert.equal(state.phase, "ready");
  assert.equal(state.started, false);
  assert.equal(state.ball.x, x0);
  assert.equal(state.ball.y, y0);
});

test("3. a ball moving up into a brick removes exactly that brick and scores", () => {
  const state = createGame(600, 400);
  const bottomRowY = TOP + 5 * PITCH_Y;
  const target = state.bricks.find((b) => b.y === bottomRowY);
  assert.ok(target, "expected a bottom-row brick");

  const before = aliveCount(state);
  state.phase = "playing";
  state.started = true;
  state.ball.x = target.x + BRICK_W / 2;
  state.ball.y = target.y + BRICK_H + state.ball.r + 1;
  state.ball.vx = 0;
  state.ball.vy = -204;

  step(state, idle, 1 / 60);

  assert.equal(target.alive, false, "the target brick should be gone");
  assert.equal(aliveCount(state), before - 1, "exactly one brick should die");
  assert.ok(state.score > 0, "score should increase");
  assert.ok(state.ball.vy > 0, "the ball should be sent back down");
});

test("4. a missed ball costs a life; three misses lose the game", () => {
  const state = createGame(600, 400);

  for (let miss = 1; miss <= 3; miss++) {
    state.phase = "playing";
    state.started = true;
    state.ball.x = 10; // nowhere near the paddle
    state.ball.y = state.height + 20;
    state.ball.vx = 0;
    state.ball.vy = 204;

    step(state, idle, 1 / 60);

    assert.equal(state.lives, 3 - miss, `miss ${miss} should cost a life`);
    if (miss < 3) {
      assert.equal(state.phase, "ready", "the ball should re-dock on the paddle");
      assert.equal(state.ball.x, state.paddle.x);
    } else {
      assert.equal(state.phase, "lost");
    }
  }
});

test("5. clearing every brick wins; restart rebuilds the game", () => {
  const state = createGame(600, 400);
  const total = state.bricks.length;

  state.phase = "playing";
  state.started = true;
  for (const b of state.bricks) b.alive = false;
  state.score = 999;

  step(state, idle, 1 / 60);
  assert.equal(state.phase, "won");

  step(state, { ...idle, restart: true }, 1 / 60);
  assert.equal(state.phase, "ready");
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.started, false);
  assert.equal(aliveCount(state), total);
});

test("6. the same launch is identical at 60 Hz and at 120 Hz", () => {
  const launch = { ...idle, launch: true };

  const a = createGame(600, 400);
  for (let i = 0; i < 120; i++) step(a, launch, 1 / 60);

  const b = createGame(600, 400);
  for (let i = 0; i < 240; i++) step(b, launch, 1 / 120);

  assert.ok(a.started && b.started, "both runs should have launched");
  assert.ok(
    Math.abs(a.ball.x - b.ball.x) < 0.01,
    `ball x drifted: ${a.ball.x} vs ${b.ball.x}`,
  );
  assert.ok(
    Math.abs(a.ball.y - b.ball.y) < 0.01,
    `ball y drifted: ${a.ball.y} vs ${b.ball.y}`,
  );
  assert.equal(a.score, b.score);
  assert.equal(a.lives, b.lives);
});

test("7. the paddle bounce angle follows where the ball lands", () => {
  const hit = (offset) => {
    const state = createGame(600, 400);
    state.phase = "playing";
    state.started = true;
    state.ball.x = state.paddle.x + offset;
    state.ball.y = state.paddleY - 7;
    state.ball.vx = 0;
    state.ball.vy = 204;
    step(state, idle, 1 / 60);
    return state.ball;
  };

  const right = hit(30);
  assert.ok(right.vy < 0, "the ball should come off the paddle going up");
  assert.ok(right.vx > 0, `right-half bounce should go right, got vx ${right.vx}`);

  const left = hit(-30);
  assert.ok(left.vy < 0, "the ball should come off the paddle going up");
  assert.ok(left.vx < 0, `left-half bounce should go left, got vx ${left.vx}`);
});

test("8. the simulation touches no browser globals", () => {
  const source = readFileSync(SOURCE_URL, "utf8");
  for (const forbidden of ["document", "window", "addEventListener"]) {
    assert.ok(
      !source.includes(forbidden),
      `breakout.js should not mention ${forbidden}`,
    );
  }
});
