import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useElevationStore } from './elevation.store';
import apiService from '@/services/api.service';
import type { Coordinate, ElevationResponse } from '@/types/shared';

// Mock API Service
vi.mock('@/services/api.service', () => ({
  default: {
    getSingleElevation: vi.fn(),
    getBatchElevation: vi.fn(),
    downloadBatchResults: vi.fn(),
    getTileInfo: vi.fn(),
    uploadFile: vi.fn()
  }
}));

describe('Elevation Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useElevationStore();
      
      expect(store.results).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.currentQuery).toBeNull();
      expect(store.processingStats).toEqual({
        totalPoints: 0,
        validPoints: 0,
        processingTime: 0
      });
    });
  });

  describe('Computed Properties', () => {
    it('should compute hasResults correctly', () => {
      const store = useElevationStore();
      
      expect(store.hasResults).toBe(false);
      
      // Manually set results
      store.results.push({
        longitude: 116.4,
        latitude: 39.9,
        elevation: 100,
        error: ''
      });
      
      expect(store.hasResults).toBe(true);
    });

    it('should compute successRate correctly', () => {
      const store = useElevationStore();
      
      expect(store.successRate).toBe(0);
      
      // Add results with metadata
      store.processingStats = {
        totalPoints: 10,
        validPoints: 8,
        processingTime: 100
      };
      store.results = [
        { longitude: 116.4, latitude: 39.9, elevation: 100, error: '' },
        { longitude: 121.4, latitude: 31.2, elevation: 50, error: '' }
      ];
      
      expect(store.successRate).toBe(80); // 8/10 * 100
    });

    it('should compute validResults correctly', () => {
      const store = useElevationStore();
      
      store.results = [
        { longitude: 116.4, latitude: 39.9, elevation: 100, error: '' },
        { longitude: 121.4, latitude: 31.2, elevation: null, error: 'Out of bounds' },
        { longitude: 120.0, latitude: 30.0, elevation: 200, error: '' }
      ];
      
      expect(store.validResults.length).toBe(2);
      expect(store.validResults.every(r => r.elevation !== null)).toBe(true);
    });

    it('should compute invalidResults correctly', () => {
      const store = useElevationStore();
      
      store.results = [
        { longitude: 116.4, latitude: 39.9, elevation: 100, error: '' },
        { longitude: 121.4, latitude: 31.2, elevation: null, error: 'Out of bounds' },
        { longitude: 120.0, latitude: 30.0, elevation: null, error: 'Invalid data' }
      ];
      
      expect(store.invalidResults.length).toBe(2);
      expect(store.invalidResults.every(r => r.elevation === null)).toBe(true);
    });
  });

  describe('Query Single Point', () => {
    it('should successfully query a single point', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: [
          { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' }
        ],
        metadata: {
          totalPoints: 1,
          validPoints: 1,
          processingTime: 50,
          dataSource: 'SRTM GeoTIFF'
        }
      };
      
      vi.mocked(apiService.getSingleElevation).mockResolvedValue(mockResponse);
      
      const coordinate: Coordinate = { longitude: 116.4, latitude: 39.9 };
      await store.querySinglePoint(coordinate);
      
      expect(store.results.length).toBe(1);
      expect(store.results[0].elevation).toBe(52.5);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.processingStats.totalPoints).toBe(1);
      expect(store.processingStats.validPoints).toBe(1);
    });

    it('should handle query error', async () => {
      const store = useElevationStore();
      
      const mockError = new Error('API Error');
      vi.mocked(apiService.getSingleElevation).mockRejectedValue(mockError);
      
      const coordinate: Coordinate = { longitude: 116.4, latitude: 39.9 };
      await store.querySinglePoint(coordinate);
      
      expect(store.results.length).toBe(0);
      expect(store.error).toBe('API Error');
      expect(store.loading).toBe(false);
    });

    it('should handle API response error', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: false,
        error: 'Coordinate out of bounds'
      };
      
      vi.mocked(apiService.getSingleElevation).mockResolvedValue(mockResponse);
      
      const coordinate: Coordinate = { longitude: 200, latitude: 100 };
      await store.querySinglePoint(coordinate);
      
      expect(store.results.length).toBe(0);
      expect(store.error).toBe('Coordinate out of bounds');
    });

    it('should set loading state correctly', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: [
          { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' }
        ]
      };
      
      vi.mocked(apiService.getSingleElevation).mockImplementation(() => {
        // Verify loading is true during API call
        expect(store.loading).toBe(true);
        return Promise.resolve(mockResponse);
      });
      
      const coordinate: Coordinate = { longitude: 116.4, latitude: 39.9 };
      await store.querySinglePoint(coordinate);
      
      expect(store.loading).toBe(false);
    });
  });

  describe('Query Batch Points', () => {
    it('should successfully query batch points', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: [
          { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' },
          { longitude: 121.4, latitude: 31.2, elevation: 8.5, error: '' }
        ],
        metadata: {
          totalPoints: 2,
          validPoints: 2,
          processingTime: 100,
          dataSource: 'SRTM GeoTIFF'
        }
      };
      
      vi.mocked(apiService.getBatchElevation).mockResolvedValue(mockResponse);
      
      const coordinates: Coordinate[] = [
        { longitude: 116.4, latitude: 39.9 },
        { longitude: 121.4, latitude: 31.2 }
      ];
      
      await store.queryBatchPoints(coordinates);
      
      expect(store.results.length).toBe(2);
      expect(store.currentQuery).toEqual({ coordinates });
      expect(store.processingStats.totalPoints).toBe(2);
      expect(store.processingStats.validPoints).toBe(2);
    });

    it('should handle batch query with partial results', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: [
          { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' },
          { longitude: 200, latitude: 100, elevation: null, error: 'Out of bounds' }
        ],
        metadata: {
          totalPoints: 2,
          validPoints: 1,
          processingTime: 100,
          dataSource: 'SRTM GeoTIFF'
        }
      };
      
      vi.mocked(apiService.getBatchElevation).mockResolvedValue(mockResponse);
      
      const coordinates: Coordinate[] = [
        { longitude: 116.4, latitude: 39.9 },
        { longitude: 200, latitude: 100 }
      ];
      
      await store.queryBatchPoints(coordinates);
      
      expect(store.results.length).toBe(2);
      expect(store.validResults.length).toBe(1);
      expect(store.invalidResults.length).toBe(1);
      expect(store.processingStats.validPoints).toBe(1);
    });

    it('should handle batch query error', async () => {
      const store = useElevationStore();
      
      const mockError = new Error('Batch API Error');
      vi.mocked(apiService.getBatchElevation).mockRejectedValue(mockError);
      
      const coordinates: Coordinate[] = [
        { longitude: 116.4, latitude: 39.9 }
      ];
      
      await store.queryBatchPoints(coordinates);
      
      expect(store.results.length).toBe(0);
      expect(store.error).toBe('Batch API Error');
    });

    it('should set currentQuery correctly', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: []
      };
      
      vi.mocked(apiService.getBatchElevation).mockResolvedValue(mockResponse);
      
      const coordinates: Coordinate[] = [
        { longitude: 116.4, latitude: 39.9 }
      ];
      
      await store.queryBatchPoints(coordinates);
      
      expect(store.currentQuery).toEqual({ coordinates });
    });
  });

  describe('Clear Results', () => {
    it('should clear all results', () => {
      const store = useElevationStore();
      
      // Set up initial state
      store.results = [
        { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' }
      ];
      store.error = 'Some error';
      store.currentQuery = { coordinates: [{ longitude: 116.4, latitude: 39.9 }] };
      store.processingStats = {
        totalPoints: 1,
        validPoints: 1,
        processingTime: 50
      };
      
      // Clear results
      store.clearResults();
      
      expect(store.results.length).toBe(0);
      expect(store.error).toBeNull();
      expect(store.currentQuery).toBeNull();
      expect(store.processingStats).toEqual({
        totalPoints: 0,
        validPoints: 0,
        processingTime: 0
      });
    });
  });

  describe('Add Coordinate', () => {
    it('should add coordinate to new query', () => {
      const store = useElevationStore();
      
      const coordinate: Coordinate = { longitude: 116.4, latitude: 39.9 };
      store.addCoordinate(coordinate);
      
      expect(store.currentQuery).not.toBeNull();
      expect(store.currentQuery?.coordinates.length).toBe(1);
      expect(store.currentQuery?.coordinates[0]).toEqual(coordinate);
    });

    it('should add coordinate to existing query', () => {
      const store = useElevationStore();
      
      const coord1: Coordinate = { longitude: 116.4, latitude: 39.9 };
      const coord2: Coordinate = { longitude: 121.4, latitude: 31.2 };
      
      store.addCoordinate(coord1);
      store.addCoordinate(coord2);
      
      expect(store.currentQuery?.coordinates.length).toBe(2);
      expect(store.currentQuery?.coordinates).toContainEqual(coord1);
      expect(store.currentQuery?.coordinates).toContainEqual(coord2);
    });
  });

  describe('Download Results', () => {
    it('should throw error when no current query', async () => {
      const store = useElevationStore();
      
      store.currentQuery = null;
      
      await expect(store.downloadResults('csv')).rejects.toThrow('没有可下载的结果');
    });

    it('should attempt to download CSV results', async () => {
      const store = useElevationStore();
      
      const mockBlob = new Blob(['data'], { type: 'text/csv' });
      vi.mocked(apiService.downloadBatchResults).mockResolvedValue(mockBlob);
      
      store.currentQuery = {
        coordinates: [{ longitude: 116.4, latitude: 39.9 }]
      };
      
      // Mock window methods
      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      
      window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
      window.URL.revokeObjectURL = vi.fn();
      
      try {
        await store.downloadResults('csv');
        
        expect(apiService.downloadBatchResults).toHaveBeenCalledWith(
          store.currentQuery,
          'csv'
        );
      } finally {
        window.URL.createObjectURL = originalCreateObjectURL;
        window.URL.revokeObjectURL = originalRevokeObjectURL;
        appendChildSpy.mockRestore();
      }
    });

    it('should attempt to download GeoJSON results', async () => {
      const store = useElevationStore();
      
      const mockBlob = new Blob(['{"type":"FeatureCollection"}'], { type: 'application/json' });
      vi.mocked(apiService.downloadBatchResults).mockResolvedValue(mockBlob);
      
      store.currentQuery = {
        coordinates: [{ longitude: 116.4, latitude: 39.9 }]
      };
      
      // Mock window methods
      const originalCreateObjectURL = window.URL.createObjectURL;
      const originalRevokeObjectURL = window.URL.revokeObjectURL;
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      
      window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
      window.URL.revokeObjectURL = vi.fn();
      
      try {
        await store.downloadResults('geojson');
        
        expect(apiService.downloadBatchResults).toHaveBeenCalledWith(
          store.currentQuery,
          'geojson'
        );
      } finally {
        window.URL.createObjectURL = originalCreateObjectURL;
        window.URL.revokeObjectURL = originalRevokeObjectURL;
        appendChildSpy.mockRestore();
      }
    });
  });

  describe('State Mutations', () => {
    it('should properly mutate state without triggering recursive updates', async () => {
      const store = useElevationStore();
      
      const mockResponse: ElevationResponse = {
        success: true,
        data: [
          { longitude: 116.4, latitude: 39.9, elevation: 52.5, error: '' },
          { longitude: 121.4, latitude: 31.2, elevation: 8.5, error: '' }
        ]
      };
      
      vi.mocked(apiService.getSingleElevation).mockResolvedValue(mockResponse);
      
      const coordinate: Coordinate = { longitude: 116.4, latitude: 39.9 };
      
      // This should not trigger recursive updates
      await store.querySinglePoint(coordinate);
      
      expect(store.results.length).toBe(2);
      expect(store.error).toBeNull();
    });
  });
});
