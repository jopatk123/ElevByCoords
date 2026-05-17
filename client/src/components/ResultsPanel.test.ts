import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ResultsPanel from './ResultsPanel.vue';
import { useElevationStore } from '@/stores/elevation.store';

vi.mock('element-plus', () => ({
  ElMessage: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn()
  }
}));

vi.mock('@element-plus/icons-vue', () => ({
  Download: { name: 'DownloadIcon' },
  Delete: { name: 'DeleteIcon' },
  Search: { name: 'SearchIcon' },
  Location: { name: 'LocationIcon' }
}));

describe('ResultsPanel.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('uses paginated results instead of rendering the full dataset', async () => {
    const store = useElevationStore();

    store.results = Array.from({ length: 60 }, (_item, index) => ({
      longitude: index,
      latitude: index,
      elevation: 100 + index
    }));
    store.processingStats = {
      totalPoints: 60,
      validPoints: 60,
      processingTime: 120
    };

    const wrapper = mount(ResultsPanel, {
      global: {
        stubs: {
          'el-card': { template: '<div><slot name="header" /><slot /></div>' },
          'el-button-group': { template: '<div><slot /></div>' },
          'el-button': { template: '<button><slot /></button>' },
          'el-row': { template: '<div><slot /></div>' },
          'el-col': { template: '<div><slot /></div>' },
          'el-statistic': { template: '<div />' },
          'el-radio-group': { template: '<div><slot /></div>' },
          'el-radio-button': { template: '<button><slot /></button>' },
          'el-input': { template: '<input />' },
          'el-table': { template: '<div><slot /></div>' },
          'el-table-column': { template: '<div />' },
          'el-pagination': { template: '<div />' },
          'el-empty': { template: '<div />' },
          'el-tag': { template: '<span><slot /></span>' }
        }
      }
    });

    expect((wrapper.vm as any).paginatedResults).toHaveLength(50);
    expect((wrapper.vm as any).paginatedResults[0].longitude).toBe(0);

    (wrapper.vm as any).onPageSizeChange(20);
    (wrapper.vm as any).onCurrentPageChange(2);
    await nextTick();

    expect((wrapper.vm as any).paginatedResults).toHaveLength(20);
    expect((wrapper.vm as any).paginatedResults[0].longitude).toBe(20);
    expect((wrapper.vm as any).getRowIndex(0)).toBe(21);
  });
});
