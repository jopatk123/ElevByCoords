import express from 'express';
import cors from 'cors';
import helmet, { type HelmetOptions } from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config from './config/env';
import elevationRoutes from './routes/elevation.routes';

const app = express();

// HTTP 请求头配置
app.use((_req, res, next) => {
  // 移除 Origin-Agent-Cluster，使用相对协议 URL
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const allowedOrigins = config.corsOrigins;
const allowAllOrigins = allowedOrigins.includes('*');

// 安全中间件（定制 CSP 以允许瓦片图层和成功加载 Leaflet）
const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://unpkg.com', 'http://cdnjs.cloudflare.com', 'http://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'http://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'http://*.tile.openstreetmap.org', 'https://server.arcgisonline.com', 'http://server.arcgisonline.com', 'https://cdnjs.cloudflare.com'],
      connectSrc: ["'self'", 'http://*', 'https://*', 'ws:', 'wss:'],
    }
  },
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: false // 禁用 HSTS，允许 HTTP
};

app.use(helmet(helmetOptions));
app.use(cors({
  origin: (origin, callback) => {
    if (allowAllOrigins || !origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS request from disallowed origin: ${origin}`);
    return callback(new Error('Origin not allowed by CORS policy'));
  },
  credentials: true
}));

// 基础中间件
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件
if (config.enableRequestLogging) {
  app.use(morgan('combined'));
}

// 静态文件服务（客户端构建产物）
import path from 'path';
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API 路由
app.use('/api/v1/elevation', elevationRoutes);

// SPA 回退：非 API 路由都返回 index.html
app.get(/^(?!\/api\/).*$/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// 404 处理
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// 错误处理中间件
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large'
    });
  }

  return res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error'
  });
});

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;