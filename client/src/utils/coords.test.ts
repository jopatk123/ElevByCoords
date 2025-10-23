import { describe, it, expect } from 'vitest';
import { isValidLongitude, isValidLatitude, isValidCoordinate } from './coords';

describe('coords utils', () => {
  it('valid longitudes', () => {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(200)).toBe(false);
    expect(isValidLongitude(NaN)).toBe(false);
    expect(isValidLongitude(null)).toBe(false);
  });

  it('valid latitudes', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(100)).toBe(false);
    expect(isValidLatitude(NaN)).toBe(false);
    expect(isValidLatitude(undefined)).toBe(false);
  });

  it('valid coordinate object', () => {
    expect(isValidCoordinate({ longitude: 116.4, latitude: 39.9 })).toBe(true);
    expect(isValidCoordinate({ longitude: -200, latitude: 0 })).toBe(false);
    expect(isValidCoordinate(null)).toBe(false);
    expect(isValidCoordinate({ longitude: 0, latitude: null })).toBe(false);
  });
});
