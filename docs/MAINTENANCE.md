# 维护与运维手册

本文面向项目维护者，补充 README 中不适合展开的运行与排障细节。

## 1. 存储模式与数据位置

- SQLite：
  - 主数据：`kv_store` 中 `public_data` / `private_data`
  - 封面：`kv_store` 中 `media:*`
- WebDAV：
  - 主数据：`public_data.json` / `private_data.json`
  - 封面：`covers/` 目录

切换路径：后台 `/tat` -> 数据同步。

## 2. 管理员凭据机制

- 密码统一使用哈希存储（`scrypt`）。
- 历史明文凭据会在登录/保存流程中迁移。
- 凭据更新走专用接口：
  - `GET /api/sqlite/admin-profile`
  - `POST /api/sqlite/admin-credentials`
  - `POST /api/sqlite/admin-credentials-sync?target=sqlite|webdav`
- 账号或密码发生变更时，会话会被清理并要求重新登录。

## 3. 封面资源清理（GC）

- 接口：`POST /api/sqlite/media-gc?target=sqlite|webdav&limit=80`
- 返回：`removed` / `checked` / `pending` / `hasMore`
- 建议：通过后台“封面资源清理”按钮按批次执行，避免一次清理阻塞。

## 4. 封面多规格与加载策略

### 4.1 数据结构

- `CardData` 新增 `coverVariants` 字段：
  - `thumb`：卡片列表/分区默认使用（小图）
  - `card`：详情页主封面默认使用（中图）
  - `original`：详情页“查看原图”使用
- `coverUrl` 仍保留，用于兼容历史数据与回退（等价于 `original`）。

### 4.2 上传与生成

- 新上传本地封面时会自动生成并上传三种规格：
  - `thumb`：约 480px 宽
  - `card`：约 960px 宽
  - `original`：原图
- GIF / SVG 不做 Canvas 重采样，直接复用原图。

### 4.3 前端读取规则

- 首页/分区/搜索等卡片位：优先 `thumb`。
- Hero 与详情主封面：优先 `card`。
- 详情页点击封面右上角放大图标：按需加载 `original`。

### 4.4 历史数据批量优化

- 路径：后台 `/tat` -> 数据同步 -> “封面缩略图优化” -> “一键优化已有封面”。
- 作用：对缺少 `thumb/card/original` 的历史卡片批量补齐，无需逐条编辑保存。
- 注意：仅同源可访问的原图可自动补齐；跨域不可读资源会跳过并计入失败数。

## 5. 操作日志

- 查询接口：`GET /api/sqlite/audit-logs?limit=20`
- 日志保留：最新 200 条（环形裁剪）
- 典型动作：
  - `update_admin_credentials`
  - `sync_admin_credentials`
  - `run_media_gc`
  - `write_public_data`
  - `write_storage_mode`
  - `write_private_data`

## 6. 发布与回归建议

发布前：

```bash
npm run lint
npm run test
npm run build
```

上线后最小验收：

1. 后台登录与退出正常。
2. 卡片新增/编辑/同步正常。
3. 安全选项改账号或密码后能重新登录。
4. 封面清理可执行并有进度。
5. 操作日志可查看并能刷新。

## 7. 常见故障

- 登录失败：
  - 检查 `.env` 的 `ADMIN_*` 是否正确。
  - 检查 `private_data` 是否被非法结构覆盖。
- WebDAV 同步失败：
  - 检查 `VITE_WEBDAV_*` 配置。
  - 检查服务端是否支持 `PROPFIND/PUT/DELETE`。
- 清理失败：
  - 先在日志里查看 `run_media_gc` 失败记录。
  - WebDAV 失败时优先排查目录权限与方法限制。
- 缩略图优化失败：
  - 先确认原图 URL 可在浏览器直接访问。
  - 若为跨域资源且目标源未允许读取，系统会跳过该卡片（不会阻塞其余卡片）。
