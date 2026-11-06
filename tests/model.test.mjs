import test from "node:test";
import assert from "node:assert/strict";
import {newSequence, seekSequence, advanceSequence, skipTenPull, readyAt, hasSummary} from "../scripts/model.js";

test("single 3/4/5-star pulls hold indefinitely then close without cards", () => {
  for (const stars of [3, 4, 5]) {
    const state = newSequence([stars]);
    assert.equal(advanceSequence(state), false);
    seekSequence(state, readyAt(stars), stars); seekSequence(state, 1e9, stars);
    assert.equal(state.phase, "holding"); assert.equal(state.index, 0);
    assert.equal(advanceSequence(state), true); assert.equal(state.phase, "complete");
    assert.equal(hasSummary(state), false); assert.equal(advanceSequence(state), false);
  }
});
test("ten pulls retain their supplied order and show a summary after the tenth click", () => {
  const order = [3, 4, 3, 3, 5, 3, 3, 3, 3, 3], original = [...order], state = newSequence(order);
  for (let i = 0; i < order.length; i++) {
    assert.equal(state.index, i); assert.equal(advanceSequence(state), false);
    seekSequence(state, readyAt(order[i]), order[i]); assert.equal(advanceSequence(state), true);
    assert.equal(state.phase, i === 9 ? "summary" : "intro");
  }
  assert.deepEqual(order, original); assert.equal(hasSummary(state), true);
});
test("other batch sizes never create a ten-pull summary", () => {
  for (const count of [0, 2, 9, 11]) assert.equal(hasSummary(newSequence(Array(count).fill(3))), false);
});

test("ten-pull skip preserves a five-star at any original position, then opens the summary", () => {
  for (let position = 0; position < 10; position++) {
    const order = Array(10).fill(3); order[position] = 5;
    const before = [...order], state = newSequence(order);
    assert.equal(skipTenPull(state), true); assert.equal(state.index, position); assert.equal(state.phase, "intro");
    assert.equal(skipTenPull(state), false); assert.equal(advanceSequence(state), false);
    seekSequence(state, readyAt(5), 5); assert.equal(advanceSequence(state), true); assert.equal(state.phase, "summary");
    assert.deepEqual(order, before);
  }
});

test("skip keeps all remaining five-stars in order and never restarts one already on screen", () => {
  const state = newSequence([5, 3, 4, 3, 5, 3, 3, 4, 3, 5]);
  seekSequence(state, 500, 5); assert.equal(skipTenPull(state), true);
  assert.equal(state.time, 500); assert.equal(state.phase, "intro");
  for (const index of [0, 4, 9]) {
    assert.equal(state.index, index); seekSequence(state, readyAt(5), 5); advanceSequence(state);
  }
  assert.equal(state.phase, "summary");
  const later = newSequence([5, 3, 4, 3, 5, 3, 3, 4, 3, 3]);
  seekSequence(later, readyAt(5), 5); advanceSequence(later);
  skipTenPull(later); assert.equal(later.index, 4); // Do not replay the five-star already viewed.
});

test("skip goes straight to all ten rewards without five-stars and is unavailable on singles", () => {
  const state = newSequence([3, 4, 3, 3, 4, 3, 3, 4, 3, 3]);
  assert.equal(skipTenPull(state), true); assert.equal(state.phase, "summary"); assert.equal(state.count, 10);
  for (const count of [0, 1, 2, 9, 11]) {
    const other = newSequence(Array(count).fill(5)), before = structuredClone(other);
    assert.equal(skipTenPull(other), false); assert.deepEqual(other, before);
  }
});
