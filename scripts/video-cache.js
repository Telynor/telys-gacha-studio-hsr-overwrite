const MB = 1024 * 1024;
const aborted = () => new DOMException("Video preparation was skipped.", "AbortError");

/** Encoded video bytes stay local to this browser; active playback leases pin URLs. */
export class VideoMemoryCache {
  constructor({maxBytes = 256 * MB, fetcher = (...args) => globalThis.fetch(...args), urls = globalThis.URL, timeout = 120000, concurrency = 2} = {}) {
    Object.assign(this, {maxBytes, fetcher, urls, timeout, concurrency});
    this.entries = new Map(); this.bytes = 0; this.running = 0; this.clock = 0;
  }

  setLimit(bytes) {this.maxBytes = Math.max(1, Number(bytes) || 256 * MB); this.trim();}
  stats() {return {bytes: this.bytes, limit: this.maxBytes, entries: this.entries.size, loading: [...this.entries.values()].filter(entry => !entry.url).length};}

  entry(src) {
    const key = String(src || "").trim();
    if (!key) throw new Error("A video source is required.");
    let entry = this.entries.get(key);
    if (entry) {entry.used = ++this.clock; return entry;}
    entry = {src: key, refs: 0, size: 0, loaded: 0, total: 0, used: ++this.clock, listeners: new Set(), state: "queued", controller: new AbortController()};
    entry.promise = new Promise((resolve, reject) => {entry.resolve = resolve; entry.reject = reject;});
    entry.promise.catch(() => {});
    this.entries.set(key, entry);
    return entry;
  }

  warm(src) {
    if (!this.entries.has(String(src || "").trim()) && [...this.entries.values()].filter(entry => !entry.url).length >= 8) return Promise.resolve(null);
    const entry = this.entry(src); this.drain(); return entry.promise;
  }

  acquire(src, {signal, onProgress} = {}) {
    if (signal?.aborted) return Promise.reject(aborted());
    const entry = this.entry(src); entry.refs++;
    if (onProgress) entry.listeners.add(onProgress);
    this.emit(entry);
    this.drain();
    return new Promise((resolve, reject) => {
      let cancelled = false, released = false;
      const release = () => {if (released) return; released = true; entry.refs--; this.trim();};
      const detach = () => {entry.listeners.delete(onProgress); signal?.removeEventListener("abort", cancel);};
      const cancel = () => {if (cancelled) return; cancelled = true; detach(); release(); reject(aborted());};
      signal?.addEventListener("abort", cancel, {once: true});
      if (signal?.aborted) cancel();
      entry.promise.then(url => {
        if (cancelled) return;
        detach(); resolve({src: entry.src, url, bytes: entry.size, release});
      }, error => {if (cancelled) return; detach(); release(); reject(error);});
    });
  }

  emit(entry) {
    for (const listener of entry.listeners) {
      try {listener({loaded: entry.loaded, total: entry.total});} catch { /* UI observers never block video downloads. */ }
    }
  }

  drain() {
    while (this.running < this.concurrency) {
      const entry = [...this.entries.values()].filter(entry => entry.state === "queued").sort((a, b) => b.refs - a.refs || a.used - b.used)[0];
      if (!entry) return;
      entry.state = "loading"; this.running++;
      this.download(entry).then(url => entry.resolve(url), error => {
        if (this.entries.get(entry.src) === entry) this.entries.delete(entry.src);
        entry.reject(error);
      }).finally(() => {this.running--; this.trim(); this.drain();});
    }
  }

  async download(entry) {
    const timer = setTimeout(() => entry.controller.abort(), this.timeout);
    let reader;
    try {
      const response = await this.fetcher(entry.src, {signal: entry.controller.signal, credentials: "same-origin"});
      if (!response.ok) throw new Error(`Video download failed (${response.status}).`);
      entry.total = Math.max(0, Number(response.headers?.get("content-length")) || 0);
      if (entry.total > this.maxBytes) throw new Error("Video exceeds the browser video preload memory limit.");
      let blob;
      if (response.body?.getReader) {
        reader = response.body.getReader(); const chunks = [];
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          if (entry.controller.signal.aborted) throw aborted();
          entry.loaded += value.byteLength;
          if (entry.loaded > this.maxBytes) throw new Error("Video exceeds the browser video preload memory limit.");
          chunks.push(value); this.emit(entry);
        }
        blob = new Blob(chunks, {type: response.headers?.get("content-type") || "video/mp4"});
      } else blob = await response.blob();
      if (entry.controller.signal.aborted) throw aborted();
      if (!blob.size) throw new Error("The video file is empty.");
      if (blob.size > this.maxBytes) throw new Error("Video exceeds the browser video preload memory limit.");
      entry.size = blob.size; entry.loaded = blob.size; entry.total = blob.size;
      entry.url = this.urls.createObjectURL(blob); entry.state = "ready"; this.bytes += blob.size;
      this.emit(entry); return entry.url;
    } catch (error) {
      entry.controller.abort();
      try {await reader?.cancel();} catch { /* The request may already be closed. */ }
      throw error;
    } finally {clearTimeout(timer); reader?.releaseLock?.();}
  }

  trim() {
    for (const entry of [...this.entries.values()].filter(entry => entry.url && !entry.refs).sort((a, b) => a.used - b.used)) {
      if (this.bytes <= this.maxBytes && this.entries.size <= 12) break;
      this.evict(entry);
    }
  }

  evict(entry) {
    if (entry.url) {this.urls.revokeObjectURL(entry.url); this.bytes -= entry.size;}
    if (entry.state === "queued") entry.reject(aborted());
    entry.controller.abort(); this.entries.delete(entry.src);
  }

  clear({force = false} = {}) {
    for (const entry of [...this.entries.values()]) if (force || !entry.refs) this.evict(entry);
  }
}

export const videoCache = new VideoMemoryCache();
