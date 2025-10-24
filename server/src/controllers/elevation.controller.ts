import { Request, Response } from 'express';
import Joi from 'joi';
import { ElevationService } from '../services/elevation.service';
import config from '../config/env';
import type {
  Coordinate,
  ElevationQuery,
  ElevationResponse,
  ElevationStreamEvent
} from '../types/shared';

const elevationService = new ElevationService();

// 验证模式
const coordinateSchema = Joi.object({
  longitude: Joi.number().min(-180).max(180).required(),
  latitude: Joi.number().min(-90).max(90).required()
});

const singleQuerySchema = coordinateSchema;

const batchQuerySchema = Joi.object({
  coordinates: Joi.array().items(coordinateSchema).min(1).max(config.maxBatchSize).required(),
  format: Joi.string().valid('json', 'csv', 'geojson').default('json'),
  stream: Joi.boolean().default(false),
  chunkSize: Joi.number().integer().min(1).max(config.maxBatchSize).optional()
});

export class ElevationController {
  async getSingleElevation(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = singleQuerySchema.validate(req.query);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const coordinate: Coordinate = {
        longitude: parseFloat(value.longitude),
        latitude: parseFloat(value.latitude)
      };

      const startTime = Date.now();
      const result = await elevationService.getElevation(coordinate);
      const processingTime = Date.now() - startTime;

      const response: ElevationResponse = {
        success: true,
        data: [result],
        metadata: {
          totalPoints: 1,
          validPoints: result.elevation !== null ? 1 : 0,
          processingTime,
          dataSource: 'SRTM'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error in getSingleElevation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getBatchElevation(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = batchQuerySchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const { stream, chunkSize, ...rest } = value as ElevationQuery & { stream: boolean; chunkSize?: number };
      const query: ElevationQuery = {
        coordinates: rest.coordinates
      };
      if (rest.format) {
        query.format = rest.format;
      }
      const shouldStream = stream === true;

      if (shouldStream && query.format !== 'json') {
        res.status(400).json({
          success: false,
          error: 'Streaming is only supported for JSON format responses'
        });
        return;
      }

      const startTime = Date.now();

      if (shouldStream) {
        await this.streamBatchResponse(req, res, query, chunkSize);
        return;
      }

      const results = await elevationService.getBatchElevation(
        query.coordinates,
        chunkSize ? { chunkSize } : undefined
      );
      const processingTime = Date.now() - startTime;

      const validPoints = results.filter(r => r.elevation !== null).length;

      // 根据格式返回不同的响应
      if (query.format === 'csv') {
        const csv = this.formatAsCSV(results);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="elevations.csv"');
        res.send(csv);
        return;
      }

      if (query.format === 'geojson') {
        const geojson = this.formatAsGeoJSON(results);
        res.json(geojson);
        return;
      }

      const response: ElevationResponse = {
        success: true,
        data: results,
        metadata: {
          totalPoints: results.length,
          validPoints,
          processingTime,
          dataSource: 'SRTM'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error in getBatchElevation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async streamBatchResponse(
    req: Request,
    res: Response,
    query: ElevationQuery,
    chunkSize?: number
  ): Promise<void> {
    const totalPoints = query.coordinates.length;
    let processedPoints = 0;
    let validPoints = 0;
    const startTime = Date.now();

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    try {
      let chunkIndex = 0;
      for await (const chunk of elevationService.streamBatchElevation(
        query.coordinates,
        chunkSize ? { chunkSize } : undefined
      )) {
        processedPoints += chunk.length;
        validPoints += chunk.filter(point => point.elevation !== null).length;

        const payload: ElevationStreamEvent = {
          type: 'chunk',
          chunkIndex,
          processedPoints,
          totalPoints,
          progress: totalPoints === 0 ? 1 : processedPoints / totalPoints,
          data: chunk
        };

        res.write(`${JSON.stringify(payload)}\n`);
        chunkIndex += 1;
      }
      const processingTime = Date.now() - startTime;
      const completePayload: ElevationStreamEvent = {
        type: 'complete',
        metadata: {
          totalPoints,
          validPoints,
          processingTime,
          dataSource: 'SRTM'
        }
      };
      res.write(`${JSON.stringify(completePayload)}\n`);
    } catch (error) {
      console.error('Error streaming batch elevation:', error);
      const errorPayload: ElevationStreamEvent = {
        type: 'error',
        error: 'Internal server error'
      };
      res.write(`${JSON.stringify(errorPayload)}\n`);
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async getTileInfo(_req: Request, res: Response): Promise<void> {
    try {
      const tileInfo = elevationService.getTileInfo();
      res.json({
        success: true,
        data: tileInfo
      });
    } catch (error) {
      console.error('Error in getTileInfo:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const format = req.query.format as string || 'csv';
      
      if (format === 'json') {
        const template = this.generateJSONTemplate();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="elevation_template.json"');
        res.send(JSON.stringify(template, null, 2));
      } else {
        // 默认返回 CSV 格式
        const csv = this.generateCSVTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="elevation_template.csv"');
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8
      }
    } catch (error) {
      console.error('Error in downloadTemplate:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private generateCSVTemplate(): string {
    const header = 'longitude,latitude\n';
    const examples = [
      '116.3974,39.9093',  // 北京
      '121.4737,31.2304',  // 上海
      '113.2644,23.1291'   // 广州
    ].join('\n');
    return header + examples;
  }

  private generateJSONTemplate(): any[] {
    return [
      { longitude: 116.3974, latitude: 39.9093 },  // 北京
      { longitude: 121.4737, latitude: 31.2304 },  // 上海
      { longitude: 113.2644, latitude: 23.1291 }   // 广州
    ];
  }

  private formatAsCSV(results: any[]): string {
    const header = 'longitude,latitude,elevation,error\n';
    const rows = results.map(r => 
      `${r.longitude},${r.latitude},${r.elevation || ''},${r.error || ''}`
    ).join('\n');
    return header + rows;
  }

  private formatAsGeoJSON(results: any[]): any {
    return {
      type: 'FeatureCollection',
      features: results.map(r => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [r.longitude, r.latitude]
        },
        properties: {
          elevation: r.elevation,
          error: r.error
        }
      }))
    };
  }
}