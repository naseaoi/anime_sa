# 维护者约束、兼容入口与高风险改动

本文记录修改代码时必须保留的行为契约、兼容入口和容易误判的边界。它描述的是当前实现，不代表所有现状都值得长期保留。

部署、备份和常用命令见根目录 [`README.md`](../README.md)，API 字段和错误码见 [`docs/API_CONTRACT.md`](./API_CONTRACT.md)，公共数据容量策略见 [`docs/DATA_MODEL_POLICY.md`](./DATA_MODEL_POLICY.md)，发版流程见 [`docs/RELEASE.md`](./RELEASE.md)。文中涉及限制和路由时，以代码和测试为最终来源。

## 一、数据模型与保存语义

### `public_data` 是整体写入的聚合

站点设置、标签和全部卡片作为一份 `PublicData` 写入 `public_data`。SQLite 默认使用 `data/local.db`，实际目录由 `SQLITE_DATA_DIR` 决定；公共数据仍在 `kv_store(key, value)` 中整体保存，没有按卡片拆分的关系表。媒体二进制位于 SQLite 的 `media_store`，不再写入 KV JSON。

因此：

- 修改任意卡片都会重写整份公共数据。
- 新增字段不需要数据库迁移，但必须同步更新运行时归一化、默认值、对象构造点、草稿白名单和兼容测试。
- 并发版本以整份数据的顶层 `updatedAt` 为基线，不能假设不同卡片可以独立写入。
- 卡片容量和文档大小按 [`docs/DATA_MODEL_POLICY.md`](./DATA_MODEL_POLICY.md) 的指标和触发线维护。

公共数据的运行时边界是 `shared/publicDataSchema.js` 导出的 `normalizePublicDataPayload`。SQLite、Redis、客户端读取和跨存储传输都必须经过这个边界。

`src/types.ts` 的 `PublicData`、`CardData`、`Tag` 和 `SiteSettings` 从该函数的返回值推导。JSDoc 类型和归一化逻辑维护在 `server/publicDataValidation.js`；不要重新添加一套独立 `.d.ts` 类型。

### 保存语义按入口区分

| 操作 | 语义 | 持久化时机 |
|---|---|---|
| 后台卡片、标签、站点信息 | 暂存 | 更新 `AdminLayout.localData`，顶部“保存”时写入 `public_data` |
| 公开详情页编辑、快速记录 | 即时保存 | `onPersist` 直接调用存储 API |
| 管理员账号和密码 | 即时保存 | `/admin-credentials` 直接写入，必要时清除全部 Session |
| 同步、媒体 GC、封面优化 | 操作内保存 | 通过对应 API 执行；封面优化完成后会保存新的公共数据 |

后台卡片弹窗的字段变化使用 `onStage`，关闭弹窗只代表结束编辑。后台草稿会保留到公共数据持久化成功；公开页面的 `onPersist` 成功后立即清理草稿。

公共数据写入返回 `PersistenceResult`：

- `persisted`：服务端已经写入。
- `conflict`：乐观锁冲突，不能静默覆盖。
- `failed`：其他失败。

## 二、运行入口与 API 契约

### 三个服务入口

| 场景 | 入口 | 可用驱动 |
|---|---|---|
| `npm run dev` | Vite 挂载 `server/devMiddleware.ts` | SQLite 或 Redis |
| `npm start` / Docker | `server.js` | SQLite 或 Redis |
| Vercel | `api/storage.ts` | 仅 Redis |

`server/core/storageApiHandler.js` 负责共享 HTTP 编排，`server/core/apiCore.js` 和 `server/storage/redisApi.js` 只提供 SQLite/Redis 驱动适配。修改 API 业务时，优先修改共享 handler，再核对两个驱动以及开发、Node 和 Vercel 的路由入口。

`STORAGE_DRIVER` 在进程启动时解析，不支持运行时热切换。配置 `REDIS_URL` 但仍使用 SQLite 是合法状态，此时 Redis 只作为后台跨存储传输的另一端。

客户端需要可靠判断驱动时，先调用 `getStorageAsync()`；不要在驱动加载前把 `getStorage().type` 当作真实配置。

### 读取、写入和错误响应

- `readJsonObject` 把空 body 当作 `{}`；JSON 原始值和数组返回 400。
- `public_data` 是公开的业务数据读取；`driver`、`ping`、`ready`、Session 检查、容量指标和媒体 GET 属于各自的独立端点，不要把它们混称为通用 KV 公开读取。`ping` 不连接存储，`ready` 才检查活动存储。
- `public_data` 的写入，媒体上传/删除，远程图片代理，审计日志和存储传输都必须鉴权。凭据只能通过管理员凭据接口和服务端存储传输处理，不能通过通用 KV HTTP 入口读取或写入。登录、退出和 Session 检查是 Session 生命周期例外。
- 方法不匹配使用 `methodNotAllowed`；其他错误使用 `errorResponse`，保持 JSON、`success: false`、稳定的 `code` 和展示用 `error` 字段。客户端按 `code` 分支，不按错误文本分支。
- 所有写请求继续经过同源校验；新增端点不能绕过该校验、请求体限制或审计入口。

安全响应头的唯一来源是 `server/core/securityHeaders.js`。修改后运行 `npm run sync:vercel-headers` 更新 `vercel.json`，`npm run lint` 会通过 `check:config` 检查是否失步。Node.js 非生产环境不发送 HSTS；生产 Node.js 和 Vercel 会发送。

## 三、公共数据写入与版本控制

客户端保存公共数据时通过 `X-Expected-Updated-At` 发送读取时的版本。正确顺序是：

1. 保存当前数据的 `updatedAt` 作为 `expectedUpdatedAt`。
2. 为待写数据生成新的 `updatedAt`。
3. 服务端成功后再替换本地基线并刷新数据。

冲突返回 409，调用方必须保留本地草稿或提示用户重新读取，不能静默覆盖。

旧数据缺少顶层 `updatedAt` 时，由 `server/publicDataValidation.js` 的 `getPublicDataUpdatedAt` 从卡片时间推导。客户端的 `applyDerivedPublicDataVersion` 只是防御性兼容处理，服务端归一化才是版本判断的权威来源。

Redis 使用 Lua 原子完成版本比较和写入。SQLite 在单进程内使用事务完成版本检查和写入，但仍不是跨进程或多实例共享锁；多进程或多实例部署不能依赖 SQLite 提供同等并发保证。

### 当前限制

| 项目 | 限制 |
|---|---:|
| 标签数量 | 200 |
| 卡片数量 | 2000 |
| 单卡片标签数 | 200 |
| 卡片标题 | 200 字符 |
| 卡片简介 | 20000 字符 |
| 普通资源 URL | 4096 字符 |
| `coverLocalData` | 1,048,576 个字符 |
| 公共数据 JSON 请求体 | 1 MiB |
| 媒体上传和远程图片响应 | 10 MiB，按流式读取累计值限制 |

`coverLocalData` 的限制是字符串长度，不是解码后的图片字节数；历史 Base64 图片仍要受整个公共数据 JSON 请求体限制。新增限制时同步修改 `server/publicDataValidation.js`、`server/core/constants.js` 和相关客户端校验。新上传媒体不应再写入 `coverLocalData`。

## 四、兼容入口与路由规则

以下入口不能当作重复代码直接删除：

- `/api/sqlite/*`：历史封面 URL。开发中间件和 Node 服务会转发到当前活动驱动的处理器；Vercel 不提供 SQLite 驱动。
- `/card/:id`：旧详情链接兼容入口。
- 首页的 `?tag=<id-or-slug>`：加载时迁移到路径形式。
- Vercel 的 `/api/storage/:path* -> /api/storage` rewrite：让 `/api/storage/login`、`/api/storage/media` 等子路径进入同一个 Function；删除后可能落到 SPA HTML，而不是 API JSON。

### 多标签

卡片使用多标签模型，`tagIds` 的顺序必须保留。过滤和标签分区按全部标签匹配；详情页按卡片 ID 查找，URL 中的 section 主要用于路径和返回位置。卡片没有列表上下文时，使用 `tagIds[0]` 生成默认详情路径，因此调整标签顺序可能改变默认 URL，但不改变筛选结果。

编辑器使用 `MultiSelect` 保存完整的 `tagIds`，不能把多标签压缩成单元素数组。

结构化首页的当前优先级是：推荐区、观看中区、顶部卡片，最后才是普通标签分区。被前面分区使用的卡片不会再次进入标签分区。

标签 slug 支持 Unicode，并保留 `recommended`、`watching`、`tat`、`card`。保留词会追加 `-tag`；历史退化值 `tag` 会按名称重算；名称仍无法生成 slug 时使用 `tag-{id}`。

当前服务端只保证标签 ID 唯一，不保证 slug 唯一；新增或修改标签时应避免产生相同 slug。改变 slug 规则会使已有书签和详情返回路径失效。

无标签且非推荐/在看的卡片目前由 `sectionFromCard` 回退到 `recommended` 路径。这是兼容行为，不是准确的业务分类；重做路由时必须先确定无分类卡片的正式 URL。

## 五、封面与媒体生命周期

| 字段 | 职责 |
|---|---|
| `coverUrl` | 规范原图来源，可为外部 HTTP(S) URL 或本站媒体 URL |
| `coverVariants.thumb/card/original` | 不同展示尺寸的实际来源 |
| `coverLocalData` | 上传过程中的临时 Data URL，持久化后应清空 |

`persistCardCover` 在浏览器端解码图片，通过 `src/services/coverImagePipeline.ts` 生成缩略图和卡片图，优先使用 WebP，再由 `src/services/coverMediaClient.ts` 上传媒体，最后由调用方保存 `public_data`。公共数据保存冲突或失败时，已上传媒体可能暂时成为孤立资源，由 Media GC 收口；不要因为一次保存失败就猜测删除媒体，因为同名资源可能已被其他数据引用。

SQLite 媒体保存在 `media_store` BLOB 表，Redis 使用 `<prefix>:media:<name>` 二进制值和 `<prefix>:media-meta:<name>` 元数据。旧 KV Base64 媒体在读取或传输时兼容迁移；新增代码不得重新写入旧 JSON 形式。

外部 URL 生成缩略图时，跨域或同源读取失败会经过需要管理员 Session 的 `/api/storage/remote-image`。服务端负责 SSRF、响应类型和大小检查，不能改成浏览器任意抓取后上传。

媒体写入只接受 JPEG、PNG、WebP、GIF 和 AVIF，并校验文件签名与声明类型一致；SVG 和其他主动内容不得进入公开的同源媒体端点。远程图片逐跳校验重定向目标，并受总超时、重定向次数和流式字节上限约束。

Media GC 只把以下路径中的 `name` 视为本站媒体引用：

- `/api/storage/media?name=...`
- `/api/sqlite/media?name=...`

它会扫描 `coverUrl` 和全部 `coverVariants`。新增媒体 URL 形式或新增资源字段时，必须同步修改 `server/core/mediaGc.js`，否则仍在使用的资源可能被清理。

Media GC 只删除未引用且最后更新时间超过 24 小时的资源。这个宽限期覆盖“媒体已上传但公共数据尚未保存”的窗口；修改媒体元数据或 GC 策略时，SQLite 和 Redis 必须保持相同判定。

跨存储传输先按名称差集分批复制媒体，完成后再校验并覆盖 `private_data` 和 `public_data`。无效的源 `public_data` 不会覆盖目标。凭据被覆盖时会清除目标存储的全部 Session；目标是当前活动驱动时，当前浏览器也必须重新登录。目标端多余媒体不会删除，限流和审计日志不传输。

客户端封面服务只负责图片处理和当前 API 上传；真正的 SQLite/Redis 双向复制由服务端 `/api/storage/transfer` 完成。不要在客户端新增存储驱动分支。

## 六、凭据、Session 与审计

`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 只在存储中没有有效管理员凭据时用于初始化。已有有效的 `username` 加 `password` 或 `passwordHash` 后，修改 `.env` 不会覆盖账号密码；应通过后台安全配置或明确的数据恢复流程处理。

后台安全配置的行为如下：

- 用户名未变化且新密码留空：不要求重新登录。
- 用户名变化，或提交任何非空新密码：清除全部 Session，并要求重新登录。
- 历史明文密码只用于兼容迁移；成功登录后升级为 scrypt 哈希，新代码不得重新写入明文 `password`。

SQLite 和 Redis 的管理员凭据接口必须保持上述行为一致。

审计日志统一经过 `server/core/auditContract.js`。`action` 只能包含字母、数字、下划线、冒号和横线，`status` 只能是 `success` 或 `failed`。不要绕过 `appendAuditLog` / `appendRedisAudit` 直接写底层存储。

生产模式的 Session Cookie 带 `Secure`。本机以 HTTP 启动 `NODE_ENV=production` 时，浏览器不会正常回传该 Cookie，通常表现为“登录成功后仍未登录”。

## 七、浏览器端兼容状态

浏览器存储按不可信输入读取。`localStorage` 跨页面和会话保存，`sessionStorage` 只在当前标签页内保存。

| Key | 存储 | 用途 |
|---|---|---|
| `tat_site_settings` | localStorage | `public/bootstrap.js` 首屏恢复标题、图标和主题色；`App.tsx` 在数据加载后更新 |
| `tat_theme` | localStorage | 主题模式 |
| `tat_sort_config` | sessionStorage | 当前标签页的排序设置 |
| `tat_visible_count` | sessionStorage | 当前标签页的列表加载数量 |
| `tat_home_scroll:<path><query>` | sessionStorage | 当前列表路径的滚动位置 |
| `tat_card_draft:new`、`tat_card_draft:edit:<encoded-id>` | localStorage | 公开页面未保存卡片草稿 |
| `tat_card_draft:admin:new`、`tat_card_draft:admin:edit:<encoded-id>` | localStorage | 等待后台顶部保存的卡片草稿 |
| `tat_relogin_notice` | sessionStorage | 凭据变更后向重新登录页传递提示 |

修改站点设置缓存格式时，必须同时检查 `public/bootstrap.js` 和 React 代码。卡片草稿刻意不保存 `coverLocalData`，避免 Base64 图片占满 `localStorage`。

公共顶栏只能由 `PublicNavigationProvider` 统一渲染，首页和详情页不要各自重新挂载 `PublicTopNav`。登录和退出通过 `tat:auth-changed` 通知全局状态，并在 `pageshow` 和窗口聚焦时复核 Session，以覆盖浏览器后退缓存恢复。

轮播主图、缩略图和详情图使用 `ImagePreview`；渲染原生 `<img>` 前必须确认 URL 非空。推荐卡片允许没有封面，空字符串不能直接作为原生图片地址。

## 八、按改动类型检查

### 新增公共数据字段

- `server/publicDataValidation.js`：JSDoc、归一化逻辑和限制常量。
- `shared/publicDataSchema.js`：共享导出边界。
- `src/domain/publicData.ts`：默认公共数据。
- `src/domain/card.ts`：卡片创建、合并和清理规则。
- 所有新建/合并对象的构造点。
- `src/utils/cardDraft.ts`：字段需要恢复时更新草稿白名单和校验。
- SQLite、Redis、客户端契约、旧数据兼容测试。

### 新增或修改存储 API

- `server/core/storageApiHandler.js`：共享 HTTP 编排、错误码、鉴权和端点行为。
- `server/core/apiCore.js`：SQLite 驱动适配。
- `server/storage/redisApi.js`：Redis/Vercel 驱动适配。
- `api/storage.ts`：Vercel Function 入口。
- `server/devMiddleware.ts`：开发路由挂载。
- `server.js`：Node 路由、驱动分发和限流。
- `vercel.json`：rewrite 和安全头配置。
- 鉴权、同源校验、请求体上限、错误响应和审计日志。
- `docs/API_CONTRACT.md`：端点、错误码和新增接口约束。
- SQLite、Redis、Vercel 路由契约测试。

### 修改媒体引用方式

- `src/services/coverAssetService.ts`：封面业务编排。
- `src/services/coverImagePipeline.ts`：浏览器图片解码和变体生成。
- `src/services/coverMediaClient.ts`：媒体上传和远程图片读取。
- `src/utils/cardCover.ts`：展示来源回退。
- `server/core/mediaGc.js`：引用扫描和清理。
- `server/core/kvStore.js`、`server/storage/redisStore.js`：媒体二进制存储和旧数据兼容迁移。
- `/api/storage/media`、旧 `/api/sqlite/media` 和跨存储传输。
- 上传、远程图片、GC 和失败恢复测试。

### 修改路由或标签规则

- `src/utils/routeUtils.ts`：slug 和默认 section。
- `src/components/PublicHome.tsx`、`src/hooks/useStructuredHomeSections.ts`：筛选和分区。
- `src/components/PublicDetail.tsx`：详情按 ID 查找和返回路径。
- `src/components/public/PublicNavigationContext.tsx`：导航、搜索和滚动状态。
- 旧详情链接、旧 `?tag=` 参数、保留 slug 和重复 slug 测试。

重构共享契约时，先为现有行为补回归测试，再改变契约。本文标记为兼容入口的内容，应在有迁移方案和弃用周期后删除。

## 九、验证

界面版本来自构建变量 `VITE_APP_VERSION`，发布流水线由 Git tag 注入；`package.json` 的 `version` 不参与发布版本号。具体发版步骤见 [`docs/RELEASE.md`](./RELEASE.md)。

代码改动后按根目录 README 的要求执行：

```powershell
npm run lint
npm test
npm run build
npm run test:coverage
npm run test:e2e
```

支持 Node.js `20.19.0` 及以上版本；CI 会验证 Node.js 20.19.0 和 24。涉及安全依赖、发布或部署时，再执行 `npm run audit:prod`、`npm run audit:all`，使用 `npm run verify:sqlite-backup -- <backup.db>` 校验 SQLite 备份，并按 [`docs/RELEASE.md`](./RELEASE.md) 的流程核对版本和构建入口。
