// pages/login/login.ts
// 登录页

import { authService } from '../../services/auth';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

Page({
  data: {
    loading: false,
  },

  /**
   * 页面加载时检查登录状态
   */
  async onLoad() {
    // 检查是否已登录
    const isLoggedIn = await authService.checkSession();
    if (isLoggedIn) {
      // 已登录，跳转到首页
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  /**
   * 微信登录
   * Requirements: 1.1, 1.2, 1.3
   */
  async onLogin() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });

    try {
      // 1. 尝试获取用户信息（可选，失败也能登录）
      let userInfo = null;
      try {
        userInfo = await authService.getUserProfile();
      } catch (e) {
        console.warn('获取用户信息失败，将使用默认信息', e);
      }

      // 2. 调用认证服务进行登录
      const result = await authService.login(userInfo);

      // 3. 显示登录成功提示
      if (result.isNewUser) {
        wx.showToast({ title: '欢迎加入 Life Card!', icon: 'success' });
      } else {
        wx.showToast({ title: '登录成功', icon: 'success' });
      }

      // 4. 跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);

    } catch (error) {
      console.error('登录失败', error);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 获取用户信息回调（兼容旧版本）
   */
  onGetUserInfo(e: any) {
    if (e.detail.userInfo) {
      // 用户同意授权
      this.onLogin();
    } else {
      // 用户拒绝授权
      wx.showToast({ title: '需要授权才能登录', icon: 'none' });
    }
  },
});
