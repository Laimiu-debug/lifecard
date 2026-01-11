/**
 * 验证器工具
 * 提供表单和数据验证功能
 */

// 卡片类型
export type CardType = 'day_card' | 'week_card' | 'fragment_card' | 'moment_card';

// 隐私级别
export type PrivacyLevel = 'public' | 'friends_only' | 'exchange_only';

// 媒体项
export interface MediaItem {
  id: string;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

// 位置信息
export interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

// 卡片创建数据
export interface CardCreateData {
  card_type?: CardType;
  title?: string;
  description?: string;
  media?: MediaItem[];
  location?: Location;
  emotion_tags?: string[];
  interest_tags?: string[];
  privacy_level?: PrivacyLevel;
}

// 资料更新数据
export interface ProfileUpdateData {
  nickname?: string;
  bio?: string;
  age_range?: string;
  location?: string;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// 验证常量
export const ValidationLimits = {
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 5000,
  BIO_MAX_LENGTH: 500,
  COMMENT_MAX_LENGTH: 500,
  FOLDER_NAME_MAX_LENGTH: 50,
  NICKNAME_MAX_LENGTH: 50,
  MAX_MEDIA_COUNT: 9,
  MAX_EMOTION_TAGS: 10,
  MAX_INTEREST_TAGS: 10,
} as const;


/**
 * 验证器类
 */
export class Validator {
  /**
   * 验证卡片创建数据
   * Requirements: 3.2, 3.3, 3.4, 3.6, 3.8
   */
  validateCardCreate(data: CardCreateData): ValidationResult {
    const errors: Record<string, string> = {};

    // 验证卡片类型 (Requirement 3.2)
    if (!data.card_type) {
      errors.card_type = '请选择卡片类型';
    }

    // 验证标题 (Requirement 3.3)
    if (!data.title?.trim()) {
      errors.title = '请输入标题';
    } else if (data.title.length > ValidationLimits.TITLE_MAX_LENGTH) {
      errors.title = `标题不能超过${ValidationLimits.TITLE_MAX_LENGTH}字`;
    }

    // 验证描述 (Requirement 3.3)
    if (!data.description?.trim()) {
      errors.description = '请输入描述';
    } else if (data.description.length > ValidationLimits.DESCRIPTION_MAX_LENGTH) {
      errors.description = `描述不能超过${ValidationLimits.DESCRIPTION_MAX_LENGTH}字`;
    }

    // 验证媒体数量 (Requirement 3.4)
    if (data.media) {
      const videoCount = data.media.filter(m => m.media_type === 'video').length;
      const imageCount = data.media.filter(m => m.media_type === 'image').length;
      
      if (videoCount > 1) {
        errors.media = '最多上传1个视频';
      } else if (imageCount > ValidationLimits.MAX_MEDIA_COUNT) {
        errors.media = `最多上传${ValidationLimits.MAX_MEDIA_COUNT}张图片`;
      } else if (videoCount > 0 && imageCount > 0) {
        errors.media = '视频和图片不能同时上传';
      }
    }

    // 验证情绪标签数量 (Requirement 3.6)
    if (data.emotion_tags && data.emotion_tags.length > ValidationLimits.MAX_EMOTION_TAGS) {
      errors.emotion_tags = `最多添加${ValidationLimits.MAX_EMOTION_TAGS}个情绪标签`;
    }

    // 验证兴趣标签数量 (Requirement 3.6)
    if (data.interest_tags && data.interest_tags.length > ValidationLimits.MAX_INTEREST_TAGS) {
      errors.interest_tags = `最多添加${ValidationLimits.MAX_INTEREST_TAGS}个兴趣标签`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 验证评论内容
   * Requirements: 6.5
   */
  validateComment(content: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!content?.trim()) {
      errors.content = '请输入评论内容';
    } else if (content.length > ValidationLimits.COMMENT_MAX_LENGTH) {
      errors.content = `评论不能超过${ValidationLimits.COMMENT_MAX_LENGTH}字`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 验证文件夹名称
   * Requirements: 8.3
   */
  validateFolderName(name: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!name?.trim()) {
      errors.name = '请输入文件夹名称';
    } else if (name.length > ValidationLimits.FOLDER_NAME_MAX_LENGTH) {
      errors.name = `名称不能超过${ValidationLimits.FOLDER_NAME_MAX_LENGTH}字`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }


  /**
   * 验证用户资料更新
   * Requirements: 2.3, 2.5
   */
  validateProfileUpdate(data: ProfileUpdateData): ValidationResult {
    const errors: Record<string, string> = {};

    // 验证昵称
    if (data.nickname !== undefined) {
      if (!data.nickname?.trim()) {
        errors.nickname = '请输入昵称';
      } else if (data.nickname.length > ValidationLimits.NICKNAME_MAX_LENGTH) {
        errors.nickname = `昵称不能超过${ValidationLimits.NICKNAME_MAX_LENGTH}字`;
      }
    }

    // 验证简介
    if (data.bio !== undefined && data.bio.length > ValidationLimits.BIO_MAX_LENGTH) {
      errors.bio = `简介不能超过${ValidationLimits.BIO_MAX_LENGTH}字`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 验证交换余额
   * Requirements: 7.2
   */
  validateExchangeBalance(userBalance: number, exchangePrice: number): ValidationResult {
    const errors: Record<string, string> = {};

    if (userBalance < exchangePrice) {
      errors.balance = `余额不足，需要 ${exchangePrice} 金币，当前余额 ${userBalance} 金币`;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 验证是否为空字符串或仅包含空白字符
   */
  isEmpty(value: string | undefined | null): boolean {
    return !value || !value.trim();
  }

  /**
   * 验证字符串长度
   */
  isWithinLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength;
  }
}

/**
 * 搜索查询数据
 */
export interface SearchQuery {
  keyword?: string;
  card_type?: CardType | '';
  interest_tags?: string[];
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}

/**
 * 搜索筛选验证结果
 */
export interface SearchFilterValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  /** 是否有任何筛选条件 */
  hasFilters: boolean;
  /** 应用的筛选条件数量 */
  filterCount: number;
}

// 搜索验证常量
export const SearchLimits = {
  KEYWORD_MAX_LENGTH: 100,
  MAX_INTEREST_TAGS: 5,
  MIN_RADIUS_KM: 0.1,
  MAX_RADIUS_KM: 100,
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
} as const;

// 导出单例
export const validator = new Validator();

/**
 * 搜索筛选验证器
 * 用于验证搜索查询参数
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
 */
export class SearchFilterValidator {
  /**
   * 验证搜索查询
   * Requirements: 5.2, 5.3, 5.4, 5.5
   */
  validateSearchQuery(query: SearchQuery): SearchFilterValidationResult {
    const errors: Record<string, string> = {};
    let filterCount = 0;

    // 验证关键词 (Requirement 5.2)
    if (query.keyword !== undefined && query.keyword !== null) {
      const trimmedKeyword = query.keyword.trim();
      if (trimmedKeyword.length > 0) {
        filterCount++;
        if (trimmedKeyword.length > SearchLimits.KEYWORD_MAX_LENGTH) {
          errors.keyword = `关键词不能超过${SearchLimits.KEYWORD_MAX_LENGTH}字`;
        }
      }
    }

    // 验证卡片类型 (Requirement 5.3)
    if (query.card_type !== undefined && query.card_type !== null && query.card_type !== '') {
      const validTypes: CardType[] = ['day_card', 'week_card', 'fragment_card', 'moment_card'];
      if (!validTypes.includes(query.card_type)) {
        errors.card_type = '无效的卡片类型';
      } else {
        filterCount++;
      }
    }

    // 验证兴趣标签 (Requirement 5.4)
    if (query.interest_tags !== undefined && query.interest_tags !== null) {
      if (Array.isArray(query.interest_tags) && query.interest_tags.length > 0) {
        filterCount++;
        if (query.interest_tags.length > SearchLimits.MAX_INTEREST_TAGS) {
          errors.interest_tags = `最多选择${SearchLimits.MAX_INTEREST_TAGS}个标签`;
        }
        // 验证每个标签不为空
        const hasEmptyTag = query.interest_tags.some(tag => !tag || !tag.trim());
        if (hasEmptyTag) {
          errors.interest_tags = '标签不能为空';
        }
      }
    }

    // 验证位置搜索 (Requirement 5.5)
    const hasLatitude = query.latitude !== undefined && query.latitude !== null;
    const hasLongitude = query.longitude !== undefined && query.longitude !== null;

    if (hasLatitude || hasLongitude) {
      // 如果提供了任一坐标，两者都必须提供
      if (!hasLatitude || !hasLongitude) {
        errors.location = '经纬度必须同时提供';
      } else {
        filterCount++;
        
        // 验证纬度范围
        if (query.latitude! < SearchLimits.MIN_LATITUDE || query.latitude! > SearchLimits.MAX_LATITUDE) {
          errors.latitude = `纬度必须在${SearchLimits.MIN_LATITUDE}到${SearchLimits.MAX_LATITUDE}之间`;
        }

        // 验证经度范围
        if (query.longitude! < SearchLimits.MIN_LONGITUDE || query.longitude! > SearchLimits.MAX_LONGITUDE) {
          errors.longitude = `经度必须在${SearchLimits.MIN_LONGITUDE}到${SearchLimits.MAX_LONGITUDE}之间`;
        }

        // 验证搜索半径
        if (query.radius_km !== undefined && query.radius_km !== null) {
          if (query.radius_km < SearchLimits.MIN_RADIUS_KM || query.radius_km > SearchLimits.MAX_RADIUS_KM) {
            errors.radius_km = `搜索半径必须在${SearchLimits.MIN_RADIUS_KM}到${SearchLimits.MAX_RADIUS_KM}公里之间`;
          }
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      hasFilters: filterCount > 0,
      filterCount,
    };
  }

  /**
   * 检查搜索结果是否符合筛选条件
   * 用于属性测试验证
   * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
   */
  validateSearchResult(
    result: { 
      id: string;
      title: string;
      description: string;
      card_type: CardType;
      interest_tags: string[];
      location?: { latitude: number; longitude: number };
    },
    query: SearchQuery
  ): { matches: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // 验证关键词匹配 (Requirement 5.2)
    if (query.keyword && query.keyword.trim()) {
      const keyword = query.keyword.trim().toLowerCase();
      const titleMatch = result.title.toLowerCase().includes(keyword);
      const descMatch = result.description.toLowerCase().includes(keyword);
      if (!titleMatch && !descMatch) {
        reasons.push(`关键词 "${query.keyword}" 不匹配标题或描述`);
      }
    }

    // 验证卡片类型匹配 (Requirement 5.3)
    if (query.card_type) {
      if (result.card_type !== query.card_type) {
        reasons.push(`卡片类型 "${result.card_type}" 不匹配筛选条件 "${query.card_type}"`);
      }
    }

    // 验证标签匹配 (Requirement 5.4)
    if (query.interest_tags && query.interest_tags.length > 0) {
      const hasMatchingTag = query.interest_tags.some(tag => 
        result.interest_tags.includes(tag)
      );
      if (!hasMatchingTag) {
        reasons.push(`卡片标签不包含任何筛选标签`);
      }
    }

    // 验证位置匹配 (Requirement 5.5)
    if (query.latitude !== undefined && query.longitude !== undefined && query.radius_km !== undefined) {
      if (result.location) {
        const distance = this.calculateDistance(
          query.latitude,
          query.longitude,
          result.location.latitude,
          result.location.longitude
        );
        if (distance > query.radius_km) {
          reasons.push(`卡片距离 ${distance.toFixed(2)}km 超出搜索半径 ${query.radius_km}km`);
        }
      } else {
        reasons.push('卡片没有位置信息');
      }
    }

    return {
      matches: reasons.length === 0,
      reasons,
    };
  }

  /**
   * 计算两点之间的距离（Haversine 公式）
   * @returns 距离（公里）
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

// 导出搜索筛选验证器单例
export const searchFilterValidator = new SearchFilterValidator();
