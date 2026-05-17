import { read, utils } from 'xlsx';
import type { Coordinate } from '@/types/shared';
import { isValidCoordinate } from './coords';

const SUPPORTED_UPLOAD_EXTENSIONS = ['csv', 'json', 'txt', 'xls', 'xlsx'] as const;
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx']);

const parseCoordinateValue = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return parseFloat(value.trim());
  }

  return Number.NaN;
};

const toCoordinate = (longitudeValue: unknown, latitudeValue: unknown): Coordinate | null => {
  const coordinate: Coordinate = {
    longitude: parseCoordinateValue(longitudeValue),
    latitude: parseCoordinateValue(latitudeValue)
  };

  return isValidCoordinate(coordinate) ? coordinate : null;
};

export const getFileExtension = (fileName: string): string => {
  const match = fileName.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] ?? '';
};

export const isSpreadsheetFileName = (fileName: string): boolean => (
  SPREADSHEET_EXTENSIONS.has(getFileExtension(fileName))
);

export const isSupportedUploadFileType = (file: Pick<File, 'name' | 'type'>): boolean => {
  const extension = getFileExtension(file.name);
  if (SUPPORTED_UPLOAD_EXTENSIONS.includes(extension as typeof SUPPORTED_UPLOAD_EXTENSIONS[number])) {
    return true;
  }

  return [
    'text/csv',
    'application/json',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ].includes(file.type);
};

export const parseCoordinateRows = (rows: Array<Array<unknown>>): Coordinate[] => rows.reduce<Coordinate[]>((coordinates, row) => {
  if (row.length < 2) {
    return coordinates;
  }

  const coordinate = toCoordinate(row[0], row[1]);
  if (coordinate) {
    coordinates.push(coordinate);
  }

  return coordinates;
}, []);

export const parseDelimitedCoordinateText = (text: string): Coordinate[] => {
  if (!text.trim()) {
    return [];
  }

  const rows = text
    .trim()
    .split('\n')
    .map(line => line.split(',').map(value => value.trim()));

  return parseCoordinateRows(rows);
};

export const parseJsonCoordinates = (data: unknown): Coordinate[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.reduce<Coordinate[]>((coordinates, item) => {
    if (!item || typeof item !== 'object') {
      return coordinates;
    }

    const record = item as Record<string, unknown>;
    const coordinate = toCoordinate(record.longitude, record.latitude);
    if (coordinate) {
      coordinates.push(coordinate);
    }

    return coordinates;
  }, []);
};

export const parseSpreadsheetCoordinates = (buffer: ArrayBuffer): Coordinate[] => {
  const workbook = read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json<Array<unknown>>(worksheet, {
    header: 1,
    raw: false,
    blankrows: false
  });

  return parseCoordinateRows(rows);
};
