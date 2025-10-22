// 测试环境设置
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.DATA_PATH = './GD';
});

afterAll(() => {
  // 清理测试环境
});