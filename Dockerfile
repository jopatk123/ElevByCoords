# 多阶段构建 - 生产环境
FROM node:20-alpine AS base

# 安装 GDAL 依赖
RUN apk add --no-cache \
    gdal-dev \
    gdal-tools \
    python3 \
    make \
    g++

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# 安装依赖
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force
RUN cd client && npm ci --only=production && npm cache clean --force
RUN cd server && npm ci --only=production && npm cache clean --force

# 构建阶段
FROM base AS builder
COPY . .
RUN npm ci
RUN npm run build

# 生产运行阶段
FROM node:20-alpine AS runner

# 安装运行时 GDAL 依赖
RUN apk add --no-cache gdal gdal-tools

WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

# 复制构建产物
COPY --from=builder --chown=appuser:appgroup /app/server/dist ./server/dist
COPY --from=builder --chown=appuser:appgroup /app/client/dist ./client/dist
COPY --from=deps --chown=appuser:appgroup /app/server/node_modules ./server/node_modules
COPY --from=builder --chown=appuser:appgroup /app/server/package.json ./server/
COPY --from=builder --chown=appuser:appgroup /app/shared ./shared

# 复制数据文件
COPY --chown=appuser:appgroup ./server/GD ./server/GD

USER appuser

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/dist/index.js"]