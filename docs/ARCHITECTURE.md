# 架构说明

## 系统边界

项目由 React 单页应用、Node.js HTTP 服务和可切换存储组成。

| 层 | 目录 | 职责 |
|---|---|---|
| 领域层 | `src/domain/`、`src/types.ts` | 领域类型、默认数据、存储模式 |
| 应用服务 | `src/services/` | API 调用、存储适配、封面处理 |
| 界面层 | `src/components/`、`src/hooks/` | 页面、组件和交互状态 |
| 服务端编排 | `server/core/apiCore.js` | API 路由与用例编排 |
| 服务端能力 | `server/core/` | 存储、认证、审计、WebDAV、媒体清理、安全校验 |

Vercel API 入口只返回 410。Node.js 与 Docker 是受支持的运行方式。

## 依赖方向

```text
components/hooks → services → domain/types
server.js/devMiddleware → apiCore → server/core 能力模块
```

- `src/domain/` 不依赖组件、Hooks 或服务。
- `src/services/` 不依赖 React 组件。
- 页面组件负责组合，不直接实现 HTTP 协议和存储细节。
- 服务端 handler 负责鉴权、参数解析和能力编排，持久化与安全规则位于独立模块。
- ESLint 对领域层和服务层的反向依赖执行检查。

## 前端结构

### 领域层

| 文件 | 职责 |
|---|---|
| `src/domain/publicData.ts` | 默认公共数据、默认私有数据、版本派生 |
| `src/domain/storage.ts` | `StorageMode`、存储模式校验 |
| `src/types.ts` | 卡片、分类、站点设置和审计数据结构 |

领域结构变更先修改类型和领域函数，再更新存储适配与界面。

### 存储适配

`StorageAdapter` 是前端数据访问边界：

```ts
interface StorageAdapter {
  type: StorageMode;
  getPublicData(): Promise<PublicData>;
  savePublicData(data: PublicData, options?: SavePublicDataOptions): Promise<StorageWriteResult>;
  getPrivateData(): Promise<PrivateData>;
  savePrivateData(data: PrivateData): Promise<StorageWriteResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
```

`src/services/storageFactory.ts` 注册 SQLite 和 WebDAV 适配器。页面通过 `getStorage()` 或 `getStorageAsync()` 获取适配器，不判断协议细节。

### API 客户端

`src/services/apiClient.ts` 统一 Session Cookie 请求和 API 错误读取。新增管理接口时复用该模块。

### 界面扩展

- 公共页面组件位于 `src/components/public/`。
- 管理页面组件位于 `src/components/admin/`。
- 跨页面交互放入 `src/hooks/`。
- 通用控件从 `src/components/Common.tsx` 导出。
- 页面级组件保留数据组合和路由交互，领域计算放入 `src/domain/` 或 `src/utils/`。

## 服务端结构

| 模块 | 职责 |
|---|---|
| `server/core/apiCore.js` | SQLite API 与 WebDAV 代理编排 |
| `server/core/webdavStore.js` | WebDAV 配置、JSON、目录和文件操作 |
| `server/core/mediaGc.js` | 封面引用解析与垃圾清理 |
| `server/core/adminCredentials.js` | 管理员凭据解析、校验和迁移 |
| `server/core/kvStore.js` | SQLite KV 访问与存储模式 |
| `server/core/sessionStore.js` | Session 与 Cookie |
| `server/core/auditStore.js` | 审计日志 |
| `server/core/requestOrigin.js` | 写请求同源校验 |
| `server/core/remoteSecurity.js` | 远程地址与 DNS 校验 |
| `server/publicDataValidation.js` | 公共数据结构校验 |
| `server/sharedSecurity.js` | 密码、路径和输入校验 |

新增 API 时，handler 只保留路由、认证、请求解析和响应映射。可复用业务逻辑放入对应能力模块。

## 数据一致性

- 普通编辑携带 `X-Expected-Updated-At`。
- SQLite 写入前比较当前版本，冲突返回 409。
- WebDAV 写入前比较版本，并在服务端提供 ETag 时发送 `If-Match`。
- 读取故障返回错误；文件不存在时返回默认数据。
- 覆盖同步属于显式操作，不使用目标端版本检查。

## 安全边界

- 所有外部输入在服务端校验。
- 写请求校验 `Origin` 或 `Referer`。
- Session Cookie 使用 `HttpOnly` 和 `SameSite=Strict`，生产环境使用 `Secure`。
- WebDAV 文件名只接受指定根文件和单层封面文件。
- 外部图片代理拒绝本地、回环和私有地址。
- CSP 的 `script-src` 只允许同源脚本。
- 公共数据写入执行数量、长度、唯一性、引用和 URL 校验。

## 测试边界

| 变更 | 最低测试范围 |
|---|---|
| 领域函数 | 对应单元测试 |
| 存储适配 | `storageFactory.test.ts` 或存储服务测试 |
| 封面处理 | `coverAssetService.test.ts` |
| 服务端安全与校验 | `server/*.test.js` |
| Vercel 入口 | `api/vercelDisabled.test.ts` |
| 界面交互 | 组件测试与 ESLint 无障碍规则 |

完整检查命令：

```powershell
npm run lint
npm run audit:all
npm test
npm run build
```
