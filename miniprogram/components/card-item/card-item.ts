/**
 * 卡片列表项组件
 * 显示缩略图、标题、创建者、互动数
 * Requirements: 4.4
 */

import { formatCount, formatRelativeTime } from '../../utils/format';

// 默认头像
const DEFAULT_AVATAR = '/assets/images/default-avatar.png';
// 默认缩略图
const DEFAULT_THUMBNAIL = '/assets/images/default-card.png';

Component({
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },

  properties: {
    /** 卡片数据 */
    card: {
      type: Object,
      value: {} as WechatMiniprogram.IAnyObject,
    },
    /** 是否显示创建者信息 */
    showCreator: {
      type: Boolean,
      value: true,
    },
    /** 是否显示互动数据 */
    showStats: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    // 格式化后的数据
    thumbnail: DEFAULT_THUMBNAIL,
    creatorAvatar: DEFAULT_AVATAR,
    creatorName: '',
    likeCountText: '0',
    commentCountText: '0',
    timeText: '',
  },

  observers: {
    'card': function(card) {
      if (!card) return;
      this.updateDisplayData(card);
    },
  },

  lifetimes: {
    attached() {
      if (this.data.card) {
        this.updateDisplayData(this.data.card);
      }
    },
  },

  methods: {
    /**
     * 更新显示数据
     */
    updateDisplayData(card: any) {
      // 获取缩略图
      let thumbnail = DEFAULT_THUMBNAIL;
      if (card.thumbnail_url) {
        thumbnail = card.thumbnail_url;
      } else if (card.media && card.media.length > 0) {
        const firstMedia = card.media[0];
        thumbnail = firstMedia.thumbnail_url || firstMedia.url || DEFAULT_THUMBNAIL;
      }

      // 获取创建者信息
      const creator = card.creator || {};
      const creatorAvatar = creator.avatar_url || DEFAULT_AVATAR;
      const creatorName = creator.nickname || '未知用户';

      // 格式化互动数
      const likeCountText = formatCount(card.like_count || 0);
      const commentCountText = formatCount(card.comment_count || 0);

      // 格式化时间
      let timeText = '';
      if (card.created_at) {
        timeText = formatRelativeTime(new Date(card.created_at));
      }

      this.setData({
        thumbnail,
        creatorAvatar,
        creatorName,
        likeCountText,
        commentCountText,
        timeText,
      });
    },

    /**
     * 点击卡片
     */
    onTapCard() {
      const { card } = this.data;
      if (card && card.id) {
        this.triggerEvent('tap', { card });
      }
    },

    /**
     * 点击创建者
     */
    onTapCreator(_e: WechatMiniprogram.TouchEvent) {
      // Note: stopPropagation is handled via catchtap in WXML
      const { card } = this.data;
      if (card && card.creator_id) {
        this.triggerEvent('tapcreator', { 
          userId: card.creator_id,
          creator: card.creator,
        });
      }
    },

    /**
     * 图片加载失败
     */
    onImageError() {
      this.setData({
        thumbnail: DEFAULT_THUMBNAIL,
      });
    },

    /**
     * 头像加载失败
     */
    onAvatarError() {
      this.setData({
        creatorAvatar: DEFAULT_AVATAR,
      });
    },
  },
});
