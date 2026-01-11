/**
 * 他人主页
 * 显示公开资料和卡片
 * 
 * Requirements: 2.1, 6.2
 */

import { userService } from '../../services/user';
import { cardService } from '../../services/card';
import { userStore } from '../../stores/user';
import type { UserProfile } from '../../types/user';
import type { LifeCard } from '../../types/card';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// 页面数据接口
interface UserProfilePageData {
  /** 用户 ID */
  userId: string;
  /** 用户资料 */
  profile: UserProfile | null;
  /** 用户卡片列表 */
  cards: LifeCard[];
  /** 是否正在加载资料 */
  loading: boolean;
  /** 是否正在加载卡片 */
  loadingCards: boolean;
  /** 是否正在关注/取关 */
  followLoading: boolean;
  /** 是否还有更多卡片 */
  hasMoreCards: boolean;
  /** 当前页码 */
  currentPage: number;
  /** 是否是自己的主页 */
  isOwnProfile: boolean;
  /** 加载错误信息 */
  errorMessage: string;
}

Page<UserProfilePageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    userId: '',
    profile: null,
    cards: [],
    loading: false,
    loadingCards: false,
    followLoading: false,
    hasMoreCards: true,
    currentPage: 1,
    isOwnProfile: false,
    errorMessage: '',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const userId = options.id;
    if (userId) {
      // 检查是否是自己的主页
      const isOwnProfile = userStore.profile?.id === userId;
      
      if (isOwnProfile) {
        // 如果是自己的主页，跳转到个人中心
        wx.redirectTo({ url: '/pages/profile/profile' });
        return;
      }
      
      this.setData({ userId, isOwnProfile });
      this.loadProfile(userId);
      this.loadUserCards(userId, 1);
    } else {
      wx.showToast({ title: '用户不存在', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时刷新关注状态
    if (this.data.userId && this.data.profile) {
      this.refreshFollowStatus();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    if (this.data.userId) {
      Promise.all([
        this.loadProfile(this.data.userId),
        this.loadUserCards(this.data.userId, 1, true),
      ]).finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMoreCards && !this.data.loadingCards) {
      this.loadUserCards(this.data.userId, this.data.currentPage + 1);
    }
  },

  /**
   * 加载用户资料
   * Requirements: 2.1
   */
  async loadProfile(userId: string): Promise<void> {
    this.setData({ loading: true, errorMessage: '' });
    
    try {
      const profile = await userService.getUserProfile(userId);
      
      // 设置页面标题为用户昵称
      wx.setNavigationBarTitle({
        title: profile.nickname || '用户主页',
      });
      
      this.setData({ 
        profile,
        loading: false,
      });
    } catch (error: any) {
      console.error('加载用户资料失败:', error);
      
      let errorMessage = '加载失败';
      if (error?.message) {
        errorMessage = error.message;
      }
      
      this.setData({ 
        loading: false,
        errorMessage,
      });
      
      wx.showToast({ title: errorMessage, icon: 'none' });
    }
  },

  /**
   * 刷新关注状态
   */
  async refreshFollowStatus(): Promise<void> {
    if (!this.data.userId || !userStore.isLoggedIn) return;
    
    try {
      const isFollowing = await userService.isFollowing(this.data.userId);
      if (this.data.profile) {
        this.setData({
          'profile.is_following': isFollowing,
        });
      }
    } catch (error) {
      console.error('刷新关注状态失败:', error);
    }
  },

  /**
   * 加载用户卡片
   * Requirements: 6.2
   */
  async loadUserCards(userId: string, page: number = 1, refresh: boolean = false): Promise<void> {
    if (this.data.loadingCards) return;
    
    this.setData({ loadingCards: true });
    
    try {
      const result = await cardService.getUserCards(userId, page, 20);
      
      const newCards = result.items || [];
      
      this.setData({
        cards: refresh || page === 1 ? newCards : [...this.data.cards, ...newCards],
        hasMoreCards: result.has_more,
        currentPage: page,
        loadingCards: false,
      });
    } catch (error) {
      console.error('加载用户卡片失败:', error);
      this.setData({ loadingCards: false });
      
      if (page === 1) {
        wx.showToast({ title: '加载卡片失败', icon: 'none' });
      }
    }
  },

  /**
   * 关注/取关
   * Requirements: 9.1, 9.2
   */
  async onFollow(): Promise<void> {
    if (!this.data.profile) return;
    
    // 检查登录状态
    if (!userStore.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再关注',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        },
      });
      return;
    }
    
    if (this.data.followLoading) return;
    
    const profile = this.data.profile;
    const isCurrentlyFollowing = profile.is_following;
    
    // 乐观更新 UI
    this.setData({
      followLoading: true,
      'profile.is_following': !isCurrentlyFollowing,
      'profile.follower_count': profile.follower_count + (isCurrentlyFollowing ? -1 : 1),
    });
    
    try {
      if (isCurrentlyFollowing) {
        // 取消关注
        const result = await userService.unfollowUser(this.data.userId);
        this.setData({
          'profile.is_following': result.is_following,
          'profile.follower_count': result.follower_count,
        });
      } else {
        // 关注
        const result = await userService.followUser(this.data.userId);
        this.setData({
          'profile.is_following': result.is_following,
          'profile.follower_count': result.follower_count,
        });
      }
    } catch (error: any) {
      console.error('关注操作失败:', error);
      
      // 回滚乐观更新
      this.setData({
        'profile.is_following': isCurrentlyFollowing,
        'profile.follower_count': profile.follower_count,
      });
      
      wx.showToast({ title: error?.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ followLoading: false });
    }
  },

  /**
   * 跳转到卡片详情
   * Requirements: 6.2
   */
  onCardTap(e: WechatMiniprogram.TouchEvent): void {
    const cardId = e.currentTarget.dataset.id as string;
    if (cardId) {
      wx.navigateTo({
        url: `/pages/card-detail/card-detail?id=${cardId}`,
      });
    }
  },

  /**
   * 查看关注列表
   * Requirements: 9.3
   */
  onViewFollowing(): void {
    if (!this.data.userId) return;
    wx.navigateTo({ 
      url: `/pages/follow-list/follow-list?tab=following&userId=${this.data.userId}` 
    });
  },

  /**
   * 查看粉丝列表
   * Requirements: 9.3
   */
  onViewFollowers(): void {
    if (!this.data.userId) return;
    wx.navigateTo({ 
      url: `/pages/follow-list/follow-list?tab=followers&userId=${this.data.userId}` 
    });
  },

  /**
   * 重试加载
   */
  onRetry(): void {
    if (this.data.userId) {
      this.loadProfile(this.data.userId);
      this.loadUserCards(this.data.userId, 1);
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const profile = this.data.profile;
    return {
      title: profile ? `${profile.nickname} 的主页` : '用户主页',
      path: `/pages/user-profile/user-profile?id=${this.data.userId}`,
    };
  },
});
