# 维护与运维手册

## 环境变量

| 变量 | 场景 | 说明 |
|---|---|---|
| `ADMIN_USERNAME` | 首次启动 | 管理员初始账号 |
| `ADMIN_PASSWORD` | 首次启动 | 管理员初始密码 |
| `PORT` | Node.js / Docker | HTTP 端口，默认 `3000` |
| `TRUST_PROXY` | Node.js / Docker | 可信代理地址头开关 |
| `REDIS_URL` | Vercel | 完整 `redis://` 或 `rediss://` 连接串 |
| `REDIS_PREFIX` | Vercel | Redis Key 前缀，默认 `anime-sa` |

## 运行检查

- 健康检查：`GET /api/storage?key=ping`
- 驱动检查：`GET /api/storage?key=driver`
- Node.js / Docker 返回 `sqlite`
- Vercel 返回 `redis`

## Docker

- 持久化目录：`/app/data`
- 数据库文件：`/app/data/local.db`
- 运行用户：UID `1000` 的 `node`
- 生产环境通过 HTTPS 反向代理访问

## Redis

- 使用支持 TLS 的 `rediss://` 连接串。
- 公共数据、凭据和媒体 Key 不设置 TTL。
- Session 和限流 Key 设置 TTL。
- Redis 实例需要启用持久化或托管备份。
- 达到套餐容量前清理未引用封面或升级容量。

## API

| 接口 | 用途 |
|---|---|
| `/api/storage/login` | 管理员登录 |
| `/api/storage/logout` | 管理员登出 |
| `/api/storage/session` | Session 检查 |
| `/api/storage?key=public_data` | 公共数据读写 |
| `/api/storage?key=private_data` | 私有数据读写 |
| `/api/storage/media` | 封面读写 |
| `/api/storage/media-gc` | 封面清理 |
| `/api/storage/audit-logs` | 审计日志 |

## 日常检查

```powershell
npm run lint
npm run audit:prod
npm run audit:all
npm test
npm run build
```

## 故障排查

### SQLite

- 检查 `data/` 的 UID `1000` 写权限。
- 请求 `/api/storage?key=ping`。
- 检查 `data/local.db` 是否可读取。

### Redis

- 检查 `REDIS_URL` 是否包含协议、账号、密码、主机和端口。
- 检查 Redis 服务是否允许 Vercel 网络连接。
- 检查 TLS 与连接数限制。
- 检查 Redis Key 是否使用一致的 `REDIS_PREFIX`。
