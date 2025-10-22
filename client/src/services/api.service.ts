import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import config from '@/constants/env';
import type { Coordinate, ElevationResponse, ElevationQuery } from '@/types/shared';

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
        ElMessage.error(message);
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