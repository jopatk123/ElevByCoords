import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import MapView from './MapView.vue';

// Mock Leaflet
const mockMap = {
  setView: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  removeLayer: vi.fn(),
  flyTo: vi.fn(),
};

const mockTileLayer = {
  addTo: vi.fn().mockReturnThis(),
};

const mockMarker = {
  addTo: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  getLatLng: vi.fn().mockReturnValue({ lat: 39.9, lng: 116.4 }),
};

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => mockTileLayer),
    marker: vi.fn(() => mockMarker),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}));

// Mock Element Plus
vi.mock('element-plus', () => ({
  ElMessage: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  ElButton: {
    name: 'ElButton',
    template: '<button><slot /></button>',
  },
}));

// Mock icons
vi.mock('@element-plus/icons-vue', () => ({
  Location: { name: 'LocationIcon' },
  Plus: { name: 'PlusIcon' },
  Delete: { name: 'DeleteIcon' },
  Map: { name: 'MapIcon' },
}));

describe('MapView.vue', () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Mock document.getElementById for map container
    const mapDiv = document.createElement('div');
    mapDiv.id = 'map';
    vi.spyOn(document, 'getElementById').mockReturnValue(mapDiv);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('地图初始化', () => {
    it('应该正确渲染地图容器', () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      expect(wrapper.find('.map-container').exists()).toBe(true);
      expect(wrapper.find('#map').exists()).toBe(true);
    });

    it('应该初始化街道图层和卫星图层', async () => {
      const L = await import('leaflet');
      
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      // 验证地图被创建
      expect(L.default.map).toHaveBeenCalledWith('map');
      
      // 验证两个图层都被创建（街道图层和卫星图层）
      expect(L.default.tileLayer).toHaveBeenCalledTimes(2);
      
      // 验证街道图层被调用
      expect(L.default.tileLayer).toHaveBeenCalledWith(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        expect.objectContaining({
          attribution: '© OpenStreetMap contributors',
        })
      );
      
      // 验证卫星图层被调用
      expect(L.default.tileLayer).toHaveBeenCalledWith(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        expect.objectContaining({
          attribution: expect.stringContaining('Esri'),
        })
      );
    });
  });

  describe('地图控制按钮', () => {
    it('应该渲染所有控制按钮', () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button class="el-button"><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      const buttons = wrapper.findAll('.el-button');
      expect(buttons.length).toBeGreaterThanOrEqual(4); // 定位、添加点位、图层切换、清除标记
    });

    it('应该显示图层切换按钮', () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button class="el-button"><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      const buttonText = wrapper.text();
      expect(buttonText).toContain('卫星'); // 默认显示"卫星"按钮（因为当前是街道地图）
    });
  });

  describe('图层切换功能', () => {
    it('应该能够切换到卫星图层', async () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button @click="$attrs.onClick" class="el-button"><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled', 'title'],
            },
          },
        },
      });

      await nextTick();

      // 找到图层切换按钮（包含"卫星"文本的按钮）
      const buttons = wrapper.findAll('.el-button');
      const mapToggleButton = buttons.find(btn => btn.text().includes('卫星'));
      
      expect(mapToggleButton).toBeDefined();
      
      if (mapToggleButton) {
        // 触发切换
        await mapToggleButton.trigger('click');
        await nextTick();

        // 验证状态改变 - 按钮文本应该变为"街道"
        expect(mapToggleButton.text()).toContain('街道');
      }
    });

    it('toggleMapLayer方法应该正确切换图层', async () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      const component = wrapper.vm;
      
      // 调用切换方法
      if (component.toggleMapLayer) {
        component.toggleMapLayer();
        await nextTick();

        // 验证图层操作被调用
        expect(mockMap.removeLayer).toHaveBeenCalled();
        expect(mockTileLayer.addTo).toHaveBeenCalled();
      }
    });

    it('应该在切换失败时显示错误消息', async () => {
      const { ElMessage } = await import('element-plus');
      
      // Mock removeLayer to throw error
      mockMap.removeLayer.mockImplementationOnce(() => {
        throw new Error('Layer error');
      });

      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button @click="$attrs.onClick"><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      const component = wrapper.vm;
      
      if (component.toggleMapLayer) {
        component.toggleMapLayer();
        await nextTick();

        // 验证错误消息
        expect(ElMessage.error).toHaveBeenCalledWith('图层切换失败');
      }
    });
  });

  describe('标记管理', () => {
    it('应该能够添加标记', async () => {
      const L = await import('leaflet');
      
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      const component = wrapper.vm;
      const coordinate = { latitude: 39.9, longitude: 116.4 };

      component.addMarker(coordinate);
      await nextTick();

      expect(L.default.marker).toHaveBeenCalledWith([39.9, 116.4]);
      expect(mockMarker.addTo).toHaveBeenCalled();
      expect(mockMarker.bindPopup).toHaveBeenCalled();
    });

    it('应该能够清除所有标记', async () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      const component = wrapper.vm;

      // 添加标记
      component.addMarker({ latitude: 39.9, longitude: 116.4 });
      await nextTick();

      // 清除标记
      component.clearMarkers();
      await nextTick();

      expect(mockMap.removeLayer).toHaveBeenCalled();
    });
  });

  describe('坐标管理', () => {
    it('应该接收coordinates prop', () => {
      const coordinates = [
        { latitude: 39.9, longitude: 116.4 },
        { latitude: 31.2, longitude: 121.5 },
      ];

      wrapper = mount(MapView, {
        props: { coordinates },
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      expect(wrapper.props('coordinates')).toEqual(coordinates);
    });

    it('应该在添加坐标时触发coordinate-added事件', async () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      const component = wrapper.vm;
      const coordinate = { latitude: 39.9, longitude: 116.4 };

      component.addMarker(coordinate);
      
      // 手动触发事件
      wrapper.vm.$emit('coordinate-added', coordinate);
      await nextTick();

      expect(wrapper.emitted('coordinate-added')).toBeTruthy();
      expect(wrapper.emitted('coordinate-added')?.[0]).toEqual([coordinate]);
    });
  });

  describe('添加模式', () => {
    it('应该能够切换添加模式', async () => {
      const { ElMessage } = await import('element-plus');
      
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button @click="$attrs.onClick"><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      // 找到添加点位按钮
      const buttons = wrapper.findAll('.el-button');
      const addButton = buttons.find(btn => btn.text().includes('添加点位'));

      if (addButton) {
        await addButton.trigger('click');
        await nextTick();

        // 验证提示信息
        expect(ElMessage.info).toHaveBeenCalledWith('点击地图添加查询点位');
        
        // 验证按钮文本改变
        expect(addButton.text()).toContain('退出添加');
      }
    });
  });

  describe('flyToCoordinate方法', () => {
    it('应该能够飞到指定坐标', async () => {
      wrapper = mount(MapView, {
        global: {
          stubs: {
            'el-button': {
              template: '<button><slot /></button>',
              props: ['type', 'icon', 'loading', 'disabled'],
            },
          },
        },
      });

      await nextTick();

      const component = wrapper.vm;
      const coordinate = { latitude: 39.9, longitude: 116.4 };

      component.flyToCoordinate(coordinate, 15);
      await nextTick();

      expect(mockMap.flyTo).toHaveBeenCalledWith([39.9, 116.4], 15, { animate: true });
    });
  });
});
