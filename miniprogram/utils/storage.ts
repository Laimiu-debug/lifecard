/**
 * 本地存储封装
 * 提供类型安全的本地存储操作
 */

// 声明全局 wx 对象 (微信小程序环境)
declare const wx: {
  getStorageSync: <T>(key: string) => T | undefined;
  setStorageSync: <T>(key: string, data: T) => void;
  removeStorageSync: (key: string) => void;
  clearStorageSync: () => void;
};

// 存储键常量
export const StorageKeys = {
  TOKEN: 'life_card_token',
  USER_PROFILE: 'life_card_user',
  SEARCH_HISTORY: 'life_card_search_history',
  DRAFT_CARD: 'life_card_draft',
} as const;

export type StorageKey = typeof StorageKeys[keyof typeof StorageKeys];

// Token 存储数据结构
export interface TokenData {
  token: string;
  expires_at: number;
}

// 搜索历史项
export interface SearchHistoryItem {
  keyword: string;
  timestamp: number;
}

/**
 * 存储服务类
 * 封装微信小程序本地存储 API
 */
class Storage {
  /**
   * 同步获取存储数据
   */
  get<T>(key: StorageKey): T | null {
    try {
      const value = wx.getStorageSync<T>(key);
      return (value as T) ?? null;
    } catch (e) {
      console.error(`Storage get error for key ${key}:`, e);
      return null;
    }
  }

  /**
   * 同步设置存储数据
   */
  set<T>(key: StorageKey, value: T): boolean {
    try {
      wx.setStorageSync(key, value);
      return true;
    } catch (e) {
      console.error(`Storage set error for key ${key}:`, e);
      return false;
    }
  }


  /**
   * 同步删除存储数据
   */
  remove(key: StorageKey): boolean {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (e) {
      console.error(`Storage remove error for key ${key}:`, e);
      return false;
    }
  }

  /**
   * 清除所有存储数据
   */
  clear(): boolean {
    try {
      wx.clearStorageSync();
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  }

  // Token 相关便捷方法
  
  /**
   * 获取 Token
   */
  getToken(): string | null {
    const tokenData = this.get<TokenData>(StorageKeys.TOKEN);
    if (!tokenData) return null;
    
    // 检查是否过期
    if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
      this.remove(StorageKeys.TOKEN);
      return null;
    }
    
    return tokenData.token;
  }

  /**
   * 设置 Token
   */
  setToken(token: string, expiresIn?: number): boolean {
    const tokenData: TokenData = {
      token,
      expires_at: expiresIn ? Date.now() + expiresIn * 1000 : 0,
    };
    return this.set(StorageKeys.TOKEN, tokenData);
  }

  /**
   * 清除 Token
   */
  clearToken(): boolean {
    return this.remove(StorageKeys.TOKEN);
  }

  // 搜索历史相关便捷方法

  /**
   * 获取搜索历史
   */
  getSearchHistory(): SearchHistoryItem[] {
    return this.get<SearchHistoryItem[]>(StorageKeys.SEARCH_HISTORY) || [];
  }

  /**
   * 添加搜索历史
   */
  addSearchHistory(keyword: string, maxItems: number = 10): boolean {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return false;

    const history = this.getSearchHistory();
    
    // 移除重复项
    const filtered = history.filter(item => item.keyword !== trimmedKeyword);
    
    // 添加到开头
    filtered.unshift({
      keyword: trimmedKeyword,
      timestamp: Date.now(),
    });
    
    // 限制数量
    const limited = filtered.slice(0, maxItems);
    
    return this.set(StorageKeys.SEARCH_HISTORY, limited);
  }

  /**
   * 清除搜索历史
   */
  clearSearchHistory(): boolean {
    return this.remove(StorageKeys.SEARCH_HISTORY);
  }
}

// 导出单例
export const storage = new Storage();

// 导出类以便测试
export { Storage };
