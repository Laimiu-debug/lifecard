/**
 * 用户头像组件
 * 支持不同尺寸和默认头像
 * Requirements: 2.1, 6.2
 */

// 默认头像路径
const DEFAULT_AVATAR = '/assets/images/default-avatar.png';

// 尺寸映射 (rpx)
const SIZE_MAP: Record<string, number> = {
  small: 64,
  medium: 96,
  large: 128,
  xlarge: 160,
};

Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    /** 头像 URL */
    src: {
      type: String,
      value: '',
    },
    /** 尺寸: small(64rpx), medium(96rpx), large(128rpx), xlarge(160rpx) 或自定义数值 */
    size: {
      type: null, // 支持 string 或 number
      value: 'medium',
    },
    /** 是否显示边框 */
    border: {
      type: Boolean,
      value: false,
    },
    /** 边框颜色 */
    borderColor: {
      type: String,
      value: '#ffffff',
    },
    /** 是否可点击 */
    clickable: {
      type: Boolean,
      value: false,
    },
    /** 用户 ID（用于点击事件） */
    userId: {
      type: String,
      value: '',
    },
  },

  data: {
    // 实际显示的头像 URL
    avatarUrl: DEFAULT_AVATAR,
    // 计算后的尺寸样式
    sizeStyle: '',
    // 是否加载失败
    loadError: false,
  },

  observers: {
    'src': function(src: string) {
      this.updateAvatarUrl(src);
    },
    'size, border, borderColor': function() {
      this.updateSizeStyle();
    },
  },

  lifetimes: {
    attached() {
      this.updateAvatarUrl(this.data.src);
      this.updateSizeStyle();
    },
  },

  methods: {
    /**
     * 更新头像 URL
     */
    updateAvatarUrl(src: string) {
      const avatarUrl = src && src.trim() ? src : DEFAULT_AVATAR;
      this.setData({
        avatarUrl,
        loadError: false,
      });
    },

    /**
     * 更新尺寸样式
     */
    updateSizeStyle() {
      const { size, border, borderColor } = this.data;
      
      // 计算尺寸
      let sizeValue: number;
      if (typeof size === 'number') {
        sizeValue = size;
      } else if (typeof size === 'string' && SIZE_MAP[size]) {
        sizeValue = SIZE_MAP[size];
      } else if (typeof size === 'string' && !isNaN(Number(size))) {
        sizeValue = Number(size);
      } else {
        sizeValue = SIZE_MAP.medium;
      }

      // 构建样式
      let style = `width: ${sizeValue}rpx; height: ${sizeValue}rpx;`;
      
      if (border) {
        style += ` border: 4rpx solid ${borderColor};`;
      }

      this.setData({
        sizeStyle: style,
      });
    },

    /**
     * 头像加载失败处理
     */
    onImageError() {
      if (!this.data.loadError) {
        this.setData({
          avatarUrl: DEFAULT_AVATAR,
          loadError: true,
        });
      }
    },

    /**
     * 点击头像
     */
    onTapAvatar() {
      if (this.data.clickable) {
        this.triggerEvent('tap', {
          userId: this.data.userId,
          src: this.data.src,
        });
      }
    },
  },
});
