import fs from 'fs/promises';
import path from 'path';
import { fromFile, type GeoTIFFImage, type TypedArray } from 'geotiff';
import type {
  Coordinate,
  ElevationPoint,
  SRTMTileInfo
} from '../types/shared';
import config from '../config/env';

interface TileDescriptor extends SRTMTileInfo {
  filePath: string;
  image: GeoTIFFImage;
  rasterWidth: number;
  rasterHeight: number;
  pixelSizeX: number;
  pixelSizeY: number;
  noDataValue: number | null;
}

export class ElevationService {
  private tiles: TileDescriptor[] = [];
  private ready: Promise<void>;

  constructor() {
    this.ready = this.initializeTiles();
  }

  private async initializeTiles(): Promise<void> {
    try {
      const files = await fs.readdir(config.dataPath);
      const tifFiles = files.filter(file => file.toLowerCase().endsWith('.tif'));

      const loadedTiles: TileDescriptor[] = [];

      for (const filename of tifFiles) {
        const filePath = path.join(config.dataPath, filename);
        try {
          const tiff = await fromFile(filePath);
          const image = await tiff.getImage();
          const [west, south, east, north] = image.getBoundingBox();
          const [resXRaw, resYRaw] = image.getResolution();
          const rasterWidth = image.getWidth();
          const rasterHeight = image.getHeight();

          const pixelSizeX = this.resolvePixelSize(resXRaw, east - west, rasterWidth);
          const pixelSizeY = this.resolvePixelSize(resYRaw, north - south, rasterHeight);
          const resolution = Math.max(pixelSizeX, pixelSizeY);
          const noDataValue = this.extractNoDataValue(image);

          loadedTiles.push({
            filename,
            filePath,
            image,
            bounds: { west, south, east, north },
            resolution,
            pixelSize: {
              x: pixelSizeX,
              y: pixelSizeY
            },
            dimensions: {
              width: rasterWidth,
              height: rasterHeight
            },
            rasterWidth,
            rasterHeight,
            pixelSizeX,
            pixelSizeY,
            noDataValue
          });
        } catch (tileError) {
          console.error(`Failed to load GeoTIFF tile ${filename}:`, tileError);
        }
      }

      this.tiles = loadedTiles.sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error) {
      console.error('Failed to initialize tile info:', error);
      this.tiles = [];
    }
  }

  private resolvePixelSize(resolutionValue: number, span: number, size: number): number {
    if (Number.isFinite(resolutionValue) && resolutionValue !== 0) {
      return Math.abs(resolutionValue);
    }
    if (size > 0) {
      return Math.abs(span / size);
    }
    return 0;
  }

  private extractNoDataValue(image: GeoTIFFImage): number | null {
    const fileDirectory = image.getFileDirectory();
    const gdalNoData = image.getGDALNoData?.();
    const candidates: Array<number | string | null | undefined> = [
      gdalNoData,
      fileDirectory.GDAL_NODATA as string | number | undefined,
      fileDirectory.NoData as string | number | undefined
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue;
      }
      const value = typeof candidate === 'string' ? parseFloat(candidate) : Number(candidate);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private async ensureInitialized(): Promise<void> {
    await this.ready;
  }

  private findTileForCoordinate(coord: Coordinate): TileDescriptor | null {
    for (const tile of this.tiles) {
      if (
        coord.longitude < tile.bounds.west ||
        coord.longitude >= tile.bounds.east ||
        coord.latitude <= tile.bounds.south ||
        coord.latitude > tile.bounds.north
      ) {
        continue;
      }

      const column = (coord.longitude - tile.bounds.west) / tile.pixelSizeX;
      const row = (tile.bounds.north - coord.latitude) / tile.pixelSizeY;

      if (
        Number.isFinite(column) &&
        Number.isFinite(row) &&
        column >= 0 &&
        row >= 0 &&
        column < tile.rasterWidth &&
        row < tile.rasterHeight
      ) {
        return tile;
      }
    }

    return null;
  }

  private async readElevation(tile: TileDescriptor, coord: Coordinate): Promise<number | null> {
    if (tile.pixelSizeX <= 0 || tile.pixelSizeY <= 0) {
      return null;
    }

    const columnFloat = (coord.longitude - tile.bounds.west) / tile.pixelSizeX;
    const rowFloat = (tile.bounds.north - coord.latitude) / tile.pixelSizeY;

    const column = Math.floor(columnFloat);
    const row = Math.floor(rowFloat);

    if (
      Number.isNaN(column) ||
      Number.isNaN(row) ||
      column < 0 ||
      row < 0 ||
      column >= tile.rasterWidth ||
      row >= tile.rasterHeight
    ) {
      return null;
    }

    const window: [number, number, number, number] = [
      column,
      row,
      column + 1,
      row + 1
    ];

    const raster = await tile.image.readRasters({
      window,
      width: 1,
      height: 1,
      samples: [0],
      interleave: true
    });

    let value: number | undefined;

    if (ArrayBuffer.isView(raster)) {
      value = (raster as TypedArray)[0];
    } else if (Array.isArray(raster)) {
      const first = raster[0];
      if (ArrayBuffer.isView(first)) {
        value = (first as TypedArray)[0];
      } else if (typeof first === 'number') {
        value = first;
      }
    }

    if (value === undefined || !Number.isFinite(value)) {
      return null;
    }

    if (tile.noDataValue !== null && value === tile.noDataValue) {
      return null;
    }

    return Math.round(value);
  }

  private async buildElevationPoint(coord: Coordinate): Promise<ElevationPoint> {
    const tile = this.findTileForCoordinate(coord);

    if (!tile) {
      return {
        ...coord,
        elevation: null,
        error: 'No data available for this coordinate'
      };
    }

    try {
      const elevation = await this.readElevation(tile, coord);

      if (elevation === null) {
        return {
          ...coord,
          elevation: null,
          error: 'No data available for this coordinate'
        };
      }

      return {
        ...coord,
        elevation
      };
    } catch (error) {
      console.error(`Error getting elevation for ${coord.longitude},${coord.latitude}:`, error);
      return {
        ...coord,
        elevation: null,
        error: 'Error processing elevation data'
      };
    }
  }

  async getElevation(coord: Coordinate): Promise<ElevationPoint> {
    await this.ensureInitialized();
    return this.buildElevationPoint(coord);
  }

  private resolveChunkSize(requested?: number): number {
    const configured = Math.max(1, config.batchChunkSize);
    if (!requested) {
      return Math.min(configured, config.maxBatchSize);
    }
    return Math.min(config.maxBatchSize, Math.max(1, requested));
  }

  private async processChunk(coordinates: Coordinate[]): Promise<ElevationPoint[]> {
    const tasks = coordinates.map(coord => this.buildElevationPoint(coord));
    return Promise.all(tasks);
  }

  async *streamBatchElevation(
    coordinates: Coordinate[],
    options?: { chunkSize?: number }
  ): AsyncGenerator<ElevationPoint[], void, unknown> {
    await this.ensureInitialized();

    const chunkSize = this.resolveChunkSize(options?.chunkSize);
    const totalPoints = coordinates.length;
    let processedPoints = 0;

    for (let start = 0; start < coordinates.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, coordinates.length);
      const chunkCoords = coordinates.slice(start, end);
      const chunkResults = await this.processChunk(chunkCoords);
      processedPoints += chunkResults.length;
      yield chunkResults;

      if (processedPoints < totalPoints) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  async getBatchElevation(
    coordinates: Coordinate[],
    options?: { chunkSize?: number }
  ): Promise<ElevationPoint[]> {
    await this.ensureInitialized();

    const results: ElevationPoint[] = [];
    for await (const chunk of this.streamBatchElevation(coordinates, options)) {
      results.push(...chunk);
    }
    return results;
  }

  async getTileInfo(): Promise<SRTMTileInfo[]> {
    await this.ensureInitialized();

    return this.tiles.map(tile => {
      const info: SRTMTileInfo = {
        filename: tile.filename,
        bounds: { ...tile.bounds },
        resolution: tile.resolution
      };

      if (tile.pixelSize) {
        info.pixelSize = { ...tile.pixelSize };
      }

      if (tile.dimensions) {
        info.dimensions = { ...tile.dimensions };
      }

      return info;
    });
  }

  clearCache(): void {
    this.tiles = [];
    this.ready = this.initializeTiles();
  }

}