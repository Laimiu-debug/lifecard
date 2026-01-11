/// <reference types="miniprogram-api-typings" />
/**
 * 分享工具
 * 提供微信分享相关功能
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import type { LifeCard, MediaItem } from '../types/card';

/**
 * 分享数据接口
 * 用于 onShareAppMessage 返回值
 */
export interface ShareData {
  /** 分享标题 */
  title: string;
  /** 分享路径（包含卡片 ID） */
  path: string;
  /** 分享图片 URL */
  imageUrl?: string;
}

/**
 * 朋友圈分享数据接口
 * 用于 onShareTimeline 返回值
 */
export interface ShareTimelineData {
  /** 分享标题 */
  title: string;
  /** 查询参数（包含卡片 ID） */
  query: string;
  /** 分享图片 URL */
  imageUrl?: string;
}

/**
 * 默认分享配置
 */
const DEFAULT_SHARE_CONFIG = {
  defaultTitle: 'Life Card - 分享人生体验',
  defaultImageUrl: '/assets/images/share-default.png',
  cardDetailPath: '/pages/card-detail/card-detail',
};

/**
 * 卡片类型标签映射
 */
const CARD_TYPE_LABELS: Record<string, string> = {
  'day_card': '一天体验卡',
  'week_card': '一周体验卡',
  'fragment_card': '人生片段卡',
  'moment_card': '重要时刻卡',
};

/**
 * 生成卡片分享数据
 * 用于微信好友分享
 * 
 * Requirements: 12.1, 12.2, 12.3
 * Property 19: Share Data Generation
 * 
 * @param card 卡片数据（可以是完整卡片或部分数据）
 * @param cardId 卡片 ID（如果 card 中没有 id）
 * @returns 分享数据
 */
export function generateShareData(
  card: Partial<LifeCard> | null | undefined,
  cardId?: string
): ShareData {
  // 获取卡片 ID
  const id = card?.id || cardId || '';
  
  // 生成分享标题
  const title = generateShareTitle(card);
  
  // 生成分享路径（包含卡片 ID 用于深度链接）
  const path = `${DEFAULT_SHARE_CONFIG.cardDetailPath}?id=${id}`;
  
  // 获取分享图片 URL
  const imageUrl = getShareImageUrl(card?.media);
  
  return {
    title,
    path,
    imageUrl,
  };
}

/**
 * 生成朋友圈分享数据
 * 
 * Requirements: 12.1, 12.2
 * 
 * @param card 卡片数据
 * @param cardId 卡片 ID
 * @returns 朋友圈分享数据
 */
export function generateShareTimelineData(
  card: Partial<LifeCard> | null | undefined,
  cardId?: string
): ShareTimelineData {
  const id = card?.id || cardId || '';
  const title = generateShareTitle(card);
  const imageUrl = getShareImageUrl(card?.media);
  
  return {
    title,
    query: `id=${id}`,
    imageUrl,
  };
}

/**
 * 生成分享标题
 * 
 * @param card 卡片数据
 * @returns 分享标题
 */
export function generateShareTitle(card: Partial<LifeCard> | null | undefined): string {
  if (!card) {
    return DEFAULT_SHARE_CONFIG.defaultTitle;
  }
  
  // 如果有标题，直接使用
  if (card.title && card.title.trim()) {
    // 可以添加卡片类型前缀
    const typeLabel = card.card_type ? CARD_TYPE_LABELS[card.card_type] : '';
    if (typeLabel) {
      return `【${typeLabel}】${card.title}`;
    }
    return card.title;
  }
  
  return DEFAULT_SHARE_CONFIG.defaultTitle;
}

/**
 * 获取分享图片 URL
 * 优先使用缩略图，其次使用原图
 * 
 * @param media 媒体列表
 * @returns 图片 URL 或 undefined
 */
export function getShareImageUrl(media: MediaItem[] | undefined): string | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }
  
  // 获取第一个媒体项
  const firstMedia = media[0];
  
  // 优先使用缩略图
  if (firstMedia.thumbnail_url) {
    return firstMedia.thumbnail_url;
  }
  
  // 如果是图片类型，使用原图
  if (firstMedia.media_type === 'image' && firstMedia.url) {
    return firstMedia.url;
  }
  
  // 视频类型但没有缩略图，返回 undefined
  return undefined;
}

/**
 * 验证分享数据是否完整
 * 用于测试验证
 * 
 * @param shareData 分享数据
 * @param cardId 期望的卡片 ID
 * @returns 验证结果
 */
export function validateShareData(
  shareData: ShareData,
  cardId: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 验证标题存在
  if (!shareData.title || shareData.title.trim() === '') {
    errors.push('分享标题不能为空');
  }
  
  // 验证路径包含卡片 ID
  if (!shareData.path || !shareData.path.includes(cardId)) {
    errors.push('分享路径必须包含卡片 ID');
  }
  
  // 验证路径格式
  if (!shareData.path.startsWith('/pages/card-detail/card-detail')) {
    errors.push('分享路径格式不正确');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 从分享路径中提取卡片 ID
 * 用于深度链接处理
 * 
 * Requirements: 12.5
 * 
 * @param path 分享路径或查询参数
 * @returns 卡片 ID 或 null
 */
export function extractCardIdFromSharePath(path: string): string | null {
  if (!path) {
    return null;
  }
  
  // 尝试从 path 参数中提取
  const idMatch = path.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  // 尝试从 query 格式中提取
  const queryMatch = path.match(/^id=([^&]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }
  
  return null;
}

/**
 * 深度链接处理结果
 * Requirements: 12.5
 */
export interface DeepLinkResult {
  /** 是否成功处理 */
  success: boolean;
  /** 目标页面路径 */
  targetPath?: string;
  /** 卡片 ID（如果是卡片链接） */
  cardId?: string;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 解析深度链接参数
 * 从小程序启动参数中解析目标页面和参数
 * 
 * Requirements: 12.5
 * Property 20: Deep Link Navigation
 * 
 * @param options 小程序启动参数（来自 onLaunch 或 onShow）
 * @returns 深度链接解析结果
 */
export function parseDeepLink(options: {
  path?: string;
  query?: Record<string, string>;
  scene?: number;
  referrerInfo?: { appId?: string; extraData?: Record<string, any> };
}): DeepLinkResult {
  // 如果没有参数，返回失败
  if (!options) {
    return { success: false, errorMessage: '无启动参数' };
  }

  // 尝试从 query 中获取卡片 ID
  const cardId = options.query?.id || options.query?.cardId;
  
  if (cardId) {
    return {
      success: true,
      targetPath: `/pages/card-detail/card-detail?id=${cardId}`,
      cardId,
    };
  }

  // 尝试从 path 中提取卡片 ID
  if (options.path) {
    const extractedCardId = extractCardIdFromSharePath(options.path);
    if (extractedCardId) {
      return {
        success: true,
        targetPath: `/pages/card-detail/card-detail?id=${extractedCardId}`,
        cardId: extractedCardId,
      };
    }
  }

  // 没有找到有效的深度链接参数
  return { success: false, errorMessage: '无有效的深度链接参数' };
}

/**
 * 处理深度链接导航
 * 根据解析结果导航到目标页面
 * 
 * Requirements: 12.5
 * Property 20: Deep Link Navigation
 * 
 * @param deepLinkResult 深度链接解析结果
 * @param onCardNotFound 卡片不存在时的回调（可选）
 * @returns Promise<boolean> 是否成功导航
 */
export async function handleDeepLinkNavigation(
  deepLinkResult: DeepLinkResult,
  onCardNotFound?: () => void
): Promise<boolean> {
  if (!deepLinkResult.success || !deepLinkResult.targetPath) {
    return false;
  }

  try {
    // 导航到目标页面
    await navigateToPage(deepLinkResult.targetPath);
    return true;
  } catch (error: any) {
    console.error('Deep link navigation failed:', error);
    
    // 如果导航失败，可能是卡片不存在
    if (onCardNotFound) {
      onCardNotFound();
    }
    
    return false;
  }
}

/**
 * 导航到指定页面
 * 封装 wx.navigateTo，处理各种导航场景
 * 
 * @param path 目标页面路径
 * @returns Promise<void>
 */
export function navigateToPage(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否是 tabBar 页面
    const tabBarPages = [
      '/pages/index/index',
      '/pages/discover/discover',
      '/pages/create/create',
      '/pages/my-cards/my-cards',
      '/pages/profile/profile',
    ];

    const isTabBarPage = tabBarPages.some(tabPath => path.startsWith(tabPath));

    if (isTabBarPage) {
      // tabBar 页面使用 switchTab
      wx.switchTab({
        url: path.split('?')[0], // switchTab 不支持参数
        success: () => resolve(),
        fail: (err) => reject(err),
      });
    } else {
      // 普通页面使用 navigateTo
      wx.navigateTo({
        url: path,
        success: () => resolve(),
        fail: () => {
          // 如果 navigateTo 失败，尝试 redirectTo
          wx.redirectTo({
            url: path,
            success: () => resolve(),
            fail: (redirectErr) => reject(redirectErr),
          });
        },
      });
    }
  });
}

/**
 * 验证卡片是否存在
 * 用于深度链接导航前的验证
 * 
 * Requirements: 12.5
 * 
 * @param cardId 卡片 ID
 * @param cardService 卡片服务（用于验证）
 * @returns Promise<boolean> 卡片是否存在
 */
export async function validateCardExists(
  cardId: string,
  cardService: { getCard: (id: string) => Promise<any> }
): Promise<boolean> {
  if (!cardId) {
    return false;
  }

  try {
    await cardService.getCard(cardId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 显示卡片不存在的错误提示并导航到首页
 * 
 * Requirements: 12.5
 */
export function showCardNotFoundAndNavigateHome(): void {
  wx.showToast({
    title: '卡片不存在或已删除',
    icon: 'none',
    duration: 2000,
  });

  // 延迟后导航到首页
  setTimeout(() => {
    wx.switchTab({
      url: '/pages/index/index',
    });
  }, 1500);
}

/**
 * 海报配置接口
 * Requirements: 12.4
 */
export interface PosterConfig {
  /** 海报宽度 (px) */
  width: number;
  /** 海报高度 (px) */
  height: number;
  /** 背景颜色 */
  backgroundColor: string;
  /** 内边距 */
  padding: number;
  /** 圆角半径 */
  borderRadius: number;
}

/**
 * 海报数据接口
 * Requirements: 12.4
 */
export interface PosterData {
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description: string;
  /** 卡片类型标签 */
  cardTypeLabel: string;
  /** 卡片类型颜色 */
  cardTypeColor: string;
  /** 卡片图片 URL */
  imageUrl?: string;
  /** 创建者昵称 */
  creatorName: string;
  /** 创建者头像 URL */
  creatorAvatar?: string;
  /** 小程序码图片路径（本地临时路径） */
  qrCodePath?: string;
  /** 点赞数 */
  likeCount: number;
  /** 评论数 */
  commentCount: number;
}

/**
 * 海报生成结果
 * Requirements: 12.4
 */
export interface PosterResult {
  /** 是否成功 */
  success: boolean;
  /** 海报图片临时路径 */
  tempFilePath?: string;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * 默认海报配置
 */
const DEFAULT_POSTER_CONFIG: PosterConfig = {
  width: 750,
  height: 1200,
  backgroundColor: '#ffffff',
  padding: 40,
  borderRadius: 24,
};

/**
 * 准备海报数据
 * 从卡片数据中提取生成海报所需的信息
 * 
 * Requirements: 12.4
 * 
 * @param card 卡片数据
 * @returns 海报数据
 */
export function preparePosterData(card: Partial<LifeCard> | null | undefined): PosterData {
  const cardTypeLabels: Record<string, string> = {
    'day_card': '一天体验卡',
    'week_card': '一周体验卡',
    'fragment_card': '人生片段卡',
    'moment_card': '重要时刻卡',
  };
  
  const cardTypeColors: Record<string, string> = {
    'day_card': '#1890ff',
    'week_card': '#52c41a',
    'fragment_card': '#faad14',
    'moment_card': '#eb2f96',
  };
  
  const cardType = card?.card_type || 'day_card';
  
  return {
    title: card?.title || 'Life Card',
    description: card?.description || '',
    cardTypeLabel: cardTypeLabels[cardType] || '体验卡',
    cardTypeColor: cardTypeColors[cardType] || '#1890ff',
    imageUrl: getShareImageUrl(card?.media),
    creatorName: card?.creator?.nickname || '未知用户',
    creatorAvatar: card?.creator?.avatar_url,
    likeCount: card?.like_count || 0,
    commentCount: card?.comment_count || 0,
  };
}

/**
 * 绘制圆角矩形
 * 
 * @param ctx Canvas 上下文
 * @param x 左上角 x 坐标
 * @param y 左上角 y 坐标
 * @param width 宽度
 * @param height 高度
 * @param radius 圆角半径
 */
export function drawRoundRect(
  ctx: WechatMiniprogram.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * 绘制圆形图片（用于头像）
 * 
 * @param ctx Canvas 上下文
 * @param imagePath 图片路径
 * @param x 圆心 x 坐标
 * @param y 圆心 y 坐标
 * @param radius 半径
 */
export function drawCircleImage(
  ctx: WechatMiniprogram.CanvasContext,
  imagePath: string,
  x: number,
  y: number,
  radius: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.clip();
  ctx.drawImage(imagePath, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * 绘制多行文本
 * 
 * @param ctx Canvas 上下文
 * @param text 文本内容
 * @param x 起始 x 坐标
 * @param y 起始 y 坐标
 * @param maxWidth 最大宽度
 * @param lineHeight 行高
 * @param maxLines 最大行数
 * @returns 实际绘制的高度
 */
export function drawMultilineText(
  ctx: WechatMiniprogram.CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
): number {
  if (!text) return 0;
  
  const chars = text.split('');
  let line = '';
  let lineCount = 0;
  let currentY = y;
  
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && line.length > 0) {
      // 检查是否达到最大行数
      if (lineCount >= maxLines - 1) {
        // 最后一行，添加省略号
        let truncatedLine = line;
        while (ctx.measureText(truncatedLine + '...').width > maxWidth && truncatedLine.length > 0) {
          truncatedLine = truncatedLine.slice(0, -1);
        }
        ctx.fillText(truncatedLine + '...', x, currentY);
        lineCount++;
        break;
      }
      
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  
  // 绘制最后一行
  if (line.length > 0 && lineCount < maxLines) {
    ctx.fillText(line, x, currentY);
    lineCount++;
  }
  
  return lineCount * lineHeight;
}

/**
 * 下载图片到本地临时路径
 * 
 * @param url 图片 URL
 * @returns 本地临时路径
 */
export function downloadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('图片 URL 为空'));
      return;
    }
    
    // 如果已经是本地路径，直接返回
    if (url.startsWith('wxfile://') || url.startsWith('/')) {
      resolve(url);
      return;
    }
    
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error(`下载图片失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(new Error(`下载图片失败: ${err.errMsg}`));
      },
    });
  });
}

/**
 * 生成分享海报
 * 使用 Canvas 绘制海报图片
 * 
 * Requirements: 12.4
 * 
 * @param canvasId Canvas ID
 * @param posterData 海报数据
 * @param config 海报配置（可选）
 * @param componentInstance 组件实例（用于组件内的 canvas）
 * @returns 海报生成结果
 */
export async function generatePoster(
  canvasId: string,
  posterData: PosterData,
  config: Partial<PosterConfig> = {},
  componentInstance?: WechatMiniprogram.Component.TrivialInstance
): Promise<PosterResult> {
  const finalConfig = { ...DEFAULT_POSTER_CONFIG, ...config };
  const { width, height, backgroundColor, padding, borderRadius } = finalConfig;
  
  try {
    // 获取 Canvas 上下文
    const ctx = wx.createCanvasContext(canvasId, componentInstance);
    
    // 1. 绘制背景
    ctx.setFillStyle(backgroundColor);
    drawRoundRect(ctx, 0, 0, width, height, borderRadius);
    ctx.fill();
    
    // 2. 绘制卡片图片区域
    const imageAreaHeight = 400;
    let cardImagePath: string | null = null;
    
    if (posterData.imageUrl) {
      try {
        cardImagePath = await downloadImage(posterData.imageUrl);
      } catch (e) {
        console.log('下载卡片图片失败，使用占位背景');
      }
    }
    
    if (cardImagePath) {
      // 绘制圆角图片
      ctx.save();
      drawRoundRect(ctx, padding, padding, width - padding * 2, imageAreaHeight, borderRadius);
      ctx.clip();
      ctx.drawImage(cardImagePath, padding, padding, width - padding * 2, imageAreaHeight);
      ctx.restore();
    } else {
      // 绘制占位背景
      ctx.setFillStyle('#f5f5f5');
      drawRoundRect(ctx, padding, padding, width - padding * 2, imageAreaHeight, borderRadius);
      ctx.fill();
      
      // 绘制占位图标
      ctx.setFillStyle('#cccccc');
      ctx.setFontSize(60);
      ctx.setTextAlign('center');
      ctx.fillText('📷', width / 2, padding + imageAreaHeight / 2 + 20);
    }
    
    // 3. 绘制卡片类型标签
    const tagY = padding + imageAreaHeight + 30;
    const tagPadding = 16;
    const tagHeight = 44;
    
    ctx.setFontSize(24);
    const tagWidth = ctx.measureText(posterData.cardTypeLabel).width + tagPadding * 2;
    
    // 标签背景
    ctx.setFillStyle(posterData.cardTypeColor + '20');
    drawRoundRect(ctx, padding, tagY, tagWidth, tagHeight, 8);
    ctx.fill();
    
    // 标签文字
    ctx.setFillStyle(posterData.cardTypeColor);
    ctx.setTextAlign('left');
    ctx.fillText(posterData.cardTypeLabel, padding + tagPadding, tagY + 30);
    
    // 4. 绘制标题
    const titleY = tagY + tagHeight + 24;
    ctx.setFillStyle('#1a1a1a');
    ctx.setFontSize(36);
    ctx.setTextAlign('left');
    
    const titleHeight = drawMultilineText(
      ctx,
      posterData.title,
      padding,
      titleY,
      width - padding * 2,
      48,
      2
    );
    
    // 5. 绘制描述
    const descY = titleY + titleHeight + 16;
    ctx.setFillStyle('#666666');
    ctx.setFontSize(28);
    
    const descHeight = drawMultilineText(
      ctx,
      posterData.description,
      padding,
      descY,
      width - padding * 2,
      40,
      3
    );
    
    // 6. 绘制分割线
    const dividerY = descY + descHeight + 30;
    ctx.setStrokeStyle('#f0f0f0');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(padding, dividerY);
    ctx.lineTo(width - padding, dividerY);
    ctx.stroke();
    
    // 7. 绘制创建者信息
    const creatorY = dividerY + 30;
    const avatarRadius = 30;
    
    // 绘制头像
    if (posterData.creatorAvatar) {
      try {
        const avatarPath = await downloadImage(posterData.creatorAvatar);
        drawCircleImage(ctx, avatarPath, padding + avatarRadius, creatorY + avatarRadius, avatarRadius);
      } catch (e) {
        // 绘制默认头像
        ctx.setFillStyle('#e8e8e8');
        ctx.beginPath();
        ctx.arc(padding + avatarRadius, creatorY + avatarRadius, avatarRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.setFillStyle('#999999');
        ctx.setFontSize(30);
        ctx.setTextAlign('center');
        ctx.fillText('👤', padding + avatarRadius, creatorY + avatarRadius + 10);
      }
    } else {
      // 绘制默认头像
      ctx.setFillStyle('#e8e8e8');
      ctx.beginPath();
      ctx.arc(padding + avatarRadius, creatorY + avatarRadius, avatarRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.setFillStyle('#999999');
      ctx.setFontSize(30);
      ctx.setTextAlign('center');
      ctx.fillText('👤', padding + avatarRadius, creatorY + avatarRadius + 10);
    }
    
    // 绘制创建者昵称
    ctx.setFillStyle('#333333');
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    ctx.fillText(posterData.creatorName, padding + avatarRadius * 2 + 16, creatorY + avatarRadius + 10);
    
    // 8. 绘制互动数据
    const statsY = creatorY + avatarRadius * 2 + 30;
    ctx.setFillStyle('#999999');
    ctx.setFontSize(24);
    ctx.setTextAlign('left');
    ctx.fillText(`❤️ ${posterData.likeCount}  💬 ${posterData.commentCount}`, padding, statsY);
    
    // 9. 绘制底部区域（小程序信息）
    const footerY = height - 140;
    
    // 分割线
    ctx.setStrokeStyle('#f0f0f0');
    ctx.beginPath();
    ctx.moveTo(padding, footerY);
    ctx.lineTo(width - padding, footerY);
    ctx.stroke();
    
    // 小程序名称和提示
    ctx.setFillStyle('#1a1a1a');
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    ctx.fillText('Life Card', padding, footerY + 50);
    
    ctx.setFillStyle('#999999');
    ctx.setFontSize(22);
    ctx.fillText('长按识别小程序码查看详情', padding, footerY + 85);
    
    // 绘制小程序码占位（实际小程序码需要通过后端获取）
    const qrSize = 100;
    const qrX = width - padding - qrSize;
    const qrY = footerY + 20;
    
    if (posterData.qrCodePath) {
      try {
        ctx.drawImage(posterData.qrCodePath, qrX, qrY, qrSize, qrSize);
      } catch (e) {
        // 绘制占位
        ctx.setFillStyle('#f5f5f5');
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.setFillStyle('#cccccc');
        ctx.setFontSize(20);
        ctx.setTextAlign('center');
        ctx.fillText('小程序码', qrX + qrSize / 2, qrY + qrSize / 2 + 8);
      }
    } else {
      // 绘制占位
      ctx.setFillStyle('#f5f5f5');
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.setFillStyle('#cccccc');
      ctx.setFontSize(20);
      ctx.setTextAlign('center');
      ctx.fillText('小程序码', qrX + qrSize / 2, qrY + qrSize / 2 + 8);
    }
    
    // 10. 绘制完成，导出图片
    return new Promise((resolve) => {
      ctx.draw(false, () => {
        // 延迟一下确保绘制完成
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width,
            height,
            destWidth: width * 2, // 2倍图提高清晰度
            destHeight: height * 2,
            fileType: 'png',
            quality: 1,
            success: (res) => {
              resolve({
                success: true,
                tempFilePath: res.tempFilePath,
              });
            },
            fail: (err) => {
              resolve({
                success: false,
                errorMessage: `导出图片失败: ${err.errMsg}`,
              });
            },
          }, componentInstance);
        }, 300);
      });
    });
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error?.message || '生成海报失败',
    };
  }
}

/**
 * 保存海报到相册
 * 
 * Requirements: 12.4
 * 
 * @param tempFilePath 海报临时文件路径
 * @returns 是否保存成功
 */
export async function savePosterToAlbum(tempFilePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        resolve(true);
      },
      fail: (err) => {
        // 检查是否是权限问题
        if (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize')) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            confirmText: '去授权',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      // 重新尝试保存
                      wx.saveImageToPhotosAlbum({
                        filePath: tempFilePath,
                        success: () => resolve(true),
                        fail: () => resolve(false),
                      });
                    } else {
                      resolve(false);
                    }
                  },
                  fail: () => resolve(false),
                });
              } else {
                resolve(false);
              }
            },
          });
        } else {
          resolve(false);
        }
      },
    });
  });
}
