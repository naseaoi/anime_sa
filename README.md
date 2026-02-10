# anime_sa

个人记录向收藏站点（前台展示 + 后台管理），支持 `SQLite` / `WebDAV` 双存储模式。

## 快速开始

```bash
npm install
npm run dev
```

- 前台：`http://localhost:5173/`
- 后台：`http://localhost:5173/tat`

生产运行：

```bash
npm run build
npm start
```

## 核心能力

- 卡片系统：搜索、筛选、排序、结构化首页分区、详情页。
- 后台管理：卡片、分类、站点设置、存储切换、数据同步。
- 双存储：SQLite（默认）与 WebDAV（可切换覆盖同步）。
- 封面治理：
  - 上传封面自动生成多规格（`thumb` / `card` / `original`）。
  - 列表默认走缩略图，详情页可按需查看原图。
  - 支持后台一键批量补齐历史封面缩略图。
  - 支持封面垃圾回收（删除未引用资源）。
- 安全机制：会话鉴权、登录限流、管理员凭据哈希化与会话失效。

## 环境变量

WebDAV（可选）：

```bash
VITE_WEBDAV_URL=https://dav.example.com/dav/
VITE_WEBDAV_USERNAME=your_username
VITE_WEBDAV_PASSWORD=your_password
VITE_WEBDAV_PATH=my-collection/
```

管理员初始化（推荐）：

```bash
ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=your_password
```

## 常用命令

```bash
npm run dev
npm run lint
npm run test
npm run build
npm start
```

## 管理后台常用路径

- ` /tat/cards `：卡片管理
- ` /tat/tags `：分类管理
- ` /tat/sync `：存储切换 / 数据覆盖 / 封面清理 / 封面缩略图优化
- ` /tat/settings `：站点与管理员安全配置

## 项目结构

```text
anime_sa/
  api/                      Vercel Serverless 入口（webdav/sqlite）
  data/                     SQLite 数据目录（运行时生成，如 local.db）
  docs/                     维护文档
    MAINTENANCE.md
  server/                   服务端安全与共享逻辑
    sharedSecurity.js
  src/
    components/             前台与后台 UI 组件
      admin/                后台子模块（cards/tags/sync/settings）
      public/               前台卡片网格等公共展示组件
    services/               存储适配、封面处理、数据读写
    utils/                  业务工具（路由、图标、统计、封面选择器）
    types.ts                核心类型定义
    App.tsx                 路由与应用入口组件
    styles.css              全局样式
  server.js                 生产 Node 服务（静态资源 + API）
  vite.config.ts            开发态构建与中间件配置
```

## 文档导航

- 维护与运维手册：`docs/MAINTENANCE.md`

## License

MIT
