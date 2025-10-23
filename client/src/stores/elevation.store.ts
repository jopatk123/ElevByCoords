import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Coordinate, ElevationPoint, ElevationQuery } from '@/types/shared';
import apiService from '@/services/api.service';

export const useElevationStore = defineStore('elevation', () => {
  // 状态
  const results = ref<ElevationPoint[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentQuery = ref<ElevationQuery | null>(null);
  const processingStats = ref({
    totalPoints: 0,
    validPoints: 0,
    processingTime: 0
  });

  // 计算属性
  const hasResults = computed(() => results.value.length > 0);
  const successRate = computed(() => {
    if (processingStats.value.totalPoints === 0) return 0;
    return (processingStats.value.validPoints / processingStats.value.totalPoints) * 100;
  });

  const validResults = computed(() => 
    results.value.filter(r => r.elevation !== null)
  );

  const invalidResults = computed(() => 
    results.value.filter(r => r.elevation === null)
  );

  // 操作
  async function querySinglePoint(coordinate: Coordinate): Promise<void> {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await apiService.getSingleElevation(coordinate);
      
      if (response.success && response.data) {
        // 使用 splice 而不是赋值，减少响应式系统的反应
        results.value.splice(0, results.value.length, ...response.data);
        
        if (response.metadata) {
          processingStats.value.totalPoints = response.metadata.totalPoints;
          processingStats.value.validPoints = response.metadata.validPoints;
          processingStats.value.processingTime = response.metadata.processingTime;
        }
      } else {
        throw new Error(response.error || '查询失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '查询失败';
      results.value.splice(0, results.value.length);
    } finally {
      loading.value = false;
    }
  }

  async function queryBatchPoints(coordinates: Coordinate[]): Promise<void> {
    try {
      loading.value = true;
      error.value = null;
      
      const query: ElevationQuery = { coordinates };
      currentQuery.value = query;
      
      const response = await apiService.getBatchElevation(query);
      
      if (response.success && response.data) {
        // 使用 splice 而不是赋值
        results.value.splice(0, results.value.length, ...response.data);
        
        if (response.metadata) {
          processingStats.value.totalPoints = response.metadata.totalPoints;
          processingStats.value.validPoints = response.metadata.validPoints;
          processingStats.value.processingTime = response.metadata.processingTime;
        }
      } else {
        throw new Error(response.error || '批量查询失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量查询失败';
      results.value.splice(0, results.value.length);
    } finally {
      loading.value = false;
    }
  }

  async function downloadResults(format: 'csv' | 'geojson'): Promise<void> {
    if (!currentQuery.value) {
      throw new Error('没有可下载的结果');
    }

    try {
      const blob = await apiService.downloadBatchResults(currentQuery.value, format);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `elevation_results.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      throw new Error('下载失败');
    }
  }

  function clearResults(): void {
    results.value = [];
    error.value = null;
    currentQuery.value = null;
    processingStats.value = {
      totalPoints: 0,
      validPoints: 0,
      processingTime: 0
    };
  }

  function addCoordinate(coordinate: Coordinate): void {
    // 添加单个坐标到当前查询
    if (currentQuery.value) {
      currentQuery.value.coordinates.push(coordinate);
    } else {
      currentQuery.value = { coordinates: [coordinate] };
    }
  }

  return {
    // 状态
    results,
    loading,
    error,
    currentQuery,
    processingStats,
    
    // 计算属性
    hasResults,
    successRate,
    validResults,
    invalidResults,
    
    // 操作
    querySinglePoint,
    queryBatchPoints,
    downloadResults,
    clearResults,
    addCoordinate
  };
});