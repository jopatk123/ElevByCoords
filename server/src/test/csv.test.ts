import { describe, expect, it } from 'vitest';
import { formatElevationResultsAsCsv } from '../utils/csv';
import type { ElevationPoint } from '../types/shared';

describe('CSV formatting', () => {
  it('escapes commas, quotes, and newlines in output fields', () => {
    const rows: ElevationPoint[] = [
      {
        longitude: 116.4,
        latitude: 39.9,
        elevation: 12,
        error: 'bad,value "quoted"\nnext line'
      }
    ];

    expect(formatElevationResultsAsCsv(rows)).toBe(
      'longitude,latitude,elevation,error\n116.4,39.9,12,"bad,value ""quoted""\nnext line"'
    );
  });
});
