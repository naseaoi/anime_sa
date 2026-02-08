# anime_sa

一个极简风格、卡片式布局的收藏展示网站，支持 WebDAV / SQLite 双存储，适合个人收藏记录与多端浏览。

## 功能特性

- 前台展示：卡片流、标签筛选、搜索、排序、推荐轮播、无限加载。
- 后台管理：`/tat` 登录后可管理卡片、分类、站点设置、数据同步。
- 双模存储：
  - SQLite（默认）：本地 `data/local.db`，适合 VPS / NAS / Docker。
  - WebDAV：远程 JSON 文件，适合 Vercel 等无状态部署。
- 实时切换：后台切换存储模式后，前台自动读取新数据源。
- 响应式 + 主题：移动端适配，支持浅色 / 深色 / 跟随系统。

## 近期更新（2026-02）

- 路由与返回体验：统一详情路由为 `/:section/:id`，并优化为“从哪里打开卡片，返回哪里”。
- 前台侧栏：支持收缩/展开状态持久化（`tat_public_sidebar_collapsed`），并优化图标与文案过渡。
- 分类图标体系：后台分类支持 SVG 图标选择，前台导航与分组标题可复用分类图标（无图标时回退 `|`）。
- 卡片编辑体验：支持本地封面上传（`coverLocalData` 优先于 URL），封面预览、滚动锁、日历样式与交互细节优化。
- 站点 Footer：支持 `footerLeft/footerRight` 配置，兼容旧字段 `footerText`，首页与详情页已统一接入。
- 细节优化：返回顶部按钮行为优化、详情页顶底栏简化、推荐/观看中状态视觉增强。

### 数据字段变更（兼容旧数据）

- `Tag` 新增可选字段：`icon?: string`
- `CardData` 新增可选字段：`coverLocalData?: string`
- `SiteSettings` 新增可选字段：`footerLeft?: string`、`footerRight?: string`（保留 `footerText?` 兼容）

## 安全与性能优化（已落地）

- 服务端会话：后台登录改为 `HttpOnly` Cookie 会话，不依赖前端本地 token。
- 接口鉴权：敏感读取与写入接口统一服务端鉴权拦截。
- 弱口令兜底移除：不再内置 `admin/password` 默认登录。
- 登录与 API 限流：防爆破、抗高频刷接口。
- 响应头与缓存：API `no-store`，静态资源支持 `ETag/304`。
- 压缩传输：静态文本资源支持 `br/gzip`。
- 前端构建：Tailwind 改为本地构建，不依赖 CDN 运行时注入。

## 项目结构

```
├── src/
│   ├── components/
│   │   ├── admin/                # 后台拆分模块
│   │   └── public/               # 前台拆分模块
│   ├── services/                 # 存储适配与接口封装
│   ├── utils/                    # 可复用工具与单测
│   ├── styles.css                # Tailwind 入口与全局样式
│   └── App.tsx
├── server.js                     # 生产服务器（鉴权/限流/静态资源）
├── vite.config.ts                # 开发服务器中间件
├── tailwind.config.js
├── postcss.config.js
└── data/                         # SQLite 数据目录（自动创建）
```

## 环境变量

### WebDAV（可选）

```bash
VITE_WEBDAV_URL=https://dav.example.com/dav/
VITE_WEBDAV_USERNAME=your_username
VITE_WEBDAV_PASSWORD=your_password
VITE_WEBDAV_PATH=my-collection/
```

### 管理员初始化（推荐）

```bash
ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=your_password
```

管理员凭据优先级说明：
- 若存储中已有 `private_data`（历史已设置过账号密码），系统会优先使用它。
- 若存储中不存在管理员凭据，会尝试使用 `ADMIN_USERNAME/ADMIN_PASSWORD` 初始化。
- 因此“不配置这两个环境变量也能登录”是可能的（通常是已有历史凭据）。

## 部署说明

### 方式一：VPS / Docker（推荐）

1. 安装 Node.js 18+。
2. 拉取代码并安装依赖：

```bash
git clone https://github.com/your-repo/anime_sa.git
cd anime_sa
npm install
```

3. 构建并启动：

```bash
npm run build
npm start
```

4. 指定端口：
- Linux/macOS: `PORT=20003 npm start`
- Windows PowerShell: `$env:PORT=20003; npm start`

建议用 `pm2` 守护进程：`pm2 start server.js --name anime_sa`

### 生产更新建议流程（GitHub 推送后）

1. 本地先执行质量检查：

```bash
npm run lint && npm run test && npm run build
```

2. 推送到 GitHub 后，在生产机更新代码并安装依赖（如有变更）：

```bash
git pull
npm install
npm run build
```

3. 重启服务（以 pm2 为例）：

```bash
pm2 restart anime_sa
```

4. 验收要点：
- 前台：侧栏收缩/展开、分类标题与图标、卡片详情返回行为。
- 后台：分类图标选择、卡片编辑（推荐/观看按钮、本地封面、日历）。
- 设置：`footerLeft/footerRight` 生效，旧 `footerText` 回退正常。

### 方式二：Vercel（Serverless）

Vercel 不适合本地 SQLite 持久化，建议仅使用 WebDAV：
- 配置 `VITE_WEBDAV_*` 环境变量。
- 部署后在后台切到 WebDAV 模式。

## 开发与质量命令

```bash
npm run dev        # 本地开发
npm run build      # 生产构建
npm run lint       # TypeScript 类型检查
npm run test       # 单元测试（Vitest）
npm run test:watch # 测试监听模式
```

## 存储模式对比

| 特性 | SQLite | WebDAV |
|------|--------|--------|
| 配置复杂度 | 低 | 中 |
| 数据位置 | 本地 `data/local.db` | 远程 WebDAV 文件 |
| 适用场景 | VPS / NAS / Docker | Vercel / 多端同步 |
| 性能 | 高 | 受网络影响 |

切换路径：后台登录 → 数据同步 → 存储设置。

## License

MIT
