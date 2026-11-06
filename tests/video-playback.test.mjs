import test from "node:test";
import assert from "node:assert/strict";
import {waitForVideoReady, reduceBackgroundRendering, monitorCinematic, getVideoPlaybackReports} from "../scripts/video-playback.js";

class Video extends EventTarget {
  readyState = 2; seeking = false; src = "blob:private-video"; currentTime = 0; videoWidth = 1920; videoHeight = 1080;
  frames = {totalVideoFrames: 0, droppedVideoFrames: 0};
  getVideoPlaybackQuality() {return this.frames;}
}
const turn = () => new Promise(resolve => setImmediate(resolve));

test("downloaded bytes do not bypass decoder readiness, including an outstanding seek", async () => {
  const video = new Video(); let ready = false;
  const pending = waitForVideoReady(video).then(() => {ready = true;});
  video.dispatchEvent(new Event("loadeddata")); await turn(); assert.equal(ready, false);
  video.readyState = 4; video.seeking = true; video.dispatchEvent(new Event("canplaythrough")); await turn(); assert.equal(ready, false);
  video.seeking = false; video.dispatchEvent(new Event("seeked")); await pending; assert.equal(ready, true);
});

test("media errors, cancellation, and timeout release a decoder wait instead of hanging the pull", async () => {
  const video = new Video(), pending = waitForVideoReady(video);
  video.error = {code: 4}; video.dispatchEvent(new Event("error")); await assert.rejects(pending, /media error 4/);
  const cancelled = new AbortController(), other = new Video(), waiting = waitForVideoReady(other, {signal: cancelled.signal});
  cancelled.abort(); await assert.rejects(waiting, {name: "AbortError"});
  await assert.rejects(waitForVideoReady(new Video(), {signal: cancelled.signal}), {name: "AbortError"});
  await assert.rejects(waitForVideoReady(new Video(), {timeout: 20}), /did not become ready/);
});

test("background rendering reduction preserves ticker state and restores its previous FPS limit", () => {
  for (const limit of [0, 30, 60, 144]) {
    const ticker = {maxFPS: limit, minFPS: 10, started: false};
    const running = {playState: "running", currentTime: 100, pause() {this.playState = "paused";}, play() {this.playState = "running";}};
    const paused = {playState: "paused", pause() {throw Error("Already paused");}};
    const document = {querySelectorAll: () => [{getAnimations: () => [running, paused]}]};
    const reduction = reduceBackgroundRendering({enabled: true, canvas: {app: {ticker}}, document});
    assert.equal(ticker.maxFPS, 15); assert.equal(ticker.started, false); assert.equal(running.playState, "paused");
    reduction.restore(); reduction.restore(); assert.equal(ticker.maxFPS, limit); assert.equal(ticker.started, false);
    assert.equal(running.playState, "running"); assert.equal(paused.playState, "paused");
  }
});

test("rendering reduction respects lower limits, minimum FPS, and subsequent setting changes", () => {
  for (const [maxFPS, minFPS, expected] of [[10, 5, 10], [60, 30, 30]]) {
    const ticker = {maxFPS, minFPS};
    const reduced = reduceBackgroundRendering({enabled: true, canvas: {app: {ticker}}, document: null});
    assert.equal(ticker.maxFPS, expected); reduced.restore(); assert.equal(ticker.maxFPS, maxFPS);
  }
  const ticker = {maxFPS: 60, minFPS: 10};
  const reduced = reduceBackgroundRendering({enabled: true, canvas: {app: {ticker}}, document: null});
  ticker.maxFPS = 30; reduced.restore(); assert.equal(ticker.maxFPS, 30);
});

test("client opt-out and unavailable background APIs are harmless", () => {
  const ticker = {maxFPS: 60, minFPS: 10};
  const reduced = reduceBackgroundRendering({enabled: false, canvas: {app: {ticker}}, document: {querySelectorAll() {throw Error("Must not inspect animations");}}});
  reduced.restore(); assert.equal(ticker.maxFPS, 60);
  reduceBackgroundRendering({enabled: true, canvas: null, document: null}).restore();
});

test("cinematic reports distinguish local buffering, stalls, and dropped frames without saving source URLs", () => {
  const video = new Video(), original = console.info; console.info = () => {};
  try {
    const monitor = monitorCinematic(video, {preloaded: true, bytes: 25 * 1024 * 1024, backgroundFPS: 15});
    video.readyState = 4; monitor.ready(); video.currentTime = 15.25;
    video.dispatchEvent(new Event("waiting")); video.dispatchEvent(new Event("waiting")); video.dispatchEvent(new Event("stalled"));
    video.frames = {totalVideoFrames: 600, droppedVideoFrames: 12};
    const report = monitor.finish("ended"); monitor.finish("skipped");
    assert.equal(report.localSource, true); assert.equal(report.preloaded, true); assert.equal(report.bufferedMB, 25);
    assert.equal(report.waitingEvents, 2); assert.equal(report.stalledEvents, 1); assert.equal(report.totalFrames, 600); assert.equal(report.droppedFrames, 12);
    assert.equal(report.width, 1920); assert.equal(report.height, 1080); assert.equal(report.mediaSeconds, 15.25);
    assert(!JSON.stringify(report).includes(video.src));
    const saved = getVideoPlaybackReports(); saved.at(-1).droppedFrames = 0; assert.equal(getVideoPlaybackReports().at(-1).droppedFrames, 12);
    video.dispatchEvent(new Event("waiting")); assert.equal(getVideoPlaybackReports().at(-1).waitingEvents, 2);
    for (let i = 0; i < 12; i++) monitorCinematic(video).finish("skipped");
    assert.equal(getVideoPlaybackReports().length, 10);
  } finally {console.info = original;}
});

test("unsupported frame-quality counters are recorded as unavailable", () => {
  const original = console.info; console.info = () => {};
  try {
    const video = new Video(); video.getVideoPlaybackQuality = undefined;
    const report = monitorCinematic(video).finish("ended");
    assert.equal(report.totalFrames, null); assert.equal(report.droppedFrames, null);
  } finally {console.info = original;}
});
