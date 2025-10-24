import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  dataPath: string;
  maxUploadSize: number;
  maxBatchSize: number;
  batchChunkSize: number;
  logLevel: string;
  enableRequestLogging: boolean;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dataPath: process.env.DATA_PATH || path.join(__dirname, '../../GD'),
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '20000', 10),
  batchChunkSize: Math.max(1, parseInt(process.env.BATCH_CHUNK_SIZE || '500', 10)),
  logLevel: process.env.LOG_LEVEL || 'info',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
};

export default config;