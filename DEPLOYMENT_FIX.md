# 部署配置修复说明

## 问题描述
项目在服务器部署后出现以下报错：
1. Origin-Agent-Cluster 头导致的浏览器警告
2. HTTPS 资源加载失败（net::ERR_SSL_PROTOCOL_ERROR）

## 根本原因
- 服务器设置了 `Origin-Agent-Cluster: ?1` 头，导致浏览器策略冲突
- 浏览器将 HTTP 页面中的 HTTPS 资源请求转换为安全请求，但服务器不支持 HTTPS
- 地图瓦片和 CDN 资源使用了硬编码的 HTTPS URLs

## 修复内容

### 1. 服务器配置修改 (`server/src/index.ts`)
- 移除 `Origin-Agent-Cluster: ?1` 头
- 禁用 HSTS（HTTP Strict-Transport-Security）
- 更新 CSP（Content-Security-Policy）以支持 HTTP 协议

### 2. 前端资源修改 (`client/src/components/MapView.vue`)
- 将 Leaflet CDN 资源 URL 改为协议相对路径（`//` 开头）
- 地图瓦片 URL 也改为协议相对路径
- 这样可以自动适应 HTTP 和 HTTPS

### 3. 环境配置修改
- 创建 `.env.production` 用于生产环境
- 禁用 HSTS：`ENABLE_HSTS=false`
- 使用相对 API 路径：`VITE_API_BASE_URL=/api/v1`
- CORS 开放配置：`CORS_ORIGIN=*`（可根据需要限制）

### 4. Dockerfile 修改
- 添加环保境变量支持生产配置

## 部署步骤

### 本地开发环境
```bash
# 使用默认的 .env 文件
npm run dev
```

### Docker 生产部署
```bash
# 重新构建镜像
docker-compose build

# 启动容器
docker-compose up -d

# 访问应用
# http://47.99.207.128:40000
```

## 验证修复

1. **浏览器控制台** - 不应该看到：
   - Origin-Agent-Cluster 相关的警告
   - net::ERR_SSL_PROTOCOL_ERROR 错误

2. **网络标签页** - 所有资源应该显示 `http://` 而非 `https://`

3. **功能测试**：
   - 地图应该正常加载（街道和卫星图层）
   - 坐标查询功能正常工作
   - 文件上传功能正常工作

## 如果仍有 HTTPS 重定向问题

检查反向代理（如 Nginx）配置中是否有以下设置，如有则需要移除：
- `add_header Strict-Transport-Security ...`
- `if ($scheme != "https") { rewrite ... }` 

Nginx 配置示例：
```nginx
server {
    listen 80;
    server_name 47.99.207.128;
    
    # 不添加 HSTS 头
    # 不重定向到 HTTPS
    
    location / {
        proxy_pass http://app:40000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 不添加 X-Forwarded-Proto https
    }
}
```

## 未来需要使用 HTTPS 时

如果后续需要升级到 HTTPS：
1. 在 `.env.production` 中设置 `ENABLE_HSTS=true`
2. 更新 server 配置以启用 HSTS
3. 更新浏览器访问协议为 HTTPS
4. 确保所有外部资源也支持 HTTPS
