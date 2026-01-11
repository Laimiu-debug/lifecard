// pages/my-cards/my-cards.ts
// 我的卡片页面
// Requirements: 8.1 - 实现创建/收藏 Tab 切换
// Requirements: 8.2, 8.3, 8.5 - 文件夹管理
// Requirements: 8.6, 8.7 - 时间线和分类视图

import { cardService } from '../../services/card';
import { formatDate } from '../../utils/format';
import { validator } from '../../utils/validator';
import type { LifeCard, CardFolder, CardType } from '../../types/card';

// 卡片类型标签映射
const cardTypeLabels: Record<string, string> = {
  day_card: '一天体验',
  week_card: '一周体验',
  fragment_card: '人生片段',
  moment_card: '重要时刻',
};

// 卡片类型图标映射
const cardTypeIcons: Record<string, string> = {
  day_card: '📅',
  week_card: '📆',
  fragment_card: '🎬',
  moment_card: '⭐',
};

// 视图模式类型
type ViewMode = 'list' | 'timeline' | 'category';

// 时间线分组项
interface TimelineGroup {
  date: string;
  dateLabel: string;
  cards: (LifeCard & { formattedDate: string; cardTypeLabel: string })[];
}

// 分类分组项
interface CategoryGroup {
  cardType: CardType;
  typeLabel: string;
  typeIcon: string;
  count: number;
  cards: (LifeCard & { formattedDate: string; cardTypeLabel: string })[];
}

/**
 * 按日期分组卡片（时间线视图）
 * Requirements: 8.6 - 实现按日期分组
 * @param cards 卡片列表
 * @returns 按日期分组的卡片列表
 */
export function groupCardsByDate(
  cards: (LifeCard & { formattedDate: string; cardTypeLabel: string })[]
): TimelineGroup[] {
  const groups: Map<string, TimelineGroup> = new Map();
  
  for (const card of cards) {
    const date = new Date(card.created_at);
    const dateKey = formatDateKey(date);
    const dateLabel = formatDateLabel(date);
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        dateLabel,
        cards: [],
      });
    }
    
    groups.get(dateKey)!.cards.push(card);
  }
  
  // 按日期降序排序
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    return b.date.localeCompare(a.date);
  });
  
  return sortedGroups;
}

/**
 * 按类型分组卡片（分类视图）
 * Requirements: 8.7 - 实现按类型分组
 * @param cards 卡片列表
 * @returns 按类型分组的卡片列表
 */
export function groupCardsByType(
  cards: (LifeCard & { formattedDate: string; cardTypeLabel: string })[]
): CategoryGroup[] {
  const groups: Map<CardType, CategoryGroup> = new Map();
  
  // 定义类型顺序
  const typeOrder: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];
  
  // 初始化所有类型分组
  for (const cardType of typeOrder) {
    groups.set(cardType, {
      cardType,
      typeLabel: cardTypeLabels[cardType] || cardType,
      typeIcon: cardTypeIcons[cardType] || '📄',
      count: 0,
      cards: [],
    });
  }
  
  // 将卡片分配到对应分组
  for (const card of cards) {
    const group = groups.get(card.card_type);
    if (group) {
      group.cards.push(card);
      group.count++;
    }
  }
  
  // 按预定义顺序返回，只返回有卡片的分组
  return typeOrder
    .map(type => groups.get(type)!)
    .filter(group => group.count > 0);
}

/**
 * 格式化日期键（用于分组）
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期标签（用于显示）
 */
function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const cardDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (cardDate.getTime() === today.getTime()) {
    return '今天';
  } else if (cardDate.getTime() === yesterday.getTime()) {
    return '昨天';
  } else if (cardDate.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

Page({
  data: {
    // Tab 状态
    activeTab: 'created' as 'created' | 'collected',
    
    // 视图模式
    // Requirements: 8.6, 8.7 - 时间线和分类视图
    viewMode: 'list' as ViewMode,
    
    // 卡片列表
    cards: [] as LifeCard[],
    
    // 时间线分组数据
    // Requirements: 8.6 - 按日期分组
    timelineGroups: [] as TimelineGroup[],
    
    // 分类分组数据
    // Requirements: 8.7 - 按类型分组
    categoryGroups: [] as CategoryGroup[],
    
    // 文件夹列表（收藏 Tab 使用）
    folders: [] as CardFolder[],
    
    // 当前选中的文件夹
    selectedFolderId: null as string | null,
    
    // 加载状态
    loading: false,
    refreshing: false,
    
    // 分页
    page: 1,
    pageSize: 20,
    hasMore: true,
    total: 0,
    
    // 统计
    createdCount: 0,
    collectedCount: 0,
    
    // 文件夹管理弹窗状态
    showFolderModal: false,
    folderModalType: 'create' as 'create' | 'rename',
    folderModalTitle: '新建文件夹',
    folderInputValue: '',
    folderInputError: '',
    editingFolderId: null as string | null,
    
    // 文件夹操作菜单
    showFolderActionSheet: false,
    actionFolderId: null as string | null,
    actionFolderName: '',
    
    // 卡片移动到文件夹
    // Requirements: 8.4
    showMoveToFolderSheet: false,
    movingCardId: null as string | null,
    movingCardTitle: '',
  },

  onLoad() {
    this.loadCards();
    this.loadFolders();
    this.loadStats();
  },

  onShow() {
    // 页面显示时刷新数据（可能有新创建或收藏的卡片）
    if (this.data.cards.length > 0) {
      this.refreshCards();
    }
  },

  onPullDownRefresh() {
    this.refreshCards();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreCards();
    }
  },

  /**
   * 切换 Tab
   * Requirements: 8.1 - 实现创建/收藏 Tab 切换
   */
  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as 'created' | 'collected';
    if (tab !== this.data.activeTab) {
      this.setData({
        activeTab: tab,
        cards: [],
        timelineGroups: [],
        categoryGroups: [],
        page: 1,
        hasMore: true,
        total: 0,
      });
      this.loadCards();
    }
  },

  /**
   * 切换视图模式
   * Requirements: 8.6, 8.7 - 时间线和分类视图
   */
  onViewModeChange(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as ViewMode;
    if (mode !== this.data.viewMode) {
      this.setData({ viewMode: mode });
      // 重新计算分组数据
      this.updateGroupedData();
    }
  },

  /**
   * 更新分组数据
   * Requirements: 8.6, 8.7 - 时间线和分类视图
   */
  updateGroupedData() {
    const { cards, viewMode } = this.data;
    
    // 格式化卡片数据
    const formattedCards = cards.map(card => ({
      ...card,
      formattedDate: formatDate(card.created_at, { relative: true }),
      cardTypeLabel: cardTypeLabels[card.card_type] || card.card_type,
    }));
    
    if (viewMode === 'timeline') {
      const timelineGroups = groupCardsByDate(formattedCards);
      this.setData({ timelineGroups });
    } else if (viewMode === 'category') {
      const categoryGroups = groupCardsByType(formattedCards);
      this.setData({ categoryGroups });
    }
  },

  /**
   * 刷新卡片列表
   */
  async refreshCards() {
    this.setData({ refreshing: true, page: 1, hasMore: true });
    
    try {
      await this.loadCards(true);
    } finally {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 加载更多卡片
   */
  async loadMoreCards() {
    const nextPage = this.data.page + 1;
    this.setData({ page: nextPage });
    await this.loadCards(false);
  },

  /**
   * 加载卡片列表
   * @param isRefresh 是否是刷新操作
   */
  async loadCards(isRefresh: boolean = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const { activeTab, page, pageSize } = this.data;
      
      // 根据当前 Tab 调用不同的 API
      const result = activeTab === 'created'
        ? await cardService.getMyCards(page, pageSize)
        : await cardService.getCollectedCards(page, pageSize);
      
      // 格式化卡片数据
      const formattedCards = result.items.map(card => ({
        ...card,
        formattedDate: formatDate(card.created_at, { relative: true }),
        cardTypeLabel: cardTypeLabels[card.card_type] || card.card_type,
      }));
      
      // 更新数据
      if (isRefresh || page === 1) {
        this.setData({
          cards: formattedCards,
          total: result.total,
          hasMore: result.has_more,
        });
      } else {
        this.setData({
          cards: [...this.data.cards, ...formattedCards],
          total: result.total,
          hasMore: result.has_more,
        });
      }
      
      // 更新分组数据
      // Requirements: 8.6, 8.7 - 时间线和分类视图
      this.updateGroupedData();
    } catch (error) {
      console.error('加载卡片失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载文件夹列表
   */
  async loadFolders() {
    try {
      const folders = await cardService.getFolders();
      this.setData({ folders });
    } catch (error) {
      console.error('加载文件夹失败:', error);
    }
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 并行加载创建和收藏的卡片数量
      const [createdResult, collectedResult] = await Promise.all([
        cardService.getMyCards(1, 1),
        cardService.getCollectedCards(1, 1),
      ]);
      
      this.setData({
        createdCount: createdResult.total,
        collectedCount: collectedResult.total,
      });
    } catch (error) {
      console.error('加载统计失败:', error);
    }
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

  /**
   * 跳转到创建卡片页面
   */
  onCreateCard() {
    wx.navigateTo({
      url: '/pages/create/create',
    });
  },

  /**
   * 跳转到发现页面（用于收藏为空时）
   */
  onGoDiscover() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },

  // ==================== 文件夹管理功能 ====================
  // Requirements: 8.2, 8.3, 8.5

  /**
   * 显示创建文件夹弹窗
   * Requirements: 8.2
   */
  onShowCreateFolder() {
    this.setData({
      showFolderModal: true,
      folderModalType: 'create',
      folderModalTitle: '新建文件夹',
      folderInputValue: '',
      folderInputError: '',
      editingFolderId: null,
    });
  },

  /**
   * 显示重命名文件夹弹窗
   * Requirements: 8.5
   */
  onShowRenameFolder(e: WechatMiniprogram.TouchEvent) {
    const folderId = e.currentTarget.dataset.id as string;
    const folder = this.data.folders.find(f => f.id === folderId);
    if (folder) {
      this.setData({
        showFolderModal: true,
        folderModalType: 'rename',
        folderModalTitle: '重命名文件夹',
        folderInputValue: folder.name,
        folderInputError: '',
        editingFolderId: folderId,
      });
    }
  },

  /**
   * 关闭文件夹弹窗
   */
  onCloseFolderModal() {
    this.setData({
      showFolderModal: false,
      folderInputValue: '',
      folderInputError: '',
      editingFolderId: null,
    });
  },

  /**
   * 文件夹名称输入
   */
  onFolderInputChange(e: WechatMiniprogram.Input) {
    const value = e.detail.value;
    this.setData({
      folderInputValue: value,
      folderInputError: '',
    });
  },

  /**
   * 显示文件夹操作菜单
   */
  onShowFolderActions(e: WechatMiniprogram.TouchEvent) {
    const folderId = e.currentTarget.dataset.id as string;
    const folder = this.data.folders.find(f => f.id === folderId);
    if (folder) {
      this.setData({
        showFolderActionSheet: true,
        actionFolderId: folderId,
        actionFolderName: folder.name,
      });
    }
  },

  /**
   * 关闭文件夹操作菜单
   */
  onCloseFolderActionSheet() {
    this.setData({
      showFolderActionSheet: false,
      actionFolderId: null,
      actionFolderName: '',
    });
  },

  /**
   * 处理文件夹操作菜单选择
   */
  onFolderActionSelect(e: WechatMiniprogram.TouchEvent) {
    const action = e.currentTarget.dataset.action as string;
    const { actionFolderId } = this.data;

    this.onCloseFolderActionSheet();

    if (action === 'rename' && actionFolderId) {
      // 显示重命名弹窗
      const folder = this.data.folders.find(f => f.id === actionFolderId);
      if (folder) {
        this.setData({
          showFolderModal: true,
          folderModalType: 'rename',
          folderModalTitle: '重命名文件夹',
          folderInputValue: folder.name,
          folderInputError: '',
          editingFolderId: actionFolderId,
        });
      }
    } else if (action === 'delete' && actionFolderId) {
      // 确认删除
      this.confirmDeleteFolder(actionFolderId);
    }
  },

  /**
   * 确认删除文件夹
   * Requirements: 8.5
   */
  confirmDeleteFolder(folderId: string) {
    const folder = this.data.folders.find(f => f.id === folderId);
    wx.showModal({
      title: '删除文件夹',
      content: `确定要删除文件夹"${folder?.name || ''}"吗？文件夹内的卡片将移至未分类。`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteFolder(folderId);
        }
      },
    });
  },

  /**
   * 删除文件夹
   * Requirements: 8.5
   */
  async deleteFolder(folderId: string) {
    try {
      wx.showLoading({ title: '删除中...' });
      await cardService.deleteFolder(folderId);
      wx.showToast({ title: '删除成功', icon: 'success' });
      
      // 如果当前选中的是被删除的文件夹，清除选中状态
      if (this.data.selectedFolderId === folderId) {
        this.setData({ selectedFolderId: null });
      }
      
      // 刷新文件夹列表和卡片列表
      await this.loadFolders();
      await this.refreshCards();
    } catch (error) {
      console.error('删除文件夹失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 选择文件夹查看
   */
  onSelectFolder(e: WechatMiniprogram.TouchEvent) {
    const folderId = e.currentTarget.dataset.id as string | null;
    
    // 如果点击的是当前选中的文件夹，取消选中
    if (this.data.selectedFolderId === folderId) {
      this.setData({
        selectedFolderId: null,
        cards: [],
        page: 1,
        hasMore: true,
      });
    } else {
      this.setData({
        selectedFolderId: folderId,
        cards: [],
        page: 1,
        hasMore: true,
      });
    }
    
    this.loadCards();
  },

  /**
   * 长按文件夹显示操作菜单
   */
  onFolderLongPress(e: WechatMiniprogram.TouchEvent) {
    const folderId = e.currentTarget.dataset.id as string;
    if (folderId) {
      this.onShowFolderActions(e);
    }
  },

  // ==================== 卡片移动到文件夹功能 ====================
  // Requirements: 8.4

  /**
   * 长按卡片显示移动到文件夹选项
   * Requirements: 8.4
   */
  onCardLongPress(e: WechatMiniprogram.TouchEvent) {
    // 只在收藏 Tab 下允许移动卡片到文件夹
    if (this.data.activeTab !== 'collected') {
      return;
    }

    const cardId = e.currentTarget.dataset.id as string;
    const card = this.data.cards.find(c => c.id === cardId);
    
    if (card) {
      // 震动反馈
      wx.vibrateShort({ type: 'medium' });
      
      this.setData({
        showMoveToFolderSheet: true,
        movingCardId: cardId,
        movingCardTitle: card.title,
      });
    }
  },

  /**
   * 关闭移动到文件夹选择面板
   * Requirements: 8.4
   */
  onCloseMoveToFolderSheet() {
    this.setData({
      showMoveToFolderSheet: false,
      movingCardId: null,
      movingCardTitle: '',
    });
  },

  /**
   * 选择目标文件夹并移动卡片
   * Requirements: 8.4
   */
  async onSelectTargetFolder(e: WechatMiniprogram.TouchEvent) {
    const folderId = e.currentTarget.dataset.id as string | null;
    const { movingCardId } = this.data;

    if (!movingCardId) {
      return;
    }

    try {
      wx.showLoading({ title: '移动中...' });
      
      // 调用 API 移动卡片到文件夹
      await cardService.moveToFolder(movingCardId, folderId || undefined);
      
      // 关闭面板
      this.onCloseMoveToFolderSheet();
      
      // 显示成功提示
      const targetFolderName = folderId 
        ? this.data.folders.find(f => f.id === folderId)?.name || '文件夹'
        : '未分类';
      wx.showToast({ 
        title: `已移动到${targetFolderName}`, 
        icon: 'success' 
      });
      
      // 刷新文件夹列表（更新卡片数量）
      await this.loadFolders();
      
      // 如果当前选中了某个文件夹，刷新卡片列表
      if (this.data.selectedFolderId !== null) {
        await this.refreshCards();
      }
    } catch (error) {
      console.error('移动卡片失败:', error);
      wx.showToast({ title: '移动失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 从移动面板创建新文件夹
   * Requirements: 8.4
   */
  onCreateFolderFromMoveSheet() {
    // 先关闭移动面板，保存当前要移动的卡片信息
    const { movingCardId, movingCardTitle } = this.data;
    
    this.setData({
      showMoveToFolderSheet: false,
      showFolderModal: true,
      folderModalType: 'create',
      folderModalTitle: '新建文件夹',
      folderInputValue: '',
      folderInputError: '',
      editingFolderId: null,
    });
    
    // 保存卡片信息以便创建文件夹后继续移动
    (this as any)._pendingMoveCardId = movingCardId;
    (this as any)._pendingMoveCardTitle = movingCardTitle;
  },

  /**
   * 确认创建或重命名文件夹（扩展版本，支持创建后移动卡片）
   * Requirements: 8.2, 8.3, 8.4, 8.5
   */
  async onConfirmFolderModal() {
    const { folderModalType, folderInputValue, editingFolderId } = this.data;
    
    // 验证文件夹名称
    const validationResult = validator.validateFolderName(folderInputValue);
    if (!validationResult.valid) {
      this.setData({
        folderInputError: validationResult.errors.name || '名称无效',
      });
      return;
    }

    try {
      wx.showLoading({ title: '处理中...' });

      let newFolder: CardFolder | null = null;

      if (folderModalType === 'create') {
        // 创建文件夹
        newFolder = await cardService.createFolder(folderInputValue.trim());
        wx.showToast({ title: '创建成功', icon: 'success' });
      } else if (folderModalType === 'rename' && editingFolderId) {
        // 重命名文件夹
        await cardService.renameFolder(editingFolderId, folderInputValue.trim());
        wx.showToast({ title: '重命名成功', icon: 'success' });
      }

      // 关闭弹窗并刷新文件夹列表
      this.onCloseFolderModal();
      await this.loadFolders();

      // 检查是否有待移动的卡片（从移动面板创建文件夹的情况）
      const pendingMoveCardId = (this as any)._pendingMoveCardId;
      
      if (pendingMoveCardId && newFolder) {
        // 清除待移动信息
        (this as any)._pendingMoveCardId = null;
        (this as any)._pendingMoveCardTitle = null;
        
        // 询问是否将卡片移动到新创建的文件夹
        wx.showModal({
          title: '移动卡片',
          content: `是否将卡片移动到新建的"${newFolder.name}"文件夹？`,
          success: async (res) => {
            if (res.confirm) {
              try {
                wx.showLoading({ title: '移动中...' });
                await cardService.moveToFolder(pendingMoveCardId, newFolder!.id);
                wx.showToast({ title: '移动成功', icon: 'success' });
                await this.loadFolders();
                if (this.data.selectedFolderId !== null) {
                  await this.refreshCards();
                }
              } catch (error) {
                console.error('移动卡片失败:', error);
                wx.showToast({ title: '移动失败', icon: 'none' });
              } finally {
                wx.hideLoading();
              }
            }
          },
        });
      }
    } catch (error) {
      console.error('文件夹操作失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
