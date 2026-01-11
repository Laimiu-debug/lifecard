/**
 * 评论列表组件
 * 支持加载更多和发表评论
 * Requirements: 6.4
 */

import { formatRelativeTime } from '../../utils/format';
import { validator, ValidationLimits } from '../../utils/validator';
import { cardService } from '../../services/card';
import type { Comment } from '../../types/card';

// 声明 console 对象 (微信小程序环境)
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// 默认头像
const DEFAULT_AVATAR = '/assets/images/default-avatar.png';

// 每页评论数量
const PAGE_SIZE = 20;

Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    /** 卡片 ID */
    cardId: {
      type: String,
      value: '',
    },
    /** 当前用户 ID（用于判断是否可删除） */
    currentUserId: {
      type: String,
      value: '',
    },
    /** 是否显示输入框 */
    showInput: {
      type: Boolean,
      value: true,
    },
    /** 输入框占位符 */
    placeholder: {
      type: String,
      value: '写下你的评论...',
    },
  },

  data: {
    // 评论列表
    comments: [] as Comment[],
    // 格式化后的评论数据
    formattedComments: [] as Array<{
      id: string;
      userId: string;
      avatarUrl: string;
      nickname: string;
      content: string;
      timeText: string;
      canDelete: boolean;
    }>,
    // 分页状态
    page: 1,
    hasMore: true,
    total: 0,
    // 加载状态
    loading: false,
    loadingMore: false,
    // 输入状态
    inputValue: '',
    inputFocus: false,
    submitting: false,
    // 错误信息
    errorMessage: '',
    // 最大评论长度
    maxLength: ValidationLimits.COMMENT_MAX_LENGTH,
  },

  observers: {
    'cardId': function(cardId: string) {
      if (cardId) {
        this.loadComments(true);
      }
    },
    'comments, currentUserId': function() {
      this.formatComments();
    },
  },

  lifetimes: {
    attached() {
      if (this.data.cardId) {
        this.loadComments(true);
      }
    },
  },


  methods: {
    /**
     * 加载评论列表
     * @param refresh 是否刷新（从第一页开始）
     */
    async loadComments(refresh: boolean = false) {
      const { cardId, loading, loadingMore, hasMore } = this.data;
      
      if (!cardId) return;
      if (loading || loadingMore) return;
      if (!refresh && !hasMore) return;

      const page = refresh ? 1 : this.data.page;
      
      this.setData({
        [refresh ? 'loading' : 'loadingMore']: true,
        errorMessage: '',
      });

      try {
        const result = await cardService.getComments(cardId, page, PAGE_SIZE);
        
        const newComments = refresh 
          ? result.comments 
          : [...this.data.comments, ...result.comments];

        this.setData({
          comments: newComments,
          page: page + 1,
          hasMore: result.has_more,
          total: result.total,
          loading: false,
          loadingMore: false,
        });

        // 触发加载完成事件
        this.triggerEvent('load', {
          comments: newComments,
          total: result.total,
          hasMore: result.has_more,
        });
      } catch (error) {
        console.error('Load comments failed:', error);
        this.setData({
          loading: false,
          loadingMore: false,
          errorMessage: '加载评论失败，请重试',
        });
        
        this.triggerEvent('error', { error });
      }
    },

    /**
     * 加载更多评论
     */
    loadMore() {
      if (this.data.hasMore && !this.data.loadingMore) {
        this.loadComments(false);
      }
    },

    /**
     * 刷新评论列表
     */
    refresh() {
      this.loadComments(true);
    },

    /**
     * 格式化评论数据用于显示
     */
    formatComments() {
      const { comments, currentUserId } = this.data;
      
      // 防御性检查
      if (!comments || !Array.isArray(comments)) {
        this.setData({ formattedComments: [] });
        return;
      }
      
      const formattedComments = comments.map(comment => {
        const user = comment.user;
        return {
          id: comment.id,
          userId: comment.user_id,
          avatarUrl: user?.avatar_url || DEFAULT_AVATAR,
          nickname: user?.nickname || '未知用户',
          content: comment.content,
          timeText: comment.created_at 
            ? formatRelativeTime(new Date(comment.created_at))
            : '',
          canDelete: comment.user_id === currentUserId,
        };
      });

      this.setData({ formattedComments });
    },

    /**
     * 输入框内容变化
     */
    onInputChange(e: WechatMiniprogram.Input) {
      this.setData({
        inputValue: e.detail.value,
        errorMessage: '',
      });
    },

    /**
     * 输入框获得焦点
     */
    onInputFocus() {
      this.setData({ inputFocus: true });
      this.triggerEvent('focus');
    },

    /**
     * 输入框失去焦点
     */
    onInputBlur() {
      this.setData({ inputFocus: false });
      this.triggerEvent('blur');
    },

    /**
     * 提交评论
     */
    async submitComment() {
      const { cardId, inputValue, submitting } = this.data;
      
      if (submitting) return;
      
      // 验证评论内容
      const validation = validator.validateComment(inputValue);
      if (!validation.valid) {
        this.setData({
          errorMessage: validation.errors.content || '评论内容无效',
        });
        return;
      }

      this.setData({ submitting: true, errorMessage: '' });

      try {
        const newComment = await cardService.addComment(cardId, inputValue.trim());
        
        // 将新评论添加到列表顶部
        const comments = [newComment, ...this.data.comments];
        
        this.setData({
          comments,
          inputValue: '',
          submitting: false,
          total: this.data.total + 1,
        });

        // 触发评论成功事件
        this.triggerEvent('submit', { comment: newComment });
        
        // 显示成功提示
        wx.showToast({
          title: '评论成功',
          icon: 'success',
          duration: 1500,
        });
      } catch (error) {
        console.error('Submit comment failed:', error);
        this.setData({
          submitting: false,
          errorMessage: '发表评论失败，请重试',
        });
        
        this.triggerEvent('error', { error });
      }
    },

    /**
     * 删除评论
     */
    async deleteComment(e: WechatMiniprogram.TouchEvent) {
      const { commentId } = e.currentTarget.dataset;
      if (!commentId) return;

      // 确认删除
      const result = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '删除评论',
          content: '确定要删除这条评论吗？',
          success: (res) => resolve(res.confirm),
          fail: () => resolve(false),
        });
      });

      if (!result) return;

      try {
        await cardService.deleteComment(commentId);
        
        // 从列表中移除
        const comments = this.data.comments.filter(c => c.id !== commentId);
        
        this.setData({
          comments,
          total: Math.max(0, this.data.total - 1),
        });

        // 触发删除成功事件
        this.triggerEvent('delete', { commentId });
        
        wx.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 1500,
        });
      } catch (error) {
        console.error('Delete comment failed:', error);
        wx.showToast({
          title: '删除失败',
          icon: 'none',
          duration: 1500,
        });
        
        this.triggerEvent('error', { error });
      }
    },

    /**
     * 点击用户头像/昵称
     */
    onTapUser(e: WechatMiniprogram.TouchEvent) {
      const { userId } = e.currentTarget.dataset;
      if (userId) {
        this.triggerEvent('tapuser', { userId });
      }
    },

    /**
     * 重试加载
     */
    onRetry() {
      this.loadComments(true);
    },

    /**
     * 头像加载失败
     */
    onAvatarError(e: WechatMiniprogram.TouchEvent) {
      const { index } = e.currentTarget.dataset;
      if (index !== undefined) {
        const key = `formattedComments[${index}].avatarUrl`;
        this.setData({
          [key]: DEFAULT_AVATAR,
        });
      }
    },
  },
});
