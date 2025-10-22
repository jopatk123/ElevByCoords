import { Router } from 'express';
import { ElevationController } from '../controllers/elevation.controller';

const router = Router();
const elevationController = new ElevationController();

// 单点查询 GET /api/v1/elevation?longitude=116.3974&latitude=39.9093
router.get('/', elevationController.getSingleElevation.bind(elevationController));

// 批量查询 POST /api/v1/elevation/batch
router.post('/batch', elevationController.getBatchElevation.bind(elevationController));

// 获取瓦片信息 GET /api/v1/elevation/tiles
router.get('/tiles', elevationController.getTileInfo.bind(elevationController));

export default router;