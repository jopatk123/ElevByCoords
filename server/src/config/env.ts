import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  dataPath: string;
  maxUploadSize: number;
  maxBatchSize: number;
  batchChunkSize: number;
  logLevel: string;
  enableRequestLogging: boolean;
}

const parseOrigins = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
};

const unique = (origins: string[]): string[] => Array.from(new Set(origins));

const buildDefaultCorsOrigins = (port: number): string[] => unique([
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  `http://host.docker.internal:${port}`,
  `https://localhost:${port}`,
  `https://127.0.0.1:${port}`,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
]);

const buildInternalOrigins = (port: number): string[] => unique([
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  `http://host.docker.internal:${port}`,
  `https://localhost:${port}`,
  `https://127.0.0.1:${port}`
]);

const port = parseInt(process.env.PORT || '40000', 10);

const config: Config = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (() => {
    const envOrigins = parseOrigins(process.env.CORS_ORIGIN);
    const baseOrigins = envOrigins.length > 0 ? envOrigins : buildDefaultCorsOrigins(port);
    return unique([...baseOrigins, ...buildInternalOrigins(port)]);
  })(),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '../../GD'),
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '20000', 10),
  batchChunkSize: Math.max(1, parseInt(process.env.BATCH_CHUNK_SIZE || '500', 10)),
  logLevel: process.env.LOG_LEVEL || 'info',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
};

export default config;