/**
 * 请求服务封装
 * 提供统一的 HTTP 请求处理，包括 token 自动注入和错误处理
 */

import { storage } from '../utils/storage';

// 声明微信小程序全局对象
declare const wx: {
  request: (options: WxRequestOptions) => void;
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  reLaunch: (options: { url: string }) => void;
  getStorageSync: <T>(key: string) => T | undefined;
};

// App 全局数据接口
interface AppGlobalData {
  apiBaseUrl?: string;
}

interface AppInstance {
  globalData: AppGlobalData;
}

declare const getApp: () => AppInstance;

// 微信请求选项接口
interface WxRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  data?: Record<string, any>;
  header?: Record<string, string>;
  timeout?: number;
  success?: (res: WxRequestResponse) => void;
  fail?: (err: any) => void;
  complete?: () => void;
}

// 微信请求响应接口
interface WxRequestResponse {
  data: any;
  statusCode: number;
  header: Record<string, string>;
}

// 请求配置接口
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
  header?: Record<string, string>;
  needAuth?: boolean;
  timeout?: number;
}

// API 响应接口
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: string;
}

// 错误码枚举
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}


// 应用错误接口
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, string>;
}

// 默认请求超时时间 (毫秒)
const DEFAULT_TIMEOUT = 30000;

/**
 * 错误处理器映射
 */
const errorHandlers: Record<ErrorCode, (error: AppError) => void> = {
  [ErrorCode.NETWORK_ERROR]: () => {
    wx.showToast({ title: '网络连接失败，请检查网络', icon: 'none' });
  },
  [ErrorCode.TIMEOUT]: () => {
    wx.showToast({ title: '请求超时，请重试', icon: 'none' });
  },
  [ErrorCode.UNAUTHORIZED]: () => {
    // 清除 token，跳转登录
    storage.clearToken();
    wx.reLaunch({ url: '/pages/login/login' });
  },
  [ErrorCode.FORBIDDEN]: () => {
    wx.showToast({ title: '没有权限执行此操作', icon: 'none' });
  },
  [ErrorCode.NOT_FOUND]: () => {
    wx.showToast({ title: '请求的资源不存在', icon: 'none' });
  },
  [ErrorCode.VALIDATION_ERROR]: (error: AppError) => {
    const firstError = Object.values(error.details || {})[0];
    wx.showToast({ title: firstError || '输入数据有误', icon: 'none' });
  },
  [ErrorCode.SERVER_ERROR]: () => {
    wx.showToast({ title: '服务器错误，请稍后重试', icon: 'none' });
  },
};

/**
 * 根据 HTTP 状态码获取错误码
 */
function getErrorCodeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 401) return ErrorCode.UNAUTHORIZED;
  if (statusCode === 403) return ErrorCode.FORBIDDEN;
  if (statusCode === 404) return ErrorCode.NOT_FOUND;
  if (statusCode === 422 || statusCode === 400) return ErrorCode.VALIDATION_ERROR;
  if (statusCode >= 500) return ErrorCode.SERVER_ERROR;
  return ErrorCode.SERVER_ERROR;
}

/**
 * 处理错误
 */
function handleError(error: AppError): void {
  const handler = errorHandlers[error.code];
  if (handler) {
    handler(error);
  } else {
    wx.showToast({ title: error.message || '请求失败', icon: 'none' });
  }
}


/**
 * 请求服务类
 * 封装微信小程序网络请求 API
 */
class RequestService {
  private _baseUrl: string = '';

  constructor() {
    // 构造函数不再初始化 baseUrl，改为延迟获取
  }

  /**
   * 获取基础 URL（延迟初始化）
   */
  private get baseUrl(): string {
    if (!this._baseUrl) {
      try {
        const app = getApp();
        this._baseUrl = app?.globalData?.apiBaseUrl || '';
      } catch {
        this._baseUrl = '';
      }
    }
    return this._baseUrl;
  }

  /**
   * 设置基础 URL
   */
  setBaseUrl(url: string): void {
    this._baseUrl = url;
  }

  /**
   * 获取基础 URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 获取认证头
   */
  private getAuthHeader(): Record<string, string> {
    const token = storage.getToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /**
   * 构建完整 URL
   */
  private buildUrl(url: string, params?: Record<string, any>): string {
    // 如果 url 已经是完整 URL，直接使用
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    // 添加查询参数
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      
      if (queryString) {
        return fullUrl.includes('?') ? `${fullUrl}&${queryString}` : `${fullUrl}?${queryString}`;
      }
    }
    
    return fullUrl;
  }


  /**
   * 发送请求
   * @param config 请求配置
   * @returns Promise<ApiResponse<T>>
   */
  request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      const { url, method, data, header = {}, needAuth = true, timeout = DEFAULT_TIMEOUT } = config;

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...header,
      };

      // 自动注入 token
      if (needAuth) {
        const authHeader = this.getAuthHeader();
        Object.assign(headers, authHeader);
      }

      // 构建完整 URL
      const fullUrl = method === 'GET' ? this.buildUrl(url, data) : this.buildUrl(url);

      wx.request({
        url: fullUrl,
        method,
        data: method !== 'GET' ? data : undefined,
        header: headers,
        timeout,
        success: (res: WxRequestResponse) => {
          const { statusCode, data: responseData } = res;

          // 成功响应 (2xx)
          if (statusCode >= 200 && statusCode < 300) {
            resolve({
              success: true,
              data: responseData as T,
            });
            return;
          }

          // 错误响应
          const errorCode = getErrorCodeFromStatus(statusCode);
          const error: AppError = {
            code: errorCode,
            message: (responseData as any)?.message || '请求失败',
            details: (responseData as any)?.details,
          };

          // 处理错误 (显示提示)
          handleError(error);

          resolve({
            success: false,
            message: error.message,
            error_code: error.code,
          });
        },
        fail: (err: any) => {
          // 网络错误或超时
          const isTimeout = err?.errMsg?.includes('timeout');
          const errorCode = isTimeout ? ErrorCode.TIMEOUT : ErrorCode.NETWORK_ERROR;
          const error: AppError = {
            code: errorCode,
            message: isTimeout ? '请求超时' : '网络连接失败',
          };

          handleError(error);

          resolve({
            success: false,
            message: error.message,
            error_code: error.code,
          });
        },
      });
    });
  }


  /**
   * GET 请求
   * @param url 请求地址
   * @param params 查询参数
   * @param needAuth 是否需要认证
   * @returns Promise<T>
   */
  async get<T>(url: string, params?: Record<string, any>, needAuth = true): Promise<T> {
    const response = await this.request<T>({
      url,
      method: 'GET',
      data: params,
      needAuth,
    });

    if (!response.success) {
      throw new Error(response.message || '请求失败');
    }

    return response.data as T;
  }

  /**
   * POST 请求
   * @param url 请求地址
   * @param data 请求数据
   * @param needAuth 是否需要认证
   * @returns Promise<T>
   */
  async post<T>(url: string, data?: Record<string, any>, needAuth = true): Promise<T> {
    const response = await this.request<T>({
      url,
      method: 'POST',
      data,
      needAuth,
    });

    if (!response.success) {
      throw new Error(response.message || '请求失败');
    }

    return response.data as T;
  }

  /**
   * PUT 请求
   * @param url 请求地址
   * @param data 请求数据
   * @param needAuth 是否需要认证
   * @returns Promise<T>
   */
  async put<T>(url: string, data?: Record<string, any>, needAuth = true): Promise<T> {
    const response = await this.request<T>({
      url,
      method: 'PUT',
      data,
      needAuth,
    });

    if (!response.success) {
      throw new Error(response.message || '请求失败');
    }

    return response.data as T;
  }

  /**
   * DELETE 请求
   * @param url 请求地址
   * @param needAuth 是否需要认证
   * @returns Promise<T>
   */
  async delete<T>(url: string, needAuth = true): Promise<T> {
    const response = await this.request<T>({
      url,
      method: 'DELETE',
      needAuth,
    });

    if (!response.success) {
      throw new Error(response.message || '请求失败');
    }

    return response.data as T;
  }
}

// 导出单例
export const request = new RequestService();

// 导出类以便测试
export { RequestService };

// 导出错误处理函数以便测试
export { handleError, getErrorCodeFromStatus };
