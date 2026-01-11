/**
 * 空状态组件
 * 支持自定义图标和文案
 * Requirements: 5.7
 */

// 预设图标映射
const PRESET_ICONS: Record<string, string> = {
  search: 'search',
  card: 'photo-o',
  notification: 'bell-o',
  comment: 'comment-o',
  exchange: 'exchange',
  folder: 'folder-o',
  user: 'user-o',
  error: 'warning-o',
  network: 'wifi-o',
};

// 预设文案映射
const PRESET_DESCRIPTIONS: Record<string, string> = {
  search: '没有找到相关内容',
  card: '暂无卡片',
  notification: '暂无通知',
  comment: '暂无评论',
  exchange: '暂无交换记录',
  folder: '文件夹为空',
  user: '暂无用户',
  error: '出错了',
  network: '网络连接失败',
};

Component({
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },

  properties: {
    /** 预设类型 */
    type: {
      type: String,
      value: '',
    },
    /** 自定义图标名称 (Vant icon name) */
    icon: {
      type: String,
      value: '',
    },
    /** 自定义图片URL */
    image: {
      type: String,
      value: '',
    },
    /** 主标题 */
    title: {
      type: String,
      value: '',
    },
    /** 描述文案 */
    description: {
      type: String,
      value: '',
    },
    /** 操作按钮文案 */
    actionText: {
      type: String,
      value: '',
    },
    /** 图标大小 (rpx) */
    iconSize: {
      type: Number,
      value: 120,
    },
    /** 图标颜色 */
    iconColor: {
      type: String,
      value: '#cccccc',
    },
  },

  data: {
    // 计算后的显示数据
    displayIcon: '',
    displayDescription: '',
  },

  observers: {
    'type, icon, description': function(_type: string, _icon: string, _description: string) {
      this.updateDisplayData();
    },
  },

  lifetimes: {
    attached() {
      this.updateDisplayData();
    },
  },

  methods: {
    /**
     * 更新显示数据
     */
    updateDisplayData() {
      const { type, icon, description } = this.data;
      
      // 确定显示的图标
      let displayIcon = icon;
      if (!displayIcon && type && PRESET_ICONS[type]) {
        displayIcon = PRESET_ICONS[type];
      }
      if (!displayIcon) {
        displayIcon = 'info-o'; // 默认图标
      }

      // 确定显示的描述
      let displayDescription = description;
      if (!displayDescription && type && PRESET_DESCRIPTIONS[type]) {
        displayDescription = PRESET_DESCRIPTIONS[type];
      }
      if (!displayDescription) {
        displayDescription = '暂无内容';
      }

      this.setData({
        displayIcon,
        displayDescription,
      });
    },

    /**
     * 点击操作按钮
     */
    onTapAction() {
      this.triggerEvent('action');
    },

    /**
     * 图片加载失败
     */
    onImageError() {
      // 图片加载失败时，回退到图标显示
      this.setData({
        image: '',
      });
    },
  },
});
