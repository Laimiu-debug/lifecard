/**
 * 上传服务
 * 实现图片/视频上传到云存储
 * 
 * Requirements: 3.4, 2.6
 */

import { storage } from '../utils/storage';
import type { UploadResult, BatchUploadResult } from '../types/api';
import type { MediaItem, MediaType } from '../types/card';

// 声明微信小程序全局对象
declare const wx: {
  uploadFile: (options: WxUploadFileOptions) => WxUploadTask;
  chooseImage: (options: WxChooseImageOptions) => void;
  chooseMedia: (options: WxChooseMediaOptions) => void;
  showToast: (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none'; duration?: number }) => void;
  showLoading: (options: { title: string; mask?: boolean }) => void;
  hideLoading: () => void;
  getFileInfo: (options: WxGetFileInfoOptions) => void;
  getImageInfo: (options: WxGetImageInfoOptions) => void;
  getVideoInfo: (options: WxGetVideoInfoOptions) => void;
};

// App 全局数据接口
interface AppGlobalData {
  apiBaseUrl?: string;
  uploadUrl?: string;
}

interface AppInstance {
  globalData: AppGlobalData;
}

declare const getApp: () => AppInstance;
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// 微信上传文件选项
interface WxUploadFileOptions {
  url: string;
  filePath: string;
  name: string;
  header?: Record<string, string>;
  formData?: Record<string, any>;
  timeout?: number;
  success?: (res: WxUploadFileResponse) => void;
  fail?: (err: any) => void;
  complete?: () => void;
}

// 微信上传文件响应
interface WxUploadFileResponse {
  data: string;
  statusCode: number;
}

// 微信上传任务
interface WxUploadTask {
  onProgressUpdate: (callback: (res: WxUploadProgressResult) => void) => void;
  abort: () => void;
}

// 上传进度结果
interface WxUploadProgressResult {
  progress: number;
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
}

// 选择图片选项
interface WxChooseImageOptions {
  count?: number;
  sizeType?: ('original' | 'compressed')[];
  sourceType?: ('album' | 'camera')[];
  success?: (res: WxChooseImageResult) => void;
  fail?: (err: any) => void;
}

// 选择图片结果
interface WxChooseImageResult {
  tempFilePaths: string[];
  tempFiles: Array<{
    path: string;
    size: number;
  }>;
}

// 选择媒体选项
interface WxChooseMediaOptions {
  count?: number;
  mediaType?: ('image' | 'video')[];
  sourceType?: ('album' | 'camera')[];
  maxDuration?: number;
  sizeType?: ('original' | 'compressed')[];
  camera?: 'back' | 'front';
  success?: (res: WxChooseMediaResult) => void;
  fail?: (err: any) => void;
}

// 选择媒体结果
interface WxChooseMediaResult {
  tempFiles: Array<{
    tempFilePath: string;
    size: number;
    duration?: number;
    height?: number;
    width?: number;
    thumbTempFilePath?: string;
    fileType: 'image' | 'video';
  }>;
  type: 'image' | 'video' | 'mix';
}

// 获取文件信息选项
interface WxGetFileInfoOptions {
  filePath: string;
  success?: (res: { size: number }) => void;
  fail?: (err: any) => void;
}

// 获取图片信息选项
interface WxGetImageInfoOptions {
  src: string;
  success?: (res: { width: number; height: number; path: string; type: string }) => void;
  fail?: (err: any) => void;
}

// 获取视频信息选项
interface WxGetVideoInfoOptions {
  src: string;
  success?: (res: { width: number; height: number; duration: number; size: number }) => void;
  fail?: (err: any) => void;
}


// 上传配置
export interface UploadConfig {
  /** 最大图片数量 */
  maxImageCount: number;
  /** 最大视频数量 */
  maxVideoCount: number;
  /** 最大图片大小 (字节) */
  maxImageSize: number;
  /** 最大视频大小 (字节) */
  maxVideoSize: number;
  /** 允许的图片类型 */
  allowedImageTypes: string[];
  /** 允许的视频类型 */
  allowedVideoTypes: string[];
  /** 视频最大时长 (秒) */
  maxVideoDuration: number;
}

// 默认上传配置
const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  maxImageCount: 9,
  maxVideoCount: 1,
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  allowedVideoTypes: ['mp4', 'mov'],
  maxVideoDuration: 60, // 60秒
};

// 上传进度回调
export type UploadProgressCallback = (progress: number, index: number) => void;

// 选择的文件信息
export interface SelectedFile {
  path: string;
  size: number;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number;
  thumbPath?: string;
}

// 上传选项
export interface UploadOptions {
  /** 上传类型 */
  type: 'avatar' | 'card_media';
  /** 进度回调 */
  onProgress?: UploadProgressCallback;
  /** 自定义配置 */
  config?: Partial<UploadConfig>;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 上传服务类
 * 封装微信小程序文件上传 API
 */
class UploadService {
  private uploadUrl: string;
  private config: UploadConfig;

  constructor() {
    // 从全局配置获取上传地址
    try {
      const app = getApp();
      this.uploadUrl = app.globalData.uploadUrl || `${app.globalData.apiBaseUrl || ''}/api/upload`;
    } catch {
      this.uploadUrl = '/api/upload';
    }
    this.config = { ...DEFAULT_UPLOAD_CONFIG };
  }

  /**
   * 设置上传 URL
   */
  setUploadUrl(url: string): void {
    this.uploadUrl = url;
  }

  /**
   * 获取上传 URL
   */
  getUploadUrl(): string {
    return this.uploadUrl;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UploadConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): UploadConfig {
    return { ...this.config };
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
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * 验证图片文件
   */
  validateImage(file: SelectedFile, config?: Partial<UploadConfig>): ValidationResult {
    const cfg = { ...this.config, ...config };
    
    // 检查文件大小
    if (file.size > cfg.maxImageSize) {
      const maxSizeMB = cfg.maxImageSize / (1024 * 1024);
      return { valid: false, error: `图片大小不能超过 ${maxSizeMB}MB` };
    }

    // 检查文件类型
    const ext = this.getFileExtension(file.path);
    if (ext && !cfg.allowedImageTypes.includes(ext)) {
      return { valid: false, error: `不支持的图片格式: ${ext}` };
    }

    return { valid: true };
  }

  /**
   * 验证视频文件
   */
  validateVideo(file: SelectedFile, config?: Partial<UploadConfig>): ValidationResult {
    const cfg = { ...this.config, ...config };

    // 检查文件大小
    if (file.size > cfg.maxVideoSize) {
      const maxSizeMB = cfg.maxVideoSize / (1024 * 1024);
      return { valid: false, error: `视频大小不能超过 ${maxSizeMB}MB` };
    }

    // 检查文件类型
    const ext = this.getFileExtension(file.path);
    if (ext && !cfg.allowedVideoTypes.includes(ext)) {
      return { valid: false, error: `不支持的视频格式: ${ext}` };
    }

    // 检查视频时长
    if (file.duration && file.duration > cfg.maxVideoDuration) {
      return { valid: false, error: `视频时长不能超过 ${cfg.maxVideoDuration}秒` };
    }

    return { valid: true };
  }

  /**
   * 验证文件
   */
  validateFile(file: SelectedFile, config?: Partial<UploadConfig>): ValidationResult {
    if (file.type === 'image') {
      return this.validateImage(file, config);
    } else if (file.type === 'video') {
      return this.validateVideo(file, config);
    }
    return { valid: false, error: '不支持的文件类型' };
  }

  /**
   * 验证文件列表
   */
  validateFiles(files: SelectedFile[], config?: Partial<UploadConfig>): ValidationResult {
    const cfg = { ...this.config, ...config };
    
    const imageCount = files.filter(f => f.type === 'image').length;
    const videoCount = files.filter(f => f.type === 'video').length;

    // 检查图片数量
    if (imageCount > cfg.maxImageCount) {
      return { valid: false, error: `最多只能上传 ${cfg.maxImageCount} 张图片` };
    }

    // 检查视频数量
    if (videoCount > cfg.maxVideoCount) {
      return { valid: false, error: `最多只能上传 ${cfg.maxVideoCount} 个视频` };
    }

    // 检查每个文件
    for (const file of files) {
      const result = this.validateFile(file, config);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }


  /**
   * 上传单个文件
   * 
   * @param filePath 文件路径
   * @param options 上传选项
   * @returns 上传结果
   */
  uploadFile(filePath: string, options: UploadOptions): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const { type, onProgress } = options;

      // 构建上传 URL
      const url = `${this.uploadUrl}/${type}`;

      // 获取认证头
      const header = this.getAuthHeader();

      const uploadTask = wx.uploadFile({
        url,
        filePath,
        name: 'file',
        header,
        formData: {
          type,
        },
        success: (res: WxUploadFileResponse) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(res.data);
              if (data.success !== false) {
                resolve({
                  url: data.url || data.data?.url,
                  file_id: data.file_id || data.data?.file_id,
                  thumbnail_url: data.thumbnail_url || data.data?.thumbnail_url,
                });
              } else {
                reject(new Error(data.message || '上传失败'));
              }
            } catch (e) {
              reject(new Error('解析上传响应失败'));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('请先登录'));
          } else if (res.statusCode === 413) {
            reject(new Error('文件太大'));
          } else {
            reject(new Error(`上传失败: ${res.statusCode}`));
          }
        },
        fail: (err: any) => {
          console.error('Upload file failed:', err);
          if (err?.errMsg?.includes('timeout')) {
            reject(new Error('上传超时，请重试'));
          } else {
            reject(new Error('网络错误，上传失败'));
          }
        },
      });

      // 监听上传进度
      if (onProgress) {
        uploadTask.onProgressUpdate((res: WxUploadProgressResult) => {
          onProgress(res.progress, 0);
        });
      }
    });
  }

  /**
   * 批量上传文件
   * 
   * @param files 文件列表
   * @param options 上传选项
   * @returns 批量上传结果
   */
  async uploadFiles(files: SelectedFile[], options: UploadOptions): Promise<BatchUploadResult> {
    const { onProgress, config } = options;

    // 验证文件列表
    const validation = this.validateFiles(files, config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const success: UploadResult[] = [];
    const failed: Array<{ index: number; error: string }> = [];

    // 逐个上传文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const result = await this.uploadFile(file.path, {
          ...options,
          onProgress: onProgress ? (progress) => onProgress(progress, i) : undefined,
        });
        success.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '上传失败';
        failed.push({ index: i, error: errorMessage });
      }
    }

    return { success, failed };
  }

  /**
   * 上传头像
   * 
   * Requirements: 2.6
   * @param filePath 图片路径
   * @param onProgress 进度回调
   * @returns 上传结果
   */
  async uploadAvatar(filePath: string, onProgress?: UploadProgressCallback): Promise<UploadResult> {
    // 获取图片信息进行验证
    const fileInfo = await this.getImageInfo(filePath);
    
    const validation = this.validateImage({
      path: filePath,
      size: fileInfo.size || 0,
      type: 'image',
      width: fileInfo.width,
      height: fileInfo.height,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return this.uploadFile(filePath, {
      type: 'avatar',
      onProgress,
    });
  }

  /**
   * 上传卡片媒体文件
   * 
   * Requirements: 3.4
   * @param files 文件列表
   * @param onProgress 进度回调
   * @returns 批量上传结果
   */
  async uploadCardMedia(
    files: SelectedFile[],
    onProgress?: UploadProgressCallback
  ): Promise<BatchUploadResult> {
    return this.uploadFiles(files, {
      type: 'card_media',
      onProgress,
    });
  }

  /**
   * 将上传结果转换为 MediaItem
   * 
   * @param result 上传结果
   * @param type 媒体类型
   * @param width 宽度
   * @param height 高度
   * @returns MediaItem
   */
  toMediaItem(
    result: UploadResult,
    type: MediaType,
    width?: number,
    height?: number
  ): MediaItem {
    return {
      id: result.file_id,
      media_type: type,
      url: result.url,
      thumbnail_url: result.thumbnail_url,
      width,
      height,
    };
  }

  /**
   * 批量转换上传结果为 MediaItem 列表
   * 
   * @param results 上传结果列表
   * @param files 原始文件列表
   * @returns MediaItem 列表
   */
  toMediaItems(results: UploadResult[], files: SelectedFile[]): MediaItem[] {
    return results.map((result, index) => {
      const file = files[index];
      return this.toMediaItem(
        result,
        file?.type || 'image',
        file?.width,
        file?.height
      );
    });
  }

  /**
   * 获取图片信息
   */
  private getImageInfo(src: string): Promise<{ width: number; height: number; size?: number }> {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: (res) => {
          // 尝试获取文件大小
          wx.getFileInfo({
            filePath: src,
            success: (fileRes) => {
              resolve({
                width: res.width,
                height: res.height,
                size: fileRes.size,
              });
            },
            fail: () => {
              resolve({
                width: res.width,
                height: res.height,
              });
            },
          });
        },
        fail: () => {
          reject(new Error('获取图片信息失败'));
        },
      });
    });
  }

  /**
   * 选择图片
   * 
   * @param count 最大数量
   * @param sourceType 来源类型
   * @returns 选择的文件列表
   */
  chooseImages(
    count: number = 9,
    sourceType: ('album' | 'camera')[] = ['album', 'camera']
  ): Promise<SelectedFile[]> {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: Math.min(count, this.config.maxImageCount),
        sizeType: ['original', 'compressed'],
        sourceType,
        success: async (res: WxChooseImageResult) => {
          const files: SelectedFile[] = [];
          
          for (const tempFile of res.tempFiles) {
            try {
              const info = await this.getImageInfo(tempFile.path);
              files.push({
                path: tempFile.path,
                size: tempFile.size,
                type: 'image',
                width: info.width,
                height: info.height,
              });
            } catch {
              files.push({
                path: tempFile.path,
                size: tempFile.size,
                type: 'image',
              });
            }
          }
          
          resolve(files);
        },
        fail: (err: any) => {
          if (err?.errMsg?.includes('cancel')) {
            resolve([]);
          } else {
            reject(new Error('选择图片失败'));
          }
        },
      });
    });
  }

  /**
   * 选择媒体文件（图片或视频）
   * 
   * @param options 选择选项
   * @returns 选择的文件列表
   */
  chooseMedia(options: {
    count?: number;
    mediaType?: ('image' | 'video')[];
    sourceType?: ('album' | 'camera')[];
    maxDuration?: number;
  } = {}): Promise<SelectedFile[]> {
    const {
      count = 9,
      mediaType = ['image', 'video'],
      sourceType = ['album', 'camera'],
      maxDuration = this.config.maxVideoDuration,
    } = options;

    return new Promise((resolve, reject) => {
      wx.chooseMedia({
        count,
        mediaType,
        sourceType,
        maxDuration,
        sizeType: ['original', 'compressed'],
        success: (res: WxChooseMediaResult) => {
          const files: SelectedFile[] = res.tempFiles.map(file => ({
            path: file.tempFilePath,
            size: file.size,
            type: file.fileType,
            width: file.width,
            height: file.height,
            duration: file.duration,
            thumbPath: file.thumbTempFilePath,
          }));
          
          resolve(files);
        },
        fail: (err: any) => {
          if (err?.errMsg?.includes('cancel')) {
            resolve([]);
          } else {
            reject(new Error('选择媒体文件失败'));
          }
        },
      });
    });
  }
}

// 导出单例
export const uploadService = new UploadService();

// 导出类以便测试
export { UploadService };
