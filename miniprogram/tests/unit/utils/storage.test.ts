/**
 * Storage 工具测试
 */
import { Storage, StorageKeys } from '../../../utils/storage';

// 获取全局 wx 对象
declare const wx: any;

describe('Storage', () => {
  let storageInstance: Storage;
  let mockStorage: Record<string, any>;

  beforeEach(() => {
    storageInstance = new Storage();
    mockStorage = {};

    // 设置 mock 实现
    (wx.getStorageSync as jest.Mock).mockImplementation((key: string) => {
      return mockStorage[key];
    });

    (wx.setStorageSync as jest.Mock).mockImplementation((key: string, value: any) => {
      mockStorage[key] = value;
    });

    (wx.removeStorageSync as jest.Mock).mockImplementation((key: string) => {
      delete mockStorage[key];
    });
  });

  describe('get/set/remove', () => {
    it('should set and get value correctly', () => {
      const testData = { foo: 'bar' };
      storageInstance.set(StorageKeys.USER_PROFILE, testData);
      
      const result = storageInstance.get(StorageKeys.USER_PROFILE);
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const result = storageInstance.get(StorageKeys.TOKEN);
      expect(result).toBeNull();
    });

    it('should remove value correctly', () => {
      storageInstance.set(StorageKeys.USER_PROFILE, { test: 'data' });
      storageInstance.remove(StorageKeys.USER_PROFILE);
      
      const result = storageInstance.get(StorageKeys.USER_PROFILE);
      expect(result).toBeNull();
    });
  });

  describe('Token operations', () => {
    it('should set and get token correctly', () => {
      const token = 'test-jwt-token';
      storageInstance.setToken(token);
      
      const result = storageInstance.getToken();
      expect(result).toBe(token);
    });


    it('should return null for expired token', () => {
      // 设置一个已过期的 token
      mockStorage[StorageKeys.TOKEN] = {
        token: 'expired-token',
        expires_at: Date.now() - 1000, // 1秒前过期
      };
      
      const result = storageInstance.getToken();
      expect(result).toBeNull();
    });

    it('should clear token correctly', () => {
      storageInstance.setToken('test-token');
      storageInstance.clearToken();
      
      const result = storageInstance.getToken();
      expect(result).toBeNull();
    });
  });

  describe('Search history operations', () => {
    it('should add search history correctly', () => {
      storageInstance.addSearchHistory('test keyword');
      
      const history = storageInstance.getSearchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].keyword).toBe('test keyword');
    });

    it('should not add empty keyword', () => {
      storageInstance.addSearchHistory('');
      storageInstance.addSearchHistory('   ');
      
      const history = storageInstance.getSearchHistory();
      expect(history).toHaveLength(0);
    });

    it('should remove duplicate keywords', () => {
      storageInstance.addSearchHistory('keyword1');
      storageInstance.addSearchHistory('keyword2');
      storageInstance.addSearchHistory('keyword1'); // 重复
      
      const history = storageInstance.getSearchHistory();
      expect(history).toHaveLength(2);
      expect(history[0].keyword).toBe('keyword1'); // 最新的在前面
    });

    it('should limit history items', () => {
      for (let i = 0; i < 15; i++) {
        storageInstance.addSearchHistory(`keyword${i}`);
      }
      
      const history = storageInstance.getSearchHistory();
      expect(history).toHaveLength(10); // 默认最多10条
    });

    it('should clear search history', () => {
      storageInstance.addSearchHistory('test');
      storageInstance.clearSearchHistory();
      
      const history = storageInstance.getSearchHistory();
      expect(history).toHaveLength(0);
    });
  });
});
