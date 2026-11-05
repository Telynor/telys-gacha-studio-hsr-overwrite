import test from "node:test";
import assert from "node:assert/strict";
import {newSequence, seekSequence, advanceSequence, readyAt, hasSummary} from "../scripts/model.js";

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
