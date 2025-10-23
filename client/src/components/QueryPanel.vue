<template>
  <div class="query-panel">
    <el-card class="panel-card">
      <template #header>
        <div class="card-header">
          <span>查询方式</span>
          <el-radio-group v-model="queryMode" @change="onQueryModeChange">
            <el-radio-button label="single">单点查询</el-radio-button>
            <el-radio-button label="batch">批量查询</el-radio-button>
            <el-radio-button label="upload">文件上传</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 单点查询 -->
      <div v-if="queryMode === 'single'" class="query-section">
        <el-form :model="singleForm" :rules="singleRules" ref="singleFormRef" label-width="80px">
          <el-form-item label="经度" prop="longitude">
            <el-input-number
              v-model="singleForm.longitude"
              :precision="6"
              :min="-180"
              :max="180"
              :step="0.000001"
              placeholder="请输入经度"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="纬度" prop="latitude">
            <el-input-number
              v-model="singleForm.latitude"
              :precision="6"
              :min="-90"
              :max="90"
              :step="0.000001"
              placeholder="请输入纬度"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item>
            <el-button 
              type="primary" 
              @click="handleSingleQuery"
              :loading="loading"
              :icon="SearchIcon"
            >
              查询海拔
            </el-button>
            <el-button @click="resetSingleForm">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 批量查询 -->
      <div v-if="queryMode === 'batch'" class="query-section">
        <div class="batch-input">
          <el-form-item label="坐标列表">
            <el-input
              v-model="batchText"
              type="textarea"
              :rows="8"
              placeholder="请输入坐标，每行一个，格式：经度,纬度&#10;例如：&#10;116.3974,39.9093&#10;121.4737,31.2304"
            />
          </el-form-item>
          <div class="batch-controls">
            <el-button 
              type="primary" 
              @click="handleBatchQuery"
              :loading="loading"
              :disabled="!batchText.trim()"
              :icon="SearchIcon"
            >
              批量查询 ({{ parsedCoordinates.length }} 个点)
            </el-button>
            <el-button @click="clearBatchText">清空</el-button>
            <el-button 
              type="success" 
              @click="useMapCoordinates"
              :disabled="mapCoordinates.length === 0"
              :icon="LocationIcon"
            >
              使用地图点位 ({{ mapCoordinates.length }})
            </el-button>
          </div>
        </div>
      </div>

      <!-- 文件上传 -->
      <div v-if="queryMode === 'upload'" class="query-section">
        <el-upload
          ref="uploadRef"
          class="upload-demo"
          drag
          :auto-upload="false"
          :on-change="handleFileChange"
          :before-upload="beforeUpload"
          accept=".csv,.json,.txt,.xlsx"
          :limit="1"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 CSV、JSON、TXT、Excel 格式，文件大小不超过 10MB
            </div>
          </template>
        </el-upload>
        
        <div v-if="uploadFile" class="file-info">
          <el-alert
            :title="`已选择文件: ${uploadFile.name}`"
            type="info"
            :closable="false"
          />
          <div class="upload-controls">
            <el-button 
              type="primary" 
              @click="handleFileUpload"
              :loading="loading"
              :icon="UploadIcon"
            >
              解析并查询
            </el-button>
            <el-button @click="clearUploadFile">移除文件</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 查询统计 -->
    <el-card v-if="hasResults" class="stats-card">
      <template #header>
        <span>查询统计</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="总点数">{{ processingStats.totalPoints }}</el-descriptions-item>
        <el-descriptions-item label="有效点数">{{ processingStats.validPoints }}</el-descriptions-item>
        <el-descriptions-item label="成功率">{{ successRate.toFixed(1) }}%</el-descriptions-item>
        <el-descriptions-item label="处理时间">{{ processingStats.processingTime }}ms</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineEmits } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search as SearchIcon, Location as LocationIcon, Upload as UploadIcon, UploadFilled } from '@element-plus/icons-vue';
import type { FormInstance, FormRules, UploadFile, UploadInstance } from 'element-plus';
import { useElevationStore } from '@/stores/elevation.store';
import { isValidCoordinate } from '@/utils/coords';
import type { Coordinate } from '@/types/shared';
import Papa from 'papaparse';

interface Props {
  mapCoordinates?: Coordinate[];
}

const props = withDefaults(defineProps<Props>(), {
  mapCoordinates: () => []
});

const elevationStore = useElevationStore();

// 响应式数据
const queryMode = ref<'single' | 'batch' | 'upload'>('single');
const singleFormRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();
const uploadFile = ref<File | null>(null);
const batchText = ref('');

// 单点查询表单
const singleForm = ref({
  longitude: null as number | null,
  latitude: null as number | null
});

const singleRules: FormRules = {
  longitude: [
    { required: true, message: '请输入经度', trigger: 'blur' },
    { type: 'number', min: -180, max: 180, message: '经度范围: -180 到 180', trigger: 'blur' }
  ],
  latitude: [
    { required: true, message: '请输入纬度', trigger: 'blur' },
    { type: 'number', min: -90, max: 90, message: '纬度范围: -90 到 90', trigger: 'blur' }
  ]
};

// 计算属性
const loading = computed(() => elevationStore.loading);
const hasResults = computed(() => elevationStore.hasResults);
const processingStats = computed(() => elevationStore.processingStats);
const successRate = computed(() => elevationStore.successRate);

const parsedCoordinates = computed(() => {
  if (!batchText.value.trim()) return [];
  
  const lines = batchText.value.trim().split('\n');
  const coordinates: Coordinate[] = [];
  
  for (const line of lines) {
    const parts = line.trim().split(',');
    if (parts.length >= 2) {
      const longitude = parseFloat(parts[0]);
      const latitude = parseFloat(parts[1]);
      
      if (!isNaN(longitude) && !isNaN(latitude)) {
        coordinates.push({ longitude, latitude });
      }
    }
  }
  
  return coordinates;
});

// 方法
function onQueryModeChange(): void {
  elevationStore.clearResults();
}

const emit = defineEmits(['locate-coordinate']);

async function handleSingleQuery(): Promise<void> {
  if (!singleFormRef.value) return;

  try {
    await singleFormRef.value.validate();

    const coordinate: Coordinate = {
      longitude: singleForm.value.longitude!,
      latitude: singleForm.value.latitude!
    };

    // 额外校验，防止非法数值通过
    if (!isValidCoordinate(coordinate)) {
      ElMessage.warning('输入的经度/纬度不合法');
      return;
    }

    await elevationStore.querySinglePoint(coordinate);
    ElMessage.success('查询完成');

    // 成功后通知父组件定位并添加标记
    emit('locate-coordinate', coordinate);
  } catch (error) {
    console.error('Single query failed:', error);
  }
}

function resetSingleForm(): void {
  singleFormRef.value?.resetFields();
  elevationStore.clearResults();
}

async function handleBatchQuery(): Promise<void> {
  const coordinates = parsedCoordinates.value;
  
  if (coordinates.length === 0) {
    ElMessage.warning('请输入有效的坐标数据');
    return;
  }
  
  if (coordinates.length > 1000) {
    ElMessage.warning('批量查询最多支持1000个点位');
    return;
  }
  
  try {
    await elevationStore.queryBatchPoints(coordinates);
    ElMessage.success(`批量查询完成，共处理 ${coordinates.length} 个点位`);
  } catch (error) {
    console.error('Batch query failed:', error);
  }
}

function clearBatchText(): void {
  batchText.value = '';
  elevationStore.clearResults();
}

function useMapCoordinates(): void {
  if (props.mapCoordinates.length === 0) {
    ElMessage.warning('地图上没有标记点位');
    return;
  }
  
  const coordText = props.mapCoordinates
    .map(coord => `${coord.longitude},${coord.latitude}`)
    .join('\n');
  
  batchText.value = coordText;
  ElMessage.success(`已导入 ${props.mapCoordinates.length} 个地图点位`);
}

function handleFileChange(file: UploadFile): void {
  if (file.raw) {
    uploadFile.value = file.raw;
  }
}

function beforeUpload(file: File): boolean {
  const isValidType = ['text/csv', 'application/json', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type);
  const isValidSize = file.size / 1024 / 1024 < 10;
  
  if (!isValidType) {
    ElMessage.error('文件格式不支持');
    return false;
  }
  
  if (!isValidSize) {
    ElMessage.error('文件大小不能超过 10MB');
    return false;
  }
  
  return false; // 阻止自动上传
}

async function handleFileUpload(): Promise<void> {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择文件');
    return;
  }
  
  try {
    const coordinates = await parseFile(uploadFile.value);
    
    if (coordinates.length === 0) {
      ElMessage.warning('文件中没有找到有效的坐标数据');
      return;
    }
    
    if (coordinates.length > 1000) {
      const result = await ElMessageBox.confirm(
        `文件包含 ${coordinates.length} 个坐标点，超过建议的1000个点位限制。是否继续？`,
        '确认查询',
        {
          confirmButtonText: '继续查询',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
      
      if (result !== 'confirm') {
        return;
      }
    }
    
    await elevationStore.queryBatchPoints(coordinates);
    ElMessage.success(`文件解析完成，共处理 ${coordinates.length} 个点位`);
  } catch (error) {
    console.error('File upload failed:', error);
    ElMessage.error('文件解析失败');
  }
}

function clearUploadFile(): void {
  uploadFile.value = null;
  uploadRef.value?.clearFiles();
  elevationStore.clearResults();
}

async function parseFile(file: File): Promise<Coordinate[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let coordinates: Coordinate[] = [];
        
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          // 解析 CSV
          Papa.parse(content, {
            complete: (results) => {
              coordinates = parseCSVData(results.data as string[][]);
              resolve(coordinates);
            },
            error: (error) => {
              reject(error);
            }
          });
        } else if (file.name.endsWith('.json')) {
          // 解析 JSON
          const data = JSON.parse(content);
          coordinates = parseJSONData(data);
          resolve(coordinates);
        } else {
          reject(new Error('不支持的文件格式'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsText(file);
  });
}

function parseCSVData(data: string[][]): Coordinate[] {
  const coordinates: Coordinate[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row.length >= 2) {
      const longitude = parseFloat(row[0]);
      const latitude = parseFloat(row[1]);
      
      if (!isNaN(longitude) && !isNaN(latitude)) {
        coordinates.push({ longitude, latitude });
      }
    }
  }
  
  return coordinates;
}

function parseJSONData(data: any): Coordinate[] {
  const coordinates: Coordinate[] = [];
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'object' && item.longitude !== undefined && item.latitude !== undefined) {
        const longitude = parseFloat(item.longitude);
        const latitude = parseFloat(item.latitude);
        
        if (!isNaN(longitude) && !isNaN(latitude)) {
          coordinates.push({ longitude, latitude });
        }
      }
    }
  }
  
  return coordinates;
}

// 监听地图坐标变化
watch(() => props.mapCoordinates, () => {
  // 可以在这里添加自动同步逻辑
}, { deep: true });
</script>

<style scoped lang="scss">
.query-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  .panel-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }
  
  .query-section {
    .batch-input {
      .batch-controls {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    }
    
    .upload-demo {
      margin-bottom: 16px;
    }
    
    .file-info {
      .upload-controls {
        margin-top: 12px;
        display: flex;
        gap: 8px;
      }
    }
  }
  
  .stats-card {
    .el-descriptions {
      margin-top: 0;
    }
  }
}
</style>