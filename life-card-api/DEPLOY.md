# 微信云托管部署指南

## 数据库选择

当前后端使用 **PostgreSQL** 数据库。微信云托管原生只支持 MySQL，但你有以下选择：

### 方案一：使用腾讯云 PostgreSQL（推荐）
1. 在腾讯云控制台创建 PostgreSQL 实例
2. 配置安全组允许云托管访问
3. 使用内网地址连接

### 方案二：使用外部 PostgreSQL 服务
- Supabase (免费额度)
- Railway
- Neon
- 其他云服务商

### 方案三：迁移到 MySQL
需要修改：
- `Cargo.toml` 中的 sqlx feature 从 `postgres` 改为 `mysql`
- 所有 SQL 查询中的 `$1, $2...` 改为 `?`
- 移除所有 `RETURNING *` 子句
- 数组类型改为 JSON
- 全文搜索语法调整

---

## 1. 开通微信云托管

1. 登录 [微信云托管控制台](https://cloud.weixin.qq.com/)
2. 使用小程序管理员微信扫码登录
3. 选择你的小程序，开通云托管服务
4. 选择地域（建议选择上海）

## 2. 创建数据库

### 使用腾讯云 PostgreSQL

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 搜索 "云数据库 PostgreSQL"
3. 创建实例（选择与云托管相同的地域和 VPC）
4. 记录连接信息：
   - 内网地址
   - 端口（默认 5432）
   - 用户名
   - 密码
5. 创建数据库 `life_card_db`

### 初始化数据库

```bash
# 连接到 PostgreSQL
psql -h <host> -p 5432 -U <user> -d life_card_db

# 执行迁移脚本
\i migrations/001_initial_schema.sql
```

## 3. 配置环境变量

在云托管控制台 → 服务管理 → 服务设置 → 环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| DATABASE_URL | postgres://user:pass@host:5432/life_card_db | PostgreSQL 连接串 |
| JWT_SECRET | 随机生成的32位以上字符串 | JWT 密钥 |
| WECHAT_APP_ID | wx1fc5089fd86b03d9 | 小程序 AppID |
| WECHAT_APP_SECRET | 你的密钥 | 小程序密钥 |
| RUST_LOG | info | 日志级别 |
| SERVER_HOST | 0.0.0.0 | 服务监听地址 |
| SERVER_PORT | 80 | 服务端口 |

## 4. 部署服务

### 方式一：通过 Git 仓库部署（推荐）

1. 将代码推送到 GitHub/Gitee
2. 在云托管控制台，点击「新建服务」
3. 选择「代码库」部署方式
4. 关联你的 Git 仓库
5. 选择 `life-card-api` 目录作为构建目录
6. 点击部署

### 方式二：本地构建上传

```bash
# 在 life-card-api 目录下构建镜像
docker build -t life-card-api .

# 导出镜像
docker save life-card-api > life-card-api.tar

# 在云托管控制台上传镜像
```

## 5. 配置域名

部署成功后，云托管会分配默认域名：
`https://xxx.sh.run.tcloudbase.com`

### 配置小程序请求域名

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 开发管理 → 开发设置 → 服务器域名
3. 添加 request 合法域名

### 更新小程序 API 地址

修改 `miniprogram/services/request.ts`：

```typescript
const API_BASE_URL = 'https://xxx.sh.run.tcloudbase.com';
```

## 6. 配置云存储（推荐）

云托管容器重启后本地文件会丢失，建议使用云存储：

### 微信云托管对象存储
1. 在云托管控制台开通对象存储
2. 获取存储桶信息
3. 修改上传接口使用云存储

### 腾讯云 COS
1. 开通腾讯云 COS 服务
2. 创建存储桶
3. 配置 CORS

## 7. 验证部署

1. 访问 `https://xxx.sh.run.tcloudbase.com/health` 检查服务状态
2. 在小程序中测试登录功能
3. 测试创建卡片、上传图片
4. 检查云托管日志

## 常见问题

### Q: 部署失败，提示内存不足
A: 在 container.config.json 中增加 mem 值（建议 512MB 以上）

### Q: 数据库连接失败
A: 
- 检查 DATABASE_URL 格式
- 确保使用内网地址
- 检查安全组配置

### Q: 图片上传后丢失
A: 云托管容器重启后本地文件会丢失，请使用云存储

## 费用说明

- 云托管按实际使用量计费
- 最小实例数设为 0 可以在无请求时不产生费用
- 数据库按规格计费
