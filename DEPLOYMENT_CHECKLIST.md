# 修复检查清单

## ✅ 已完成的修改

### 1. 后端修改（`server/src/index.ts`）
- [x] 移除导致浏览器错误的 `Origin-Agent-Cluster: ?1` 头
- [x] 禁用 HSTS（hsts: false），允许 HTTP 连接
- [x] 更新 CSP 策略同时支持 HTTP 和 HTTPS 的 CDN（//cdnjs.cloudflare.com 等）
- [x] 添加 HTTP 协议的瓦片服务（//tile.openstreetmap.org 等）

### 2. 前端修改（`client/src/components/MapView.vue`）
- [x] 修改 Leaflet 图标 URL 为协议相对路径
- [x] 修改 OpenStreetMap 瓦片 URL 为协议相对路径（`//` 开头）
- [x] 修改 ArcGIS 瓦片 URL 为协议相对路径

### 3. 配置文件修改
- [x] 更新 `.env` 中的 CORS 配置注释
- [x] 创建 `.env.production` 用于生产部署
- [x] 更新 `Dockerfile` 添加 `CORS_ORIGIN=*` 环境变量
- [x] 简化 `index.html`（移除强制 HTTPS CSP）

### 4. 文档更新
- [x] 创建 `DEPLOYMENT_FIX.md` 详细说明修复内容和验证步骤

## 🚀 重新部署步骤

```bash
# 1. 重新构建镜像
docker-compose build

# 2. 停止旧容器
docker-compose down

# 3. 启动新容器
docker-compose up -d

# 4. 验证服务
curl http://47.99.207.128:40000/health
```

## 📋 验证清单

在浏览器中访问 `http://47.99.207.128:40000` 后，检查：

- [ ] 浏览器控制台 - 无 Origin-Agent-Cluster 警告
- [ ] 浏览器控制台 - 无 `net::ERR_SSL_PROTOCOL_ERROR` 错误  
- [ ] 网络标签 - 所有资源使用 `http://` 协议
- [ ] 地图显示正常（能看到街道地图）
- [ ] 地图切换功能正常（街道↔卫星）
- [ ] 坐标查询功能正常

## 核心修复原理

**协议相对 URL**：当资源 URL 以 `//` 开头时，浏览器会自动使用当前页面的协议（HTTP 或 HTTPS）

```
// 不好 - 总是 HTTPS
<img src="https://example.com/image.png" />

// 好 - 自适应协议
<img src="//example.com/image.png" />

// 最好 - 使用相对路径（本地资源）
<img src="/assets/image.png" />
```

这样就解决了混合内容问题！
