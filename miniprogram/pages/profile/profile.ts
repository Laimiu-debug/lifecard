/**
 * 个人中心页面
 * 显示用户资料、统计数据、金币余额
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 11.1
 */

import { userStore } from '../../stores/user';
import { notificationStore } from '../../stores/notification';
import { validator } from '../../utils/validator';
import { uploadService } from '../../services/upload';
import type { UserProfile, CoinTransaction, ProfileUpdateData } from '../../types/user';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// 年龄范围选项
const AGE_RANGE_OPTIONS = [
  '18岁以下',
  '18-24岁',
  '25-30岁',
  '31-40岁',
  '41-50岁',
  '50岁以上',
];

// 编辑表单数据接口
interface EditFormData {
  nickname: string;
  bio: string;
  age_range: string;
  location: string;
  avatar_url: string;
}

// 表单错误接口
interface FormErrors {
  nickname?: string;
  bio?: string;
  age_range?: string;
  location?: string;
}

// 页面数据接口
interface ProfilePageData {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 用户资料 */
  profile: UserProfile | null;
  /** 金币余额 */
  coinBalance: number;
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在刷新 */
  refreshing: boolean;
  /** 最近交易记录（用于展示） */
  recentTransactions: CoinTransaction[];
  /** 统计数据 */
  stats: {
    cardCount: number;
    collectedCount: number;
    followerCount: number;
    followingCount: number;
  };
  /** 是否显示编辑弹窗 */
  showEditModal: boolean;
  /** 编辑表单数据 */
  editForm: EditFormData;
  /** 表单错误 */
  formErrors: FormErrors;
  /** 是否正在提交 */
  submitting: boolean;
  /** 是否正在上传头像 */
  uploadingAvatar: boolean;
  /** 年龄范围选项 */
  ageRangeOptions: string[];
  /** 当前选中的年龄范围索引 */
  ageRangeIndex: number;
  /** 未读通知数 */
  unreadCount: number;
}

Page<ProfilePageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    isLoggedIn: false,
    profile: null,
    coinBalance: 0,
    loading: false,
    refreshing: false,
    recentTransactions: [],
    stats: {
      cardCount: 0,
      collectedCount: 0,
      followerCount: 0,
      followingCount: 0,
    },
    showEditModal: false,
    editForm: {
      nickname: '',
      bio: '',
      age_range: '',
      location: '',
      avatar_url: '',
    },
    formErrors: {},
    submitting: false,
    uploadingAvatar: false,
    ageRangeOptions: AGE_RANGE_OPTIONS,
    ageRangeIndex: -1,
    unreadCount: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.initPage();
  },

  /**
   * 生命周期函数--监听页面显示
   * 每次显示页面时刷新数据
   */
  onShow() {
    this.syncFromStore();
    if (this.data.isLoggedIn) {
      this.refreshProfile();
      // 刷新通知徽章
      // Requirements: 10.1
      this.refreshNotificationBadge();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    if (this.data.isLoggedIn) {
      this.refreshProfile().finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 初始化页面
   */
  initPage() {
    // 初始化 userStore
    userStore.init();
    this.syncFromStore();
  },

  /**
   * 从 Store 同步数据到页面
   */
  syncFromStore() {
    const { isLoggedIn, profile, coinBalance } = userStore;
    const { totalUnread } = notificationStore;
    
    this.setData({
      isLoggedIn,
      profile,
      coinBalance,
      unreadCount: totalUnread,
      stats: {
        cardCount: profile?.card_count || 0,
        collectedCount: 0, // 需要从 API 获取
        followerCount: profile?.follower_count || 0,
        followingCount: profile?.following_count || 0,
      },
    });
  },

  /**
   * 刷新通知徽章
   * Requirements: 10.1
   */
  async refreshNotificationBadge() {
    try {
      await notificationStore.loadUnreadCount();
      this.setData({
        unreadCount: notificationStore.totalUnread,
      });
    } catch (error) {
      console.error('刷新通知徽章失败:', error);
    }
  },

  /**
   * 刷新用户资料
   * Requirements: 2.1
   */
  async refreshProfile() {
    if (this.data.refreshing) return;
    
    this.setData({ refreshing: true });
    
    try {
      // 获取最新用户资料
      await userStore.fetchProfile();
      
      // 刷新金币余额
      await userStore.refreshBalance();
      
      // 同步数据到页面
      this.syncFromStore();
      
    } catch (error) {
      console.error('刷新资料失败:', error);
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 跳转到登录页面
   */
  onLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  /**
   * 编辑资料
   * Requirements: 2.2
   */
  onEditProfile() {
    if (!this.data.profile) return;
    
    // 初始化编辑表单数据
    const profile = this.data.profile;
    const ageRangeIndex = AGE_RANGE_OPTIONS.indexOf(profile.age_range || '');
    
    this.setData({
      showEditModal: true,
      editForm: {
        nickname: profile.nickname || '',
        bio: profile.bio || '',
        age_range: profile.age_range || '',
        location: profile.location || '',
        avatar_url: profile.avatar_url || '',
      },
      formErrors: {},
      ageRangeIndex: ageRangeIndex >= 0 ? ageRangeIndex : -1,
    });
  },

  /**
   * 关闭编辑弹窗
   */
  onCloseEditModal() {
    if (this.data.submitting || this.data.uploadingAvatar) {
      wx.showToast({ title: '请等待操作完成', icon: 'none' });
      return;
    }
    this.setData({
      showEditModal: false,
      formErrors: {},
    });
  },

  /**
   * 处理昵称输入
   * Requirements: 2.3
   */
  onNicknameInput(e: WechatMiniprogram.Input) {
    const nickname = e.detail.value;
    this.setData({
      'editForm.nickname': nickname,
      'formErrors.nickname': '',
    });
  },

  /**
   * 处理简介输入
   * Requirements: 2.3
   */
  onBioInput(e: WechatMiniprogram.Input) {
    const bio = e.detail.value;
    this.setData({
      'editForm.bio': bio,
      'formErrors.bio': '',
    });
  },

  /**
   * 处理位置输入
   * Requirements: 2.3
   */
  onLocationInput(e: WechatMiniprogram.Input) {
    const location = e.detail.value;
    this.setData({
      'editForm.location': location,
    });
  },

  /**
   * 处理年龄范围选择
   * Requirements: 2.3
   */
  onAgeRangeChange(e: WechatMiniprogram.PickerChange) {
    const index = parseInt(e.detail.value as string, 10);
    this.setData({
      ageRangeIndex: index,
      'editForm.age_range': AGE_RANGE_OPTIONS[index] || '',
    });
  },

  /**
   * 更换头像
   * Requirements: 2.6
   */
  async onChangeAvatar() {
    if (this.data.uploadingAvatar) return;
    
    try {
      // 选择图片
      const files = await uploadService.chooseImages(1, ['album', 'camera']);
      if (files.length === 0) return;
      
      this.setData({ uploadingAvatar: true });
      wx.showLoading({ title: '上传中...', mask: true });
      
      // 上传头像
      const result = await uploadService.uploadAvatar(files[0].path);
      
      // 更新表单数据
      this.setData({
        'editForm.avatar_url': result.url,
      });
      
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (error: any) {
      wx.hideLoading();
      console.error('上传头像失败:', error);
      wx.showToast({ title: error?.message || '上传失败', icon: 'none' });
    } finally {
      this.setData({ uploadingAvatar: false });
    }
  },

  /**
   * 验证表单
   * Requirements: 2.3, 2.5
   */
  validateForm(): boolean {
    const { editForm } = this.data;
    
    // 使用验证器验证
    const result = validator.validateProfileUpdate({
      nickname: editForm.nickname,
      bio: editForm.bio,
    });
    
    if (!result.valid) {
      this.setData({ formErrors: result.errors });
      return false;
    }
    
    this.setData({ formErrors: {} });
    return true;
  },

  /**
   * 提交资料更新
   * Requirements: 2.3, 2.4
   */
  async onSubmitProfile() {
    if (this.data.submitting) return;
    
    // 验证表单
    if (!this.validateForm()) {
      // 显示第一个错误
      const firstError = Object.values(this.data.formErrors)[0];
      if (firstError) {
        wx.showToast({ title: firstError, icon: 'none' });
      }
      return;
    }
    
    this.setData({ submitting: true });
    
    try {
      const { editForm } = this.data;
      
      // 构建更新数据
      const updateData: ProfileUpdateData = {};
      
      // 只包含有变化的字段
      if (editForm.nickname !== this.data.profile?.nickname) {
        updateData.nickname = editForm.nickname;
      }
      if (editForm.bio !== (this.data.profile?.bio || '')) {
        updateData.bio = editForm.bio;
      }
      if (editForm.age_range !== (this.data.profile?.age_range || '')) {
        updateData.age_range = editForm.age_range;
      }
      if (editForm.location !== (this.data.profile?.location || '')) {
        updateData.location = editForm.location;
      }
      if (editForm.avatar_url !== (this.data.profile?.avatar_url || '')) {
        updateData.avatar_url = editForm.avatar_url;
      }
      
      // 如果没有变化，直接关闭
      if (Object.keys(updateData).length === 0) {
        this.setData({ showEditModal: false });
        return;
      }
      
      // 调用 store 更新资料
      await userStore.updateProfile(updateData);
      
      // 同步数据到页面
      this.syncFromStore();
      
      // 关闭弹窗
      this.setData({ showEditModal: false });
      
    } catch (error: any) {
      console.error('更新资料失败:', error);
      // 处理验证错误
      if (error?.details) {
        this.setData({ formErrors: error.details });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  /**
   * 查看金币交易记录
   * Requirements: 11.2
   */
  onViewTransactions() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/transactions/transactions' });
  },

  /**
   * 查看关注列表
   * Requirements: 9.3
   */
  onViewFollowing() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/follow-list/follow-list?tab=following' });
  },

  /**
   * 查看粉丝列表
   * Requirements: 9.3
   */
  onViewFollowers() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/follow-list/follow-list?tab=followers' });
  },

  /**
   * 查看我的卡片
   * Requirements: 8.1
   */
  onViewMyCards() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/my-cards/my-cards' });
  },

  /**
   * 查看交换管理
   * Requirements: 7.5
   */
  onViewExchanges() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/exchange/exchange' });
  },

  /**
   * 查看通知
   * Requirements: 10.2
   */
  onViewNotifications() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  /**
   * 设置
   */
  onSettings() {
    // TODO: 跳转到设置页面
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },

  /**
   * 关于我们
   */
  onAbout() {
    // TODO: 跳转到关于页面
    wx.showToast({ title: '关于页面开发中', icon: 'none' });
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          userStore.logout();
          this.syncFromStore();
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      },
    });
  },
});
