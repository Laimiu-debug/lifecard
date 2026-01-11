// pages/discover/discover.ts
// 发现页

Page({
  data: {
    hotCards: [] as LifeCard.Card[],
    randomCards: [] as LifeCard.Card[],
    timeRange: 'week' as 'day' | 'week' | 'month',
    loading: false,
  },

  onLoad() {
    this.loadHotCards();
    this.loadRandomCards();
  },

  onPullDownRefresh() {
    Promise.all([this.loadHotCards(), this.loadRandomCards()]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 切换时间范围
   */
  onTimeRangeChange(e: WechatMiniprogram.TouchEvent) {
    const range = e.currentTarget.dataset.range as 'day' | 'week' | 'month';
    if (range !== this.data.timeRange) {
      this.setData({ timeRange: range });
      this.loadHotCards();
    }
  },

  /**
   * 加载热门卡片
   */
  async loadHotCards() {
    this.setData({ loading: true });
    try {
      // TODO: 调用 API
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载随机卡片
   */
  async loadRandomCards() {
    try {
      // TODO: 调用 API
    } catch (error) {
      console.error('加载随机卡片失败', error);
    }
  },

  /**
   * 刷新随机卡片
   */
  onRefreshRandom() {
    this.loadRandomCards();
  },

  /**
   * 跳转到卡片详情
   */
  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const cardId = e.currentTarget.dataset.id as string;
    wx.navigateTo({
      url: `/pages/card-detail/card-detail?id=${cardId}`,
    });
  },
});
