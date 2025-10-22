// 共享类型定义

export interface Coordinate {
  longitude: number;
  latitude: number;
}

export interface ElevationPoint extends Coordinate {
  elevation: number | null;
  error?: string;
}

export interface ElevationQuery {
  coordinates: Coordinate[];
  format?: 'json' | 'csv' | 'geojson';
}

export interface ElevationResponse {
  success: boolean;
  data?: ElevationPoint[];
  error?: string;
  metadata?: {
    totalPoints: number;
    validPoints: number;
    processingTime: number;
    dataSource: string;
  };
}

export interface SRTMTileInfo {
  filename: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  resolution: number;
}

export interface BatchUploadResult {
  success: boolean;
  processedCount: number;
  results: ElevationPoint[];
  errors: string[];
}