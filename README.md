# anime_sa

轻量的个人收藏站，卡片式展示 + 后台管理。Node.js / Docker 支持 SQLite（默认）与 Redis，Vercel 使用 Redis。

## 功能特性

- **卡片展示** — 分区筛选、搜索、排序、详情页
- **后台管理** — 卡片 / 标签 / 站点配置 / 数据同步（路径 `/tat`）
- **存储驱动** — SQLite 与 Redis 共用统一 API，Node.js / Docker 可通过 `STORAGE_DRIVER` 切换，支持后台跨存储传输
- **封面管理** — 外置存储 + 分批清理未引用封面（Media GC）
- **安全** — Session 鉴权、登录限流、scrypt、同源写校验、请求体限制，以及 Node.js / Vercel 静态响应安全头

## 快速开始

```bash
git clone https://github.com/naseaoi/anime_sa.git
cd anime_sa
npm ci
```

首次运行前复制并填写环境变量。Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

至少设置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，再启动开发服务器：

```bash
npm run dev
```

需要 Node.js `20.19.0` 或更高版本。

- 前台：`http://localhost:5173/`
- 后台：`http://localhost:5173/tat`

## 环境变量

复制 `.env.example` 为 `.env`，再填写实际配置：

| 变量 | 场景 | 说明 |
|---|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 首次启动 | 管理员初始凭据，首次启动写入数据库，后续在后台修改 |
| `PORT` | Node.js / Docker | HTTP 端口，默认 `3000` |
| `STORAGE_DRIVER` | Node.js / Docker | 活动存储驱动，`sqlite`（默认）或 `redis` |
| `SQLITE_DATA_DIR` | Node.js / Docker | SQLite 持久化目录，默认 `data`；容器内建议挂载到 `/app/data` |
| `REDIS_URL` | Vercel 必填；Node.js / Docker 可选 | 完整 `redis://` 或 `rediss://` 连接串 |
| `REDIS_PREFIX` | Vercel / Node.js / Docker | Redis Key 前缀，默认 `anime-sa` |
| `TRUST_PROXY` | Node.js / Docker | 仅在可信反向代理覆盖 `X-Real-IP`/`X-Forwarded-For` 时开启 |

只配置 `REDIS_URL` 不切换驱动：此时 SQLite 与 Redis 同时可用，后台「同步」页可在两者之间双向传输数据。

## 生产部署

### Node.js 直接部署

```bash
npm run build
npm start
```

服务默认监听 `3000` 端口，纯 HTTP。生产环境建议通过 Nginx 等反向代理提供 HTTPS。

### Docker 部署

**使用预构建镜像（发布版本 tag 后自动构建）：**

```bash
docker run -d \
  --name anime_sa \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  ghcr.io/naseaoi/anime_sa:latest
```

**本地构建镜像：**

```bash
docker build -t anime_sa .
docker run -d \
  --name anime_sa \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  anime_sa
```

- `-v ./data:/app/data` 将 SQLite 数据库（`/app/data/local.db`）持久化到宿主机。
- 容器启动时会设置 SQLite 挂载目录权限，再使用 UID `1000` 的 `node` 用户运行服务。
- 容器健康检查访问 `/api/storage?key=ping`。
- 镜像默认 `NODE_ENV=production`，Session Cookie 带 `Secure`，正式环境需通过 HTTPS 反向代理访问；仅在本机临时使用 HTTP 调试时可覆盖为 `-e NODE_ENV=development`。

### Vercel 部署

公共数据、管理员凭据、封面、Session、登录限流与审计日志全部存储在 Redis。

1. 在 Vercel 导入仓库。
2. 创建支持标准 `redis://` 或 `rediss://` 连接串的 Redis 实例。
3. 配置 `REDIS_URL` 和可选的 `REDIS_PREFIX`。
4. 首次部署配置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。
5. 部署后访问 `/api/storage?key=ping`，响应中的 `driver` 应为 `redis`。

Vercel 不使用 SQLite，跨存储传输仅在 Node.js / Docker 运行时可用。

## 架构

### 运行边界

| 运行方式 | 存储驱动 | 持久化位置 |
|---|---|---|
| Node.js / Docker | SQLite（默认）或 Redis（`STORAGE_DRIVER=redis`） | `data/local.db` 或 `REDIS_URL` 指向的实例 |
| Vercel Functions | Redis | `REDIS_URL` 指向的实例 |

前端统一调用 `/api/storage`，不包含数据库协议与连接信息。旧 `/api/sqlite` 路径仅作为已有 SQLite 封面 URL 的兼容入口。

### 依赖方向

```text
components/hooks → services → domain/types
server.js/devMiddleware → 驱动分发（SQLite storage API / Redis storage API / transfer API）
api/storage.ts → Redis storage API → server/storage
```

`src/services/storageFactory.ts` 是客户端数据访问边界。SQLite 与 Redis 提供相同的数据、媒体、认证、审计和维护接口。

### 数据键

| 数据 | SQLite | Redis |
|---|---|---|
| 公共数据 | `public_data` | `<prefix>:public_data` |
| 私有凭据 | `private_data` | `<prefix>:private_data` |
| 封面 | `media:<name>` | `<prefix>:media:<name>` |
| Session | `session:<token>` | `<prefix>:session:<token>` |
| 审计日志 | `audit_logs` | `<prefix>:audit` |

### 一致性与安全

- 公共数据通过 `updatedAt` 执行乐观并发检查，冲突返回 409。
- Redis 使用 Lua 脚本原子完成版本比较和写入。
- 写请求校验 `Origin` 或 `Referer`。
- Session Cookie 使用 `HttpOnly`、`SameSite=Strict`，生产环境使用 `Secure`。
- 外部图片代理拒绝本地、回环和私有地址。
- 公共数据和媒体名称进入存储前执行结构与边界校验。

### 驱动契约

新增 MySQL 等驱动时需要实现以下能力：

- 公共数据读取、写入与版本冲突检查
- 私有凭据读取与写入
- 媒体读取、写入、删除和枚举
- Session 创建、校验、删除和批量失效
- 审计日志追加与分页读取
- 限流计数和健康检查

新驱动通过独立服务端模块接入 `/api/storage`，不修改页面组件和领域模型。

### 关键约束

- `vercel.json` 中 `/api/storage/:path*` → `/api/storage` 的 rewrite 不可删除：Vercel 按文件精确路由，`/api/storage/login` 等子路径经该 rewrite 进入函数，缺失时请求落入 SPA fallback 返回 HTML。
- `server/storage/redisStore.js` 的 `getRedisClient` 在初次连接失败时清空模块级缓存再抛错，下次调用重新建连；Docker 长驻进程依赖该语义应对 Redis 晚就绪。

## API

| 接口 | 用途 |
|---|---|
| `/api/storage/login` | 管理员登录 |
| `/api/storage/logout` | 管理员登出 |
| `/api/storage/session` | Session 检查 |
| `/api/storage?key=public_data` | 公共数据读写 |
| `/api/storage?key=private_data` | 私有数据读写 |
| `/api/storage?key=ping` | 健康检查 |
| `/api/storage?key=driver` | 活动驱动检查 |
| `/api/storage/media` | 封面读写 |
| `/api/storage/media-gc` | 封面清理 |
| `/api/storage/audit-logs` | 审计日志 |
| `/api/storage/transfer` | 跨存储数据传输（仅 Node.js / Docker） |

`key=driver` 在 Node.js / Docker 返回 `STORAGE_DRIVER` 指定的驱动（默认 `sqlite`），在 Vercel 返回 `redis`。

### 跨存储传输

`/api/storage/transfer` 仅在 Node.js / Docker 运行时挂载：

- `GET` 返回活动驱动与可用驱动列表。
- `POST scope=data` 复制 `public_data` 与 `private_data`。
- `POST scope=media` 按名称差集分批复制封面，响应携带 `pending`/`hasMore` 供前端循环。
- Session、限流和审计日志属于运行环境本地状态，不参与传输。

## 备份与恢复

### 跨存储传输（Node.js / Docker）

配置 `REDIS_URL` 后，后台「同步」页提供 SQLite 与 Redis 之间的双向传输：

- 「备份到 X」把活动存储的公共数据、管理员凭据与封面复制到另一存储。
- 「从 X 恢复」反向复制并覆盖活动存储，完成后页面自动刷新。
- 传输只新增或覆盖同名数据；目标中多出的封面可在恢复后执行「清理未引用封面」。

### SQLite

备份 `data/local.db`，复制文件前停止 Node.js 进程或 Docker 容器：

```powershell
docker stop anime_sa
Copy-Item .\data\local.db .\backups\local.db
docker start anime_sa
```

恢复时停止服务，替换 `data/local.db`，再启动服务并检查前台、后台登录和封面。

### Redis

使用托管平台提供的快照、导出或备份功能保存 `<prefix>:public_data`、`<prefix>:private_data`、`<prefix>:media:*`、`<prefix>:audit`。Session 和限流 Key 无需恢复。恢复后重新部署并检查 `/api/storage?key=ping`、后台登录、公共数据和封面。

Redis 运维要点：

- 使用支持 TLS 的 `rediss://` 连接串。
- 公共数据、凭据和媒体 Key 不设置 TTL；Session 和限流 Key 设置 TTL。
- Redis 实例需要启用持久化或托管备份。
- 达到套餐容量前清理未引用封面或升级容量。

### 操作要求

- 管理员凭据和数据库备份按敏感数据保存，备份文件不得提交到 Git。
- 数据结构升级和批量媒体清理前创建备份。
- 至少保留 3 个可用版本并定期验证恢复。

## 故障排查

**SQLite**

- 检查 `SQLITE_DATA_DIR` 指向持久化挂载目录，且挂载模式不是只读。
- 旧容器升级后需重新创建容器，使启动入口获得设置挂载目录权限的能力。
- 请求 `/api/storage?key=ping`，检查 `data/local.db` 是否可读取。

**Redis**

- 检查 `REDIS_URL` 是否包含协议、账号、密码、主机和端口。
- 检查 Redis 服务是否允许部署环境的网络连接，以及 TLS 与连接数限制。
- 检查 Redis Key 是否使用一致的 `REDIS_PREFIX`。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端产物到 `dist/` |
| `npm start` | 生产模式运行 |
| `npm run lint` | 客户端/服务端静态检查 |
| `npm run audit:prod` | 生产依赖安全审计 |
| `npm run audit:all` | 全部依赖安全审计 |
| `npm test` | 运行测试（Vitest） |

代码改动后依次执行 `npm run lint`、`npm test`、`npm run build` 验证。

## 项目结构

```
src/
├── domain/            领域类型、默认数据与存储模式
├── components/        界面组件（前台 + 后台）
├── services/          API 客户端、存储适配与封面服务
├── hooks/             跨组件复用的状态逻辑
└── utils/             工具函数
shared/                前后端共享的运行时契约入口
server.js              生产服务器（HTTP、静态文件、驱动分发，API 委托 server/）
server/core/           SQLite API、Session、审计与安全模块
server/storage/        Redis API 与数据能力、跨存储传输
server/sharedSecurity.js 密码哈希、输入校验等共享模块
server/publicDataValidation.js 公共数据 Schema 实现与兼容入口
api/                   Vercel Functions 入口
vite.config.ts         Vite 配置 + 开发态 API 中间件
data/local.db          SQLite 数据文件（运行时自动创建）
docs/RELEASE.md        发布流程
docs/MAINTAINER_GUIDE.md 项目独有约束、易错点与改动检查表
docs/TECH_DEBT_BACKLOG.md 技术债、重构优先级与验收清单
docs/DATA_MODEL_POLICY.md 公共数据模型、容量指标与迁移触发线
docs/API_CONTRACT.md API 错误码、端点分组与扩展约束
docs/NODE_VERSION_POLICY.md Node.js 最低支持版本与升级检查项
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 8 + Tailwind CSS 3 + React Router 6 |
| 后端 | Node.js 原生 HTTP 服务器、Vercel Functions |
| 数据库 | better-sqlite3（KV 存储模式）、Redis |
| CI/CD | GitHub Actions、依赖审计、容器扫描、GitHub Container Registry |

## 发布

- 版本 tag 与镜像发布流程见 [docs/RELEASE.md](docs/RELEASE.md)。
- 接手项目或开始结构性改造前，先读 [docs/MAINTAINER_GUIDE.md](docs/MAINTAINER_GUIDE.md)。
- 重构规划与技术债优先级见 [docs/TECH_DEBT_BACKLOG.md](docs/TECH_DEBT_BACKLOG.md)。

## License

MIT
