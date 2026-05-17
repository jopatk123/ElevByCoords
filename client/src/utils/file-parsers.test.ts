import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import {
  isSupportedUploadFileType,
  parseDelimitedCoordinateText,
  parseJsonCoordinates,
  parseSpreadsheetCoordinates
} from './file-parsers';

describe('file parsers', () => {
  it('parses delimited coordinates and skips invalid ranges', () => {
    const coordinates = parseDelimitedCoordinateText('116.4,39.9\n200,100\n121.4,31.2');

    expect(coordinates).toEqual([
      { longitude: 116.4, latitude: 39.9 },
      { longitude: 121.4, latitude: 31.2 }
    ]);
  });

  it('parses json coordinates with numeric strings', () => {
    const coordinates = parseJsonCoordinates([
      { longitude: '116.4', latitude: '39.9' },
      { longitude: 121.4, latitude: 31.2 },
      { longitude: 200, latitude: 91 }
    ]);

    expect(coordinates).toEqual([
      { longitude: 116.4, latitude: 39.9 },
      { longitude: 121.4, latitude: 31.2 }
    ]);
  });

  it('parses spreadsheet coordinates from the first worksheet', () => {
    const workbook = utils.book_new();
    const worksheet = utils.aoa_to_sheet([
      ['longitude', 'latitude'],
      [116.4, 39.9],
      ['bad', 'data'],
      [121.4, 31.2]
    ]);

    utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const buffer = write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const coordinates = parseSpreadsheetCoordinates(buffer);

    expect(coordinates).toEqual([
      { longitude: 116.4, latitude: 39.9 },
      { longitude: 121.4, latitude: 31.2 }
    ]);
  });

  it('accepts supported files by extension even when mime type is empty', () => {
    expect(isSupportedUploadFileType({ name: 'points.xlsx', type: '' } as File)).toBe(true);
    expect(isSupportedUploadFileType({ name: 'points.csv', type: '' } as File)).toBe(true);
    expect(isSupportedUploadFileType({ name: 'points.exe', type: 'application/x-msdownload' } as File)).toBe(false);
  });
});
