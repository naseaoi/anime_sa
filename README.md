# anime_sa

轻量的个人收藏站，前台展示 + 后台管理，支持 `SQLite` / `WebDAV` 双存储。

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

- 卡片展示：筛选、搜索、排序、详情页。
- 后台管理：卡片、分类、站点配置、数据同步。
- 双存储：SQLite（默认）和 WebDAV（可切换）。
- 体积治理：封面外置存储 + 分批清理未引用封面。
- 安全：会话鉴权、登录限流、管理员凭据哈希化与校验。

## 必要配置

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
```

## 项目结构

```text
src/components/      前后端界面组件
src/services/        存储适配与 API 封装
src/utils/           工具函数与单测
server.js            生产服务
vite.config.ts       开发态 API 中间件
data/local.db        SQLite 数据文件（自动创建）
```

## 文档导航

- 维护与运维手册：`docs/MAINTENANCE.md`

> README 保持“新成员 3 分钟上手”；详细维护细节放到独立文档，便于长期维护。

## License

MIT
