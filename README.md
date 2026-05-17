# 海拔查询系统 (ElevByCoords)

基于 SRTM 数据的经纬度海拔查询服务，提供单点查询、批量查询和文件上传等多种查询方式。

## 功能特性

- 🗺️ **多种查询方式**：单点查询、批量查询、文件上传
- 📊 **丰富的数据格式**：支持 CSV、JSON、GeoJSON 导出
- 🎯 **交互式地图**：可视化查询点位，支持点击添加
- 🛰️ **地图图层切换**：支持街道地图和卫星图像切换（使用Esri World Imagery）
- 📁 **文件上传**：支持 CSV、JSON、TXT、Excel 格式，本地解析后提交查询
- 📈 **查询统计**：实时显示查询成功率和处理时间
- 🔍 **结果筛选**：支持按状态筛选和关键词搜索
- 📱 **响应式设计**：适配桌面和移动设备

## 技术栈

### 后端

- **框架**: Node.js + Express + TypeScript
- **数据处理**: geotiff (GeoTIFF 数据解析)
- **验证**: Joi
- **安全**: Helmet + CORS
- **测试**: Vitest + Supertest

### 前端

- **框架**: Vue 3 + TypeScript + Vite
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **地图**: Leaflet (OpenStreetMap + Esri World Imagery)
- **HTTP**: Axios
- **文件处理**: PapaParse + SheetJS (xlsx)

## 数据说明

- **数据源**: SRTM (Shuttle Radar Topography Mission)
- **精度**: 约 90 米 (3 弧秒)
- **覆盖范围**: 中国东南部地区
- **数据格式**: GeoTIFF
- **无数据处理**: 若坐标超出瓦片覆盖范围或像元缺失，返回 `elevation = null` 并附带错误说明

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+

### 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
cd client && npm install
cd ../server && npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 根据需要修改配置；服务端会优先读取当前工作目录的 .env，若不存在则回退到仓库根目录 .env
```

### 开发模式

```bash
# 启动开发服务器 (前后端同时启动)
npm run dev

# 或分别启动
npm run dev:server  # 后端: http://localhost:40000
npm run dev:client  # 前端: http://localhost:5173
```

### 生产构建

```bash
# 构建所有
npm run build

# 启动生产服务器
cd server && npm start
```

## Docker 部署

### 开发环境

```bash
docker-compose up --build
```

### 生产环境

```bash
docker-compose up -d --build
```

## API 文档

### 单点查询

```http
GET /api/v1/elevation?longitude=121.4737&latitude=31.2304
```

### 批量查询

```http
POST /api/v1/elevation/batch
Content-Type: application/json

{
  "coordinates": [
    {"longitude": 118.7969, "latitude": 32.0603},
    {"longitude": 121.4737, "latitude": 31.2304}
  ],
  "format": "json"
}
```

### 获取瓦片信息

```http
GET /api/v1/elevation/tiles
```

## 文件格式说明

### CSV 格式

```csv
longitude,latitude
118.7969,32.0603
121.4737,31.2304
```

### JSON 格式

```json
[
  {"longitude": 118.7969, "latitude": 32.0603},
  {"longitude": 121.4737, "latitude": 31.2304}
]
```

### Excel 格式

- 支持 `.xls` / `.xlsx`
- 默认读取首个工作表
- 按前两列解析为 `longitude`、`latitude`
- 文件会在浏览器本地解析后再调用批量查询接口

## 测试

```bash
# 运行所有测试
npm run test

# 运行测试覆盖率
npm run test:coverage
```

## 代码质量

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 项目结构

```text
ElevByCoords/
├── client/                 # Vue 3 前端应用
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── views/         # 页面组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── services/      # API 服务
│   │   └── constants/     # 常量配置
├── server/                # Node.js 后端服务
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── services/      # 业务逻辑
│   │   ├── routes/        # 路由定义
│   │   ├── middleware/    # 中间件
│   │   └── config/        # 配置文件
│   └── GD/               # SRTM 数据文件
├── shared/               # 共享类型定义
└── docs/                # 文档
```

## 性能优化

- 瓦片缓存机制，避免重复加载数据
- 前端组件懒加载和代码分割
- 批量查询优化，支持大量坐标点处理
- 响应压缩和静态资源缓存

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

如有问题或建议，请提交 Issue 或联系项目维护者。
