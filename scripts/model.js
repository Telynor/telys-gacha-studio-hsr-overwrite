export const backgroundAt = stars => stars === 5 ? 1680 : 160;
export const readyAt = stars => backgroundAt(stars) + 1200;
export function newSequence(rewards) { return {index: 0, time: 0, count: rewards.length, phase: rewards.length ? "intro" : "complete"}; }
export function seekSequence(state, time, stars) {
  if (state.index >= state.count) return state;
  state.time = time;
  state.phase = time < backgroundAt(stars) ? "intro" : time < readyAt(stars) ? "reveal" : "holding";
  return state;
}
export const hasSummary = state => state.count === 10;
export function advanceSequence(state) {
  if (state.phase !== "holding") return false;
  state.index++; state.time = 0;
  state.phase = state.index >= state.count ? hasSummary(state) ? "summary" : "complete" : "intro";
  return true;
}
