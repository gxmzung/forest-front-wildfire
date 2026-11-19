// Shared by Node and the browser: one complete right-to-left / left-to-right loop.
function scrollInfo({ width, height, stripWidth, step = 4, direction = 'left' }) {
  if (![width, height, stripWidth, step].every(Number.isInteger) || width < 64 || width > 1280 || width % 64 || height < 1 || height > 256 || stripWidth < 1 || stripWidth > 2048 || step < 1 || step > 32 || !['left', 'right'].includes(direction)) throw new TypeError('스크롤 크기·이동 간격·방향을 확인하세요.');
  const maxFrames = Math.min(512, Math.floor((2 * 1024 * 1024 - 323) / (width / 8 * height)));
  const distance = width + stripWidth;
  const effectiveStep = Math.max(step, Math.ceil(distance / (maxFrames - 1)));
  return { width, height, stripWidth, step: effectiveStep, direction, frameCount: Math.ceil(distance / effectiveStep) + 1, distance };
}
function scrollFrame(bitmap, info, index) {
  const { width, height, stripWidth, step, direction, distance } = info;
  const travel = Math.min(distance, Math.max(0, index) * step);
  const left = direction === 'left' ? width - travel : -stripWidth + travel;
  const mask = new Uint8Array(width * height);
  const start = Math.max(0, left), end = Math.min(width, left + stripWidth);
  for (let y = 0; y < height; y++) for (let x = start; x < end; x++) mask[y * width + x] = bitmap[y * stripWidth + x - left];
  return mask;
}
if (typeof module !== 'undefined') module.exports = { scrollInfo, scrollFrame };
else globalThis.WF4Scroll = { scrollInfo, scrollFrame };
