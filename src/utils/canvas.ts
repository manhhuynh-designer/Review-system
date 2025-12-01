// Helpers to normalize/denormalize coordinates between 0..1 and absolute pixels
export const denormalize = (val: number, max: number) => val * max
export const normalize = (val: number, max: number) => val / max

export const denormalizePoints = (pts: number[], w: number, h: number) => {
  return pts.map((val, i) => (i % 2 === 0 ? val * w : val * h))
}

export const normalizePoints = (pts: number[], w: number, h: number) => {
  return pts.map((val, i) => (i % 2 === 0 ? val / w : val / h))
}
