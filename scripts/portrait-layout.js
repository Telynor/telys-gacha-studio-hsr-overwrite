import {clamp} from "./constants.js";

export const PORTRAIT_ASPECT = 1.9;

export function portraitLayout(width, height, image, visual) {
  const scale = Math.max(width / image.width, height / image.height) * clamp(Number(visual.portraitScale) || 100, 25, 300) / 100;
  const w = image.width * scale, h = image.height * scale;
  return {width: w, height: h, x: (width - w) / 2 + width * clamp(visual.portraitX, -200, 200) / 100, y: height * clamp(visual.portraitY, -200, 200) / 100};
}

export function portraitStyle(visual, image) {
  if (!image) return "object-fit:cover;object-position:50% 0;";
  const width = PORTRAIT_ASPECT * 100;
  const layout = portraitLayout(width, 100, image, visual);
  return `left:${layout.x / width * 100}%;top:${layout.y}%;right:auto;width:${layout.width / width * 100}%;height:${layout.height}%;object-fit:fill;`;
}

export function paintPortrait(context, width, height, visual, image, dpr = 1) {
  if (!image) return;
  const layout = portraitLayout(width, height, image, visual);
  context.save(); context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.drawImage(image.image, layout.x, layout.y, layout.width, layout.height); context.restore();
}
