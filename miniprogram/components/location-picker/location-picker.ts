/**
 * 位置选择器组件
 * 集成微信位置 API
 * Requirements: 3.5
 */

import type { Location } from '../../types/card';

Component({
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },

  properties: {
    /** 当前选中的位置 */
    location: {
      type: Object,
      value: {} as WechatMiniprogram.IAnyObject,
    },
    /** 是否禁用 */
    disabled: {
      type: Boolean,
      value: false,
    },
    /** 占位文本 */
    placeholder: {
      type: String,
      value: '添加位置',
    },
    /** 是否显示清除按钮 */
    showClear: {
      type: Boolean,
      value: true,
    },
    /** 是否显示当前位置选项 */
    showCurrentLocation: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    // 内部位置状态
    selectedLocation: null as Location | null,
    // 加载状态
    loading: false,
    // 错误信息
    errorMessage: '',
  },

  observers: {
    'location': function(location: WechatMiniprogram.IAnyObject) {
      if (location && location.name) {
        this.setData({ selectedLocation: location as unknown as Location });
      }
    },
  },

  lifetimes: {
    attached() {
      const loc = this.data.location as unknown as Location;
      if (loc && loc.name) {
        this.setData({ selectedLocation: loc });
      }
    },
  },

  methods: {
    /**
     * 打开位置选择
     */
    async onChooseLocation() {
      if (this.data.disabled || this.data.loading) return;

      this.setData({ loading: true, errorMessage: '' });

      try {
        // 先检查位置权限
        const hasPermission = await this.checkLocationPermission();
        if (!hasPermission) {
          this.setData({ loading: false });
          return;
        }

        // 调用微信选择位置 API
        const result = await this.chooseLocationFromMap();
        
        if (result) {
          const location: Location = {
            name: result.name || result.address || '未知位置',
            latitude: result.latitude,
            longitude: result.longitude,
          };

          this.setData({ selectedLocation: location });
          this.triggerEvent('change', { location });
          this.triggerEvent('select', { location });
        }
      } catch (error) {
        console.error('Choose location failed:', error);
        const errorMsg = this.getErrorMessage(error);
        this.setData({ errorMessage: errorMsg });
        
        if (errorMsg) {
          wx.showToast({
            title: errorMsg,
            icon: 'none',
          });
        }
      } finally {
        this.setData({ loading: false });
      }
    },

    /**
     * 检查位置权限
     */
    async checkLocationPermission(): Promise<boolean> {
      return new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            if (res.authSetting['scope.userLocation'] === false) {
              // 用户之前拒绝过，引导去设置页开启
              wx.showModal({
                title: '位置权限',
                content: '需要获取您的位置信息，请在设置中开启位置权限',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        resolve(settingRes.authSetting['scope.userLocation'] === true);
                      },
                      fail: () => resolve(false),
                    });
                  } else {
                    resolve(false);
                  }
                },
              });
            } else {
              // 未请求过或已授权
              resolve(true);
            }
          },
          fail: () => resolve(true), // 获取设置失败，尝试继续
        });
      });
    },

    /**
     * 从地图选择位置
     */
    chooseLocationFromMap(): Promise<WechatMiniprogram.ChooseLocationSuccessCallbackResult | null> {
      return new Promise((resolve, reject) => {
        wx.chooseLocation({
          success: (res) => {
            if (res.name || res.address || (res.latitude && res.longitude)) {
              resolve(res);
            } else {
              resolve(null);
            }
          },
          fail: (err) => {
            // 用户取消选择不算错误
            if (err.errMsg?.includes('cancel') || err.errMsg?.includes('取消')) {
              resolve(null);
            } else {
              reject(err);
            }
          },
        });
      });
    },

    /**
     * 获取当前位置
     */
    async onGetCurrentLocation() {
      if (this.data.disabled || this.data.loading) return;

      this.setData({ loading: true, errorMessage: '' });

      try {
        const hasPermission = await this.checkLocationPermission();
        if (!hasPermission) {
          this.setData({ loading: false });
          return;
        }

        const result = await this.getCurrentPosition();
        
        if (result) {
          // 尝试逆地理编码获取地址名称
          const addressName = await this.reverseGeocode(result.latitude, result.longitude);
          
          const location: Location = {
            name: addressName || '当前位置',
            latitude: result.latitude,
            longitude: result.longitude,
          };

          this.setData({ selectedLocation: location });
          this.triggerEvent('change', { location });
          this.triggerEvent('select', { location });
        }
      } catch (error) {
        console.error('Get current location failed:', error);
        const errorMsg = this.getErrorMessage(error);
        this.setData({ errorMessage: errorMsg });
        
        if (errorMsg) {
          wx.showToast({
            title: errorMsg,
            icon: 'none',
          });
        }
      } finally {
        this.setData({ loading: false });
      }
    },

    /**
     * 获取当前位置坐标
     */
    getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
      return new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02', // 使用国测局坐标
          success: (res) => {
            resolve({
              latitude: res.latitude,
              longitude: res.longitude,
            });
          },
          fail: (err) => {
            if (err.errMsg?.includes('cancel') || err.errMsg?.includes('取消')) {
              resolve(null);
            } else {
              reject(err);
            }
          },
        });
      });
    },

    /**
     * 逆地理编码（获取地址名称）
     * 注意：微信小程序没有内置的逆地理编码 API，
     * 这里返回简单的坐标描述，实际项目中可以调用腾讯地图 API
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<string> {
      // 简单实现：返回坐标描述
      // 实际项目中应该调用腾讯地图 WebService API 进行逆地理编码
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    },

    /**
     * 清除选中的位置
     */
    onClearLocation() {
      if (this.data.disabled) return;

      this.setData({ selectedLocation: null, errorMessage: '' });
      this.triggerEvent('change', { location: null });
      this.triggerEvent('clear', {});
    },

    /**
     * 获取错误信息
     */
    getErrorMessage(error: unknown): string {
      if (!error) return '';
      
      const err = error as { errMsg?: string };
      const errMsg = err.errMsg || '';

      if (errMsg.includes('auth deny') || errMsg.includes('authorize')) {
        return '请授权位置权限';
      }
      if (errMsg.includes('cancel') || errMsg.includes('取消')) {
        return ''; // 用户取消不显示错误
      }
      if (errMsg.includes('timeout')) {
        return '获取位置超时，请重试';
      }
      if (errMsg.includes('fail')) {
        return '获取位置失败，请重试';
      }
      
      return '获取位置失败';
    },

    /**
     * 格式化位置显示
     */
    formatLocationDisplay(location: Location | null): string {
      if (!location) return '';
      return location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    },

    /**
     * 获取当前选中的位置
     */
    getLocation(): Location | null {
      return this.data.selectedLocation;
    },

    /**
     * 设置位置
     */
    setLocation(location: Location | null) {
      this.setData({ selectedLocation: location });
      this.triggerEvent('change', { location });
    },
  },
});
