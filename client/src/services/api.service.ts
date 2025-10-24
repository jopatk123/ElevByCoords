import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import config from '@/constants/env';
import type {
  Coordinate,
  ElevationResponse,
  ElevationQuery,
  ElevationPoint,
  ElevationStreamChunk,
  ElevationStreamComplete,
  ElevationStreamError,
  ElevationStreamEvent
} from '@/types/shared';

interface StreamHandlers {
  onChunk?: (chunk: ElevationStreamChunk) => void;
  onComplete?: (event: ElevationStreamComplete) => void;
  onError?: (event: ElevationStreamError) => void;
  signal?: AbortSignal;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.api.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        const message = error.response?.data?.error || error.message || '请求失败';
  (ElMessage as any).error(message);
        console.error('Response error:', error);
        return Promise.reject(error);
      }
    );
  }

  async getSingleElevation(coordinate: Coordinate): Promise<ElevationResponse> {
    const response = await this.api.get('/elevation', {
      params: {
        longitude: coordinate.longitude,
        latitude: coordinate.latitude
      }
    });
    return response.data;
  }

  async getBatchElevation(query: ElevationQuery): Promise<ElevationResponse> {
    const response = await this.api.post('/elevation/batch', query);
    return response.data;
  }

  async streamBatchElevation(
    query: ElevationQuery,
    handlers: StreamHandlers = {}
  ): Promise<ElevationResponse> {
    const { signal, onChunk, onComplete, onError } = handlers;
    const payload = {
      ...query,
      format: query.format ?? 'json',
      stream: true
    };

    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    };

    if (signal) {
      requestInit.signal = signal;
    }

    const response = await fetch(`${config.apiBaseUrl}/elevation/batch`, requestInit);

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      const errorMessage = errorText || `批量查询失败，状态码 ${response.status}`;
      throw new Error(errorMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const aggregated: ElevationPoint[] = [];
    let metadata: ElevationStreamComplete['metadata'] | undefined;

    const processLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const event = JSON.parse(trimmed) as ElevationStreamEvent;
        if (event.type === 'chunk') {
          aggregated.push(...event.data);
          onChunk?.(event);
        } else if (event.type === 'complete') {
          metadata = event.metadata;
          onComplete?.(event);
        } else if (event.type === 'error') {
          onError?.(event);
          throw new Error(event.error);
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error('流式数据解析失败');
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        processLine(line);
        newlineIndex = buffer.indexOf('\n');
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
      buffer = '';
    }

    return {
      success: true,
      data: aggregated,
      metadata: metadata ?? {
        totalPoints: aggregated.length,
        validPoints: aggregated.filter(point => point.elevation !== null).length,
        processingTime: 0,
        dataSource: 'SRTM GeoTIFF'
      }
    };
  }

  async downloadBatchResults(query: ElevationQuery, format: 'csv' | 'geojson'): Promise<Blob> {
    const response = await this.api.post('/elevation/batch', 
      { ...query, format }, 
      { 
        responseType: 'blob',
        headers: {
          'Accept': format === 'csv' ? 'text/csv' : 'application/json'
        }
      }
    );
    return response.data;
  }

  async getTileInfo(): Promise<any> {
    const response = await this.api.get('/elevation/tiles');
    return response.data;
  }

  async downloadTemplate(format: 'csv' | 'json'): Promise<Blob> {
    const response = await this.api.get('/elevation/template', 
      {
        params: { format },
        responseType: 'blob',
        headers: {
          'Accept': format === 'csv' ? 'text/csv' : 'application/json'
        }
      }
    );
    return response.data;
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post('/elevation/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
}

export default new ApiService();