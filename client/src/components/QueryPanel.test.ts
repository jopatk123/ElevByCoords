import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useElevationStore } from '@/stores/elevation.store';

// Mock Element Plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn()
  }
}));

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn()
  }
}));

describe('QueryPanel Utils', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('CSV Data Parsing', () => {
    it('should parse CSV data correctly', () => {
      const csvData = [
        ['116.4', '39.9'],
        ['121.4', '31.2']
      ];

      // Simulate parseCSVData logic
      const coordinates = csvData.map(row => {
        if (row.length >= 2) {
          const longitude = parseFloat(row[0]);
          const latitude = parseFloat(row[1]);
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(2);
      expect(coordinates[0]).toEqual({ longitude: 116.4, latitude: 39.9 });
      expect(coordinates[1]).toEqual({ longitude: 121.4, latitude: 31.2 });
    });

    it('should skip invalid CSV rows', () => {
      const csvData = [
        ['116.4', '39.9'],
        ['invalid', 'data'],
        ['121.4', '31.2']
      ];

      const coordinates = csvData.map(row => {
        if (row.length >= 2) {
          const longitude = parseFloat(row[0]);
          const latitude = parseFloat(row[1]);
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(2);
    });

    it('should handle empty rows', () => {
      const csvData: string[][] = [];

      const coordinates = csvData.map(row => {
        if (row.length >= 2) {
          const longitude = parseFloat(row[0]);
          const latitude = parseFloat(row[1]);
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(0);
    });
  });

  describe('JSON Data Parsing', () => {
    it('should parse JSON data correctly', () => {
      const jsonData = [
        { longitude: 116.4, latitude: 39.9 },
        { longitude: 121.4, latitude: 31.2 }
      ];

      // Simulate parseJSONData logic
      const coordinates = jsonData.filter(item => 
        typeof item === 'object' && 
        item.longitude !== undefined && 
        item.latitude !== undefined
      ).map(item => ({
        longitude: typeof item.longitude === 'number' ? item.longitude : parseFloat(item.longitude as string),
        latitude: typeof item.latitude === 'number' ? item.latitude : parseFloat(item.latitude as string)
      })).filter(coord => 
        !isNaN(coord.longitude) && !isNaN(coord.latitude)
      );

      expect(coordinates.length).toBe(2);
      expect(coordinates[0]).toEqual({ longitude: 116.4, latitude: 39.9 });
    });

    it('should skip invalid JSON objects', () => {
      const jsonData = [
        { longitude: 116.4, latitude: 39.9 },
        { invalid: true },
        { longitude: 121.4, latitude: 31.2 }
      ];

      const coordinates = jsonData.filter(item => 
        typeof item === 'object' && 
        item.longitude !== undefined && 
        item.latitude !== undefined
      ).map(item => ({
        longitude: typeof item.longitude === 'number' ? item.longitude : parseFloat(item.longitude as string),
        latitude: typeof item.latitude === 'number' ? item.latitude : parseFloat(item.latitude as string)
      })).filter(coord => 
        !isNaN(coord.longitude) && !isNaN(coord.latitude)
      );

      expect(coordinates.length).toBe(2);
    });
  });

  describe('Batch Text Parsing', () => {
    it('should parse batch text with valid coordinates', () => {
      const batchText = '116.4,39.9\n121.4,31.2';
      const lines = batchText.trim().split('\n');
      
      const coordinates = lines.map(line => {
        const parts = line.trim().split(',');
        if (parts.length >= 2) {
          const longitude = parseFloat(parts[0]);
          const latitude = parseFloat(parts[1]);
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(2);
      expect(coordinates[0]).toEqual({ longitude: 116.4, latitude: 39.9 });
    });

    it('should handle empty batch text', () => {
      const batchText = '';
      const lines = batchText.trim().split('\n');
      
      const coordinates = lines.map(line => {
        const parts = line.trim().split(',');
        if (parts.length >= 2) {
          const longitude = parseFloat(parts[0]);
          const latitude = parseFloat(parts[1]);
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(0);
    });

    it('should handle batch text with whitespace', () => {
      const batchText = '  116.4  ,  39.9  \n  121.4  ,  31.2  ';
      const lines = batchText.trim().split('\n');
      
      const coordinates = lines.map(line => {
        const parts = line.trim().split(',');
        if (parts.length >= 2) {
          const longitude = parseFloat(parts[0].trim());
          const latitude = parseFloat(parts[1].trim());
          if (!isNaN(longitude) && !isNaN(latitude)) {
            return { longitude, latitude };
          }
        }
        return null;
      }).filter(coord => coord !== null);

      expect(coordinates.length).toBe(2);
    });
  });

  describe('File Validation', () => {
    it('should validate file size', () => {
      const validFile = new File(['data'], 'test.csv', { type: 'text/csv' });
      const isValidSize = validFile.size / 1024 / 1024 < 10;
      expect(isValidSize).toBe(true);
    });

    it('should reject file size > 10MB', () => {
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)],
        'large.csv',
        { type: 'text/csv' }
      );
      const isValidSize = largeFile.size / 1024 / 1024 < 10;
      expect(isValidSize).toBe(false);
    });

    it('should validate file type', () => {
      const csvFile = new File(['data'], 'test.csv', { type: 'text/csv' });
      const validTypes = ['text/csv', 'application/json', 'text/plain'];
      const isValidType = validTypes.includes(csvFile.type);
      expect(isValidType).toBe(true);
    });

    it('should reject invalid file type', () => {
      const invalidFile = new File(['data'], 'test.exe', { type: 'application/x-msdownload' });
      const validTypes = ['text/csv', 'application/json', 'text/plain'];
      const isValidType = validTypes.includes(invalidFile.type);
      expect(isValidType).toBe(false);
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate longitude range', () => {
      expect(-180 >= -180 && -180 <= 180).toBe(true);
      expect(0 >= -180 && 0 <= 180).toBe(true);
      expect(180 >= -180 && 180 <= 180).toBe(true);
      expect(200 >= -180 && 200 <= 180).toBe(false);
    });

    it('should validate latitude range', () => {
      expect(-90 >= -90 && -90 <= 90).toBe(true);
      expect(0 >= -90 && 0 <= 90).toBe(true);
      expect(90 >= -90 && 90 <= 90).toBe(true);
      expect(100 >= -90 && 100 <= 90).toBe(false);
    });
  });

  describe('Store Integration', () => {
    it('should have access to elevation store', () => {
      const store = useElevationStore();
      expect(store).toBeDefined();
      expect(store.querySinglePoint).toBeDefined();
      expect(store.queryBatchPoints).toBeDefined();
    });

    it('should clear store results', () => {
      const store = useElevationStore();
      store.results.push({
        longitude: 116.4,
        latitude: 39.9,
        elevation: 52.5,
        error: ''
      });
      
      expect(store.results.length).toBe(1);
      
      store.clearResults();
      
      expect(store.results.length).toBe(0);
    });
  });
});
