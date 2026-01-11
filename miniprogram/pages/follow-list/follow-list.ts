/**
 * 粉丝/关注列表页面
 * 显示列表和互关状态
 * 
 * Requirements: 9.3, 9.4, 9.5
 */

import { userService } from '../../services/user';
import { userStore } from '../../stores/user';
import type { FollowUser } from '../../types/user';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// Tab 类型
type TabType = 'followers' | 'following';

// 页面数据接口
interface FollowListPageData {
  /** 用户 ID（可选，默认当前用户） */
  userId: string;
  /** 当前 Tab */
  activeTab: TabType;
  /** 粉丝列表 */
  followers: FollowUser[];
  /** 关注列表 */
  following: FollowUser[];
  /** 粉丝列表是否正在加载 */
  loadingFollowers: boolean;
  /** 关注列表是否正在加载 */
  loadingFollowing: boolean;
  /** 粉丝列表当前页码 */
  followersPage: number;
  /** 关注列表当前页码 */
  followingPage: number;
  /** 粉丝列表是否还有更多 */
  hasMoreFollowers: boolean;
  /** 关注列表是否还有更多 */
  hasMoreFollowing: boolean;
  /** 粉丝总数 */
  followersTotal: number;
  /** 关注总数 */
  followingTotal: number;
  /** 正在操作的用户 ID（关注/取关） */
  operatingUserId: string;
  /** 是否是自己的列表 */
  isOwnList: boolean;
  /** 页面标题 */
  pageTitle: string;
}

Page<FollowListPageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    userId: '',
    activeTab: 'followers',
    followers: [],
    following: [],
    loadingFollowers: false,
    loadingFollowing: false,
    followersPage: 1,
    followingPage: 1,
    hasMoreFollowers: true,
    hasMoreFollowing: true,
    followersTotal: 0,
    followingTotal: 0,
    operatingUserId: '',
    isOwnList: true,
    pageTitle: '粉丝列表',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const userId = options.userId || '';
    const tab = (options.tab as TabType) || 'followers';
    
    // 判断是否是自己的列表
    const isOwnList = !userId || userId === userStore.profile?.id;
    
    // 设置页面标题
    const pageTitle = tab === 'followers' ? '粉丝列表' : '关注列表';
    wx.setNavigationBarTitle({ title: pageTitle });
    
    this.setData({
      userId,
      activeTab: tab,
      isOwnList,
      pageTitle,
    });
    
    // 加载初始数据
    this.loadCurrentTabData(true);
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadCurrentTabData(true).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMoreCurrentTab();
  },

  /**
   * Tab 切换
   * Requirements: 9.3
   */
  onTabChange(e: WechatMiniprogram.CustomEvent<{ index: number; name: string }>) {
    const tab = e.detail.name as TabType;
    
    if (tab === this.data.activeTab) return;
    
    // 更新页面标题
    const pageTitle = tab === 'followers' ? '粉丝列表' : '关注列表';
    wx.setNavigationBarTitle({ title: pageTitle });
    
    this.setData({ 
      activeTab: tab,
      pageTitle,
    });
    
    // 如果该 Tab 还没有数据，加载数据
    if (tab === 'followers' && this.data.followers.length === 0) {
      this.loadFollowers(1, true);
    } else if (tab === 'following' && this.data.following.length === 0) {
      this.loadFollowing(1, true);
    }
  },

  /**
   * 加载当前 Tab 数据
   */
  async loadCurrentTabData(refresh: boolean = false): Promise<void> {
    if (this.data.activeTab === 'followers') {
      await this.loadFollowers(1, refresh);
    } else {
      await this.loadFollowing(1, refresh);
    }
  },

  /**
   * 加载更多当前 Tab 数据
   */
  loadMoreCurrentTab(): void {
    if (this.data.activeTab === 'followers') {
      if (this.data.hasMoreFollowers && !this.data.loadingFollowers) {
        this.loadFollowers(this.data.followersPage + 1);
      }
    } else {
      if (this.data.hasMoreFollowing && !this.data.loadingFollowing) {
        this.loadFollowing(this.data.followingPage + 1);
      }
    }
  },

  /**
   * 加载粉丝列表
   * Requirements: 9.3, 9.4
   */
  async loadFollowers(page: number = 1, refresh: boolean = false): Promise<void> {
    if (this.data.loadingFollowers) return;
    
    this.setData({ loadingFollowers: true });
    
    try {
      const userId = this.data.userId || undefined;
      const result = await userService.getFollowers(userId, page, 20);
      
      const newFollowers = result.users || [];
      
      this.setData({
        followers: refresh || page === 1 
          ? newFollowers 
          : [...this.data.followers, ...newFollowers],
        followersPage: page,
        hasMoreFollowers: result.has_more,
        followersTotal: result.total,
        loadingFollowers: false,
      });
    } catch (error) {
      console.error('加载粉丝列表失败:', error);
      this.setData({ loadingFollowers: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 加载关注列表
   * Requirements: 9.3, 9.4
   */
  async loadFollowing(page: number = 1, refresh: boolean = false): Promise<void> {
    if (this.data.loadingFollowing) return;
    
    this.setData({ loadingFollowing: true });
    
    try {
      const userId = this.data.userId || undefined;
      const result = await userService.getFollowing(userId, page, 20);
      
      const newFollowing = result.users || [];
      
      this.setData({
        following: refresh || page === 1 
          ? newFollowing 
          : [...this.data.following, ...newFollowing],
        followingPage: page,
        hasMoreFollowing: result.has_more,
        followingTotal: result.total,
        loadingFollowing: false,
      });
    } catch (error) {
      console.error('加载关注列表失败:', error);
      this.setData({ loadingFollowing: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 关注/取关用户
   * Requirements: 9.1, 9.2
   */
  async onToggleFollow(e: WechatMiniprogram.TouchEvent): Promise<void> {
    const targetUserId = e.currentTarget.dataset.userId as string;
    const isFollowing = e.currentTarget.dataset.isFollowing as boolean;
    
    if (!targetUserId) return;
    
    // 检查登录状态
    if (!userStore.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再操作',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        },
      });
      return;
    }
    
    // 防止重复操作
    if (this.data.operatingUserId) return;
    
    this.setData({ operatingUserId: targetUserId });
    
    // 乐观更新 UI
    this.updateUserFollowStatus(targetUserId, !isFollowing);
    
    try {
      if (isFollowing) {
        await userService.unfollowUser(targetUserId);
      } else {
        await userService.followUser(targetUserId);
      }
    } catch (error: any) {
      console.error('关注操作失败:', error);
      // 回滚乐观更新
      this.updateUserFollowStatus(targetUserId, isFollowing);
      wx.showToast({ title: error?.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ operatingUserId: '' });
    }
  },

  /**
   * 更新用户关注状态（用于乐观更新）
   */
  updateUserFollowStatus(userId: string, isFollowing: boolean): void {
    // 更新粉丝列表中的状态
    const followers = this.data.followers.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          is_following: isFollowing,
          // 如果对方也关注了我，则更新互关状态
          is_mutual_follow: isFollowing && this.isUserFollowingMe(userId),
        };
      }
      return user;
    });
    
    // 更新关注列表中的状态
    const following = this.data.following.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          is_following: isFollowing,
          is_mutual_follow: isFollowing && user.is_following,
        };
      }
      return user;
    });
    
    this.setData({ followers, following });
  },

  /**
   * 检查用户是否关注了我（用于判断互关）
   */
  isUserFollowingMe(userId: string): boolean {
    // 在粉丝列表中查找该用户
    const follower = this.data.followers.find(u => u.id === userId);
    return !!follower;
  },

  /**
   * 跳转到用户主页
   */
  onUserTap(e: WechatMiniprogram.TouchEvent): void {
    const userId = e.currentTarget.dataset.userId as string;
    if (!userId) return;
    
    // 如果是自己，跳转到个人中心
    if (userId === userStore.profile?.id) {
      wx.switchTab({ url: '/pages/profile/profile' });
    } else {
      wx.navigateTo({ url: `/pages/user-profile/user-profile?id=${userId}` });
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const { activeTab, userId, isOwnList } = this.data;
    const tabName = activeTab === 'followers' ? '粉丝' : '关注';
    
    return {
      title: isOwnList ? `我的${tabName}列表` : `${tabName}列表`,
      path: `/pages/follow-list/follow-list?tab=${activeTab}${userId ? `&userId=${userId}` : ''}`,
    };
  },
});
