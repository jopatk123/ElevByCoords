<template>
  <div class="home-view">
    <el-container class="main-container">
      <!-- 头部 -->
      <el-header class="app-header">
        <div class="header-content">
          <div class="logo-section">
            <h1>海拔查询系统</h1>
          </div>
          <div class="header-actions">
            <el-button type="primary" :icon="InfoIcon" @click="showInfo">
              系统信息
            </el-button>
          </div>
        </div>
      </el-header>

      <!-- 主体内容 -->
      <el-container class="content-container">
        <!-- 左侧面板 -->
        <el-aside class="left-panel" width="400px">
          <div class="panel-content">
            <!-- 查询面板 -->
            <QueryPanel 
              :map-coordinates="mapCoordinates"
              @coordinate-added="onCoordinateAdded"
              @locate-coordinate="onLocateCoordinateFromPanel"
            />
            
            <!-- 结果面板 -->
            <ResultsPanel 
              @locate-point="onLocatePoint"
            />
          </div>
        </el-aside>

        <!-- 右侧地图 -->
        <el-main class="map-main">
          <MapView 
            ref="mapViewRef"
            :coordinates="mapCoordinates"
            @coordinate-added="onMapCoordinateAdded"
            @coordinates-changed="onMapCoordinatesChanged"
          />
        </el-main>
      </el-container>
    </el-container>

    <!-- 系统信息对话框 -->
    <el-dialog v-model="infoDialogVisible" title="系统信息" width="600px">
      <div class="system-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="数据源">SRTM (Shuttle Radar Topography Mission)</el-descriptions-item>
          <el-descriptions-item label="数据精度">约 90 米 (3 弧秒)</el-descriptions-item>
          <el-descriptions-item label="覆盖范围">中国东南部地区</el-descriptions-item>
          <el-descriptions-item label="支持格式">单点查询、批量查询、文件上传</el-descriptions-item>
          <el-descriptions-item label="文件类型">CSV, JSON, TXT, Excel</el-descriptions-item>
          <el-descriptions-item label="最大批量">1000 个坐标点</el-descriptions-item>
        </el-descriptions>
        
        <div class="coverage-info">
          <h4>数据覆盖范围</h4>
          <el-table :data="tileInfo" size="small" border>
            <el-table-column prop="filename" label="文件名" />
            <el-table-column label="经度范围">
              <template #default="{ row }">
                {{ row.bounds.west }}° ~ {{ row.bounds.east }}°
              </template>
            </el-table-column>
            <el-table-column label="纬度范围">
              <template #default="{ row }">
                {{ row.bounds.south }}° ~ {{ row.bounds.north }}°
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { InfoFilled as InfoIcon } from '@element-plus/icons-vue';
import MapView from '@/components/MapView.vue';
import QueryPanel from '@/components/QueryPanel.vue';
import ResultsPanel from '@/components/ResultsPanel.vue';
import apiService from '@/services/api.service';
import type { Coordinate, ElevationPoint } from '@/types/shared';

// 响应式数据
const mapViewRef = ref<InstanceType<typeof MapView>>();
const mapCoordinates = ref<Coordinate[]>([]);
const infoDialogVisible = ref(false);
const tileInfo = ref<any[]>([]);

// 生命周期
onMounted(async () => {
  await loadTileInfo();
});

// 方法
async function loadTileInfo(): Promise<void> {
  try {
    const response = await apiService.getTileInfo();
    if (response.success) {
      tileInfo.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load tile info:', error);
  }
}

function onCoordinateAdded(coordinate: Coordinate): void {
  // 从查询面板添加坐标
  if (!mapCoordinates.value.some(c => 
    Math.abs(c.longitude - coordinate.longitude) < 0.000001 && 
    Math.abs(c.latitude - coordinate.latitude) < 0.000001
  )) {
    mapCoordinates.value.push(coordinate);
    mapViewRef.value?.addMarker(coordinate);
  }
}

function onMapCoordinateAdded(coordinate: Coordinate): void {
  // 从地图添加坐标
  mapCoordinates.value.push(coordinate);
}

function onMapCoordinatesChanged(coordinates: Coordinate[]): void {
  // 地图坐标变化
  mapCoordinates.value = coordinates;
}

function onLocatePoint(point: ElevationPoint): void {
  // 定位到指定点
  const coordinate: Coordinate = {
    longitude: point.longitude,
    latitude: point.latitude
  };
  
  // 如果不在当前坐标列表中，添加进去
  if (!mapCoordinates.value.some(c => 
    Math.abs(c.longitude - coordinate.longitude) < 0.000001 && 
    Math.abs(c.latitude - coordinate.latitude) < 0.000001
  )) {
    mapCoordinates.value.push(coordinate);
  }
  
  // 地图跳转到该位置
  mapViewRef.value?.flyToCoordinate(coordinate, 12);
}

function onLocateCoordinateFromPanel(coordinate: Coordinate): void {
  // 来自查询面板的定位请求
  // 检查坐标是否已经存在
  const exists = mapCoordinates.value.some(c => 
    Math.abs(c.longitude - coordinate.longitude) < 0.000001 && 
    Math.abs(c.latitude - coordinate.latitude) < 0.000001
  );

  // 只有当坐标不存在时才添加，避免重复操作导致递归更新
  if (!exists) {
    mapCoordinates.value.push(coordinate);
  }

  // 延迟执行map操作，确保marker已添加
  setTimeout(() => {
    mapViewRef.value?.flyToCoordinate(coordinate, 12);
  }, 0);
}

function showInfo(): void {
  infoDialogVisible.value = true;
}
</script>

<style scoped lang="scss">
.home-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  
  .main-container {
    height: 100%;
    
    .app-header {
      background-color: var(--el-color-primary);
      color: white;
      padding: 0 24px;
      
      .header-content {
        height: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .logo-section {
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
        }
        
        .header-actions {
          .el-button {
            color: white;
            border-color: rgba(255, 255, 255, 0.3);
            
            &:hover {
              background-color: rgba(255, 255, 255, 0.1);
              border-color: rgba(255, 255, 255, 0.5);
            }
          }
        }
      }
    }
    
    .content-container {
      height: calc(100vh - 60px);
      
      .left-panel {
        border-right: 1px solid var(--el-border-color);
        background-color: var(--el-bg-color-page);
        
        .panel-content {
          height: 100%;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      }
      
      .map-main {
        padding: 0;
        height: 100%;
      }
    }
  }
  
  .system-info {
    .coverage-info {
      margin-top: 20px;
      
      h4 {
        margin-bottom: 12px;
        color: var(--el-text-color-primary);
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .home-view {
    .content-container {
      flex-direction: column;
      
      .left-panel {
        width: 100% !important;
        height: 50%;
        border-right: none;
        border-bottom: 1px solid var(--el-border-color);
      }
      
      .map-main {
        height: 50%;
      }
    }
  }
}
</style>