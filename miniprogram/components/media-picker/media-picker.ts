/**
 * 媒体选择器组件
 * 支持图片/视频选择和预览
 * Requirements: 3.4
 */

import { uploadService, type SelectedFile } from '../../services/upload';

// 默认配置
const DEFAULT_MAX_IMAGE_COUNT = 9;
const DEFAULT_MAX_VIDEO_COUNT = 1;
const DEFAULT_MAX_VIDEO_DURATION = 60;

// 媒体项接口（用于组件内部）
interface MediaItemData {
  id: string;
  path: string;
  type: 'image' | 'video';
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbPath?: string;
  uploading?: boolean;
  uploadProgress?: number;
  uploadError?: string;
  uploaded?: boolean;
  url?: string;
  thumbnailUrl?: string;
}

Component({
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },

  properties: {
    /** 已选媒体列表 */
    mediaList: {
      type: Array,
      value: [] as MediaItemData[],
    },
    /** 最大图片数量 */
    maxImageCount: {
      type: Number,
      value: DEFAULT_MAX_IMAGE_COUNT,
    },
    /** 最大视频数量 */
    maxVideoCount: {
      type: Number,
      value: DEFAULT_MAX_VIDEO_COUNT,
    },
    /** 最大视频时长（秒） */
    maxVideoDuration: {
      type: Number,
      value: DEFAULT_MAX_VIDEO_DURATION,
    },
    /** 媒体类型：image | video | both */
    mediaType: {
      type: String,
      value: 'both',
    },
    /** 来源类型 */
    sourceType: {
      type: Array,
      value: ['album', 'camera'],
    },
    /** 是否禁用 */
    disabled: {
      type: Boolean,
      value: false,
    },
    /** 是否显示上传进度 */
    showProgress: {
      type: Boolean,
      value: true,
    },
    /** 是否自动上传 */
    autoUpload: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    // 内部媒体列表
    internalMediaList: [] as MediaItemData[],
    // 预览状态
    previewVisible: false,
    previewIndex: 0,
    // 统计
    imageCount: 0,
    videoCount: 0,
  },

  observers: {
    'mediaList': function(mediaList: MediaItemData[]) {
      if (Array.isArray(mediaList)) {
        this.setData({ 
          internalMediaList: [...mediaList],
        });
        this.updateCounts();
      }
    },
  },

  lifetimes: {
    attached() {
      if (Array.isArray(this.data.mediaList)) {
        this.setData({ 
          internalMediaList: [...this.data.mediaList],
        });
        this.updateCounts();
      }
    },
  },

  methods: {
    /**
     * 更新媒体计数
     */
    updateCounts() {
      const { internalMediaList } = this.data;
      const imageCount = internalMediaList.filter((m: MediaItemData) => m.type === 'image').length;
      const videoCount = internalMediaList.filter((m: MediaItemData) => m.type === 'video').length;
      this.setData({ imageCount, videoCount });
    },

    /**
     * 生成唯一ID
     */
    generateId(): string {
      return `media_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },

    /**
     * 获取可选择的媒体类型
     */
    getSelectableMediaTypes(): ('image' | 'video')[] {
      const { mediaType, maxImageCount, maxVideoCount, imageCount, videoCount } = this.data;
      const types: ('image' | 'video')[] = [];

      if (mediaType === 'image' || mediaType === 'both') {
        if (imageCount < maxImageCount) {
          types.push('image');
        }
      }
      if (mediaType === 'video' || mediaType === 'both') {
        if (videoCount < maxVideoCount) {
          types.push('video');
        }
      }

      return types;
    },

    /**
     * 获取剩余可选数量
     */
    getRemainingCount(): number {
      const { maxImageCount, maxVideoCount, imageCount, videoCount, mediaType } = this.data;
      
      if (mediaType === 'image') {
        return maxImageCount - imageCount;
      } else if (mediaType === 'video') {
        return maxVideoCount - videoCount;
      } else {
        // both: 返回图片剩余数量（视频只能选1个）
        return Math.max(maxImageCount - imageCount, maxVideoCount - videoCount);
      }
    },

    /**
     * 选择媒体
     */
    async onChooseMedia() {
      if (this.data.disabled) return;

      const selectableTypes = this.getSelectableMediaTypes();
      if (selectableTypes.length === 0) {
        wx.showToast({
          title: '已达到最大数量限制',
          icon: 'none',
        });
        return;
      }

      const remainingCount = this.getRemainingCount();
      if (remainingCount <= 0) {
        wx.showToast({
          title: '已达到最大数量限制',
          icon: 'none',
        });
        return;
      }

      try {
        const files = await uploadService.chooseMedia({
          count: remainingCount,
          mediaType: selectableTypes,
          sourceType: this.data.sourceType as ('album' | 'camera')[],
          maxDuration: this.data.maxVideoDuration,
        });

        if (files.length === 0) return;

        // 验证选择的文件
        const validationResult = this.validateSelectedFiles(files);
        if (!validationResult.valid) {
          wx.showToast({
            title: validationResult.error || '文件验证失败',
            icon: 'none',
          });
          return;
        }

        // 转换为内部格式
        const newMediaItems: MediaItemData[] = files.map((file: SelectedFile) => ({
          id: this.generateId(),
          path: file.path,
          type: file.type,
          size: file.size,
          width: file.width,
          height: file.height,
          duration: file.duration,
          thumbPath: file.thumbPath,
          uploading: false,
          uploadProgress: 0,
          uploaded: false,
        }));

        const updatedList = [...this.data.internalMediaList, ...newMediaItems];
        this.setData({ internalMediaList: updatedList });
        this.updateCounts();

        // 触发变更事件，包含 selectedFiles 用于上传
        const selectedFiles: SelectedFile[] = updatedList.map((item: MediaItemData) => ({
          path: item.path,
          size: item.size,
          type: item.type,
          width: item.width,
          height: item.height,
          duration: item.duration,
          thumbPath: item.thumbPath,
        }));

        this.triggerEvent('change', { 
          mediaList: updatedList,
          selectedFiles,
          added: newMediaItems,
        });

        // 自动上传
        if (this.data.autoUpload) {
          this.uploadAllPending();
        }
      } catch (error) {
        console.error('Choose media failed:', error);
        wx.showToast({
          title: '选择媒体失败',
          icon: 'none',
        });
      }
    },


    /**
     * 验证选择的文件
     */
    validateSelectedFiles(files: SelectedFile[]): { valid: boolean; error?: string } {
      const { maxImageCount, maxVideoCount, imageCount, videoCount } = this.data;
      
      const newImageCount = files.filter(f => f.type === 'image').length;
      const newVideoCount = files.filter(f => f.type === 'video').length;

      if (imageCount + newImageCount > maxImageCount) {
        return { valid: false, error: `最多只能选择${maxImageCount}张图片` };
      }

      if (videoCount + newVideoCount > maxVideoCount) {
        return { valid: false, error: `最多只能选择${maxVideoCount}个视频` };
      }

      // 使用 uploadService 验证每个文件
      const validation = uploadService.validateFiles(files);
      if (!validation.valid) {
        return validation;
      }

      return { valid: true };
    },

    /**
     * 删除媒体项
     */
    onDeleteMedia(e: WechatMiniprogram.TouchEvent) {
      if (this.data.disabled) return;

      const { index } = e.currentTarget.dataset;
      if (typeof index !== 'number') return;

      const { internalMediaList } = this.data;
      const deletedItem = internalMediaList[index];
      
      const updatedList = internalMediaList.filter((_: MediaItemData, i: number) => i !== index);
      this.setData({ internalMediaList: updatedList });
      this.updateCounts();

      // 构建 selectedFiles 用于上传
      const selectedFiles: SelectedFile[] = updatedList.map((item: MediaItemData) => ({
        path: item.path,
        size: item.size,
        type: item.type,
        width: item.width,
        height: item.height,
        duration: item.duration,
        thumbPath: item.thumbPath,
      }));

      this.triggerEvent('change', { 
        mediaList: updatedList,
        selectedFiles,
        deleted: deletedItem,
      });
      this.triggerEvent('delete', { 
        index,
        item: deletedItem,
      });
    },

    /**
     * 预览媒体
     */
    onPreviewMedia(e: WechatMiniprogram.TouchEvent) {
      const { index } = e.currentTarget.dataset;
      if (typeof index !== 'number') return;

      const { internalMediaList } = this.data;
      const item = internalMediaList[index];

      if (item.type === 'image') {
        // 预览图片
        const urls = internalMediaList
          .filter((m: MediaItemData) => m.type === 'image')
          .map((m: MediaItemData) => m.url || m.path);
        
        const currentUrl = item.url || item.path;

        wx.previewImage({
          urls,
          current: currentUrl,
        });
      } else if (item.type === 'video') {
        // 预览视频
        this.triggerEvent('previewvideo', {
          index,
          item,
          src: item.url || item.path,
        });
      }
    },

    /**
     * 上传所有待上传的媒体
     */
    async uploadAllPending() {
      const { internalMediaList } = this.data;
      const pendingItems = internalMediaList.filter(
        (m: MediaItemData) => !m.uploaded && !m.uploading
      );

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        const index = internalMediaList.findIndex((m: MediaItemData) => m.id === item.id);
        if (index !== -1) {
          await this.uploadMediaItem(index);
        }
      }
    },

    /**
     * 上传单个媒体项
     */
    async uploadMediaItem(index: number) {
      const { internalMediaList } = this.data;
      const item = internalMediaList[index];

      if (!item || item.uploaded || item.uploading) return;

      // 更新上传状态
      this.updateMediaItem(index, {
        uploading: true,
        uploadProgress: 0,
        uploadError: undefined,
      });

      try {
        const result = await uploadService.uploadFile(item.path, {
          type: 'card_media',
          onProgress: (progress: number) => {
            this.updateMediaItem(index, { uploadProgress: progress });
          },
        });

        // 上传成功
        this.updateMediaItem(index, {
          uploading: false,
          uploaded: true,
          uploadProgress: 100,
          url: result.url,
          thumbnailUrl: result.thumbnail_url,
        });

        this.triggerEvent('uploadsuccess', {
          index,
          item: this.data.internalMediaList[index],
          result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '上传失败';
        
        this.updateMediaItem(index, {
          uploading: false,
          uploadError: errorMessage,
        });

        this.triggerEvent('uploaderror', {
          index,
          item: this.data.internalMediaList[index],
          error: errorMessage,
        });
      }
    },

    /**
     * 更新媒体项
     */
    updateMediaItem(index: number, updates: Partial<MediaItemData>) {
      const { internalMediaList } = this.data;
      if (index < 0 || index >= internalMediaList.length) return;

      const updatedList = [...internalMediaList];
      updatedList[index] = { ...updatedList[index], ...updates };
      
      this.setData({ internalMediaList: updatedList });
      this.triggerEvent('change', { mediaList: updatedList });
    },

    /**
     * 重试上传
     */
    onRetryUpload(e: WechatMiniprogram.TouchEvent) {
      const { index } = e.currentTarget.dataset;
      if (typeof index !== 'number') return;

      this.uploadMediaItem(index);
    },

    /**
     * 获取已上传的媒体列表（用于提交）
     */
    getUploadedMedia(): MediaItemData[] {
      return this.data.internalMediaList.filter((m: MediaItemData) => m.uploaded);
    },

    /**
     * 获取所有媒体列表
     */
    getAllMedia(): MediaItemData[] {
      return [...this.data.internalMediaList];
    },

    /**
     * 清空所有媒体
     */
    clearAll() {
      this.setData({ 
        internalMediaList: [],
        imageCount: 0,
        videoCount: 0,
      });
      this.triggerEvent('change', { mediaList: [] });
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(size: number): string {
      if (size < 1024) {
        return `${size}B`;
      } else if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)}KB`;
      } else {
        return `${(size / (1024 * 1024)).toFixed(1)}MB`;
      }
    },

    /**
     * 格式化视频时长
     */
    formatDuration(seconds: number): string {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
  },
});
