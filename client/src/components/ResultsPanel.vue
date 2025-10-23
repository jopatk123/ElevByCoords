<template>
  <div class="results-panel">
    <el-card v-if="hasResults">
      <template #header>
        <div class="results-header">
          <span>查询结果 ({{ results.length }} 条)</span>
          <div class="header-actions">
            <el-button-group>
              <el-button 
                type="primary" 
                :icon="DownloadIcon"
                @click="downloadResults('csv')"
                size="small"
              >
                下载 CSV
              </el-button>
              <el-button 
                type="primary" 
                :icon="DownloadIcon"
                @click="downloadResults('geojson')"
                size="small"
              >
                下载 GeoJSON
              </el-button>
            </el-button-group>
            <el-button 
              type="danger" 
              :icon="DeleteIcon"
              @click="clearResults"
              size="small"
            >
              清空结果
            </el-button>
          </div>
        </div>
      </template>

      <!-- 结果统计 -->
      <div class="results-summary">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic title="总点数" :value="results.length" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="有效点数" :value="validResults.length" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="无效点数" :value="invalidResults.length" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="成功率" :value="successRate" suffix="%" :precision="1" />
          </el-col>
        </el-row>
      </div>

      <!-- 结果筛选 -->
      <div class="results-filter">
        <el-radio-group v-model="filterType" @change="onFilterChange">
          <el-radio-button label="all">全部 ({{ results.length }})</el-radio-button>
          <el-radio-button label="valid">有效 ({{ validResults.length }})</el-radio-button>
          <el-radio-button label="invalid">无效 ({{ invalidResults.length }})</el-radio-button>
        </el-radio-group>
        
        <div class="search-box">
          <el-input
            v-model="searchText"
            placeholder="搜索坐标或海拔值"
            :prefix-icon="SearchIcon"
            clearable
            style="width: 200px"
          />
        </div>
      </div>

      <!-- 结果表格 -->
      <el-table 
        :data="filteredResults" 
        stripe 
        border
        height="400"
        :default-sort="{ prop: 'elevation', order: 'descending' }"
        @row-click="onRowClick"
      >
        <el-table-column type="index" label="#" width="40" align="center" />
        <el-table-column prop="longitude" label="经度" width="60" sortable align="center">
          <template #default="{ row }">
            {{ row.longitude.toFixed(4) }}
          </template>
        </el-table-column>
        <el-table-column prop="latitude" label="纬度" width="60" sortable align="center">
          <template #default="{ row }">
            {{ row.latitude.toFixed(4) }}
          </template>
        </el-table-column>
        <el-table-column prop="elevation" label="高程 (m)" width="60" sortable align="center">
          <template #default="{ row }">
            <el-tag v-if="row.elevation !== null" :type="getElevationTagType(row.elevation)">
              {{ row.elevation }}
            </el-tag>
            <el-tag v-else type="danger">无数据</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="定位" width="70" fixed="right" align="center">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              :icon="LocationIcon"
              @click.stop="locateOnMap(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="filteredResults.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100, 200]"
          :total="filteredResults.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="onCurrentPageChange"
        />
      </div>
    </el-card>

    <!-- 空状态 -->
    <el-empty v-else description="暂无查询结果" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download as DownloadIcon, Delete as DeleteIcon, Search as SearchIcon, Location as LocationIcon } from '@element-plus/icons-vue';
import { useElevationStore } from '@/stores/elevation.store';
import type { ElevationPoint } from '@/types/shared';

interface Emits {
  (e: 'locate-point', point: ElevationPoint): void;
}

const emit = defineEmits<Emits>();

const elevationStore = useElevationStore();

// 响应式数据
const filterType = ref<'all' | 'valid' | 'invalid'>('all');
const searchText = ref('');
const currentPage = ref(1);
const pageSize = ref(50);

// 计算属性
const results = computed(() => elevationStore.results);
const hasResults = computed(() => elevationStore.hasResults);
const validResults = computed(() => elevationStore.validResults);
const invalidResults = computed(() => elevationStore.invalidResults);
const successRate = computed(() => elevationStore.successRate);

const filteredResults = computed(() => {
  let data = results.value;
  
  // 按类型筛选
  if (filterType.value === 'valid') {
    data = validResults.value;
  } else if (filterType.value === 'invalid') {
    data = invalidResults.value;
  }
  
  // 按搜索文本筛选
  if (searchText.value.trim()) {
    const search = searchText.value.toLowerCase();
    data = data.filter(item => 
      item.longitude.toString().includes(search) ||
      item.latitude.toString().includes(search) ||
      (item.elevation !== null && item.elevation.toString().includes(search)) ||
      (item.error && item.error.toLowerCase().includes(search))
    );
  }
  
  return data;
});

// 方法
function onFilterChange(): void {
  currentPage.value = 1;
}

function onRowClick(row: ElevationPoint): void {
  emit('locate-point', row);
}

function locateOnMap(point: ElevationPoint): void {
  emit('locate-point', point);
  ElMessage.info(`定位到: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`);
}

function getElevationTagType(elevation: number): string {
  if (elevation < 0) return 'info';
  if (elevation < 500) return 'success';
  if (elevation < 1000) return 'warning';
  return 'danger';
}

async function downloadResults(format: 'csv' | 'geojson'): Promise<void> {
  try {
    await elevationStore.downloadResults(format);
    ElMessage.success(`${format.toUpperCase()} 文件下载成功`);
  } catch (error) {
    console.error('Download failed:', error);
    ElMessage.error('下载失败');
  }
}

async function clearResults(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有查询结果吗？',
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    elevationStore.clearResults();
    ElMessage.success('结果已清空');
  } catch {
    // 用户取消
  }
}

function onPageSizeChange(size: number): void {
  pageSize.value = size;
  currentPage.value = 1;
}

function onCurrentPageChange(page: number): void {
  currentPage.value = page;
}
</script>

<style scoped lang="scss">
.results-panel {
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  .results-summary {
    margin-bottom: 16px;
    padding: 16px;
    background-color: var(--el-bg-color-page);
    border-radius: 4px;
  }
  
  .results-filter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .search-box {
      display: flex;
      align-items: center;
    }
  }
  
  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: center;
  }
  
  .el-table {
    .el-button {
      padding: 4px 8px;
    }
  }
}
</style>