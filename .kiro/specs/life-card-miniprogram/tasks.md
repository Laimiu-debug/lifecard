# Implementation Plan: Life Card 微信小程序

## Overview

本实现计划将 Life Card 微信小程序分解为可执行的开发任务。采用渐进式开发，从基础架构开始，逐步实现核心功能模块。

## Tasks

- [ ] 1. 项目初始化与基础架构
  - [x] 1.1 创建微信小程序项目结构
    - 使用 TypeScript 模板初始化项目
    - 配置 app.json 全局设置和 tabBar
    - 设置 tsconfig.json 和项目编译配置
    - _Requirements: 1.1, 4.6_

  - [x] 1.2 安装和配置依赖
    - 安装 Vant Weapp 组件库
    - 安装 mobx-miniprogram 状态管理
    - 配置 Jest 和 fast-check 测试框架
    - _Requirements: Design Architecture_

  - [x] 1.3 实现基础工具模块
    - 创建 utils/storage.ts 本地存储封装
    - 创建 utils/format.ts 格式化工具（日期、数字）
    - 创建 utils/validator.ts 验证器
    - _Requirements: 3.3, 3.6, 8.3_

  - [x] 1.4 编写验证器属性测试
    - **Property 3: Card Creation Validation**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.6, 3.8**

- [x] 2. 网络请求与认证服务
  - [x] 2.1 实现请求服务封装
    - 创建 services/request.ts
    - 实现 token 自动注入
    - 实现错误统一处理
    - _Requirements: 1.4, 1.5_

  - [x] 2.2 实现认证服务
    - 创建 services/auth.ts
    - 实现微信登录流程 (wx.login -> API)
    - 实现 token 存储和自动刷新
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 2.3 编写 Token 存储属性测试
    - **Property 1: Token Storage Consistency**
    - **Validates: Requirements 1.4, 1.6**

- [x] 3. 类型定义与数据模型
  - [x] 3.1 创建 TypeScript 类型定义
    - 创建 types/card.ts 卡片相关类型
    - 创建 types/user.ts 用户相关类型
    - 创建 types/exchange.ts 交换相关类型
    - 创建 types/api.ts API 响应类型
    - _Requirements: Design Data Models_

- [x] 4. MobX 状态管理
  - [x] 4.1 实现用户状态管理
    - 创建 stores/user.ts
    - 实现登录状态、用户资料、金币余额管理
    - _Requirements: 1.4, 2.1, 11.1_

  - [x] 4.2 实现卡片状态管理
    - 创建 stores/card.ts
    - 实现 Feed、搜索结果、当前卡片状态
    - _Requirements: 4.1, 4.2, 5.6_

  - [x] 4.3 实现交换状态管理
    - 创建 stores/exchange.ts
    - 实现交换请求列表状态
    - _Requirements: 7.4, 7.5_

  - [x] 4.4 实现通知状态管理
    - 创建 stores/notification.ts
    - 实现未读计数和通知列表
    - _Requirements: 10.1, 10.2_

- [x] 5. Checkpoint - 基础架构验证
  - 确保所有测试通过
  - 验证 MobX store 正常工作
  - 如有问题请询问用户

- [x] 6. API 服务层实现
  - [x] 6.1 实现卡片服务
    - 创建 services/card.ts
    - 实现 CRUD、Feed、搜索、点赞、评论接口
    - _Requirements: 3.8, 4.1, 4.2, 5.2, 6.3, 6.5_

  - [x] 6.2 实现用户服务
    - 创建 services/user.ts
    - 实现资料获取、更新、关注接口
    - _Requirements: 2.1, 2.3, 9.1, 9.2_

  - [x] 6.3 实现交换服务
    - 创建 services/exchange.ts
    - 实现交换请求、接受、拒绝接口
    - _Requirements: 7.1, 7.3, 7.6_

  - [x] 6.4 实现上传服务
    - 创建 services/upload.ts
    - 实现图片/视频上传到云存储
    - _Requirements: 3.4, 2.6_

- [x] 7. 公共组件开发
  - [x] 7.1 实现卡片列表项组件
    - 创建 components/card-item
    - 显示缩略图、标题、创建者、互动数
    - _Requirements: 4.4_

  - [x] 7.2 编写卡片显示属性测试
    - **Property 5: Card Display Field Completeness**
    - **Validates: Requirements 4.4**

  - [x] 7.3 实现用户头像组件
    - 创建 components/user-avatar
    - 支持不同尺寸和默认头像
    - _Requirements: 2.1, 6.2_

  - [x] 7.4 实现标签选择器组件
    - 创建 components/tag-selector
    - 支持多选和数量限制
    - _Requirements: 3.6_

  - [x] 7.5 实现媒体选择器组件
    - 创建 components/media-picker
    - 支持图片/视频选择和预览
    - _Requirements: 3.4_

  - [x] 7.6 实现位置选择器组件
    - 创建 components/location-picker
    - 集成微信位置 API
    - _Requirements: 3.5_

  - [x] 7.7 实现评论列表组件
    - 创建 components/comment-list
    - 支持加载更多和发表评论
    - _Requirements: 6.4_

  - [x] 7.8 实现空状态组件
    - 创建 components/empty-state
    - 支持自定义图标和文案
    - _Requirements: 5.7_

- [ ] 8. 首页与 Feed 功能
  - [x] 8.1 实现首页布局
    - 创建 pages/index
    - 实现 Tab 切换（推荐/热门/随机）
    - _Requirements: 4.1, 4.6_

  - [x] 8.2 实现 Feed 无限滚动
    - 实现下拉刷新和上拉加载
    - 集成 cursor 分页
    - _Requirements: 4.2, 4.3_

  - [x] 8.3 编写 Feed 分页属性测试
    - **Property 4: Feed Pagination Cursor Consistency**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 8.4 实现热门卡片页
    - 实现时间范围筛选（日/周/月）
    - _Requirements: 4.7_

- [x] 9. 搜索功能
  - [x] 9.1 实现搜索页面
    - 创建 pages/search
    - 实现搜索框和历史记录
    - _Requirements: 5.1_

  - [x] 9.2 实现搜索筛选
    - 实现关键词、类型、标签筛选
    - 实现附近搜索（位置+半径）
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 9.3 编写搜索筛选属性测试
    - **Property 6: Search Filter Application**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 10. Checkpoint - 浏览功能验证
  - 确保所有测试通过
  - 验证 Feed 和搜索功能正常
  - 如有问题请询问用户

- [x] 11. 卡片详情与互动
  - [x] 11.1 实现卡片详情页
    - 创建 pages/card-detail
    - 显示媒体轮播、信息、标签
    - _Requirements: 6.1_

  - [x] 11.2 实现点赞功能
    - 实现点赞/取消点赞
    - 实现乐观更新
    - _Requirements: 6.3_

  - [x] 11.3 编写点赞状态属性测试
    - **Property 7: Like Toggle State Consistency**
    - **Validates: Requirements 6.3**

  - [x] 11.4 实现评论功能
    - 实现评论列表和发表
    - 实现评论验证
    - _Requirements: 6.4, 6.5_

  - [x] 11.5 编写评论验证属性测试
    - **Property 8: Comment Content Validation**
    - **Validates: Requirements 6.5**

  - [x] 11.6 实现所有权判断 UI
    - 根据是否为创建者显示不同按钮
    - _Requirements: 6.6, 6.7_

  - [x] 11.7 编写所有权 UI 属性测试
    - **Property 9: Ownership-Based UI Visibility**
    - **Validates: Requirements 6.6, 6.7**

- [x] 12. 卡片创建功能
  - [x] 12.1 实现创建卡片页面
    - 创建 pages/create
    - 实现表单布局和类型选择
    - _Requirements: 3.1, 3.2_

  - [x] 12.2 实现表单验证和提交
    - 实现字段验证
    - 实现媒体上传和提交
    - _Requirements: 3.3, 3.4, 3.8_

  - [x] 12.3 实现创建成功流程
    - 显示获得金币
    - 跳转到详情页
    - _Requirements: 3.9, 3.10_

- [x] 13. 交换功能
  - [x] 13.1 实现交换确认弹窗
    - 显示价格和余额
    - 实现余额检查
    - _Requirements: 7.1, 7.2_

  - [x] 13.2 编写交换余额属性测试
    - **Property 10: Exchange Balance Validation**
    - **Validates: Requirements 7.2**

  - [x] 13.3 实现交换请求发送
    - 发送请求并更新状态
    - _Requirements: 7.3, 7.4_

  - [x] 13.4 实现交换管理页面
    - 创建 pages/exchange
    - 显示待处理和已发送请求
    - _Requirements: 7.5, 7.6_

  - [x] 13.5 实现交换接受/拒绝
    - 实现接受和拒绝操作
    - 更新收藏和余额
    - _Requirements: 7.6, 7.7_

  - [x] 13.6 编写交换完成属性测试
    - **Property 11: Exchange Completion Consistency**
    - **Validates: Requirements 7.7**

- [x] 14. Checkpoint - 核心功能验证
  - 确保所有测试通过
  - 验证创建、详情、交换功能正常
  - 如有问题请询问用户

- [x] 15. 用户资料与社交
  - [x] 15.1 实现个人中心页面
    - 创建 pages/profile
    - 显示资料、统计、金币
    - _Requirements: 2.1, 11.1_

  - [x] 15.2 实现资料编辑
    - 实现编辑表单和验证
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 15.3 编写资料验证属性测试
    - **Property 2: Profile Validation Completeness**
    - **Validates: Requirements 2.3, 2.5**

  - [x] 15.4 实现他人主页
    - 创建 pages/user-profile
    - 显示公开资料和卡片
    - _Requirements: 2.1, 6.2_

  - [x] 15.5 实现关注功能
    - 实现关注/取关和乐观更新
    - _Requirements: 9.1, 9.2_

  - [x] 15.6 编写关注状态属性测试
    - **Property 14: Follow Action UI Consistency**
    - **Validates: Requirements 9.2**

  - [x] 15.7 实现粉丝/关注列表
    - 显示列表和互关状态
    - _Requirements: 9.3, 9.4, 9.5_

  - [x] 15.8 编写互关状态属性测试
    - **Property 15: Mutual Follow Status Accuracy**
    - **Validates: Requirements 9.5**

- [x] 16. 卡片收藏管理
  - [x] 16.1 实现我的卡片页面
    - 创建 pages/my-cards
    - 实现创建/收藏 Tab 切换
    - _Requirements: 8.1_

  - [x] 16.2 实现文件夹管理
    - 实现创建、重命名、删除文件夹
    - _Requirements: 8.2, 8.3, 8.5_

  - [x] 16.3 编写文件夹验证属性测试
    - **Property 12: Folder Name Validation**
    - **Validates: Requirements 8.3**

  - [x] 16.4 实现卡片移动到文件夹
    - 实现移动操作
    - _Requirements: 8.4_

  - [x] 16.5 实现时间线和分类视图
    - 实现按日期和类型分组
    - _Requirements: 8.6, 8.7_

  - [x] 16.6 编写卡片分组属性测试
    - **Property 13: Card Grouping Correctness**
    - **Validates: Requirements 8.6, 8.7**

- [x] 17. 通知功能
  - [x] 17.1 实现通知页面
    - 创建 pages/notifications
    - 显示分组通知列表
    - _Requirements: 10.2, 10.3_

  - [x] 17.2 编写通知分组属性测试
    - **Property 17: Notification Grouping**
    - **Validates: Requirements 10.3**

  - [x] 17.3 实现通知徽章
    - 在 tabBar 显示未读数
    - _Requirements: 10.1_

  - [x] 17.4 编写通知徽章属性测试
    - **Property 16: Notification Badge Accuracy**
    - **Validates: Requirements 10.1**

  - [x] 17.5 实现通知点击跳转
    - 跳转到相关内容
    - _Requirements: 10.4_

  - [x] 17.6 实现标记已读
    - 实现单条和全部已读
    - _Requirements: 10.5_

- [x] 18. 金币与交易记录
  - [x] 18.1 实现交易历史页面
    - 显示交易列表
    - _Requirements: 11.2, 11.3, 11.4_

  - [x] 18.2 实现交易记录显示
    - 显示金额、类型、时间
    - _Requirements: 11.5_

  - [x] 18.3 编写交易显示属性测试
    - **Property 18: Transaction Display Completeness**
    - **Validates: Requirements 11.5**

- [x] 19. 分享功能
  - [x] 19.1 实现微信分享
    - 配置 onShareAppMessage
    - 生成分享卡片
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 19.2 编写分享数据属性测试
    - **Property 19: Share Data Generation**
    - **Validates: Requirements 12.2**

  - [x] 19.3 实现海报生成
    - 生成分享海报图片
    - _Requirements: 12.4_

  - [x] 19.4 实现深度链接处理
    - 处理分享链接打开
    - _Requirements: 12.5_

  - [x] 19.5 编写深度链接属性测试
    - **Property 20: Deep Link Navigation**
    - **Validates: Requirements 12.5**

- [x] 20. Final Checkpoint - 完整功能验证
  - 确保所有测试通过
  - 验证所有功能模块正常工作
  - 如有问题请询问用户

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
