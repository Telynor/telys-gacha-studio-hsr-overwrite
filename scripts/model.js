export const backgroundAt = stars => stars === 5 ? 1680 : 160;
export const readyAt = stars => backgroundAt(stars) + 1200;
export function newSequence(rewards) {
  return {index: 0, time: 0, count: rewards.length, phase: rewards.length ? "intro" : "complete", skipLower: false,
    fiveStars: rewards.flatMap((reward, index) => (reward?.stars ?? reward) === 5 ? [index] : [])};
}
export function seekSequence(state, time, stars) {
  if (state.index >= state.count) return state;
  state.time = time;
  state.phase = time < backgroundAt(stars) ? "intro" : time < readyAt(stars) ? "reveal" : "holding";
  return state;
}
export const hasSummary = state => state.count === 10;
function selectReward(state, index) {
  state.index = index; state.time = 0;
  state.phase = state.index >= state.count ? hasSummary(state) ? "summary" : "complete" : "intro";
}
/** Skip presentation only. Keep every remaining five-star at its original index. */
export function skipTenPull(state) {
  if (!hasSummary(state) || state.skipLower || !["intro", "reveal", "holding"].includes(state.phase)) return false;
  state.skipLower = true;
  if (!state.fiveStars.includes(state.index)) selectReward(state, state.fiveStars.find(index => index > state.index) ?? state.count);
  return true;
}
export function advanceSequence(state) {
  if (state.phase !== "holding") return false;
  selectReward(state, state.skipLower ? state.fiveStars.find(index => index > state.index) ?? state.count : state.index + 1);
  return true;
}
