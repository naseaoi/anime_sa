# 维护与运维手册

## 运行要求

- Node.js `20.19.0` 或更高版本
- 生产入口：`npm start`
- 默认端口：`3000`
- 健康检查：`GET /api/sqlite?key=ping`
- 数据目录：`data/`

架构与扩展边界见 `docs/ARCHITECTURE.md`。

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `ADMIN_USERNAME` | 首次启动 | 管理员初始账号 |
| `ADMIN_PASSWORD` | 首次启动 | 管理员初始密码 |
| `PORT` | 否 | HTTP 端口，默认 `3000` |
| `WEBDAV_URL` | WebDAV 模式 | WebDAV 根地址 |
| `WEBDAV_USERNAME` | WebDAV 模式 | WebDAV 账号 |
| `WEBDAV_PASSWORD` | WebDAV 模式 | WebDAV 密码 |
| `WEBDAV_PATH` | 否 | 存储目录，默认 `my-collection` |
| `TRUST_PROXY` | 否 | 可信反向代理地址头开关，默认 `0` |

`TRUST_PROXY=1` 只用于会覆盖 `X-Real-IP` 和 `X-Forwarded-For` 的可信代理。

## 存储

| 数据 | SQLite | WebDAV |
|---|---|---|
| 公共数据 | `kv_store`：`public_data` | `public_data.json` |
| 私有数据 | `kv_store`：`private_data` | `private_data.json` |
| 封面 | `kv_store`：`media:*` | `covers/` |
| 审计日志 | `kv_store`：`audit_logs` | SQLite |

SQLite 数据库路径为 `data/local.db`。存储模式在后台 `/tat` 的数据同步页面切换。

普通编辑使用版本检查，冲突返回 409。跨存储同步是显式覆盖操作。

## 认证与安全参数

| 项目 | 配置 |
|---|---|
| 密码 | scrypt，格式 `scrypt$N$r$p$salt$derived` |
| Session Cookie | `tat_session` |
| Session 有效期 | 普通登录 1 天，记住登录 30 天 |
| 通用限流 | 600 次/IP/分钟 |
| 登录限流 | 20 次/IP/10 分钟 |
| 通用请求体 | 1 MB |
| 媒体请求体 | 10 MB |
| 审计日志 | 最新 200 条 |

修改管理员账号或密码会清除全部 Session。

## Docker

- 运行用户：`node`，UID `1000`
- 持久化目录：`/app/data`
- 健康检查：`GET /api/sqlite?key=ping`
- Linux 宿主机挂载目录需要允许 UID `1000` 读写
- 生产环境 Cookie 带 `Secure`，外部访问需要 HTTPS 反向代理

## API 摘要

| 接口 | 用途 |
|---|---|
| `/api/sqlite/login` | 管理员登录 |
| `/api/sqlite/logout` | 管理员登出 |
| `/api/sqlite/session` | Session 检查 |
| `/api/sqlite?key=public_data` | 公共数据读写 |
| `/api/sqlite?key=private_data` | 私有数据读写 |
| `/api/sqlite?key=storage_mode` | 存储模式读写 |
| `/api/sqlite/media` | SQLite 封面读写 |
| `/api/sqlite/media-gc` | 封面清理 |
| `/api/sqlite/audit-logs` | 审计日志 |
| `/api/webdav` | WebDAV 代理 |

私有数据、管理接口和写操作需要有效 Session。

## 日常检查

```powershell
npm run lint
npm run audit:prod
npm run audit:all
npm test
npm run build
```

CI 同时执行 Docker 构建和容器漏洞扫描。

## 备份与发布

- 备份与恢复：`docs/BACKUP_AND_RECOVERY.md`
- 发布流程：`docs/RELEASE.md`

## 故障排查

### 登录失败

- 检查 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`
- 检查当前存储模式中的 `private_data`
- 检查登录限流和代理地址配置

### WebDAV 失败

- 检查全部 `WEBDAV_*` 配置
- 检查 `PROPFIND`、`MKCOL`、`PUT` 和 `DELETE` 权限
- 检查目标目录和 `covers/` 目录权限

### 数据冲突

- 409 表示页面数据版本落后
- 刷新页面后重新编辑
- 跨存储覆盖前创建备份

### 容器不健康

- 检查 `data/` 目录权限
- 检查 Node.js 进程日志
- 请求 `/api/sqlite?key=ping` 验证 SQLite 服务
