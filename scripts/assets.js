const cache = new Map();
const canvas = (width, height) => Object.assign(document.createElement("canvas"), {width, height});

export function measureImage(image, kind = "art") {
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  const ratio = Math.min(1, 2048 / Math.max(width, height));
  const probe = canvas(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
  const context = probe.getContext("2d", {willReadFrequently: true});
  context.drawImage(image, 0, 0, probe.width, probe.height);
  try {
    const pixels = context.getImageData(0, 0, probe.width, probe.height), {data} = pixels, w = probe.width, h = probe.height;
    const black = kind !== "art" && [0, w - 1, (h - 1) * w, h * w - 1].every(n => {const p = n * 4; return data[p + 3] > 240 && Math.max(data[p], data[p + 1], data[p + 2]) < 24;});
    let left = w, top = h, right = -1, bottom = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (black && Math.max(data[p], data[p + 1], data[p + 2]) <= 24) {data[p + 3] = 0; continue;}
      if (data[p + 3] <= (kind === "star" ? 128 : 8)) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left) {left = 0; right = w - 1; top = 0; bottom = h - 1;}
    if (black) context.putImageData(pixels, 0, 0);
    return {image: black ? probe : image, width: black ? w : width, height: black ? h : height,
      cx: (left + right + 1) / 2 / w * (black ? w : width), cy: (top + bottom + 1) / 2 / h * (black ? h : height),
      boundsWidth: (right - left + 1) / w * (black ? w : width), boundsHeight: (bottom - top + 1) / h * (black ? h : height)};
  } catch {
    // Remote images without CORS still display; their geometric center is used.
    return {image, width, height, cx: width / 2, cy: height / 2, boundsWidth: width, boundsHeight: height};
  }
}
export function loadAsset(src, kind = "art") {
  if (!src) return Promise.resolve(null);
  const key = `${kind}:${src}`;
  if (cache.has(key)) return cache.get(key);
  const promise = new Promise(resolve => {
    const image = new Image(); let settled = false;
    const done = value => {if (settled) return; settled = true; clearTimeout(timer); resolve(value);};
    const timer = setTimeout(() => done(null), 6000);
    image.onload = () => {try {done(measureImage(image, kind));} catch {done(null);}}; image.onerror = () => done(null); image.src = src;
  });
  cache.set(key, promise); if (cache.size > 96) cache.delete(cache.keys().next().value);
  promise.then(value => {if (!value) cache.delete(key);});
  return promise;
}
export function drawAnchored(context, image, x, y, scale, opacity = 1) {
  if (!image) return;
  context.save(); context.globalAlpha *= opacity;
  context.drawImage(image.image, x - image.cx * scale, y - image.cy * scale, image.width * scale, image.height * scale);
  context.restore();
}
