/**
 * 创建卡片页面
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9, 3.10
 */

import type { CardType, PrivacyLevel, MediaItem, Location, CardCreateData } from '../../types/card';
import { Validator } from '../../utils/validator';
import { cardService } from '../../services/card';
import { uploadService, type SelectedFile } from '../../services/upload';
import { userStore } from '../../stores/user';

// 声明微信小程序全局对象
declare const wx: WechatMiniprogram.Wx;

// 创建验证器实例
const validator = new Validator();

// 卡片类型配置
const CARD_TYPES: Array<{ type: CardType; icon: string; name: string; description: string }> = [
  { type: 'day_card', icon: '📅', name: '一天体验', description: '记录一天的精彩' },
  { type: 'week_card', icon: '📆', name: '一周体验', description: '分享一周的故事' },
  { type: 'fragment_card', icon: '🎬', name: '人生片段', description: '捕捉生活瞬间' },
  { type: 'moment_card', icon: '⭐', name: '重要时刻', description: '铭记重要时刻' },
];

// 预设情绪标签
const EMOTION_TAGS = [
  '开心', '期待', '感动', '平静', '兴奋',
  '满足', '温暖', '惊喜', '自豪', '感恩',
  '思念', '怀念', '释然', '充实', '幸福',
];

// 预设兴趣标签
const INTEREST_TAGS = [
  '旅行', '美食', '摄影', '音乐', '阅读',
  '运动', '电影', '游戏', '艺术', '科技',
  '自然', '城市', '文化', '社交', '学习',
];

// 隐私级别选项
const PRIVACY_OPTIONS = [
  { value: 'public', label: '公开', description: '所有人可见' },
  { value: 'friends_only', label: '好友可见', description: '仅好友可见' },
  { value: 'exchange_only', label: '仅交换可见', description: '交换后可见' },
];

Page({
  data: {
    // 卡片类型配置
    cardTypes: CARD_TYPES,
    emotionTags: EMOTION_TAGS,
    interestTags: INTEREST_TAGS,
    privacyOptions: PRIVACY_OPTIONS,

    // 表单数据
    cardType: '' as CardType | '',
    title: '',
    description: '',
    media: [] as MediaItem[],
    location: null as Location | null,
    selectedEmotionTags: [] as string[],
    selectedInterestTags: [] as string[],
    privacyLevel: 'public' as PrivacyLevel,

    // 本地选择的文件（用于上传）
    selectedFiles: [] as SelectedFile[],

    // UI 状态
    submitting: false,
    uploadProgress: 0,
    uploadingIndex: -1,
    errors: {} as Record<string, string>,
    showPrivacyPicker: false,
    currentPrivacyIndex: 0,
  },

  /**
   * 页面加载
   */
  onLoad() {
    // 检查是否有草稿
    this.loadDraft();
  },

  /**
   * 页面显示
   */
  onShow() {
    // 可以在这里刷新数据
  },

  /**
   * 页面隐藏时保存草稿
   */
  onHide() {
    this.saveDraft();
  },

  /**
   * 加载草稿
   */
  loadDraft() {
    try {
      const draft = wx.getStorageSync('life_card_draft');
      if (draft) {
        this.setData({
          cardType: draft.cardType || '',
          title: draft.title || '',
          description: draft.description || '',
          media: draft.media || [],
          location: draft.location || null,
          selectedEmotionTags: draft.selectedEmotionTags || [],
          selectedInterestTags: draft.selectedInterestTags || [],
          privacyLevel: draft.privacyLevel || 'public',
          selectedFiles: draft.selectedFiles || [],
        });
      }
    } catch (error) {
      console.error('加载草稿失败', error);
    }
  },

  /**
   * 保存草稿
   */
  saveDraft() {
    const { cardType, title, description, media, location, selectedEmotionTags, selectedInterestTags, privacyLevel, selectedFiles } = this.data;
    
    // 只有有内容时才保存
    if (cardType || title || description || media.length > 0 || selectedFiles.length > 0) {
      try {
        wx.setStorageSync('life_card_draft', {
          cardType,
          title,
          description,
          media,
          location,
          selectedEmotionTags,
          selectedInterestTags,
          privacyLevel,
          selectedFiles,
        });
      } catch (error) {
        console.error('保存草稿失败', error);
      }
    }
  },

  /**
   * 清除草稿
   */
  clearDraft() {
    try {
      wx.removeStorageSync('life_card_draft');
    } catch (error) {
      console.error('清除草稿失败', error);
    }
  },

  /**
   * 选择卡片类型
   */
  onTypeSelect(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as CardType;
    this.setData({ 
      cardType: type,
      errors: { ...this.data.errors, cardType: '' },
    });
  },

  /**
   * 输入标题
   */
  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({ 
      title: e.detail.value,
      errors: { ...this.data.errors, title: '' },
    });
  },

  /**
   * 输入描述
   */
  onDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({ 
      description: e.detail.value,
      errors: { ...this.data.errors, description: '' },
    });
  },

  /**
   * 媒体变化回调
   * 接收来自 media-picker 组件的媒体列表变化
   */
  onMediaChange(e: WechatMiniprogram.CustomEvent<{ mediaList: MediaItem[]; selectedFiles?: SelectedFile[] }>) {
    const { mediaList, selectedFiles } = e.detail;
    this.setData({ 
      media: mediaList || [],
      selectedFiles: selectedFiles || [],
      errors: { ...this.data.errors, media: '' },
    });
  },

  /**
   * 位置变化回调
   */
  onLocationChange(e: WechatMiniprogram.CustomEvent<{ location: Location | null }>) {
    this.setData({ location: e.detail.location });
  },

  /**
   * 情绪标签变化回调
   */
  onEmotionTagsChange(e: WechatMiniprogram.CustomEvent<{ selected: string[] }>) {
    this.setData({ selectedEmotionTags: e.detail.selected || [] });
  },

  /**
   * 兴趣标签变化回调
   */
  onInterestTagsChange(e: WechatMiniprogram.CustomEvent<{ selected: string[] }>) {
    this.setData({ selectedInterestTags: e.detail.selected || [] });
  },

  /**
   * 显示隐私选择器
   */
  onShowPrivacyPicker() {
    const currentIndex = PRIVACY_OPTIONS.findIndex(opt => opt.value === this.data.privacyLevel);
    this.setData({ 
      showPrivacyPicker: true,
      currentPrivacyIndex: currentIndex >= 0 ? currentIndex : 0,
    });
  },

  /**
   * 隐藏隐私选择器
   */
  onHidePrivacyPicker() {
    this.setData({ showPrivacyPicker: false });
  },

  /**
   * 选择隐私级别
   */
  onPrivacySelect(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as PrivacyLevel;
    this.setData({ 
      privacyLevel: value,
      showPrivacyPicker: false,
    });
  },

  /**
   * 获取当前隐私级别显示文本
   */
  getPrivacyLabel(): string {
    const option = PRIVACY_OPTIONS.find(opt => opt.value === this.data.privacyLevel);
    return option ? option.label : '公开';
  },

  /**
   * 验证表单
   * Requirements: 3.2, 3.3, 3.4, 3.6, 3.8
   * 使用 Validator 类进行完整的表单验证
   */
  validate(): boolean {
    // 构建验证数据
    const validationData: CardCreateData = {
      card_type: this.data.cardType as CardType,
      title: this.data.title,
      description: this.data.description,
      media: this.data.media,
      emotion_tags: this.data.selectedEmotionTags,
      interest_tags: this.data.selectedInterestTags,
      privacy_level: this.data.privacyLevel,
    };

    // 使用 Validator 进行验证
    const result = validator.validateCardCreate(validationData);
    
    // 转换错误字段名（validator 使用下划线，UI 使用驼峰）
    const errors: Record<string, string> = {};
    if (result.errors.card_type) {
      errors.cardType = result.errors.card_type;
    }
    if (result.errors.title) {
      errors.title = result.errors.title;
    }
    if (result.errors.description) {
      errors.description = result.errors.description;
    }
    if (result.errors.media) {
      errors.media = result.errors.media;
    }
    if (result.errors.emotion_tags) {
      errors.emotionTags = result.errors.emotion_tags;
    }
    if (result.errors.interest_tags) {
      errors.interestTags = result.errors.interest_tags;
    }

    this.setData({ errors });
    
    // 如果有错误，滚动到第一个错误位置
    if (!result.valid) {
      const errorKeys = Object.keys(errors);
      if (errorKeys.length > 0) {
        const firstError = errorKeys[0];
        const selectorMap: Record<string, string> = {
          cardType: '.type-section',
          title: '.title-section',
          description: '.description-section',
          media: '.media-section',
          emotionTags: '.emotion-section',
          interestTags: '.interest-section',
        };
        const selector = selectorMap[firstError];
        if (selector) {
          wx.pageScrollTo({ selector, duration: 300 });
        }
      }
    }

    return result.valid;
  },

  /**
   * 提交卡片
   * Requirements: 3.4, 3.8
   * 实现媒体上传和卡片创建的完整流程
   */
  async onSubmit() {
    // 验证表单
    if (!this.validate()) {
      wx.showToast({ title: '请完善信息', icon: 'none' });
      return;
    }

    this.setData({ submitting: true, uploadProgress: 0, uploadingIndex: -1 });

    try {
      let uploadedMedia: MediaItem[] = [];

      // 如果有选择的文件需要上传
      if (this.data.selectedFiles.length > 0) {
        wx.showLoading({ title: '上传媒体中...', mask: true });

        // 上传媒体文件
        const uploadResult = await uploadService.uploadCardMedia(
          this.data.selectedFiles,
          (progress, index) => {
            this.setData({ 
              uploadProgress: progress,
              uploadingIndex: index,
            });
          }
        );

        wx.hideLoading();

        // 检查是否有上传失败的文件
        if (uploadResult.failed.length > 0) {
          const failedCount = uploadResult.failed.length;
          wx.showModal({
            title: '部分上传失败',
            content: `${failedCount} 个文件上传失败，是否继续发布？`,
            confirmText: '继续发布',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm && uploadResult.success.length > 0) {
                // 继续使用成功上传的文件
                this.createCardWithMedia(
                  uploadService.toMediaItems(uploadResult.success, this.data.selectedFiles)
                );
              } else {
                this.setData({ submitting: false });
              }
            },
          });
          return;
        }

        // 转换上传结果为 MediaItem
        uploadedMedia = uploadService.toMediaItems(uploadResult.success, this.data.selectedFiles);
      } else if (this.data.media.length > 0) {
        // 使用已有的媒体（可能是草稿中的）
        uploadedMedia = this.data.media;
      }

      // 创建卡片
      await this.createCardWithMedia(uploadedMedia);

    } catch (error) {
      console.error('创建卡片失败', error);
      wx.hideLoading();
      const errorMessage = error instanceof Error ? error.message : '创建失败，请重试';
      wx.showToast({ title: errorMessage, icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  /**
   * 使用上传的媒体创建卡片
   * Requirements: 3.8, 3.9, 3.10
   * 
   * 3.9: WHEN card creation succeeds, THE Mini_Program SHALL navigate to the card detail page and show earned coins
   * 3.10: IF card creation fails, THEN THE Mini_Program SHALL display the error and preserve the form data
   */
  async createCardWithMedia(media: MediaItem[]) {
    try {
      wx.showLoading({ title: '发布中...', mask: true });

      // 构建卡片创建数据
      const cardData: CardCreateData = {
        card_type: this.data.cardType as CardType,
        title: this.data.title.trim(),
        description: this.data.description.trim(),
        media: media.length > 0 ? media : undefined,
        location: this.data.location || undefined,
        emotion_tags: this.data.selectedEmotionTags.length > 0 ? this.data.selectedEmotionTags : undefined,
        interest_tags: this.data.selectedInterestTags.length > 0 ? this.data.selectedInterestTags : undefined,
        privacy_level: this.data.privacyLevel,
      };

      // 调用 API 创建卡片
      const card = await cardService.createCard(cardData);

      wx.hideLoading();

      // 清除草稿
      this.clearDraft();

      // 显示成功消息并跳转到详情页（Requirements: 3.9）
      this.showSuccessAndNavigate(card.id, 0);

    } catch (error) {
      // Requirements: 3.10 - display error and preserve form data
      wx.hideLoading();
      console.error('创建卡片失败', error);
      const errorMessage = error instanceof Error ? error.message : '创建失败，请重试';
      wx.showToast({ title: errorMessage, icon: 'none' });
      // 表单数据保留在 data 中，不清除，用户可以修改后重试
    } finally {
      this.setData({ submitting: false });
    }
  },

  /**
   * 显示创建成功消息并跳转到详情页
   * Requirements: 3.9
   * 
   * @param cardId 创建的卡片 ID
   * @param coinsEarned 获得的金币数量
   */
  showSuccessAndNavigate(cardId: string, coinsEarned: number) {
    if (coinsEarned > 0) {
      // 显示获得金币的弹窗
      wx.showModal({
        title: '🎉 发布成功',
        content: `恭喜！获得 ${coinsEarned} 金币奖励`,
        showCancel: false,
        confirmText: '查看卡片',
        success: () => {
          // 跳转到卡片详情页
          wx.redirectTo({ url: `/pages/card-detail/card-detail?id=${cardId}` });
        },
      });
    } else {
      // 没有金币奖励时，显示简单的成功提示
      wx.showToast({ title: '发布成功', icon: 'success' });
      // 延迟跳转到详情页，让用户看到成功提示
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/card-detail/card-detail?id=${cardId}` });
      }, 1500);
    }
  },

  /**
   * 重置表单
   */
  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '确定要清空所有内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            cardType: '',
            title: '',
            description: '',
            media: [],
            location: null,
            selectedEmotionTags: [],
            selectedInterestTags: [],
            privacyLevel: 'public',
            selectedFiles: [],
            errors: {},
          });
          this.clearDraft();
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      },
    });
  },
});
