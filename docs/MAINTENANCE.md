# 维护与运维手册

## 存储模式

项目支持 SQLite 和 WebDAV 两种存储模式，可在后台 `/tat` → 数据同步 中切换。

| 数据 | SQLite | WebDAV |
|---|---|---|
| 公开数据 | `kv_store` key: `public_data` | `public_data.json` |
| 私有数据 | `kv_store` key: `private_data` | `private_data.json` |
| 封面 | `kv_store` key: `media:*` | `covers/` 目录 |

SQLite 数据库路径：`data/local.db`（运行时自动创建）。

API 编排入口为 `server/core/apiCore.js`，存储、Session、审计、同源校验和远程地址校验位于 `server/core/` 的独立模块。前端存储适配位于 `src/services/storageFactory.ts`。

Vercel 不在支持范围内，`api/sqlite.ts` 和 `api/webdav.ts` 统一返回 410，不会访问存储。

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
| `/api/sqlite?key=public_data` | GET/POST | 公共数据读写，写入需认证和结构校验 |
| `/api/sqlite?key=private_data` | GET/POST | 私有数据读写，需认证 |
| `/api/sqlite?key=storage_mode` | GET/POST | 存储模式读写，写入需认证 |
| `/api/webdav` | * | WebDAV 代理（写操作及 private_data 需认证） |

WebDAV filename 仅允许以下形式：

- 空路径
- `public_data.json`
- `private_data.json`
- `covers`
- `covers/<安全文件名>`

包含 `..`、反斜杠、空路径段或未知根文件的请求返回 400。

### 数据版本

普通编辑写入使用 `X-Expected-Updated-At` 请求头。当前存储版本与请求版本不一致时返回 409，客户端需要刷新数据后重新编辑。

SQLite 执行版本比较后写入。WebDAV 执行版本比较，并在服务端返回 ETag 时使用 `If-Match` 条件写入。覆盖同步不使用版本检查。

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
- Docker 镜像默认使用生产环境，正式访问需要 HTTPS 反向代理

### 限流

| 范围 | 限制 | 窗口 |
|---|---|---|
| 通用 API | 600 次/IP | 1 分钟 |
| 登录接口 | 20 次/IP | 10 分钟 |

超限返回 429 + `Retry-After` 头。

默认按 TCP 连接地址限流。使用可信反向代理时可设置 `TRUST_PROXY=1`，代理必须覆盖 `X-Real-IP` 和 `X-Forwarded-For`。

### 请求体限制

- 通用：1 MB
- 媒体上传：10 MB

### 浏览器安全

- `script-src` 仅允许同源脚本
- 写请求校验 `Origin` 或 `Referer`
- 模态框支持焦点锁定、Esc 关闭和焦点恢复
- 管理后台页面元数据使用 `noindex,nofollow`

### 容器

- 运行用户：`node`，UID `1000`
- 健康检查：`GET /api/sqlite?key=ping`
- Linux 宿主机的 `data/` 挂载目录需要允许 UID `1000` 读写

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
npm run audit:prod
npm run audit:all
npm run test
npm run build
```

CI 还会构建 Docker 镜像并扫描存在修复版本的高危和严重漏洞。第三方 Action 使用完整提交 SHA。

上线验收：

1. 后台登录与退出正常
2. 卡片新增/编辑/同步正常
3. 修改账号或密码后能重新登录
4. 封面清理可执行并有进度
5. 日志可查看

## 备份与恢复

备份范围、命令和恢复顺序见 `docs/BACKUP_AND_RECOVERY.md`。

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
