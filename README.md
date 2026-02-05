# NicheCard - 精致卡片收藏站

一个极简风格、卡片式布局的收藏展示网站，支持 WebDAV 和 SQLite 双重存储模式，专为个人收藏记录设计。

## 功能特性

- **前端展示**：极简卡片流，支持封面、评分、日期和标签筛选。
- **后台管理**：通过 `/tat` 路径访问，支持可视化管理卡片、分类和网站设置。
- **双模存储**：
  - **SQLite (默认)**：基于本地文件的零配置数据库，适合 VPS/NAS 部署。
  - **WebDAV**：基于 WebDAV 协议同步数据，适合 Serverless (Vercel) 部署或数据漫游。
- **响应式设计**：完美适配桌面端和移动端。

## 项目结构说明

- **`server.js`**: **生产环境服务器**。基于 Node.js 原生 API 实现，负责托管静态资源并提供 SQLite/WebDAV 的后端 API 支持。
- **`services/webdavService.ts`**: **核心数据层**。负责与 WebDAV 服务器通信。
- **`api/webdav.ts`**: Vercel Serverless Function (仅用于 Vercel 部署)。
- **`data/`**: SQLite 数据库文件存放目录 (生产环境/本地开发会自动创建 `local.db`)。

## 部署说明

### 方式一：部署到 VPS / Docker (推荐)

本项目内置了生产环境服务器 (`server.js`)，可以直接在任何 Node.js 环境中运行，完美支持 SQLite 存储。

1. **环境准备**
   确保服务器已安装 Node.js (v18+)。

2. **获取代码**
   ```bash
   git clone https://github.com/your-repo/niche-card.git
   cd niche-card
   ```

3. **安装与构建**
   ```bash
   npm install
   npm run build
   ```

4. **启动服务**
   ```bash
   # 基础启动 (默认端口 3000)
   npm start

   # 指定端口
   PORT=8080 npm start
   ```
   *建议使用 `pm2` 等工具进行进程守护：* `pm2 start server.js --name niche-card`

5. **配置 WebDAV (可选)**
   如果你希望在 VPS 上使用 WebDAV 存储（而不是默认的 SQLite），请创建一个 `.env` 文件（或设置环境变量）：
   ```bash
   VITE_WEBDAV_URL=https://dav.jianguoyun.com/dav/
   VITE_WEBDAV_USERNAME=your_email@example.com
   VITE_WEBDAV_PASSWORD=your_password
   VITE_WEBDAV_PATH=my-collection/
   VITE_USE_WEBDAV=true
   ```

### 方式二：部署到 Vercel (Serverless)

Vercel 环境不支持本地 SQLite 持久化，**必须使用 WebDAV** 进行数据存储。

1. **配置环境变量**
   在 Vercel 项目设置中添加以下变量：
   - `VITE_WEBDAV_URL`
   - `VITE_WEBDAV_USERNAME`
   - `VITE_WEBDAV_PASSWORD`
   - `VITE_WEBDAV_PATH` (可选)

2. **注意事项**
   - 不要设置 `VITE_USE_SQLITE`。
   - 修改环境变量后需要 Redeploy。

## 首次使用与登录

1. **访问后台**
   在浏览器地址栏后添加 `/tat` (例如 `http://localhost:3000/tat`) 进入后台。

2. **默认账号**
   - 账号：`admin`
   - 密码：`password`

3. **安全设置**
   登录后请立即在后台“网站设置”中修改管理员账号密码。

## 开发指南

### 本地开发
```bash
# 启动开发服务器 (支持热重载 + 内置 SQLite API 代理)
npm run dev
```

### 切换存储模式 (开发环境)
项目默认使用 SQLite。如需在开发环境调试 WebDAV：
1. 配置 `.env` 中的 WebDAV 变量。
2. 设置 `VITE_USE_WEBDAV=true`。
3. 或在浏览器控制台运行 `localStorage.setItem('tat_storage_mode', 'webdav')` 并刷新。
