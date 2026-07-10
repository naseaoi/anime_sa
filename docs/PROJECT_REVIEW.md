# 工程质量与安全基线

## 支持范围

| 部署方式 | 状态 | 存储能力 |
|---|---|---|
| Node.js | 支持 | SQLite、WebDAV |
| Docker | 支持 | SQLite、WebDAV |
| Vercel | 不支持 | 所有 `/api/*` 请求返回 410 |

运行环境要求 Node.js `20.19.0` 或更高版本。Node.js 与 Docker 使用相同的服务端核心模块，Vercel 不承载认证、存储或媒体代理。

## 服务端结构

| 模块 | 职责 |
|---|---|
| `server/core/apiCore.js` | API 路由与业务编排 |
| `server/core/kvStore.js` | SQLite KV 访问与存储模式 |
| `server/core/sessionStore.js` | Session 与 Cookie |
| `server/core/auditStore.js` | 审计日志 |
| `server/core/httpUtils.js` | HTTP 请求与响应工具 |
| `server/core/requestOrigin.js` | 写请求同源校验 |
| `server/core/remoteSecurity.js` | 远程地址与 DNS 校验 |
| `server/publicDataValidation.js` | 公共数据结构校验 |
| `server/sharedSecurity.js` | 密码与输入安全工具 |

## 数据完整性

- SQLite 和 WebDAV 读取故障会返回错误，不会转换为空数据。
- 存储文件不存在时返回默认数据。
- 管理后台、详情编辑和快速添加使用 `updatedAt` 执行版本检查。
- SQLite 在写入前比较当前版本，版本冲突返回 409。
- WebDAV 在写入前比较当前版本，并在服务端提供 ETag 时使用 `If-Match`。
- 跨存储覆盖同步属于显式覆盖操作，不使用目标端版本检查。

## 数据校验

服务端只接受符合以下范围的 `public_data`：

| 数据 | 范围 |
|---|---|
| 分类数量 | 最多 200 个 |
| 卡片数量 | 最多 2000 个 |
| 单卡分类数量 | 最多 200 个 |
| 标题 | 最多 200 字符 |
| 描述 | 最多 20000 字符 |
| 资源 URL | 最多 4096 字符 |
| 内嵌图片 | 最多 1 MB |
| 评分 | 0–5 |
| 主题色 | `#RRGGBB` |

分类 ID 和卡片 ID 必须唯一，卡片引用的分类必须存在。资源地址只允许同源绝对路径、HTTP、HTTPS 和图片 Data URL。

SQLite KV 写接口仅接受 `public_data`、`private_data` 和 `storage_mode`。公开读取仅允许 `public_data`、`storage_mode` 和 `ping`。

## WebDAV 边界

WebDAV filename 仅允许：

- 空路径
- `public_data.json`
- `private_data.json`
- `covers`
- `covers/<文件名>`

文件名只允许字母、数字、点、下划线和横线。路径穿越、反斜杠、空路径段、嵌套封面目录和未知根文件返回 400。

`private_data.json` 的读取和全部写方法需要有效 Session。

## 网络与浏览器安全

- 默认使用 TCP 连接地址进行限流和审计。
- `TRUST_PROXY=1` 时读取可信代理写入的 `X-Real-IP`，其次读取 `X-Forwarded-For` 最后一项。
- 写请求校验 `Origin` 或 `Referer`，Session Cookie 使用 `HttpOnly` 和 `SameSite=Strict`。
- 外部图片代理只允许 HTTP 和 HTTPS，并在 DNS 连接阶段拒绝本地、回环和私有地址。
- CSP 的 `script-src` 仅允许同源脚本，不包含 `unsafe-inline`。
- 管理后台使用 `noindex,nofollow`，公开页面维护标题、描述、Canonical、Open Graph 和 Twitter 元数据。
- 模态框支持焦点锁定、Esc 关闭、关闭后焦点恢复和 ARIA dialog 语义。

## 容器与供应链

- Docker 运行进程使用 `node` 非 root 用户。
- 容器健康检查访问 `/api/sqlite?key=ping`。
- GitHub Actions 第三方 Action 使用完整提交 SHA。
- CI 执行静态检查、完整依赖审计、测试、构建和容器高危漏洞扫描。
- Dependabot 每周检查 npm、GitHub Actions 和 Docker 依赖。

## 工程检查

```powershell
npm run lint
npm run audit:prod
npm run audit:all
npm test
npm run build
```

`npm run lint` 包含 ESLint、客户端与服务端 TypeScript 检查、服务端与启动脚本语法检查。
