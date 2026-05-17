import type { ElevationPoint } from '../types/shared';

const escapeCsvValue = (value: string | number | null | undefined): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(raw)) {
    return raw;
  }

  return `"${raw.replace(/"/g, '""')}"`;
};

export const formatElevationResultsAsCsv = (results: ElevationPoint[]): string => {
  const header = 'longitude,latitude,elevation,error';
  const rows = results.map(result => [
    escapeCsvValue(result.longitude),
    escapeCsvValue(result.latitude),
    escapeCsvValue(result.elevation),
    escapeCsvValue(result.error)
  ].join(','));

  return [header, ...rows].join('\n');
};

export const formatCoordinateTemplateAsCsv = (): string => {
  const header = 'longitude,latitude';
  const rows = [
    '118.7969,32.0603',
    '121.4737,31.2304',
    '119.2965,26.0745'
  ];

  return [header, ...rows].join('\n');
};
