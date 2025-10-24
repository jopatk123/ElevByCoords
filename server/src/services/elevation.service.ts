import fs from 'fs/promises';
// import path from 'path';
// import gdal from 'gdal-async';
import type {
  Coordinate,
  ElevationPoint,
  SRTMTileInfo
} from '../types/shared';
import config from '../config/env';

export class ElevationService {
  private tileInfo: SRTMTileInfo[] = [];

  constructor() {
    this.initializeTileInfo();
  }

  private async initializeTileInfo(): Promise<void> {
    try {
      const files = await fs.readdir(config.dataPath);
      const tifFiles = files.filter(file => file.endsWith('.tif'));
      
      for (const file of tifFiles) {
        const match = file.match(/srtm_(\d+)_(\d+)\.tif/);
        if (match) {
          const [, lonIndex, latIndex] = match;
          const lon = parseInt(lonIndex, 10);
          const lat = parseInt(latIndex, 10);
          
          // 根据文件名解析实际边界
          let bounds;
          if (file === 'srtm_60_06.tif') {
            bounds = { west: 115, east: 120, south: 30, north: 35 };
          } else if (file === 'srtm_60_07.tif') {
            bounds = { west: 115, east: 120, south: 25, north: 30 };
          } else if (file === 'srtm_60_08.tif') {
            bounds = { west: 115, east: 120, south: 20, north: 25 };
          } else if (file === 'srtm_61_06.tif') {
            bounds = { west: 120, east: 125, south: 30, north: 35 };
          } else if (file === 'srtm_61_07.tif') {
            bounds = { west: 120, east: 125, south: 25, north: 30 };
          } else if (file === 'srtm_61_08.tif') {
            bounds = { west: 120, east: 125, south: 20, north: 25 };
          } else {
            // 默认计算
            bounds = {
              west: 110 + (lon - 60) * 5,
              east: 115 + (lon - 60) * 5,
              south: 50 - (lat - 6) * 5,
              north: 55 - (lat - 6) * 5
            };
          }

          this.tileInfo.push({
            filename: file,
            bounds,
            resolution: 0.000833333333 // 约3弧秒
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize tile info:', error);
    }
  }

  private findTileForCoordinate(coord: Coordinate): SRTMTileInfo | null {
    return this.tileInfo.find(tile => 
      coord.longitude >= tile.bounds.west &&
      coord.longitude < tile.bounds.east &&
      coord.latitude >= tile.bounds.south &&
      coord.latitude < tile.bounds.north
    ) || null;
  }

  async getElevation(coord: Coordinate): Promise<ElevationPoint> {
    const tile = this.findTileForCoordinate(coord);
    
    if (!tile) {
      return {
        ...coord,
        elevation: null,
        error: 'No data available for this coordinate'
      };
    }

    try {
      // 模拟海拔数据 - 在实际项目中这里会使用 GDAL 读取 TIFF 文件
      const elevation = this.simulateElevation(coord);
      
      return {
        ...coord,
        elevation
      };
    } catch (error) {
      console.error('Error getting elevation:', error);
      return {
        ...coord,
        elevation: null,
        error: 'Error processing elevation data'
      };
    }
  }

  private simulateElevation(coord: Coordinate): number {
    // 简单的海拔模拟算法 - 基于经纬度生成合理的海拔值
    // 在实际项目中，这里会使用 GDAL 从 TIFF 文件读取真实数据
    const { longitude, latitude } = coord;
    
    // 基于坐标生成伪随机但一致的海拔值
    const seed = Math.sin(longitude * 1000) * Math.cos(latitude * 1000);
    const baseElevation = Math.abs(seed) * 2000; // 0-2000米基础海拔
    
    // 添加一些地形变化
    const terrainVariation = Math.sin(longitude * 10) * Math.cos(latitude * 10) * 500;
    
    return Math.round(baseElevation + terrainVariation);
  }

  private resolveChunkSize(requested?: number): number {
    const configured = Math.max(1, config.batchChunkSize);
    if (!requested) {
      return Math.min(configured, config.maxBatchSize);
    }
    return Math.min(config.maxBatchSize, Math.max(1, requested));
  }

  private async processChunk(coordinates: Coordinate[]): Promise<ElevationPoint[]> {
    const chunkResults = await Promise.all(coordinates.map(coord => this.getElevation(coord)));
    return chunkResults;
  }

  async *streamBatchElevation(
    coordinates: Coordinate[],
    options?: { chunkSize?: number }
  ): AsyncGenerator<ElevationPoint[], void, unknown> {
    const chunkSize = this.resolveChunkSize(options?.chunkSize);
    const totalPoints = coordinates.length;
  let processedPoints = 0;

    for (let start = 0; start < coordinates.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, coordinates.length);
      const chunkCoords = coordinates.slice(start, end);
      const chunkResults = await this.processChunk(chunkCoords);
      processedPoints += chunkResults.length;
      yield chunkResults;
      // 在大型批次时让出事件循环，避免阻塞
      if (processedPoints < totalPoints) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  async getBatchElevation(
    coordinates: Coordinate[],
    options?: { chunkSize?: number }
  ): Promise<ElevationPoint[]> {
    const results: ElevationPoint[] = [];
    for await (const chunk of this.streamBatchElevation(coordinates, options)) {
      results.push(...chunk);
    }
    return results;
  }

  getTileInfo(): SRTMTileInfo[] {
    return [...this.tileInfo];
  }

  // 清理缓存 (模拟版本中暂不需要)
  clearCache(): void {
    // 在实际 GDAL 版本中会清理数据集缓存
    console.log('Cache cleared');
  }
}