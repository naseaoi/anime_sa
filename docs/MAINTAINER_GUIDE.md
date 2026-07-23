# 维护者约束、兼容入口与高风险改动

本文记录修改代码时必须保留的行为契约、兼容入口和容易误判的边界。它描述的是当前实现，不代表所有现状都值得长期保留。

部署、备份和常用命令见根目录 [`README.md`](../README.md)，API 字段和错误码见 [`docs/API_CONTRACT.md`](./API_CONTRACT.md)，公共数据容量策略见 [`docs/DATA_MODEL_POLICY.md`](./DATA_MODEL_POLICY.md)，发版流程见 [`docs/RELEASE.md`](./RELEASE.md)。文中涉及限制和路由时，以代码和测试为最终来源。

## 开工前

先按改动面阅读对应章节，再检查代码和测试：

| 改动面 | 必读章节 |
|---|---|
| 数据模型、保存、并发 | 一、三、八 |
| API、存储、鉴权 | 二、三、六、八 |
| 媒体、封面、GC | 二、五、八 |
| 路由、标签、浏览器状态 | 四、七、八 |
| 验证、发布、备份 | 九 |

本文中的规则分为四类：

- **硬契约**：修改后必须保持兼容，例如 `revision`、鉴权和媒体安全校验。
- **兼容保留**：有迁移方案和弃用周期后才能删除，例如旧路由和历史媒体 URL。
- **当前限制**：容量、请求体和字段长度等运行边界。
- **当前现状**：已知但不一定长期保留的行为，重做前先确定替代方案。

## 一、数据模型与保存语义

`public_data` 是整体写入的文档聚合，包含站点设置、标签和全部卡片。SQLite 默认使用 `data/local.db`（目录由 `SQLITE_DATA_DIR` 决定），公共数据保存在 `kv_store`；Redis 使用对应的 KV key。卡片没有独立写入，修改任意卡片都会重写整份文档。

媒体存储、旧 Base64 迁移和 `coverLocalData` 生命周期见第五部分。

公共数据使用整份文档级并发控制，具体 `revision` 流程见第三部分。不能假设不同卡片可以独立并发写入；容量和文档大小按 [`docs/DATA_MODEL_POLICY.md`](./DATA_MODEL_POLICY.md) 的指标维护。

对外返回或写入的 `PublicData`、客户端接收的数据和跨存储传输的数据，必须经过 `shared/publicDataSchema.js` 导出的 `normalizePublicDataPayload`。`src/types.ts` 中的 `PublicData`、`CardData`、`Tag` 和 `SiteSettings` 从该函数的返回值推导；JSDoc 类型和归一化逻辑维护在 `server/publicDataValidation.js`，不要另建 `.d.ts` 类型。

新增 `public_data` JSON 字段通常不需要数据库结构迁移，但必须同步处理归一化、默认值、对象构造点和兼容测试。若字段需要从未保存草稿恢复，再更新 `src/utils/cardDraft.ts` 的白名单和校验；涉及媒体表、私有数据或存储结构时，另行评估迁移。

### 保存语义按入口区分

| 操作 | 语义 | 持久化时机 |
|---|---|---|
| 后台卡片、标签、站点信息 | 暂存 | 更新 `AdminLayout.localData`，顶部“保存”时写入 `public_data` |
| 公开详情页编辑、快速记录 | 即时保存 | 通过 `publicDataMutationService.ts` 处理封面和 revision 后写入 |
| 管理员账号和密码 | 即时保存 | `/admin-credentials` 直接写入，必要时清除全部 Session |
| 同步、封面优化 | 操作内保存 | 通过对应 API 执行；封面优化完成后保存新的公共数据 |
| 媒体 GC | 操作内清理 | 通过对应 API 删除未引用媒体，不修改 `public_data` |

后台卡片弹窗的字段变化使用 `onStage`，关闭弹窗只代表结束编辑。提交成功与提交后刷新分开处理，刷新失败不能改写已提交结果。后台草稿保留到公共数据持久化成功；公开页面提交成功后立即清理草稿。

公共数据写入返回 `PersistenceResult`：

- `persisted`：服务端已经写入。
- `conflict`：乐观锁冲突，不能静默覆盖。
- `failed`：其他失败。

## 二、运行入口与 API 契约

| 场景 | 入口 | 驱动 |
|---|---|---|
| `npm run dev` | Vite 挂载 `server/devMiddleware.ts` | SQLite 或 Redis |
| `npm start` / Docker | `server.js` | SQLite 或 Redis |
| Vercel | `api/storage.ts` | 仅 Redis |

`server/core/storageApiHandler.js` 负责共享 HTTP 编排；SQLite、Redis 和各运行时入口只负责适配。`STORAGE_DRIVER` 在启动时解析，不支持热切换；客户端先调用 `getStorageAsync()` 再读取驱动状态。

API 约束：

- `readJsonObject` 将空 body 视为 `{}`，原始值和数组返回 400；普通请求体上限 1 MiB，媒体上限 10 MiB。
- `public_data` GET 是公开业务数据；`driver`、`ping`、`ready`、Session、容量指标和媒体 GET 是独立端点。`ping` 不连接存储，`ready` 检查活动存储。
- `public_data` 写入、媒体写入/删除、远程图片代理、审计日志和存储传输需要鉴权；凭据只通过专用接口或服务端传输处理。登录、退出和 Session 检查是生命周期例外。
- 状态变更请求必须通过同源校验；新增端点沿用请求体限制、错误响应和相应审计策略。
- 方法不匹配使用 `methodNotAllowed`；其他错误使用 `errorResponse`，保持 JSON、`success: false`、稳定 `code` 和展示用 `error`。客户端按 `code` 分支。

安全响应头唯一来源是 `server/core/securityHeaders.js`。修改后运行 `npm run sync:vercel-headers`，并用 `npm run lint` 检查 `vercel.json` 是否同步；HSTS 仅在生产 Node.js 和 Vercel 发送。

## 三、公共数据写入与版本控制

客户端通过 `X-Expected-Revision` 发送读取时的 `revision`；服务端比较后生成新的 `revision`。成功后才更新本地基线，409 冲突必须保留草稿或提示重新读取，不能静默覆盖。缺少 `revision` 的旧数据由服务端根据 `updatedAt` 派生 `legacy:<timestamp>`，客户端派生逻辑只是兼容兜底。

Redis 使用 Lua 原子比较和写入；SQLite 仅在单进程事务内提供版本检查，不能作为多进程或多实例共享锁。

当前限制：标签 200、卡片 2000、单卡片标签 200、标题 200 字符、简介 20000 字符、普通资源 URL 4096 字符、`coverLocalData` 1,048,576 字符、公共 JSON 请求体 1 MiB、媒体上传和远程图片响应 10 MiB。`coverLocalData` 按字符串长度限制；历史 Base64 图片仍受 JSON 请求体限制。修改限制时同步更新验证常量和客户端校验。

## 四、兼容入口与路由规则

以下是兼容保留入口，不能直接删除：

- `/api/sqlite/*`：历史封面 URL；开发和 Node 会转发到当前驱动，Vercel 不提供 SQLite。
- `/card/:id`：旧详情链接。
- 首页 `?tag=<id-or-slug>`：加载时迁移为路径。
- Vercel `/api/storage/:path* -> /api/storage` rewrite：让 API 子路径进入同一个 Function。

卡片使用多标签，必须保留 `tagIds` 顺序并由 `MultiSelect` 保存完整数组。筛选按 `tagIds` 判断，详情按卡片 ID 查找；section 只用于 URL 和返回位置。没有列表上下文时，默认详情路径取 `tagIds[0]`，调整标签顺序可能改变默认 URL。

section 解析、路径构建和旧 `?tag=` 迁移统一由 `src/utils/routeUtils.ts` 提供。

结构化首页按推荐、在看、顶部卡片、普通标签分区排列，顶部卡片优先无标签内容，前面分区使用过的卡片不再重复出现。标签 slug 支持 Unicode，保留 `recommended`、`watching`、`tat`、`card`；保留词追加 `-tag`，无法生成名称 slug 时使用 `tag-{id}`。归一化保证 ID 和 slug 唯一，历史重复 slug 按 ID 追加确定性后缀；修改 slug 规则会使旧书签失效。

当前现状：无标签且非推荐/在看的卡片暂时回退到 `recommended` 路径。

## 五、封面与媒体生命周期

媒体格式校验、引用扫描和 GC 属于硬契约；新增媒体 URL 或引用字段时必须同步修改对应服务端逻辑。

| 字段 | 职责 |
|---|---|
| `coverUrl` | 原图来源，可为外部 HTTP(S) 或本站媒体 URL |
| `coverVariants.thumb/card/original` | 展示尺寸对应的来源 |
| `coverLocalData` | 上传过程中的临时 Data URL，持久化后清空 |

`persistCardCover` 在浏览器端解码并生成变体，优先 WebP，再通过 `coverMediaClient.ts` 上传，由调用方最后保存 `public_data`。外部 URL 封面会保留 `coverUrl` 作为来源，同时把原图、缩略图和卡片图持久化到站内媒体；媒体响应使用长期浏览器/共享缓存和内容 ETag。封面批处理统一报告进度和失败项。保存冲突或失败时已上传媒体可能暂时孤立，交给 Media GC 处理，不要立即猜测删除。

SQLite 媒体在 `media_store`，Redis 使用 `<prefix>:media:<name>` 和元数据 key；旧 KV Base64 媒体只在读取或传输时兼容迁移，新代码不得写回旧 JSON。

外部 URL 或同源读取失败时使用需管理员 Session 的 `/api/storage/remote-image`。服务端负责 SSRF、重定向、响应类型、签名、超时和大小校验；媒体只接受 JPEG、PNG、WebP、GIF、AVIF，不能放行 SVG 或其他主动内容。

Media GC 只识别 `/api/storage/media?name=...` 和 `/api/sqlite/media?name=...`，扫描 `coverUrl` 及全部 `coverVariants`，仅删除未引用且超过 24 小时宽限期的资源。新增媒体 URL 或引用字段时同步修改 `server/core/mediaGc.js`，并保持 SQLite/Redis 判定一致。

跨存储传输先按名称差集分批复制媒体，再校验并覆盖 `private_data`、`public_data`；无效源数据不覆盖目标，目标多余媒体不删除，凭据覆盖会清除目标 Session，限流和审计日志不传输。传输由服务端 `/api/storage/transfer` 完成，客户端不要新增驱动分支。

## 六、凭据、Session 与审计

`ADMIN_USERNAME`/`ADMIN_PASSWORD` 只在存储中没有有效凭据时初始化；已有 `username` 加 `password` 或 `passwordHash` 后，修改 `.env` 不会覆盖存储值。

后台凭据更新规则：用户名不变且新密码为空时不要求重登录；用户名变化或提交新密码时清除全部 Session；历史明文密码只用于兼容迁移，成功登录后升级为 scrypt，新代码不得写回明文。

SQLite 和 Redis 必须保持同一规则。审计日志经过 `auditContract.js` 和对应的 `appendAuditLog` / `appendRedisAudit`；`action` 只允许字母、数字、下划线、冒号、横线，`status` 只能是 `success` 或 `failed`。生产 Cookie 带 `Secure`，本机 HTTP 运行生产模式会导致浏览器不回传 Session Cookie。

## 七、浏览器端兼容状态

本节是前端状态相关任务的按需兼容细节。

`localStorage` 跨会话，`sessionStorage` 仅当前标签页；所有内容按不可信输入读取。

| Key | 存储 | 用途 |
|---|---|---|
| `tat_site_settings` | localStorage | `public/bootstrap.js` 首屏恢复设置，React 加载后更新 |
| `tat_theme` | localStorage | 主题模式 |
| `tat_sort_config`、`tat_visible_count` | sessionStorage | 当前标签页的排序和列表数量 |
| `tat_home_scroll:<path><query>` | sessionStorage | 当前列表滚动位置 |
| `tat_card_draft:new`、`tat_card_draft:edit:<encoded-id>` | localStorage | 公开编辑草稿 |
| `tat_card_draft:admin:new`、`tat_card_draft:admin:edit:<encoded-id>` | localStorage | 等待后台保存的草稿 |
| `tat_relogin_notice` | sessionStorage | 凭据变更后的登录提示 |

React 端浏览器状态经 `src/utils/browserState.ts` 校验读写；`public/bootstrap.js` 保留首屏所需的最小校验。草稿不保存 `coverLocalData`。公共顶栏只能由 `PublicNavigationProvider` 渲染；认证状态通过 `tat:auth-changed`、`pageshow` 和窗口聚焦复核。封面允许为空，渲染时优先使用 `ImagePreview`；原生 `<img>` 必须先判断 URL。

## 八、按改动类型检查

- **公共数据字段：**核对 `server/publicDataValidation.js`、`src/domain/publicData.ts`、`src/domain/card.ts`、`src/services/publicDataMutationService.ts`、对象构造点和按需的 `src/utils/cardDraft.ts`；补 SQLite、Redis、客户端和旧数据兼容测试。
- **通用存储 API：**先改 `server/core/storageApiHandler.js`，再核对 `server/core/apiCore.js`、`server/storage/redisApi.js`、`server/devMiddleware.ts`、`server.js`、`api/storage.ts`、`vercel.json`、`src/services/storageAdapter.ts` 和对应客户端 service。
- **存储传输：**核对 `server/storage/transferApi.js`、`server/storage/transfer.js`、`src/services/storageMaintenanceClient.ts` 和 `src/components/admin/hooks/useSyncOperations.ts`，保持媒体先于数据传输。
- **凭据和 Session：**核对 `server/core/credentialPolicy.js`、`server/core/adminCredentials.js`、`server/core/sessionCookie.js`、`server/core/sessionStore.js`、`server/storage/redisSession.js`、`server/storage/redisApi.js`、`server/sharedSecurity.js` 和 `src/services/authClient.ts`。
- **请求和媒体安全：**核对 `server/core/constants.js`、`server/core/requestOrigin.js`、`server/core/mediaValidation.js`、`server/core/remoteImage.js`、`server/core/remoteSecurity.js`、`server/core/mediaGc.js`、SQLite/Redis 媒体存储以及客户端封面服务；覆盖上传、远程图片、GC 和失败恢复测试。
- **路由、标签和浏览器状态：**核对 `src/utils/routeUtils.ts`、`src/utils/browserState.ts`、`src/components/PublicHome.tsx`、`src/components/public/PublicNavigationContext.tsx`、`public/bootstrap.js` 和对应兼容测试。

改变共享契约前先补回归测试；兼容入口必须有迁移方案和弃用周期后才能删除。修改数据、API、路由、媒体或 npm scripts 时，同时检查本文引用的路径、命令和规则是否仍然有效。

## 九、验证

版本来自 `VITE_APP_VERSION`，发布流水线从 Git tag 注入；`package.json` 的 `version` 不参与发布，发版步骤见 [`docs/RELEASE.md`](./RELEASE.md)。

按改动风险选择验证范围：

| 改动 | 最低验证 |
|---|---|
| 仅文档或注释 | `git diff --check`，并核对引用路径和命令 |
| 局部客户端逻辑或样式 | `npm run lint`、相关单元测试、`npm run build` |
| 公共数据、API、存储、鉴权、媒体 | `npm run lint`、`npm test`、`npm run test:coverage`、`npm run build` |
| 路由、登录、跨存储或关键用户流程 | 上述验证加 `npm run test:e2e` |
| 安全依赖、发布或部署 | 再运行 `npm run audit:prod`、`npm run audit:all`，按 [`docs/RELEASE.md`](./RELEASE.md) 核对版本和入口 |
| SQLite 结构、迁移或备份 | 再运行 `npm run verify:sqlite-backup -- <backup.db>` |

首次运行 E2E 先执行 `npx playwright install chromium`。支持 Node.js `20.19.0` 及以上，CI 验证 20.19.0 和 24。
