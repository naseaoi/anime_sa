# anime_sa

一个极简风格、卡片式布局的收藏展示网站，支持 WebDAV 和 SQLite 双重存储模式，专为个人收藏记录设计。

## 功能特性

- **前端展示**：极简卡片流，支持封面、评分、日期和标签筛选。
- **后台管理**：通过 `/tat` 路径访问，支持可视化管理卡片、分类和网站设置。
- **双模存储**：
  - **SQLite (默认)**：基于本地文件的零配置数据库，适合 VPS/NAS 部署。
  - **WebDAV**：基于 WebDAV 协议同步数据，适合 Serverless (Vercel) 部署或数据漫游。
- **实时模式切换**：管理员在后台切换存储模式后，所有访客自动读取对应数据源，无需手动配置。
- **响应式设计**：完美适配桌面端和移动端。
- **深色模式**：支持浅色/深色/跟随系统三种主题。

## 项目结构说明

```
├── src/
│   ├── components/       # React 组件
│   ├── services/
│   │   ├── storageFactory.ts   # 存储适配器工厂（核心）
│   │   ├── storageAdapter.ts   # 适配器接口定义
│   │   └── webdavService.ts    # WebDAV 服务实现
│   └── App.tsx           # 应用入口
├── server.js             # 生产环境服务器
├── vite.config.ts        # 开发服务器配置（含 SQLite 中间件）
├── data/                 # SQLite 数据库目录（自动创建）
└── api/                  # Vercel Serverless Functions
```

## 部署说明

### 方式一：部署到 VPS / Docker (推荐)

本项目内置了生产环境服务器 (`server.js`)，可以直接在任何 Node.js 环境中运行，完美支持 SQLite 存储。

1. **环境准备**
   确保服务器已安装 Node.js (v18+)。

2. **获取代码**
   ```bash
   git clone https://github.com/your-repo/anime_sa.git
   cd anime_sa
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
   PORT=20003 npm start
   ```
   
   > 建议使用 `pm2` 进行进程守护：`pm2 start server.js --name anime_sa`

5. **配置 WebDAV (可选)**
   如需使用 WebDAV 存储，创建 `.env` 文件：
   ```bash
   VITE_WEBDAV_URL=https://dav.jianguoyun.com/dav/
   VITE_WEBDAV_USERNAME=your_email@example.com
   VITE_WEBDAV_PASSWORD=your_password
   VITE_WEBDAV_PATH=my-collection/
   ```

### 方式二：部署到 Vercel (Serverless)

Vercel 环境不支持本地 SQLite 持久化，**必须使用 WebDAV** 进行数据存储。

1. **配置环境变量**
   在 Vercel 项目设置中添加：
   - `VITE_WEBDAV_URL`
   - `VITE_WEBDAV_USERNAME`
   - `VITE_WEBDAV_PASSWORD`
   - `VITE_WEBDAV_PATH` (可选)

2. **部署后在后台切换到 WebDAV 模式**

## 首次使用

1. **访问后台**
   浏览器访问 `http://your-domain/tat`

2. **默认账号**
   - 账号：`admin`
   - 密码：`password`

3. **安全设置**
   登录后请立即在"网站设置"中修改管理员账号密码。

## 存储模式说明

| 特性 | SQLite | WebDAV |
|------|--------|--------|
| 配置复杂度 | 零配置 | 需要配置服务器信息 |
| 数据位置 | 本地 `data/local.db` | 远程 WebDAV 服务器 |
| 适用场景 | VPS、NAS、Docker | Vercel、多设备同步 |
| 性能 | 极快 | 取决于网络 |

**切换方式**：管理员登录后台 → 存储设置 → 点击切换模式，切换后所有访客自动生效。

## 开发指南

### 本地开发
```bash
# 启动开发服务器 (热重载 + 内置 SQLite API)
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 技术栈
- React 18 + TypeScript
- Vite
- Tailwind CSS
- better-sqlite3
- Lucide Icons

## License

MIT
