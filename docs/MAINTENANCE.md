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

## 4. 操作日志

- 查询接口：`GET /api/sqlite/audit-logs?limit=20`
- 日志保留：最新 200 条（环形裁剪）
- 典型动作：
  - `update_admin_credentials`
  - `sync_admin_credentials`
  - `run_media_gc`
  - `write_public_data`
  - `write_storage_mode`
  - `write_private_data`

## 5. 发布与回归建议

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

## 6. 常见故障

- 登录失败：
  - 检查 `.env` 的 `ADMIN_*` 是否正确。
  - 检查 `private_data` 是否被非法结构覆盖。
- WebDAV 同步失败：
  - 检查 `VITE_WEBDAV_*` 配置。
  - 检查服务端是否支持 `PROPFIND/PUT/DELETE`。
- 清理失败：
  - 先在日志里查看 `run_media_gc` 失败记录。
  - WebDAV 失败时优先排查目录权限与方法限制。
