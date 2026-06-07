# anime_sa

轻量的个人收藏站，卡片式展示 + 后台管理，支持 SQLite / WebDAV 双存储模式。

## 功能特性

- **卡片展示** — 分区筛选、搜索、排序、详情页
- **后台管理** — 卡片 / 分类 / 站点配置 / 数据同步（路径 `/tat`）
- **双存储** — SQLite（默认）与 WebDAV 可在后台切换
- **封面管理** — 外置存储 + 分批清理未引用封面（Media GC）
- **安全** — Session 鉴权、登录限流、密码 scrypt 哈希、安全响应头、请求体大小限制

## 快速开始

```bash
git clone https://github.com/naseaoi/anime_sa.git
cd anime_sa
npm install
npm run dev
```

- 前台：`http://localhost:5173/`
- 后台：`http://localhost:5173/tat`

## 环境变量

在项目根目录创建 `.env` 文件：

```bash
# 管理员初始凭据（首次启动写入数据库，后续可在后台修改）
ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=your_password

# 服务端口（默认 3000）
PORT=3000

# WebDAV（可选，不使用 WebDAV 模式可忽略）
WEBDAV_URL=https://dav.example.com/dav/
WEBDAV_USERNAME=your_username
WEBDAV_PASSWORD=your_password
WEBDAV_PATH=my-collection/
```

## 生产部署

### Node.js 直接部署

```bash
npm run build
npm start
```

服务默认监听 `3000` 端口，纯 HTTP。生产环境建议通过 Nginx 等反向代理提供 HTTPS。

### Docker 部署

**使用预构建镜像（推送到 main 分支后自动构建）：**

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  ghcr.io/naseaoi/anime_sa:latest
```

**本地构建镜像：**

```bash
docker build -t anime_sa .
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  --env-file .env \
  anime_sa
```

> `-v ./data:/app/data` 将 SQLite 数据库持久化到宿主机，避免容器重建后数据丢失。

### Vercel 部署

`api/` 目录下的 Serverless 函数 + SPA 重写规则（见 `vercel.json`）支持直接部署到 Vercel。在 Vercel 项目中配置 `WEBDAV_*` 环境变量即可。

> Vercel 为无持久磁盘环境，**仅支持 WebDAV 存储**；SQLite 接口返回 501。本地/Docker 走 `server/core/apiCore.js`，Vercel 走 `api/webdav.ts`，二者为相互独立的两套实现。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端产物到 `dist/` |
| `npm start` | 生产模式运行 |
| `npm run lint` | TypeScript 类型检查 |
| `npm test` | 运行测试（Vitest） |

## 项目结构

```
src/
├── components/        界面组件（前台 + 后台）
├── services/          存储适配与 API 封装
└── utils/             工具函数
server.js              生产服务器（HTTP、静态文件，API 委托 server/core）
server/core/apiCore.js 服务端全部 API 业务逻辑（SQLite + WebDAV 代理）
server/sharedSecurity.js 密码哈希、输入校验等共享模块
api/                   Vercel Serverless 函数（webdav.ts；sqlite.ts 为 501 占位）
vite.config.ts         Vite 配置 + 开发态 API 中间件
data/local.db          SQLite 数据文件（运行时自动创建）
docs/MAINTENANCE.md    维护与运维手册
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + React Router 6 |
| 后端 | Node.js 原生 HTTP 服务器 |
| 数据库 | better-sqlite3（KV 存储模式） |
| CI/CD | GitHub Actions → GitHub Container Registry |

## 文档

- 维护与运维手册：[docs/MAINTENANCE.md](docs/MAINTENANCE.md)

## License

MIT
