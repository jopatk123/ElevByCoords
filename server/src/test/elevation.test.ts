import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Elevation API', () => {
  beforeAll(async () => {
    // 等待应用启动
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('GET /api/v1/elevation', () => {
    it('should return elevation for valid coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/elevation')
        .query({
          longitude: 116.3974,
          latitude: 39.9093
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('longitude');
      expect(response.body.data[0]).toHaveProperty('latitude');
      expect(response.body.data[0]).toHaveProperty('elevation');
    });

    it('should return error for invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/elevation')
        .query({
          longitude: 'invalid',
          latitude: 39.9093
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return error for missing coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/elevation');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/elevation/batch', () => {
    it('should return elevations for multiple coordinates', async () => {
      const coordinates = [
        { longitude: 116.3974, latitude: 39.9093 },
        { longitude: 121.4737, latitude: 31.2304 }
      ];

      const response = await request(app)
        .post('/api/v1/elevation/batch')
        .send({ coordinates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.metadata).toHaveProperty('totalPoints', 2);
    });

    it('should return error for empty coordinates array', async () => {
      const response = await request(app)
        .post('/api/v1/elevation/batch')
        .send({ coordinates: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return CSV format when requested', async () => {
      const coordinates = [
        { longitude: 116.3974, latitude: 39.9093 }
      ];

      const response = await request(app)
        .post('/api/v1/elevation/batch')
        .send({ coordinates, format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should stream results when requested', async () => {
      const coordinates = [
        { longitude: 116.3974, latitude: 39.9093 },
        { longitude: 121.4737, latitude: 31.2304 },
        { longitude: 113.2644, latitude: 23.1291 }
      ];

      const response = await request(app)
        .post('/api/v1/elevation/batch')
        .set('Accept', 'application/x-ndjson')
        .send({ coordinates, stream: true });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-ndjson');

      const body = typeof response.text === 'string'
        ? response.text
        : typeof response.body === 'string'
          ? response.body
          : '';
      expect(body.length).toBeGreaterThan(0);
      const lines = body.trim().split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(2);

      const firstEvent = JSON.parse(lines[0]);
      expect(firstEvent.type).toBe('chunk');
      expect(Array.isArray(firstEvent.data)).toBe(true);

      const lastEvent = JSON.parse(lines[lines.length - 1]);
      expect(lastEvent.type).toBe('complete');
      expect(lastEvent.metadata.totalPoints).toBe(coordinates.length);
    });
  });

  describe('GET /api/v1/elevation/tiles', () => {
    it('should return tile information', async () => {
      const response = await request(app)
        .get('/api/v1/elevation/tiles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});