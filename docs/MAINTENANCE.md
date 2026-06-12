# 维护与运维手册

## 存储模式

项目支持 SQLite 和 WebDAV 两种存储模式，可在后台 `/tat` → 数据同步 中切换。

| 数据 | SQLite | WebDAV |
|---|---|---|
| 公开数据 | `kv_store` key: `public_data` | `public_data.json` |
| 私有数据 | `kv_store` key: `private_data` | `private_data.json` |
| 封面 | `kv_store` key: `media:*` | `covers/` 目录 |

SQLite 数据库路径：`data/local.db`（运行时自动创建）。

API 业务逻辑入口：本地/Docker 在 `server/core/apiCore.js`；Vercel 部署走独立的 `api/webdav.ts`（仅 WebDAV）。前端存储适配在 `src/services/storageFactory.ts`。

## API 接口

### 认证

| 接口 | 方法 | 认证 | 说明 |
|---|---|---|---|
| `/api/sqlite/login` | POST | 无 | 登录，支持 `remember` 参数 |
| `/api/sqlite/logout` | POST | 无 | 登出，清除 Session |
| `/api/sqlite/session` | GET | 无 | 检查 Session 有效性 |

### 管理（需认证）

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/sqlite/admin-profile` | GET | 获取管理员用户名 |
| `/api/sqlite/admin-credentials` | POST | 修改管理员账号/密码 |
| `/api/sqlite/admin-credentials-sync?target=sqlite\|webdav` | POST | 跨存储同步凭据 |
| `/api/sqlite/media-gc?target=sqlite\|webdav&limit=100` | POST | 清理未引用封面（默认 limit=100，范围 1-500） |
| `/api/sqlite/audit-logs?limit=50` | GET | 查询日志（默认 limit=50，范围 1-200） |
| `/api/sqlite/audit-logs` | POST | 写入日志（需认证，供前端同步流程记录失败） |
| `/api/sqlite/media?name=xxx` | GET/POST/DELETE | 封面 CRUD（POST/DELETE 需认证） |
| `/api/sqlite?key=xxx` | GET/POST | KV 读写（写操作及 private_data 读取需认证） |
| `/api/webdav` | * | WebDAV 代理（写操作及 private_data 需认证） |

## 安全机制

### 密码

- 算法：scrypt（N=16384, r=8, p=1, keylen=64）
- 格式：`scrypt$N$r$p$salt$derived`
- 历史明文凭据在登录流程中自动迁移为哈希
- 凭据变更后所有 Session 自动清除，要求重新登录

### Session

- Cookie 名：`tat_session`
- Token：32 字节随机（64 字符 hex）
- 过期：记住登录 30 天，否则 1 天
- 属性：`HttpOnly; SameSite=Strict`，生产环境加 `Secure`

### 限流

| 范围 | 限制 | 窗口 |
|---|---|---|
| 通用 API | 600 次/IP | 1 分钟 |
| 登录接口 | 20 次/IP | 10 分钟 |

超限返回 429 + `Retry-After` 头。

### 请求体限制

- 通用：1 MB
- 媒体上传：10 MB

## 日志

保留最新 200 条（环形裁剪）。

action 类型：

| action | 触发场景 |
|---|---|
| `update_admin_credentials` | 修改管理员账号或密码 |
| `sync_admin_credentials` | 跨存储同步凭据 |
| `sync_public_data` | 跨存储同步公共数据 |
| `run_media_gc` | 执行封面清理 |
| `write_public_data` | 写入公开数据 |
| `write_private_data` | 写入私有数据 |
| `write_storage_mode` | 切换存储模式 |

## 发布检查

发布前：

```bash
npm run lint
npm run test
npm run build
```

上线验收：

1. 后台登录与退出正常
2. 卡片新增/编辑/同步正常
3. 修改账号或密码后能重新登录
4. 封面清理可执行并有进度
5. 日志可查看

## 常见故障

**登录失败**
- 检查 `.env` 中 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 是否正确
- 检查 `private_data` 是否被非法结构覆盖

**WebDAV 同步失败**
- 检查 `WEBDAV_*` 环境变量配置
- 确认 WebDAV 服务端支持 `PROPFIND` / `PUT` / `DELETE` 方法

**封面清理失败**
- 查看日志中 `run_media_gc` 的失败记录
- WebDAV 模式下优先排查目录权限与方法限制
