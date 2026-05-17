// 测试环境设置
import { afterAll, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATA_PATH = './GD';
process.env.ENABLE_REQUEST_LOGGING = 'false';

vi.mock('../services/elevation.service', () => {
  class ElevationService {
    async getElevation(coord: { longitude: number; latitude: number }) {
      return {
        ...coord,
        elevation: 123
      };
    }

    async getBatchElevation(
      coordinates: Array<{ longitude: number; latitude: number }>,
      options?: { chunkSize?: number }
    ) {
      const chunkSize = options?.chunkSize ?? coordinates.length;
      const results = [];

      for (let index = 0; index < coordinates.length; index += chunkSize) {
        results.push(...coordinates.slice(index, index + chunkSize).map(coord => ({
          ...coord,
          elevation: 123
        })));
      }

      return results;
    }

    async *streamBatchElevation(
      coordinates: Array<{ longitude: number; latitude: number }>,
      options?: { chunkSize?: number }
    ) {
      const chunkSize = options?.chunkSize ?? coordinates.length;
      for (let index = 0; index < coordinates.length; index += chunkSize) {
        yield coordinates.slice(index, index + chunkSize).map(coord => ({
          ...coord,
          elevation: 123
        }));
      }
    }

    async getTileInfo() {
      return [
        {
          filename: 'mock-tile.tif',
          bounds: {
            west: 118,
            south: 26,
            east: 122,
            north: 33
          },
          resolution: 0.0008333333,
          pixelSize: {
            x: 0.0008333333,
            y: 0.0008333333
          },
          dimensions: {
            width: 4800,
            height: 4800
          }
        }
      ];
    }
  }

  return { ElevationService };
});

afterAll(() => {
  vi.clearAllMocks();
});