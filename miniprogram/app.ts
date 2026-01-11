// app.ts
// Life Card 微信小程序入口文件

import { authService } from './services/auth';
import { notificationStore } from './stores/notification';
import { parseDeepLink, handleDeepLinkNavigation, showCardNotFoundAndNavigateHome } from './utils/share';
import { cardService } from './services/card';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

App<IAppOption>({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    apiBaseUrl: 'http://localhost:8080', // 本地开发 API 地址
  },

  /**
   * 小程序启动时触发
   * 处理深度链接导航
   * Requirements: 1.6, 12.5
   */
  onLaunch(options) {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 处理深度链接
    // Requirements: 12.5
    this.handleDeepLink(options);
  },

  /**
   * 小程序从后台切换到前台时触发
   * 处理通过分享链接打开的场景
   * Requirements: 12.5
   */
  onShow(options) {
    // 处理深度链接（从分享链接打开）
    // Requirements: 12.5
    if (options && (options.query?.id || options.query?.cardId)) {
      this.handleDeepLink(options);
    }
  },

  /**
   * 处理深度链接
   * 解析启动参数并导航到目标页面
   * Requirements: 12.5
   * Property 20: Deep Link Navigation
   */
  async handleDeepLink(options: WechatMiniprogram.App.LaunchShowOption) {
    // 解析深度链接参数
    const deepLinkResult = parseDeepLink({
      path: options.path,
      query: options.query as Record<string, string>,
      scene: options.scene,
      referrerInfo: options.referrerInfo,
    });

    // 如果没有有效的深度链接，不做处理
    if (!deepLinkResult.success || !deepLinkResult.cardId) {
      return;
    }

    console.log('Processing deep link:', deepLinkResult);

    // 验证卡片是否存在
    try {
      const cardExists = await this.validateCardForDeepLink(deepLinkResult.cardId);
      
      if (cardExists) {
        // 卡片存在，导航到详情页
        await handleDeepLinkNavigation(deepLinkResult);
      } else {
        // 卡片不存在，显示错误并导航到首页
        showCardNotFoundAndNavigateHome();
      }
    } catch (error) {
      console.error('Deep link handling failed:', error);
      // 出错时也导航到首页
      showCardNotFoundAndNavigateHome();
    }
  },

  /**
   * 验证卡片是否存在（用于深度链接）
   * Requirements: 12.5
   */
  async validateCardForDeepLink(cardId: string): Promise<boolean> {
    if (!cardId) {
      return false;
    }

    try {
      await cardService.getCard(cardId);
      return true;
    } catch (error) {
      console.log('Card not found for deep link:', cardId);
      return false;
    }
  },

  /**
   * 检查登录状态
   * Requirements: 1.6
   */
  async checkLoginStatus() {
    try {
      // 使用 authService 检查登录状态
      const isLoggedIn = await authService.checkSession();
      this.globalData.isLoggedIn = isLoggedIn;

      if (isLoggedIn) {
        // 从本地存储获取用户资料
        const userProfile = authService.getUserProfileFromStorage();
        if (userProfile) {
          this.globalData.userInfo = {
            nickName: userProfile.nickname,
            avatarUrl: userProfile.avatar_url || '',
            gender: 0,
            country: '',
            province: '',
            city: userProfile.location || '',
            language: 'zh_CN',
          };
        }
        
        // 加载未读通知计数并更新 TabBar 徽章
        // Requirements: 10.1
        this.loadNotificationBadge();
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      this.globalData.isLoggedIn = false;
    }
  },

  /**
   * 加载通知徽章
   * Requirements: 10.1
   */
  async loadNotificationBadge() {
    try {
      await notificationStore.loadUnreadCount();
    } catch (error) {
      console.error('加载通知徽章失败:', error);
    }
  },
});
