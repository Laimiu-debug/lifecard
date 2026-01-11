/**
 * 认证服务
 * 实现微信登录流程、token 存储和自动刷新
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { storage, StorageKeys } from '../utils/storage';
import { request } from './request';

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
  login: (options: {
    success?: (res: { code: string }) => void;
    fail?: (err: any) => void;
  }) => void;
  checkSession: (options: {
    success?: () => void;
    fail?: () => void;
  }) => void;
  getUserProfile: (options: {
    desc: string;
    success?: (res: { userInfo: WxUserInfo }) => void;
    fail?: (err: any) => void;
  }) => void;
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  reLaunch: (options: { url: string }) => void;
};

// App 全局数据接口
interface AppGlobalData {
  isLoggedIn: boolean;
  userInfo: WxUserInfo | null;
  apiBaseUrl?: string;
}

interface AppInstance {
  globalData: AppGlobalData;
}

declare const getApp: () => AppInstance;

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

// 用户资料接口
export interface UserProfile {
  id: string;
  email?: string;
  wechat_openid?: string;
  nickname: string;
  avatar_url?: string;
  bio?: string;
  age_range?: string;
  location?: string;
  interest_tags: string[];
  coin_balance: number;
  level: number;
  card_count: number;
  exchange_count: number;
  follower_count: number;
  following_count: number;
  created_at: string;
}

// 登录结果接口
export interface LoginResult {
  token: string;
  user: UserProfile;
  isNewUser: boolean;
}

// 微信登录请求接口
interface WxLoginRequest {
  code: string;
  nickname?: string;
  avatar_url?: string;
}

// API 响应接口
interface AuthApiResponse {
  token: string;
  user: UserProfile;
  is_new_user?: boolean;
}

// Token 过期时间 (默认 7 天，单位：秒)
const TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60;

// Token 刷新阈值 (剩余 1 天时刷新)
const TOKEN_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000;

/**
 * 认证服务类
 * 封装微信登录、token 管理等功能
 */
class AuthService {
  private refreshPromise: Promise<string> | null = null;

  /**
   * 微信登录
   * 获取微信 code 并调用后端 API 进行认证
   * 
   * Requirements: 1.1, 1.2, 1.3
   */
  async login(userInfo?: WxUserInfo): Promise<LoginResult> {
    try {
      // 1. 调用 wx.login 获取 code
      const code = await this.getWxLoginCode();

      // 2. 构建登录请求
      const loginData: WxLoginRequest = {
        code,
        nickname: userInfo?.nickName,
        avatar_url: userInfo?.avatarUrl,
      };

      // 3. 调用后端 API 进行认证
      const response = await request.post<AuthApiResponse>(
        '/api/auth/wechat-login',
        loginData,
        false // 登录接口不需要认证
      );

      // 4. 存储 token
      this.saveToken(response.token);

      // 5. 存储用户资料
      this.saveUserProfile(response.user);

      // 6. 更新全局状态
      this.updateGlobalState(true, response.user);

      return {
        token: response.token,
        user: response.user,
        isNewUser: response.is_new_user || false,
      };
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * 获取微信登录 code
   */
  private getWxLoginCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve(res.code);
          } else {
            reject(new Error('获取微信登录 code 失败'));
          }
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || '微信登录失败'));
        },
      });
    });
  }

  /**
   * 获取微信用户资料
   * 需要用户授权
   * 
   * Requirements: 1.2
   */
  getUserProfile(): Promise<WxUserInfo> {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          resolve(res.userInfo);
        },
        fail: (err) => {
          reject(new Error(err?.errMsg || '获取用户资料失败'));
        },
      });
    });
  }

  /**
   * 检查登录状态
   * 验证本地 token 和微信 session 是否有效
   * 
   * Requirements: 1.6
   */
  async checkSession(): Promise<boolean> {
    // 1. 检查本地 token
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // 2. 检查微信 session
    const sessionValid = await this.checkWxSession();
    if (!sessionValid) {
      // 微信 session 过期，清除本地 token
      this.clearAuth();
      return false;
    }

    // 3. 检查 token 是否需要刷新
    await this.checkAndRefreshToken();

    return true;
  }

  /**
   * 检查微信 session 是否有效
   */
  private checkWxSession(): Promise<boolean> {
    return new Promise((resolve) => {
      wx.checkSession({
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    });
  }

  /**
   * 获取存储的 token
   * 
   * Requirements: 1.4
   */
  getToken(): string | null {
    return storage.getToken();
  }

  /**
   * 保存 token
   * 
   * Requirements: 1.4
   */
  private saveToken(token: string, expiresIn: number = TOKEN_EXPIRES_IN): void {
    storage.setToken(token, expiresIn);
  }

  /**
   * 保存用户资料到本地存储
   */
  private saveUserProfile(user: UserProfile): void {
    storage.set(StorageKeys.USER_PROFILE, user);
  }

  /**
   * 获取本地存储的用户资料
   */
  getUserProfileFromStorage(): UserProfile | null {
    return storage.get<UserProfile>(StorageKeys.USER_PROFILE);
  }

  /**
   * 登出
   * 清除本地存储的认证信息
   */
  logout(): void {
    this.clearAuth();
    this.updateGlobalState(false, null);
    
    // 跳转到登录页
    wx.reLaunch({ url: '/pages/login/login' });
  }

  /**
   * 清除认证信息
   */
  private clearAuth(): void {
    storage.clearToken();
    storage.remove(StorageKeys.USER_PROFILE);
  }

  /**
   * 刷新 token
   * 
   * Requirements: 1.4
   */
  async refreshToken(): Promise<string> {
    // 防止并发刷新
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshToken();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * 执行 token 刷新
   */
  private async doRefreshToken(): Promise<string> {
    try {
      // 获取新的微信 code
      const code = await this.getWxLoginCode();

      // 调用刷新接口
      const response = await request.post<{ token: string }>(
        '/api/auth/refresh',
        { code },
        true // 需要当前 token
      );

      // 保存新 token
      this.saveToken(response.token);

      return response.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // 刷新失败，清除认证信息
      this.clearAuth();
      throw error;
    }
  }

  /**
   * 检查并刷新 token
   * 如果 token 即将过期，自动刷新
   */
  private async checkAndRefreshToken(): Promise<void> {
    const tokenData = storage.get<{ token: string; expires_at: number }>(StorageKeys.TOKEN);
    if (!tokenData || !tokenData.expires_at) {
      return;
    }

    const timeUntilExpiry = tokenData.expires_at - Date.now();
    
    // 如果剩余时间小于阈值，刷新 token
    if (timeUntilExpiry > 0 && timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
      try {
        await this.refreshToken();
      } catch (error) {
        // 刷新失败不影响当前请求，token 仍然有效
        console.warn('Token refresh failed, will retry later:', error);
      }
    }
  }

  /**
   * 更新全局状态
   */
  private updateGlobalState(isLoggedIn: boolean, userInfo: UserProfile | null): void {
    try {
      const app = getApp();
      app.globalData.isLoggedIn = isLoggedIn;
      if (userInfo) {
        app.globalData.userInfo = {
          nickName: userInfo.nickname,
          avatarUrl: userInfo.avatar_url || '',
          gender: 0,
          country: '',
          province: '',
          city: userInfo.location || '',
          language: 'zh_CN',
        };
      } else {
        app.globalData.userInfo = null;
      }
    } catch (error) {
      // 在测试环境中可能没有 app 实例
      console.warn('Failed to update global state:', error);
    }
  }

  /**
   * 静默登录
   * 尝试使用已有的微信 session 进行登录，不需要用户授权
   * 
   * Requirements: 1.6
   */
  async silentLogin(): Promise<LoginResult | null> {
    try {
      // 检查微信 session
      const sessionValid = await this.checkWxSession();
      if (!sessionValid) {
        return null;
      }

      // 获取 code 并登录
      const code = await this.getWxLoginCode();
      
      const response = await request.post<AuthApiResponse>(
        '/api/auth/wechat-login',
        { code },
        false
      );

      // 存储认证信息
      this.saveToken(response.token);
      this.saveUserProfile(response.user);
      this.updateGlobalState(true, response.user);

      return {
        token: response.token,
        user: response.user,
        isNewUser: response.is_new_user || false,
      };
    } catch (error) {
      console.warn('Silent login failed:', error);
      return null;
    }
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}

// 导出单例
export const authService = new AuthService();

// 导出类以便测试
export { AuthService };
