import { describe, expect, it } from 'vitest';
import { insertGapBreaks } from '../public/js/chartUtils.js';

describe('latency chart gap handling', () => {
  it('keeps 5-minute bucket points connected', () => {
    const fiveMinutes = 5 * 60 * 1000;
    const points = [
      { x: 0, y: 10 },
      { x: fiveMinutes, y: 20 }
    ];
    expect(insertGapBreaks(points, fiveMinutes * 3)).toEqual(points);
  });

  it('breaks a 13-hour gap in 5-minute buckets', () => {
    const fiveMinutes = 5 * 60 * 1000;
    const thirteenHours = 13 * 60 * 60 * 1000;
    const points = [
      { x: 0, y: 10 },
      { x: thirteenHours, y: 20 }
    ];
    expect(insertGapBreaks(points, fiveMinutes * 3)).toEqual([
      { x: 0, y: 10 },
      { x: Math.floor(thirteenHours / 2), y: null },
      { x: thirteenHours, y: 20 }
    ]);
  });

  it('uses three monitor intervals for raw 1-hour checks', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 301000, y: 20 }
    ];
    expect(insertGapBreaks(points, 100 * 3 * 1000)).toEqual([
      { x: 0, y: 10 },
      { x: 150500, y: null },
      { x: 301000, y: 20 }
    ]);
  });
});
