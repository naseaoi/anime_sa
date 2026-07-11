# anime_sa

轻量的个人收藏站，卡片式展示 + 后台管理。Node.js / Docker 使用 SQLite，Vercel 使用 Redis。

## 功能特性

- **卡片展示** — 分区筛选、搜索、排序、详情页
- **后台管理** — 卡片 / 分类 / 站点配置 / 数据同步（路径 `/tat`）
- **存储驱动** — SQLite 与 Redis 共用统一 API，可继续扩展 MySQL 等驱动
- **封面管理** — 外置存储 + 分批清理未引用封面（Media GC）
- **安全** — Session 鉴权、登录限流、scrypt、同源写校验、严格脚本 CSP、请求体限制

## 快速开始

```bash
git clone https://github.com/naseaoi/anime_sa.git
cd anime_sa
npm install
npm run dev
```

需要 Node.js `20.19.0` 或更高版本。

- 前台：`http://localhost:5173/`
- 后台：`http://localhost:5173/tat`

## 环境变量

复制 `.env.example` 为 `.env`，再填写实际配置：

```bash
# 管理员初始凭据（首次启动写入数据库，后续可在后台修改）
ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=your_password

# 服务端口（默认 3000）
PORT=3000

# Vercel Redis
REDIS_URL=rediss://user:password@host:6379
REDIS_PREFIX=anime-sa

# 仅在可信反向代理覆盖 X-Real-IP/X-Forwarded-For 时开启
TRUST_PROXY=0
```

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

> `-v ./data:/app/data` 将 SQLite 数据库持久化到宿主机，避免容器重建后数据丢失。

容器使用 UID `1000` 的 `node` 用户运行。Linux 宿主机的挂载目录需要允许 UID `1000` 读写。容器健康检查访问 `/api/storage?key=ping`。

Docker 镜像默认使用 `NODE_ENV=production`，Session Cookie 带 `Secure`。正式环境需要通过 HTTPS 反向代理访问；仅在本机临时使用 HTTP 调试时可覆盖为 `-e NODE_ENV=development`。

### Vercel 部署

Vercel 部署使用以下存储：

| 数据 | 存储 |
|---|---|
| 公共数据、管理员凭据、封面 | Redis |
| Session、登录限流、审计日志 | Redis |

部署步骤：

1. 在 Vercel 导入仓库。
2. 创建支持标准 `redis://` 或 `rediss://` 连接串的 Redis 实例。
3. 配置 `REDIS_URL` 和可选的 `REDIS_PREFIX`。
4. 首次部署配置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。
5. 部署后访问 `/api/storage?key=ping`，响应中的 `driver` 应为 `redis`。

Vercel 不使用 SQLite。Node.js / Docker 继续使用 `data/local.db`。

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

## 项目结构

```
src/
├── domain/            领域类型、默认数据与存储模式
├── components/        界面组件（前台 + 后台）
├── services/          API 客户端、存储适配与封面服务
└── utils/             工具函数
server.js              生产服务器（HTTP、静态文件，API 委托 server/core）
server/core/           SQLite API、Session、审计与安全模块
server/storage/        Redis 数据、媒体、Session、限流与审计能力
server/vercel/         Vercel API、Redis Session、限流与审计模块
server/sharedSecurity.js 密码哈希、输入校验等共享模块
api/                   Vercel Functions 入口
vite.config.ts         Vite 配置 + 开发态 API 中间件
server/publicDataValidation.js 公共数据校验
data/local.db          SQLite 数据文件（运行时自动创建）
docs/MAINTENANCE.md    维护与运维手册
docs/BACKUP_AND_RECOVERY.md 备份与恢复手册
docs/ARCHITECTURE.md   架构、依赖方向与扩展边界
docs/RELEASE.md        发布流程
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 8 + Tailwind CSS 3 + React Router 6 |
| 后端 | Node.js 原生 HTTP 服务器、Vercel Functions |
| 数据库 | better-sqlite3（KV 存储模式）、Redis |
| CI/CD | GitHub Actions、依赖审计、容器扫描、GitHub Container Registry |

## 文档

- 维护与运维手册：[docs/MAINTENANCE.md](docs/MAINTENANCE.md)
- 备份与恢复手册：[docs/BACKUP_AND_RECOVERY.md](docs/BACKUP_AND_RECOVERY.md)
- 架构说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 发布流程：[docs/RELEASE.md](docs/RELEASE.md)

## License

MIT
