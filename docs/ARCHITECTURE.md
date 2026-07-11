# 架构说明

## 运行边界

| 运行方式 | 存储驱动 | 持久化位置 |
|---|---|---|
| Node.js / Docker | SQLite | `data/local.db` |
| Vercel Functions | Redis | `REDIS_URL` 指向的实例 |

前端统一调用 `/api/storage`，不包含数据库协议与连接信息。旧 `/api/sqlite` 路径仅作为已有 SQLite 封面 URL 的兼容入口。

## 依赖方向

```text
components/hooks → services → domain/types
server.js/devMiddleware → SQLite storage API → core modules
api/storage.ts → Redis storage API → server/storage
```

`src/services/storageFactory.ts` 是客户端数据访问边界。SQLite 与 Redis 提供相同的数据、媒体、认证、审计和维护接口。

## 驱动契约

新增 MySQL 等驱动时需要实现以下能力：

- 公共数据读取、写入与版本冲突检查
- 私有凭据读取与写入
- 媒体读取、写入、删除和枚举
- Session 创建、校验、删除和批量失效
- 审计日志追加与分页读取
- 限流计数和健康检查

新驱动通过独立服务端模块接入 `/api/storage`，不修改页面组件和领域模型。

## 数据键

| 数据 | SQLite | Redis |
|---|---|---|
| 公共数据 | `public_data` | `<prefix>:public_data` |
| 私有凭据 | `private_data` | `<prefix>:private_data` |
| 封面 | `media:<name>` | `<prefix>:media:<name>` |
| Session | `session:<token>` | `<prefix>:session:<token>` |
| 审计日志 | `audit_logs` | `<prefix>:audit` |

## 一致性与安全

- 公共数据通过 `updatedAt` 执行乐观并发检查，冲突返回 409。
- Redis 使用 Lua 脚本原子完成版本比较和写入。
- 写请求校验 `Origin` 或 `Referer`。
- Session Cookie 使用 `HttpOnly`、`SameSite=Strict`，生产环境使用 `Secure`。
- 外部图片代理拒绝本地、回环和私有地址。
- 公共数据和媒体名称进入存储前执行结构与边界校验。

## 验证

```powershell
npm run lint
npm run audit:all
npm test
npm run build
```
