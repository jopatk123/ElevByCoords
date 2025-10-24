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
  stream?: boolean;
  chunkSize?: number;
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

export interface ElevationStreamChunk {
  type: 'chunk';
  chunkIndex: number;
  processedPoints: number;
  totalPoints: number;
  progress: number;
  data: ElevationPoint[];
}

export interface ElevationStreamComplete {
  type: 'complete';
  metadata: NonNullable<ElevationResponse['metadata']>;
}

export interface ElevationStreamError {
  type: 'error';
  error: string;
}

export type ElevationStreamEvent =
  | ElevationStreamChunk
  | ElevationStreamComplete
  | ElevationStreamError;

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