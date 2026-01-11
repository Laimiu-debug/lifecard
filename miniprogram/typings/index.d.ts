/// <reference path="./types/index.d.ts" />

/**
 * 全局类型声明
 */

// 小程序全局数据接口
interface IAppOption {
  globalData: {
    userInfo: WechatMiniprogram.UserInfo | null;
    isLoggedIn: boolean;
    apiBaseUrl: string;
  };
  checkLoginStatus(): void;
  loadNotificationBadge(): Promise<void>;
  handleDeepLink(options: WechatMiniprogram.App.LaunchShowOption): Promise<void>;
  validateCardForDeepLink(cardId: string): Promise<boolean>;
}

// 扩展 Page 数据类型
interface IPageData {
  [key: string]: any;
}

// 扩展 Component 数据类型
interface IComponentData {
  [key: string]: any;
}
