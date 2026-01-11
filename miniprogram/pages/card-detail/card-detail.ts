/**
 * 卡片详情页
 * 显示媒体轮播、卡片信息、标签、评论等
 * 
 * Requirements: 6.1, 7.1, 7.2, 12.1, 12.2, 12.3
 */

import { cardService } from '../../services/card';
import { userService } from '../../services/user';
import { exchangeService } from '../../services/exchange';
import { userStore } from '../../stores/user';
import { cardStore } from '../../stores/card';
import { exchangeStore } from '../../stores/exchange';
import { notificationStore } from '../../stores/notification';
import { formatRelativeTime, formatCount } from '../../utils/format';
import { generateShareData, generateShareTimelineData, preparePosterData, generatePoster, savePosterToAlbum } from '../../utils/share';
import type { LifeCard, MediaItem } from '../../types/card';
import type { PriceInfo, ExchangeRequest } from '../../types/exchange';

// 卡片类型映射
const CARD_TYPE_LABELS: Record<string, string> = {
  'day_card': '一天体验卡',
  'week_card': '一周体验卡',
  'fragment_card': '人生片段卡',
  'moment_card': '重要时刻卡',
};

// 卡片类型颜色
const CARD_TYPE_COLORS: Record<string, string> = {
  'day_card': '#1890ff',
  'week_card': '#52c41a',
  'fragment_card': '#faad14',
  'moment_card': '#eb2f96',
};

Page({
  data: {
    // 卡片 ID
    cardId: '',
    // 卡片数据
    card: null as LifeCard | null,
    // 格式化后的卡片数据
    cardTypeLabel: '',
    cardTypeColor: '',
    createdTimeText: '',
    likeCountText: '',
    commentCountText: '',
    exchangeCountText: '',
    // 媒体轮播
    currentMediaIndex: 0,
    mediaUrls: [] as string[],
    // 状态
    loading: true,
    isOwner: false,
    isFollowing: false,
    // 当前用户 ID
    currentUserId: '',
    // 错误信息
    errorMessage: '',
    // 交换确认弹窗状态 (Requirements: 7.1, 7.2)
    showExchangeDialog: false,
    exchangeLoading: false,
    exchangePriceInfo: null as PriceInfo | null,
    userCoinBalance: 0,
    hasEnoughBalance: false,
    exchangeMessage: '',
    // 交换请求状态 (Requirements: 7.3, 7.4)
    hasPendingExchange: false,
    pendingExchangeRequest: null as ExchangeRequest | null,
    // 海报生成状态 (Requirements: 12.4)
    showPosterDialog: false,
    posterGenerating: false,
    posterImagePath: '',
  },

  onLoad(options) {
    const cardId = options.id || options.cardId;
    if (cardId) {
      this.setData({ 
        cardId,
        currentUserId: userStore.userId || '',
      });
      this.loadCardDetail(cardId);
    } else {
      this.setData({
        loading: false,
        errorMessage: '卡片不存在',
      });
    }
  },

  onShow() {
    // 页面显示时刷新用户状态
    this.setData({
      currentUserId: userStore.userId || '',
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    if (this.data.cardId) {
      this.loadCardDetail(this.data.cardId).finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 加载卡片详情
   * Requirements: 6.1
   */
  async loadCardDetail(cardId: string) {
    this.setData({ loading: true, errorMessage: '' });
    
    try {
      const card = await cardService.getCard(cardId);
      
      // 更新 store 中的当前卡片
      cardStore.currentCard = card;
      
      // 判断是否为卡片所有者
      const isOwner = card.creator_id === userStore.userId;
      
      // 格式化数据
      const cardTypeLabel = CARD_TYPE_LABELS[card.card_type] || '体验卡';
      const cardTypeColor = CARD_TYPE_COLORS[card.card_type] || '#1890ff';
      const createdTimeText = formatRelativeTime(new Date(card.created_at));
      const likeCountText = formatCount(card.like_count);
      const commentCountText = formatCount(card.comment_count);
      const exchangeCountText = formatCount(card.exchange_count);
      
      // 提取媒体 URL 用于预览
      const mediaUrls = card.media.map((m: MediaItem) => m.url);
      
      this.setData({
        card,
        cardTypeLabel,
        cardTypeColor,
        createdTimeText,
        likeCountText,
        commentCountText,
        exchangeCountText,
        mediaUrls,
        isOwner,
        isFollowing: card.creator?.is_following || false,
        loading: false,
      });

      // 如果不是所有者，检查是否有待处理的交换请求 (Requirement 7.4)
      if (!isOwner && userStore.isLoggedIn) {
        this.checkPendingExchange(cardId);
      }
    } catch (error: any) {
      console.error('Load card detail failed:', error);
      this.setData({
        loading: false,
        errorMessage: error?.message || '加载失败，请重试',
      });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 检查是否有待处理的交换请求
   * Requirements: 7.4
   */
  async checkPendingExchange(cardId: string) {
    try {
      // 加载已发送的交换请求
      await exchangeStore.loadSentRequests();
      
      // 查找针对当前卡片的待处理请求
      const pendingRequest = exchangeStore.sentRequests.find(
        (req) => req.card_id === cardId && req.status === 'pending'
      );
      
      if (pendingRequest) {
        this.setData({
          hasPendingExchange: true,
          pendingExchangeRequest: pendingRequest,
        });
      }
    } catch (error) {
      // 静默失败，不影响主流程
      console.log('Check pending exchange failed:', error);
    }
  },

  /**
   * 媒体轮播切换
   */
  onSwiperChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({
      currentMediaIndex: e.detail.current,
    });
  },

  /**
   * 预览图片
   */
  onPreviewImage(e: WechatMiniprogram.TouchEvent) {
    const { url } = e.currentTarget.dataset;
    if (url && this.data.mediaUrls.length > 0) {
      wx.previewImage({
        current: url,
        urls: this.data.mediaUrls,
      });
    }
  },

  /**
   * 预览视频
   */
  onPreviewVideo(e: WechatMiniprogram.TouchEvent) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      // 视频全屏播放
      const videoContext = wx.createVideoContext('card-video', this);
      videoContext.requestFullScreen({ direction: 0 });
    }
  },

  /**
   * 跳转到创建者主页
   */
  onCreatorTap() {
    if (!this.data.card?.creator_id) return;
    if (this.data.isOwner) {
      // 如果是自己，跳转到个人中心
      wx.switchTab({ url: '/pages/profile/profile' });
    } else {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?id=${this.data.card.creator_id}`,
      });
    }
  },

  /**
   * 关注/取关创建者
   * Requirements: 9.1, 9.2
   */
  async onFollow() {
    if (!this.data.card?.creator_id || this.data.isOwner) return;
    
    // 检查登录状态
    if (!userStore.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const { isFollowing } = this.data;
    
    // 乐观更新
    this.setData({ isFollowing: !isFollowing });

    try {
      if (isFollowing) {
        await userService.unfollowUser(this.data.card.creator_id);
      } else {
        await userService.followUser(this.data.card.creator_id);
      }
      
      wx.showToast({ 
        title: isFollowing ? '已取消关注' : '关注成功', 
        icon: 'success' 
      });
    } catch (error) {
      // 回滚
      this.setData({ isFollowing });
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 点击位置
   */
  onLocationTap() {
    const { card } = this.data;
    if (!card?.location) return;

    wx.openLocation({
      latitude: card.location.latitude,
      longitude: card.location.longitude,
      name: card.location.name,
      scale: 15,
    });
  },

  /**
   * 点击标签搜索
   */
  onTagTap(e: WechatMiniprogram.TouchEvent) {
    const { tag, type } = e.currentTarget.dataset;
    if (tag) {
      wx.navigateTo({
        url: `/pages/search/search?tag=${encodeURIComponent(tag)}&tagType=${type || 'interest'}`,
      });
    }
  },

  /**
   * 点赞/取消点赞
   * 实现乐观更新
   * Requirements: 6.3
   */
  async onLike() {
    const { card } = this.data;
    if (!card) return;

    // 检查登录状态
    if (!userStore.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const { is_liked, like_count } = card;
    
    // 乐观更新 - 立即更新 UI
    const newIsLiked = !is_liked;
    const newLikeCount = newIsLiked ? like_count + 1 : Math.max(0, like_count - 1);
    
    this.setData({
      'card.is_liked': newIsLiked,
      'card.like_count': newLikeCount,
      likeCountText: formatCount(newLikeCount),
    });

    try {
      let result;
      if (is_liked) {
        // 取消点赞
        result = await cardService.unlikeCard(card.id);
      } else {
        // 点赞
        result = await cardService.likeCard(card.id);
      }
      
      // 用服务器返回的数据更新（确保数据一致性）
      this.setData({
        'card.is_liked': result.is_liked,
        'card.like_count': result.like_count,
        likeCountText: formatCount(result.like_count),
      });
      
      // 同步更新 store 中的卡片状态
      cardStore.updateCardInList(card.id, {
        is_liked: result.is_liked,
        like_count: result.like_count,
      });
    } catch (error) {
      // 回滚乐观更新
      this.setData({
        'card.is_liked': is_liked,
        'card.like_count': like_count,
        likeCountText: formatCount(like_count),
      });
      wx.showToast({ title: is_liked ? '取消点赞失败' : '点赞失败', icon: 'none' });
    }
  },

  /**
   * 评论加载完成
   */
  onCommentsLoad(e: WechatMiniprogram.CustomEvent) {
    const { total } = e.detail;
    if (this.data.card) {
      this.setData({
        'card.comment_count': total,
        commentCountText: formatCount(total),
      });
    }
  },

  /**
   * 评论提交成功
   */
  onCommentSubmit(e: WechatMiniprogram.CustomEvent) {
    const { comment } = e.detail;
    if (this.data.card && comment) {
      const newCount = this.data.card.comment_count + 1;
      this.setData({
        'card.comment_count': newCount,
        commentCountText: formatCount(newCount),
      });
    }
  },

  /**
   * 点击用户头像（评论区）
   */
  onTapCommentUser(e: WechatMiniprogram.CustomEvent) {
    const { userId } = e.detail;
    if (userId) {
      if (userId === userStore.userId) {
        wx.switchTab({ url: '/pages/profile/profile' });
      } else {
        wx.navigateTo({
          url: `/pages/user-profile/user-profile?id=${userId}`,
        });
      }
    }
  },

  /**
   * 重试加载
   */
  onRetry() {
    if (this.data.cardId) {
      this.loadCardDetail(this.data.cardId);
    }
  },

  /**
   * 分享给好友
   * 配置 onShareAppMessage 生成分享卡片
   * Requirements: 12.1, 12.2, 12.3
   */
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const { card, cardId } = this.data;
    const shareData = generateShareData(card, cardId);
    
    return {
      title: shareData.title,
      path: shareData.path,
      imageUrl: shareData.imageUrl,
    };
  },

  /**
   * 分享到朋友圈
   * Requirements: 12.1, 12.2
   */
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent {
    const { card, cardId } = this.data;
    const shareData = generateShareTimelineData(card, cardId);
    
    return {
      title: shareData.title,
      query: shareData.query,
      imageUrl: shareData.imageUrl,
    };
  },

  onUnload() {
    // 清除当前卡片状态
    cardStore.clearCurrentCard();
  },

  /**
   * 编辑卡片（仅所有者可见）
   * Requirements: 6.7
   */
  onEdit() {
    const { card, isOwner } = this.data;
    if (!card || !isOwner) return;

    wx.navigateTo({
      url: `/pages/create/create?id=${card.id}&mode=edit`,
    });
  },

  /**
   * 删除卡片（仅所有者可见）
   * Requirements: 6.7
   */
  onDelete() {
    const { card, isOwner } = this.data;
    if (!card || !isOwner) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这张卡片吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await cardService.deleteCard(card.id);
            wx.hideLoading();
            
            // 从 store 中移除卡片
            cardStore.removeCardFromList(card.id);
            
            wx.showToast({ title: '删除成功', icon: 'success' });
            
            // 返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error: any) {
            wx.hideLoading();
            wx.showToast({ 
              title: error?.message || '删除失败', 
              icon: 'none' 
            });
          }
        }
      },
    });
  },

  /**
   * 发起交换（仅非所有者可见）
   * 显示交换确认弹窗
   * Requirements: 6.6, 7.1, 7.2, 7.3, 7.4
   */
  async onExchange() {
    const { card, isOwner, hasPendingExchange } = this.data;
    if (!card || isOwner) return;

    // 检查登录状态
    if (!userStore.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 检查是否已收藏
    if (card.is_collected) {
      wx.showToast({ title: '您已收藏此卡片', icon: 'none' });
      return;
    }

    // 检查是否已有待处理的交换请求 (Requirement 7.4)
    if (hasPendingExchange) {
      wx.showToast({ title: '您已发送过交换请求，请等待对方处理', icon: 'none' });
      return;
    }

    // 获取用户当前余额
    const userCoinBalance = userStore.coinBalance;
    
    // 检查余额是否足够 (Requirement 7.2)
    const hasEnoughBalance = userStore.hasEnoughBalance(card.exchange_price);

    // 显示交换确认弹窗 (Requirement 7.1)
    this.setData({
      showExchangeDialog: true,
      userCoinBalance,
      hasEnoughBalance,
      exchangePriceInfo: {
        base_price: card.exchange_price,
        popularity_bonus: 0,
        total_price: card.exchange_price,
      },
      exchangeMessage: '',
    });

    // 异步获取详细价格信息（可选，如果 API 支持）
    try {
      const priceInfo = await exchangeService.getExchangePrice(card.id);
      this.setData({
        exchangePriceInfo: priceInfo,
        hasEnoughBalance: userCoinBalance >= priceInfo.total_price,
      });
    } catch (error) {
      // 使用卡片上的价格作为后备
      console.log('Using card price as fallback');
    }
  },

  /**
   * 关闭交换确认弹窗
   */
  onCloseExchangeDialog() {
    this.setData({
      showExchangeDialog: false,
      exchangeLoading: false,
      exchangeMessage: '',
    });
  },

  /**
   * 交换留言输入
   */
  onExchangeMessageInput(e: WechatMiniprogram.Input) {
    this.setData({
      exchangeMessage: e.detail.value,
    });
  },

  /**
   * 确认交换
   * 发送交换请求并更新状态
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  async onConfirmExchange() {
    const { card, hasEnoughBalance, exchangeMessage } = this.data;
    if (!card) return;

    // 再次检查余额 (Requirement 7.2)
    if (!hasEnoughBalance) {
      wx.showToast({ title: '余额不足', icon: 'none' });
      return;
    }

    this.setData({ exchangeLoading: true });

    try {
      // 发送交换请求 (Requirement 7.3)
      const exchangeRequest = await exchangeService.createExchangeRequest(
        card.id, 
        exchangeMessage || undefined
      );
      
      // 关闭弹窗
      this.setData({
        showExchangeDialog: false,
        exchangeLoading: false,
        // 更新状态显示待处理 (Requirement 7.4)
        hasPendingExchange: true,
        pendingExchangeRequest: exchangeRequest,
      });

      // 显示成功提示
      wx.showToast({ title: '交换请求已发送', icon: 'success' });
      
      // 刷新用户余额
      await userStore.refreshBalance();
      
      // 刷新已发送的交换请求列表 (Requirement 7.4)
      await exchangeStore.loadSentRequests();
      
      // 通知卡片所有者 - 刷新通知状态
      // 注意：实际通知由后端推送，这里只是刷新本地通知状态
      notificationStore.loadUnreadCount();
      
    } catch (error: any) {
      this.setData({ exchangeLoading: false });
      
      // 处理特定错误
      let errorMessage = '发送请求失败';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error_code === 'INSUFFICIENT_BALANCE') {
        errorMessage = '余额不足';
      } else if (error?.error_code === 'ALREADY_REQUESTED') {
        errorMessage = '您已发送过交换请求';
        // 更新状态为已有待处理请求
        this.setData({ hasPendingExchange: true });
      } else if (error?.error_code === 'ALREADY_COLLECTED') {
        errorMessage = '您已收藏此卡片';
      } else if (error?.error_code === 'CANNOT_EXCHANGE_OWN_CARD') {
        errorMessage = '不能交换自己的卡片';
      }
      
      wx.showToast({ title: errorMessage, icon: 'none' });
    }
  },

  /**
   * 显示海报生成弹窗
   * Requirements: 12.4
   */
  onShowPoster() {
    const { card } = this.data;
    if (!card) return;

    this.setData({
      showPosterDialog: true,
      posterGenerating: true,
      posterImagePath: '',
    });

    // 开始生成海报
    this.generateCardPoster();
  },

  /**
   * 关闭海报弹窗
   */
  onClosePosterDialog() {
    this.setData({
      showPosterDialog: false,
      posterGenerating: false,
      posterImagePath: '',
    });
  },

  /**
   * 生成卡片海报
   * Requirements: 12.4
   */
  async generateCardPoster() {
    const { card } = this.data;
    if (!card) {
      this.setData({ posterGenerating: false });
      wx.showToast({ title: '卡片数据不存在', icon: 'none' });
      return;
    }

    try {
      // 准备海报数据
      const posterData = preparePosterData(card);
      
      // 生成海报
      const result = await generatePoster('posterCanvas', posterData, {});
      
      if (result.success && result.tempFilePath) {
        this.setData({
          posterGenerating: false,
          posterImagePath: result.tempFilePath,
        });
      } else {
        this.setData({ posterGenerating: false });
        wx.showToast({ 
          title: result.errorMessage || '生成海报失败', 
          icon: 'none' 
        });
      }
    } catch (error: any) {
      this.setData({ posterGenerating: false });
      wx.showToast({ 
        title: error?.message || '生成海报失败', 
        icon: 'none' 
      });
    }
  },

  /**
   * 保存海报到相册
   * Requirements: 12.4
   */
  async onSavePoster() {
    const { posterImagePath } = this.data;
    if (!posterImagePath) {
      wx.showToast({ title: '海报未生成', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    const success = await savePosterToAlbum(posterImagePath);
    
    wx.hideLoading();
    
    if (success) {
      wx.showToast({ title: '已保存到相册', icon: 'success' });
      // 关闭弹窗
      this.setData({ showPosterDialog: false });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  /**
   * 预览海报图片
   */
  onPreviewPoster() {
    const { posterImagePath } = this.data;
    if (posterImagePath) {
      wx.previewImage({
        current: posterImagePath,
        urls: [posterImagePath],
      });
    }
  },
});
