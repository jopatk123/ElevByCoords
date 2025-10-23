export function isValidLongitude(lon: number | null | undefined): boolean {
  if (lon === null || lon === undefined) return false;
  if (typeof lon !== 'number' || Number.isNaN(lon)) return false;
  return lon >= -180 && lon <= 180;
}

export function isValidLatitude(lat: number | null | undefined): boolean {
  if (lat === null || lat === undefined) return false;
  if (typeof lat !== 'number' || Number.isNaN(lat)) return false;
  return lat >= -90 && lat <= 90;
}

export function isValidCoordinate(coord: { longitude?: number | null; latitude?: number | null } | null | undefined): boolean {
  if (!coord) return false;
  return isValidLongitude(coord.longitude) && isValidLatitude(coord.latitude);
}
