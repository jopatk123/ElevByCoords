<template>
  <div class="map-container">
    <div id="map" class="map"></div>
    <div class="map-controls">
      <el-button 
        type="primary" 
        :icon="LocationIcon"
        @click="getCurrentLocation"
        :loading="locating"
      >
        定位
      </el-button>
      <el-button 
        type="success" 
        :icon="PlusIcon"
        @click="toggleAddMode"
        :class="{ active: addMode }"
      >
        {{ addMode ? '退出添加' : '添加点位' }}
      </el-button>
      <el-button 
        type="warning" 
        :icon="DeleteIcon"
        @click="clearMarkers"
        :disabled="markers.length === 0"
      >
        清除标记
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Location as LocationIcon, Plus as PlusIcon, Delete as DeleteIcon } from '@element-plus/icons-vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import config from '@/constants/env';
import type { Coordinate } from '@/types/shared';

// 修复 Leaflet 默认图标问题
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Props {
  coordinates?: Coordinate[];
}

interface Emits {
  (e: 'coordinate-added', coordinate: Coordinate): void;
  (e: 'coordinates-changed', coordinates: Coordinate[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  coordinates: () => []
});

const emit = defineEmits<Emits>();

// 响应式数据
const map = ref<L.Map | null>(null);
const markers = ref<L.Marker[]>([]);
const addMode = ref(false);
const locating = ref(false);

// 初始化地图
onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});

// 监听坐标变化
watch(() => props.coordinates, (newCoords) => {
  updateMarkers(newCoords);
}, { deep: true });

function initMap(): void {
  map.value = L.map('map').setView(config.mapDefaultCenter, config.mapDefaultZoom);

  // 添加瓦片图层
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value);

  // 添加点击事件
  map.value.on('click', onMapClick);
}

function onMapClick(e: L.LeafletMouseEvent): void {
  if (!addMode.value) return;

  const coordinate: Coordinate = {
    longitude: e.latlng.lng,
    latitude: e.latlng.lat
  };

  addMarker(coordinate);
  emit('coordinate-added', coordinate);
}

function addMarker(coordinate: Coordinate): void {
  if (!map.value) return;

  const marker = L.marker([coordinate.latitude, coordinate.longitude])
    .addTo(map.value)
    .bindPopup(`经度: ${coordinate.longitude.toFixed(6)}<br>纬度: ${coordinate.latitude.toFixed(6)}`);

  markers.value.push(marker);
  
  // 双击删除标记
  marker.on('dblclick', () => {
    removeMarker(marker);
  });
}

function removeMarker(marker: L.Marker): void {
  if (!map.value) return;

  map.value.removeLayer(marker);
  const index = markers.value.indexOf(marker);
  if (index > -1) {
    markers.value.splice(index, 1);
    updateCoordinates();
  }
}

function updateMarkers(coordinates: Coordinate[]): void {
  if (!map.value) return;

  // 只更新变化的标记，而不是全部清除重建
  const existingMarkers = markers.value.map(marker => {
    const latlng = marker.getLatLng();
    return { lng: latlng.lng, lat: latlng.lat };
  });

  // 找出需要添加的新坐标
  coordinates.forEach(coord => {
    const exists = existingMarkers.some(m => 
      Math.abs(m.lng - coord.longitude) < 0.000001 && 
      Math.abs(m.lat - coord.latitude) < 0.000001
    );
    
    if (!exists) {
      addMarker(coord);
    }
  });

  // 找出需要移除的标记
  const coordinatesSet = new Set(coordinates.map(c => `${c.longitude},${c.latitude}`));
  markers.value = markers.value.filter(marker => {
    const latlng = marker.getLatLng();
    const key = `${latlng.lng},${latlng.lat}`;
    if (!coordinatesSet.has(key)) {
      map.value?.removeLayer(marker);
      return false;
    }
    return true;
  });
}

function clearMarkers(): void {
  if (!map.value) return;

  markers.value.forEach(marker => {
    map.value!.removeLayer(marker);
  });
  markers.value = [];
  updateCoordinates();
}

function updateCoordinates(): void {
  const coordinates = markers.value.map(marker => {
    const latlng = marker.getLatLng();
    return {
      longitude: latlng.lng,
      latitude: latlng.lat
    };
  });
  emit('coordinates-changed', coordinates);
}

function toggleAddMode(): void {
  addMode.value = !addMode.value;
  if (addMode.value) {
    ElMessage.info('点击地图添加查询点位');
  }
}

function getCurrentLocation(): void {
  if (!navigator.geolocation) {
    ElMessage.error('浏览器不支持地理定位');
    return;
  }

  locating.value = true;
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      if (map.value) {
        map.value.setView([latitude, longitude], 12);
        
        const coordinate: Coordinate = { longitude, latitude };
        addMarker(coordinate);
        emit('coordinate-added', coordinate);
      }
      
      locating.value = false;
      ElMessage.success('定位成功');
    },
    (error) => {
      locating.value = false;
      ElMessage.error('定位失败: ' + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

// 暴露方法给父组件（在文件末尾统一导出）
// 平移并聚焦到指定坐标
function flyToCoordinate(coordinate: Coordinate, zoom = 12): void {
  if (!map.value) return;
  map.value.flyTo([coordinate.latitude, coordinate.longitude], zoom, { animate: true });
}

// 同时暴露 flyToCoordinate
defineExpose({
  addMarker,
  clearMarkers,
  updateMarkers,
  flyToCoordinate
});
</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  height: 100%;
  
  .map {
    height: 100%;
    width: 100%;
  }
  
  .map-controls {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .el-button {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      
      &.active {
        background-color: var(--el-color-success);
        border-color: var(--el-color-success);
        color: white;
      }
    }
  }
}
</style>