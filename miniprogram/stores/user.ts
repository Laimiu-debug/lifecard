/**
 * 用户状态管理 Store
 * 使用 MobX 实现登录状态、用户资料、金币余额管理
 * 
 * Requirements: 1.4, 2.1, 11.1
 */

import { observable, action } from 'mobx-miniprogram';
import { storage, StorageKeys } from '../utils/storage';
import { authService } from '../services/auth';
import { request } from '../services/request';
import type { 
  UserProfile, 
  ProfileUpdateData,
  UserStats 
} from '../types/user';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

// 声明微信小程序全局对象
declare const wx: {
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  showLoading: (options: { title: string; mask?: boolean }) => void;
  hideLoading: () => void;
  navigateTo: (options: { url: string }) => void;
  reLaunch: (options: { url: string }) => void;
};

// 微信用户信息接口
interface WxUserInfo {
  nickName: string;
  avatarUrl: string;
  gender: number;
  country: string;
  province: string;
  city: string;
  language: string;
}

// Store 状态接口
interface UserStoreState {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 用户资料 */
  profile: UserProfile | null;
  /** 金币余额 */
  coinBalance: number;
  /** 兴趣标签 */
  interestTags: string[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
}

// Store Actions 接口
interface UserStoreActions {
  /** 获取显示名称 */
  readonly displayName: string;
  /** 获取头像 URL */
  readonly avatarUrl: string;
  /** 获取用户 ID */
  readonly userId: string | null;
  /** 获取用户统计信息 */
  readonly stats: UserStats | null;
  /** 初始化用户状态 */
  init(): void;
  /** 用户登录 */
  login(userInfo?: WxUserInfo): Promise<void>;
  /** 用户登出 */
  logout(): void;
  /** 获取用户资料 */
  fetchProfile(): Promise<void>;
  /** 更新用户资料 */
  updateProfile(data: ProfileUpdateData): Promise<void>;
  /** 刷新金币余额 */
  refreshBalance(): Promise<void>;
  /** 设置兴趣标签 */
  setInterestTags(tags: string[]): Promise<void>;
  /** 更新金币余额（本地更新） */
  updateCoinBalance(amount: number): void;
  /** 检查余额是否足够 */
  hasEnoughBalance(amount: number): boolean;
  /** 清除错误信息 */
  clearError(): void;
  /** 静默登录 */
  silentLogin(): Promise<boolean>;
  /** 检查登录状态 */
  checkLoginStatus(): Promise<boolean>;
}

// 完整 Store 类型
export type UserStore = UserStoreState & UserStoreActions;

/**
 * 用户 Store
 * 管理用户登录状态、资料和金币余额
 */
export const userStore: UserStore = observable({
  // ==================== 状态 ====================
  
  /** 是否已登录 */
  isLoggedIn: false,
  
  /** 用户资料 */
  profile: null as UserProfile | null,
  
  /** 金币余额 */
  coinBalance: 0,
  
  /** 兴趣标签 */
  interestTags: [] as string[],
  
  /** 是否正在加载 */
  loading: false,
  
  /** 错误信息 */
  error: null as string | null,

  // ==================== 计算属性 ====================
  
  /** 获取显示名称 */
  get displayName(): string {
    return this.profile?.nickname || '未登录用户';
  },
  
  /** 获取头像 URL */
  get avatarUrl(): string {
    return this.profile?.avatar_url || '/assets/images/default-avatar.png';
  },
  
  /** 获取用户 ID */
  get userId(): string | null {
    return this.profile?.id || null;
  },
  
  /** 获取用户统计信息 */
  get stats(): UserStats | null {
    if (!this.profile) return null;
    return {
      card_count: this.profile.card_count,
      collected_count: 0, // 需要从其他地方获取
      follower_count: this.profile.follower_count,
      following_count: this.profile.following_count,
      total_likes: 0, // 需要从其他地方获取
      total_exchanges: 0, // 需要从其他地方获取
    };
  },

  // ==================== Actions ====================
  
  /**
   * 初始化用户状态
   * 从本地存储恢复用户信息
   * 
   * Requirements: 1.4, 1.6
   */
  init: action(function(this: UserStoreState) {
    // 检查本地存储的 token
    const token = storage.getToken();
    if (token) {
      // 从本地存储恢复用户资料
      const savedProfile = storage.get<UserProfile>(StorageKeys.USER_PROFILE);
      if (savedProfile) {
        this.isLoggedIn = true;
        this.profile = savedProfile;
        this.coinBalance = savedProfile.coin_balance;
      }
    }
  }),

  /**
   * 用户登录
   * 调用微信登录并获取用户信息
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  login: action(async function(this: UserStoreState, userInfo?: WxUserInfo): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      const result = await authService.login(userInfo);
      
      // 更新状态
      this.isLoggedIn = true;
      this.profile = result.user as unknown as UserProfile;
      this.coinBalance = result.user.coin_balance;
      
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err: any) {
      this.error = err?.message || '登录失败';
      console.error('Login failed:', err);
      wx.showToast({ title: this.error || '登录失败', icon: 'none' });
      throw err;
    } finally {
      this.loading = false;
    }
  }),

  /**
   * 用户登出
   * 清除本地存储和状态
   */
  logout: action(function(this: UserStoreState): void {
    // 清除状态
    this.isLoggedIn = false;
    this.profile = null;
    this.coinBalance = 0;
    this.interestTags = [];
    this.error = null;
    
    // 调用 authService 登出
    authService.logout();
  }),

  /**
   * 获取用户资料
   * 从 API 获取最新的用户资料
   * 
   * Requirements: 2.1
   */
  fetchProfile: action(async function(this: UserStoreState): Promise<void> {
    if (!this.isLoggedIn) return;
    
    this.loading = true;
    this.error = null;
    
    try {
      const profile = await request.get<UserProfile>('/api/users/me');
      
      // 更新状态
      this.profile = profile;
      this.coinBalance = profile.coin_balance;
      
      // 保存到本地存储
      storage.set(StorageKeys.USER_PROFILE, profile);
    } catch (err: any) {
      this.error = err?.message || '获取用户资料失败';
      console.error('Fetch profile failed:', err);
    } finally {
      this.loading = false;
    }
  }),

  /**
   * 更新用户资料
   * 
   * Requirements: 2.3, 2.4
   */
  updateProfile: action(async function(
    this: UserStoreState, 
    data: ProfileUpdateData
  ): Promise<void> {
    if (!this.isLoggedIn) {
      throw new Error('请先登录');
    }
    
    this.loading = true;
    this.error = null;
    
    try {
      const updatedProfile = await request.put<UserProfile>('/api/users/me', data);
      
      // 更新状态
      this.profile = updatedProfile;
      
      // 保存到本地存储
      storage.set(StorageKeys.USER_PROFILE, updatedProfile);
      
      wx.showToast({ title: '资料更新成功', icon: 'success' });
    } catch (err: any) {
      this.error = err?.message || '更新资料失败';
      console.error('Update profile failed:', err);
      wx.showToast({ title: this.error || '更新失败', icon: 'none' });
      throw err;
    } finally {
      this.loading = false;
    }
  }),

  /**
   * 刷新金币余额
   * 
   * Requirements: 11.1
   */
  refreshBalance: action(async function(this: UserStoreState): Promise<void> {
    if (!this.isLoggedIn) return;
    
    try {
      // 后端接口是 /api/users/me/coins
      const response = await request.get<{ coin_balance: number }>('/api/users/me/coins');
      
      // 更新余额
      this.coinBalance = response?.coin_balance || 0;
      
      // 同步更新 profile 中的余额
      if (this.profile) {
        this.profile = {
          ...this.profile,
          coin_balance: response?.coin_balance || 0,
        };
        storage.set(StorageKeys.USER_PROFILE, this.profile);
      }
    } catch (err: any) {
      console.error('Refresh balance failed:', err);
    }
  }),

  /**
   * 设置兴趣标签
   */
  setInterestTags: action(async function(
    this: UserStoreState, 
    tags: string[]
  ): Promise<void> {
    if (!this.isLoggedIn) {
      throw new Error('请先登录');
    }
    
    try {
      await request.put('/api/users/me/interests', { interest_tags: tags });
      
      // 更新本地状态
      this.interestTags = tags;
      
      wx.showToast({ title: '兴趣标签已更新', icon: 'success' });
    } catch (err: any) {
      console.error('Set interest tags failed:', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
      throw err;
    }
  }),

  /**
   * 更新金币余额（本地更新，用于乐观更新）
   * 
   * Requirements: 11.1
   */
  updateCoinBalance: action(function(
    this: UserStoreState, 
    amount: number
  ): void {
    this.coinBalance += amount;
    
    // 同步更新 profile 中的余额
    if (this.profile) {
      this.profile = {
        ...this.profile,
        coin_balance: this.coinBalance,
      };
    }
  }),

  /**
   * 检查余额是否足够
   * 
   * Requirements: 7.2
   */
  hasEnoughBalance(this: UserStoreState, amount: number): boolean {
    return this.coinBalance >= amount;
  },

  /**
   * 清除错误信息
   */
  clearError: action(function(this: UserStoreState): void {
    this.error = null;
  }),

  /**
   * 静默登录
   * 尝试使用已有的微信 session 进行登录
   * 
   * Requirements: 1.6
   */
  silentLogin: action(async function(this: UserStoreState): Promise<boolean> {
    try {
      const result = await authService.silentLogin();
      
      if (result) {
        this.isLoggedIn = true;
        this.profile = result.user as unknown as UserProfile;
        this.coinBalance = result.user.coin_balance;
        return true;
      }
      
      return false;
    } catch (err) {
      console.warn('Silent login failed:', err);
      return false;
    }
  }),

  /**
   * 检查登录状态
   * 
   * Requirements: 1.6
   */
  checkLoginStatus: action(async function(this: UserStoreState): Promise<boolean> {
    const isValid = await authService.checkSession();
    
    if (!isValid) {
      // 清除本地状态
      this.isLoggedIn = false;
      this.profile = null;
      this.coinBalance = 0;
    }
    
    return isValid;
  }),
});
