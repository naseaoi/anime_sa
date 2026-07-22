# 维护者快速上手：项目约束与易错点

本文记录当前实现中容易被误判为冗余、但会影响数据、安全或兼容性的内容。它描述的是现状约束，不代表所有现状都值得长期保留。部署和常用命令见根目录 `README.md`，发版见 `docs/RELEASE.md`。

## 先建立这三个认知

### `public_data` 是一个整体写入的聚合

站点设置、标签和全部卡片不是分别持久化的表，而是作为一份 `PublicData` 整体写入 `public_data`。SQLite 也不是关系模型，`data/local.db` 只有通用的 `kv_store(key, value)`。

这带来三个直接后果：

- 修改任意卡片都会重写整份公共数据。
- 新增字段没有数据库迁移，但必须同步更新 TypeScript 类型、默认值、所有对象构造点和服务端校验器。
- 并发控制只能以整份数据的 `updatedAt` 为基线，不能假设不同卡片可独立写入。

### 同一界面存在两种保存语义

后台 `/tat/*` 是两阶段保存：卡片、标签和设置页面的操作只更新 `AdminLayout.localData` 并将 `hasChanges` 设为 `true`；只有顶部“保存”才调用 `savePublicData` 持久化整份数据。后台卡片弹窗没有独立的保存按钮，字段变化会立即写入页面内存，关闭弹窗只代表结束编辑。

前台管理员入口不是这个语义：详情页编辑和“快速记录”会直接调用存储 API，成功后刷新全局数据。

新增编辑入口前必须先明确它属于哪一种语义。不要仅凭函数名 `onSave` 判断已经持久化。后台卡片的本地恢复草稿会一直保留到顶栏持久化成功；前台详情编辑和“快速记录”仍通过提交按钮直接持久化。

### 开发、Node 和 Vercel 不是同一个服务入口

| 场景 | API 入口 | 可用驱动 |
|---|---|---|
| `npm run dev` | `vite.config.ts` 挂载 `server/devMiddleware.ts` | SQLite 或 Redis |
| `npm start` / Docker | `server.js` | SQLite 或 Redis |
| Vercel | `api/storage.ts` | 仅 Redis |

API 业务修改不能只验证其中一个入口。SQLite 主要走 `server/core/apiCore.js`，Redis 走 `server/storage/redisApi.js`；两边复用了部分安全与校验模块，但路由分支仍是两套实现。

请求体统一由 `server/core/httpUtils.js` 的 `readJsonObject` 解析：空 body 按空对象处理，JSON 原始值和数组会返回 400。方法不匹配必须使用 `methodNotAllowed`，返回 JSON 405 和 `Allow` 头，不要直接 `res.end()`。`public_data` 的 GET 是唯一公开的通用数据读取；`private_data` 读取和所有写入都必须鉴权，Redis handler 不要把鉴权提前放到通用 KV 分支之前。

`server.js` 和 `vercel.json` 分别维护 Node.js 与 Vercel 的 CSP、HSTS 等安全响应头。修改安全策略时必须同步两处；`server/vercelConfig.test.js` 只检查关键头存在，不能证明两份 CSP 文本完全一致。

## 数据写入与乐观锁

客户端保存公共数据时通过 `X-Expected-Updated-At` 发送读取时的版本，服务端冲突返回 409。正确顺序是：

1. 保留当前数据的 `updatedAt` 作为 `expectedUpdatedAt`。
2. 给待写数据生成新的 `updatedAt`。
3. 保存成功后再替换本地基线并刷新数据。

不要先修改基线时间再把它当预期版本，也不要在冲突后静默覆盖。Redis 使用 Lua 原子比较并写入；SQLite 在单进程同步数据库操作中完成比较与写入。

旧数据可能没有顶层 `updatedAt`。`applyDerivedPublicDataVersion` 会从卡片的最大 `updatedAt` 推导兼容值，删除这段逻辑会使旧数据第一次保存更容易误报冲突。

`normalizePublicDataPayload` 是公共数据的运行时边界，通过 `shared/publicDataSchema.js` 同时用于客户端读取、SQLite、Redis 和跨存储传输。新增 `CardData`、`Tag` 或 `SiteSettings` 字段时，如果只改前端类型，读取时会报格式错误，保存会丢弃字段或返回 400。

当前重要上限：最多 200 个标签、2000 张卡片；标题 200 字符、简介 20000 字符、普通资源 URL 4096 字符、内嵌封面 1 MiB、单次媒体上传 10 MiB。

## 存储驱动与路由兼容

`src/services/storageFactory.ts` 暴露的是一个可变的单例 `storageAdapter`。它初始类型是 `sqlite`，第一次 `getStorageAsync()` 会请求 `?key=driver` 并改写类型。需要可靠判断驱动时，应确保驱动已经加载；不要在应用初始化完成前把同步 `getStorage().type` 当作真实驱动。

`STORAGE_DRIVER` 在进程启动时解析，不支持运行时热切换。配置了 `REDIS_URL` 但仍使用 SQLite 是合法状态，此时 Redis 只作为可传输的另一端。

以下兼容入口不能当作重复代码直接删除：

- `/api/sqlite/*` 用于历史封面 URL，开发中间件和 Node 服务仍将它转发到当前存储处理器。
- `/card/:id` 是旧详情链接兼容入口。
- 首页仍把旧 `?tag=<id-or-slug>` 查询参数迁移到路径形式。
- Vercel 的 `/api/storage/:path* -> /api/storage` rewrite 负责让 `/login`、`/media` 等子路径进入同一个 Function；删除后通常会得到 SPA HTML，而不是 API JSON。

## 封面不是一个字段

`CardData` 中三个封面相关位置职责不同：

- `coverUrl`：规范原图来源，可能是外部 HTTP(S) URL，也可能是本站媒体 URL。
- `coverVariants.thumb/card/original`：不同展示尺寸的实际来源。
- `coverLocalData`：上传流程中的临时 Data URL，正常持久化后应清空。

`persistCardCover` 在浏览器端解码图片，通过 Canvas 生成 `thumb` 和 `card`，优先编码为 WebP，然后先上传媒体、再由调用方保存 `public_data`。如果后续公共数据保存冲突或失败，已上传媒体会成为孤立资源；这是预期由 Media GC 收口的失败模式，不要在写入失败时直接猜测并删除媒体，因为同名资源可能已被其他数据引用。

外部 URL 生成缩略图时，同源读取失败或跨域资源会经过需要管理员 Session 的 `/api/storage/remote-image`。服务端在此处承担 SSRF、响应类型和大小检查。不要改成浏览器直接任意抓取后再上传。

Media GC 只把以下路径中的 `name` 视为本站引用：

- `/api/storage/media?name=...`
- `/api/sqlite/media?name=...`

它会扫描 `coverUrl` 和全部 `coverVariants`。如果新增媒体 URL 形式或新增资源字段，必须同步修改 `server/core/mediaGc.js`，否则仍在使用的资源可能被清理。

跨存储传输先校验并覆盖 `public_data`，再复制 `private_data`，最后按名称差集分批复制媒体。无效的源公共数据不会覆盖目标。它不是跨数据与媒体的原子事务；中途失败时目标可能已经拥有新数据但缺少部分封面。目标端多余媒体不会删除，Session、限流和审计日志也不传输。

`coverAssetService` 中部分内部函数保留了 `targetStorage` 参数，但媒体上传端点始终是活动驱动的 `/api/storage/media`。真正的 SQLite/Redis 双向复制由服务端 `/api/storage/transfer` 完成，不要把该参数误当成客户端可直接指定写入驱动的能力。

## 标签与路由的模型不完全对齐

数据模型允许 `card.tagIds` 包含多个标签，但当前卡片编辑器只读取和写入 `tagIds[0]`，详情路径选择也优先第一个标签。直接开启多标签 UI 前，需要同时检查首页分区、详情链接、筛选、后台列表和服务端校验，不能只替换下拉框。

标签 slug 支持 Unicode，并保留以下名称：`recommended`、`watching`、`tat`、`card`。保留词会追加 `-tag`；历史退化 slug `tag` 会按名称重新生成；名称仍无法生成 slug 时使用 `tag-{id}`。改变规则会使已有书签和详情返回路径失效。

无标签且非推荐/在看的卡片目前也会由 `sectionFromCard` 回退到 `recommended` 路径。这是现有兼容行为，不是准确的业务分类；重做路由时应先确定无分类卡片的正式 URL。

## 凭据与 Session 的初始化语义

`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 只在存储中不存在管理员凭据时用于初始化。数据库已有 `private_data` 后，修改 `.env` 不会覆盖账号密码；应通过后台设置修改，或在明确的数据恢复流程中处理。

后台修改账号或密码会清除全部 Session，并要求重新登录；提交与现有凭据相同的内容不会注销 Session。SQLite 与 Redis 必须保持这一行为一致。历史明文密码只用于兼容迁移，成功登录后会升级为 scrypt 哈希；新代码不得重新写入明文 `password`。

审计日志输入统一经过 `server/core/auditContract.js`，客户端提交的 `action` 只能包含字母、数字、下划线、冒号和横线，`status` 只能是 `success` 或 `failed`。不要绕过 `appendAuditLog` / `appendRedisAudit` 直接写底层存储。

生产模式的 Session Cookie 带 `Secure`。本机以 HTTP 启动 `NODE_ENV=production` 时，浏览器不会正常回传该 Cookie，这通常表现为“登录成功后仍未登录”。

## 浏览器本地状态也有兼容责任

这些 Key 会跨页面或跨会话影响体验：

- `tat_site_settings`：`public/bootstrap.js` 在 React 启动前读取，`App.tsx` 在数据加载后更新，用于标题、图标和主题首屏稳定。
- `tat_theme`：主题模式。
- `tat_sort_config`、`tat_visible_count` 和滚动位置：仅当前标签页的列表恢复状态。
- `tat_card_draft:new`、`tat_card_draft:edit:<encoded-id>`：前台卡片未保存草稿。
- `tat_card_draft:admin:new`、`tat_card_draft:admin:edit:<encoded-id>`：等待后台顶栏保存的卡片草稿。

不要只改 React 内的缓存格式而漏掉 `public/bootstrap.js`。所有浏览器存储都应按不可信输入读取。卡片草稿刻意不保存 `coverLocalData`，防止 Base64 图片占满 `localStorage`。

## 发版版本不是 `package.json.version`

界面版本来自构建变量 `VITE_APP_VERSION`，发布流水线由 Git tag 注入 `vX.Y.Z`；未注入时显示 `dev`。`package.json` 当前版本不是发布来源，发版流程也明确不修改它。

## 常见改动的必查位置

### 新增公共数据字段

- `src/types.ts`
- `src/domain/publicData.ts` 默认值
- `src/domain/card.ts` 卡片创建与合并规则
- 所有新建/合并对象的构造点
- `server/publicDataValidation.js` Schema 实现与限制常量
- `shared/publicDataSchema.d.ts` 共享入口的 TypeScript 声明
- 编辑草稿白名单（字段需要恢复时）
- SQLite 与 Redis 读写测试、旧数据兼容测试

### 新增存储 API 能力

- SQLite：`server/core/apiCore.js`
- Redis：`server/storage/redisApi.js`
- 开发路由：`server/devMiddleware.ts`
- Node 路由和限流：`server.js`
- Vercel rewrite 与仅 Redis 的运行限制
- 鉴权、同源校验、请求体上限、审计日志

### 修改媒体引用方式

- `src/services/coverAssetService.ts`
- `src/utils/cardCover.ts`
- `server/core/mediaGc.js`
- 跨存储传输与旧 `/api/sqlite/media` URL

## 全面优化时优先解决的结构风险

以下内容是已知技术债，不应被新功能继续复制：

1. 继续统一后台暂存与前台立即保存的结果类型，明确 `staged`、`persisted`、`conflict`，避免新入口误用 `onSave` 命名。
2. 在公共数据、凭据和审计契约的基础上继续收敛 SQLite/Redis API，优先统一其余错误码和请求体校验。
3. 将 `PublicData` 的 TypeScript 类型进一步由运行时 Schema 派生，消除 `shared/publicDataSchema.d.ts` 的手工声明同步点。
4. 明确卡片是单分类还是多标签，再统一数据模型、编辑器与路由。
5. 把 Node.js 与 Vercel 的安全响应头提取为可生成配置，避免两份 CSP 手工同步。

重构这些区域时，先为现有行为补回归测试，再改变契约；本文中标记为兼容入口的内容，应在有迁移方案和弃用周期后删除。
