import {ID, setting} from "./constants.js";

const reports = [];
const clock = () => globalThis.performance?.now?.() ?? Date.now();
export const getVideoPlaybackReports = () => reports.map(report => ({...report}));

/** The file can be downloaded before the actual video element has decoded frames. */
export function waitForVideoReady(video, {signal, timeout = 15000} = {}) {
  return new Promise((resolve, reject) => {
    const events = ["loadeddata", "canplay", "canplaythrough", "progress", "seeked"];
    let timer, done = false;
    const finish = error => {
      if (done) return; done = true; clearTimeout(timer);
      for (const event of events) video.removeEventListener(event, check);
      video.removeEventListener("error", failed); signal?.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const aborted = () => finish(new DOMException("Cinematic preparation cancelled.", "AbortError"));
    const failed = () => finish(new Error(`The cinematic could not be decoded (media error ${video.error?.code ?? "unknown"}).`));
    const check = () => {if (video.error) failed(); else if (video.readyState >= 3 && !video.seeking) finish();};
    for (const event of events) video.addEventListener(event, check);
    video.addEventListener("error", failed); signal?.addEventListener("abort", aborted, {once: true});
    timer = setTimeout(() => finish(new Error("The cinematic decoder did not become ready in time.")), timeout);
    if (signal?.aborted) aborted(); else check();
  });
}

/** Reduce only this client's hidden scene; never pause the world or stop a ticker. */
export function reduceBackgroundRendering({enabled = setting(ID, "reduceBackgroundRendering", true), canvas = globalThis.canvas, document = globalThis.document} = {}) {
  const animations = []; let ticker, previousFPS, appliedFPS, restored = false;
  if (enabled) {
    try {
      ticker = canvas?.app?.ticker;
      previousFPS = Number(ticker?.maxFPS);
      const targetFPS = Math.max(15, Number(ticker?.minFPS) || 0);
      if (Number.isFinite(previousFPS) && previousFPS >= 0 && (!previousFPS || previousFPS > targetFPS)) {
        ticker.maxFPS = targetFPS; appliedFPS = ticker.maxFPS;
      }
    } catch { /* Scene rendering is optional when the canvas API is unavailable. */ }
    for (const root of document?.querySelectorAll?.(".gacha-app") || []) {
      try {
        for (const animation of root.getAnimations?.({subtree: true}) || []) {
          if (animation.playState !== "running") continue;
          animation.pause(); animations.push({animation, time: animation.currentTime});
        }
      } catch { /* Unsupported banner animations keep their original behavior. */ }
    }
  }
  return {backgroundFPS: appliedFPS ?? null, restore() {
    if (restored) return; restored = true;
    try {if (appliedFPS !== undefined && ticker.maxFPS === appliedFPS) ticker.maxFPS = previousFPS;} catch { /* The scene may have been destroyed. */ }
    for (const {animation, time} of animations) {
      try {if (animation.playState === "paused" && animation.currentTime === time && animation.effect?.target?.isConnected !== false) animation.play();} catch { /* The banner may have closed. */ }
    }
  }};
}

function quality(video) {
  try {
    const value = video.getVideoPlaybackQuality?.();
    return {total: value?.totalVideoFrames ?? video.webkitDecodedFrameCount ?? null, dropped: value?.droppedVideoFrames ?? video.webkitDroppedFrameCount ?? null};
  } catch {return {total: null, dropped: null};}
}

/** A small local record makes buffering failures distinguishable from dropped frames. */
export function monitorCinematic(video, {bytes = 0, preloaded = false, backgroundFPS = null} = {}) {
  const initial = quality(video), started = clock();
  const report = {version: globalThis.game?.modules?.get(ID)?.version || "unknown", localSource: /^blob:/i.test(video.src), preloaded,
    bufferedMB: Math.round(bytes / 1024 / 1024 * 100) / 100, backgroundFPS, waitingEvents: 0, stalledEvents: 0, decoderWaitMs: null};
  let finished;
  const waiting = () => {report.waitingEvents++;}, stalled = () => {report.stalledEvents++;};
  video.addEventListener("waiting", waiting); video.addEventListener("stalled", stalled);
  return {ready() {
    report.decoderWaitMs = Math.round(clock() - started);
    console.info(`${ID} | Cinematic decoder ready`, {...report, width: video.videoWidth || 0, height: video.videoHeight || 0, readyState: video.readyState});
  }, finish(reason) {
    if (finished) return {...finished};
    video.removeEventListener("waiting", waiting); video.removeEventListener("stalled", stalled);
    const final = quality(video);
    finished = {...report, reason, width: video.videoWidth || 0, height: video.videoHeight || 0, readyState: video.readyState,
      mediaSeconds: Math.round((video.currentTime || 0) * 100) / 100,
      totalFrames: final.total === null ? null : Math.max(0, final.total - (initial.total || 0)),
      droppedFrames: final.dropped === null ? null : Math.max(0, final.dropped - (initial.dropped || 0))};
    reports.push(finished); if (reports.length > 10) reports.shift();
    console.info(`${ID} | Cinematic playback report`, finished);
    return {...finished};
  }};
}
