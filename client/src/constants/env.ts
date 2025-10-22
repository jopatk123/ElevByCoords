interface AppConfig {
  apiBaseUrl: string;
  mapDefaultCenter: [number, number];
  mapDefaultZoom: number;
  maxBatchSize: number;
  maxFileSize: number;
  supportedFormats: string[];
}

const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  mapDefaultCenter: [32.5, 117.5], // 数据覆盖区域中心
  mapDefaultZoom: 7,
  maxBatchSize: parseInt(import.meta.env.VITE_MAX_BATCH_SIZE || '1000', 10),
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760', 10), // 10MB
  supportedFormats: ['csv', 'json', 'txt', 'xlsx']
};

export default config;