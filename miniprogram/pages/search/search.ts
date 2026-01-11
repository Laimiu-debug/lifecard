/**
 * 搜索页面
 * 实现搜索框、历史记录、筛选功能
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { createStoreBindings } from 'mobx-miniprogram-bindings';
import { cardStore } from '../../stores/card';
import { cardService } from '../../services/card';
import { storage, StorageKeys } from '../../utils/storage';
import type { LifeCard, CardType, SearchQuery, CardSearchResult } from '../../types/card';

// 卡片类型选项
const CARD_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'day_card', label: '一天体验卡' },
  { value: 'week_card', label: '一周体验卡' },
  { value: 'fragment_card', label: '人生片段卡' },
  { value: 'moment_card', label: '重要时刻卡' },
];

// 半径选项（公里）
const RADIUS_OPTIONS = [
  { value: 1, label: '1公里' },
  { value: 3, label: '3公里' },
  { value: 5, label: '5公里' },
  { value: 10, label: '10公里' },
  { value: 20, label: '20公里' },
  { value: 50, label: '50公里' },
];

// 热门标签
const HOT_TAGS = [
  '旅行', '美食', '运动', '音乐', '阅读', 
  '摄影', '电影', '游戏', '工作', '学习',
];

// 页面数据接口
interface PageData {
  // 搜索关键词
  keyword: string;
  // 搜索历史
  searchHistory: string[];
  // 搜索结果
  results: LifeCard[];
  // 是否正在加载
  loading: boolean;
  // 是否已搜索
  searched: boolean;
  // 是否有更多结果
  hasMore: boolean;
  // 当前页码
  page: number;
  // 搜索总数
  total: number;
  // 是否显示筛选面板
  showFilter: boolean;
  // 筛选条件
  filters: {
    cardType: CardType | '';
    interestTags: string[];
    nearbyEnabled: boolean;
    latitude: number | null;
    longitude: number | null;
    radiusKm: number;
  };
  // 卡片类型选项
  cardTypeOptions: typeof CARD_TYPE_OPTIONS;
  // 半径选项
  radiusOptions: typeof RADIUS_OPTIONS;
  // 热门标签
  hotTags: string[];
  // 位置名称
  locationName: string;
  // 是否正在获取位置
  gettingLocation: boolean;
}

Page({
  data: {
    keyword: '',
    searchHistory: [] as string[],
    results: [] as LifeCard[],
    loading: false,
    searched: false,
    hasMore: false,
    page: 1,
    total: 0,
    showFilter: false,
    filters: {
      cardType: '' as CardType | '',
      interestTags: [] as string[],
      nearbyEnabled: false,
      latitude: null as number | null,
      longitude: null as number | null,
      radiusKm: 5,
    },
    cardTypeOptions: CARD_TYPE_OPTIONS,
    cardTypeIndex: 0,
    cardTypeLabel: '全部类型',
    radiusOptions: RADIUS_OPTIONS,
    radiusIndex: 2,
    radiusLabel: '5公里',
    hotTags: HOT_TAGS,
    locationName: '',
    gettingLocation: false,
  } as PageData,

  // Store bindings
  storeBindings: null as any,

  onLoad() {
    // 绑定 card store
    this.storeBindings = createStoreBindings(this, {
      store: cardStore,
      fields: ['searchResults', 'searchLoading', 'searchHasMore', 'searchTotal'],
      actions: ['searchCards', 'loadMoreSearchResults', 'clearSearchResults'],
    });

    // 加载搜索历史
    this.loadSearchHistory();
  },

  onUnload() {
    // 清理 store bindings
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }
    // 清除搜索结果
    cardStore.clearSearchResults();
  },

  /**
   * 上拉加载更多
   * Requirements: 5.6 - 搜索结果分页
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  /**
   * 加载搜索历史
   * Requirements: 5.1 - 显示搜索历史
   */
  loadSearchHistory() {
    const historyItems = storage.getSearchHistory();
    const history = historyItems.map(item => item.keyword);
    this.setData({ searchHistory: history });
  },

  /**
   * 保存搜索历史
   * Requirements: 5.1 - 保存搜索历史
   */
  saveSearchHistory(keyword: string) {
    if (!keyword.trim()) return;
    
    storage.addSearchHistory(keyword, 10);
    this.loadSearchHistory();
  },

  /**
   * 输入关键词
   */
  onKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },

  /**
   * 清除关键词
   */
  onClearKeyword() {
    this.setData({ keyword: '' });
  },

  /**
   * 执行搜索
   * Requirements: 5.2 - 关键词搜索
   */
  async onSearch() {
    const keyword = this.data.keyword.trim();
    const { filters } = this.data;

    // 至少需要关键词或筛选条件
    if (!keyword && !filters.cardType && filters.interestTags.length === 0 && !filters.nearbyEnabled) {
      wx.showToast({ title: '请输入搜索关键词或选择筛选条件', icon: 'none' });
      return;
    }

    // 保存搜索历史
    if (keyword) {
      this.saveSearchHistory(keyword);
    }

    // 重置分页
    this.setData({ 
      page: 1, 
      results: [], 
      searched: true,
      loading: true,
    });

    await this.doSearch(true);
  },

  /**
   * 执行搜索请求
   * Requirements: 5.2, 5.3, 5.4, 5.5
   */
  async doSearch(reset = false) {
    const { keyword, filters, page } = this.data;

    this.setData({ loading: true });

    try {
      // 构建搜索查询
      const query: SearchQuery = {};

      // 关键词搜索
      // Requirements: 5.2
      if (keyword.trim()) {
        query.keyword = keyword.trim();
      }

      // 卡片类型筛选
      // Requirements: 5.3
      if (filters.cardType) {
        query.card_type = filters.cardType;
      }

      // 标签筛选
      // Requirements: 5.4
      if (filters.interestTags.length > 0) {
        query.interest_tags = filters.interestTags;
      }

      // 附近搜索
      // Requirements: 5.5
      if (filters.nearbyEnabled && filters.latitude !== null && filters.longitude !== null) {
        query.latitude = filters.latitude;
        query.longitude = filters.longitude;
        query.radius_km = filters.radiusKm;
      }

      // 调用搜索 API
      // Requirements: 5.6 - 分页
      const result: CardSearchResult = await cardService.searchCards(query, page, 20);

      if (reset) {
        this.setData({
          results: result.cards,
          total: result.total,
          hasMore: result.has_more,
        });
      } else {
        this.setData({
          results: [...this.data.results, ...result.cards],
          total: result.total,
          hasMore: result.has_more,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多结果
   * Requirements: 5.6 - 分页
   */
  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ page: this.data.page + 1 });
    await this.doSearch(false);
  },

  /**
   * 点击历史记录
   * Requirements: 5.1
   */
  onHistoryTap(e: WechatMiniprogram.TouchEvent) {
    const keyword = e.currentTarget.dataset.keyword as string;
    this.setData({ keyword });
    this.onSearch();
  },

  /**
   * 清空历史
   * Requirements: 5.1
   */
  onClearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          storage.clearSearchHistory();
          this.setData({ searchHistory: [] });
        }
      },
    });
  },

  /**
   * 删除单条历史
   */
  onDeleteHistoryItem(e: WechatMiniprogram.TouchEvent) {
    const keyword = e.currentTarget.dataset.keyword as string;
    const historyItems = storage.getSearchHistory();
    const filtered = historyItems.filter(item => item.keyword !== keyword);
    storage.set(StorageKeys.SEARCH_HISTORY, filtered);
    this.loadSearchHistory();
  },

  /**
   * 显示/隐藏筛选面板
   */
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter });
  },

  /**
   * 选择卡片类型
   * Requirements: 5.3
   */
  onCardTypeChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value);
    const cardType = CARD_TYPE_OPTIONS[index].value as CardType | '';
    const cardTypeLabel = CARD_TYPE_OPTIONS[index].label;
    this.setData({
      'filters.cardType': cardType,
      cardTypeIndex: index,
      cardTypeLabel,
    });
  },

  /**
   * 切换标签选择
   * Requirements: 5.4
   */
  onTagToggle(e: WechatMiniprogram.TouchEvent) {
    const tag = e.currentTarget.dataset.tag as string;
    const { interestTags } = this.data.filters;
    
    let newTags: string[];
    if (interestTags.includes(tag)) {
      newTags = interestTags.filter(t => t !== tag);
    } else {
      if (interestTags.length >= 5) {
        wx.showToast({ title: '最多选择5个标签', icon: 'none' });
        return;
      }
      newTags = [...interestTags, tag];
    }
    
    this.setData({
      'filters.interestTags': newTags,
    });
  },

  /**
   * 切换附近搜索
   * Requirements: 5.5
   */
  onNearbyToggle() {
    const { nearbyEnabled } = this.data.filters;
    
    if (!nearbyEnabled) {
      // 开启附近搜索，获取位置
      this.getLocation();
    } else {
      // 关闭附近搜索
      this.setData({
        'filters.nearbyEnabled': false,
        'filters.latitude': null,
        'filters.longitude': null,
        locationName: '',
      });
    }
  },

  /**
   * 获取当前位置
   * Requirements: 5.5
   */
  getLocation() {
    this.setData({ gettingLocation: true });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          'filters.nearbyEnabled': true,
          'filters.latitude': res.latitude,
          'filters.longitude': res.longitude,
          gettingLocation: false,
        });

        // 获取位置名称
        this.getLocationName(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.error('Get location failed:', err);
        this.setData({ gettingLocation: false });
        
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置权限',
            content: '需要位置权限才能使用附近搜索功能，是否前往设置？',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            },
          });
        } else {
          wx.showToast({ title: '获取位置失败', icon: 'none' });
        }
      },
    });
  },

  /**
   * 获取位置名称（逆地理编码）
   */
  getLocationName(latitude: number, longitude: number) {
    // 使用微信地图 API 获取位置名称
    // 简化处理：显示坐标
    this.setData({
      locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    });
  },

  /**
   * 选择位置
   * Requirements: 5.5
   */
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'filters.nearbyEnabled': true,
          'filters.latitude': res.latitude,
          'filters.longitude': res.longitude,
          locationName: res.name || res.address || `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`,
        });
      },
      fail: (err) => {
        console.error('Choose location failed:', err);
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置权限',
            content: '需要位置权限才能选择位置，是否前往设置？',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            },
          });
        }
      },
    });
  },

  /**
   * 选择搜索半径
   * Requirements: 5.5
   */
  onRadiusChange(e: WechatMiniprogram.PickerChange) {
    const index = Number(e.detail.value);
    const radius = RADIUS_OPTIONS[index].value;
    const radiusLabel = RADIUS_OPTIONS[index].label;
    this.setData({
      'filters.radiusKm': radius,
      radiusIndex: index,
      radiusLabel,
    });
  },

  /**
   * 重置筛选条件
   */
  onResetFilter() {
    this.setData({
      filters: {
        cardType: '',
        interestTags: [],
        nearbyEnabled: false,
        latitude: null,
        longitude: null,
        radiusKm: 5,
      },
      locationName: '',
      cardTypeIndex: 0,
      cardTypeLabel: '全部类型',
      radiusIndex: 2,
      radiusLabel: '5公里',
    });
  },

  /**
   * 应用筛选并搜索
   */
  onApplyFilter() {
    this.setData({ showFilter: false });
    this.onSearch();
  },

  /**
   * 获取当前选中的卡片类型索引
   */
  getCardTypeIndex(): number {
    const { cardType } = this.data.filters;
    return CARD_TYPE_OPTIONS.findIndex(opt => opt.value === cardType);
  },

  /**
   * 获取当前选中的半径索引
   */
  getRadiusIndex(): number {
    const { radiusKm } = this.data.filters;
    return RADIUS_OPTIONS.findIndex(opt => opt.value === radiusKm);
  },

  /**
   * 跳转到卡片详情
   */
  onCardTap(e: WechatMiniprogram.CustomEvent) {
    const { card } = e.detail;
    if (card && card.id) {
      wx.navigateTo({
        url: `/pages/card-detail/card-detail?id=${card.id}`,
      });
    }
  },

  /**
   * 跳转到用户主页
   */
  onCreatorTap(e: WechatMiniprogram.CustomEvent) {
    const { userId } = e.detail;
    if (userId) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?id=${userId}`,
      });
    }
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack();
  },
});
