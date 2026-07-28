# API 契约摘要

客户端统一调用 `/api/storage`。Node、Vite 和 Vercel 入口只负责平台适配，业务响应使用相同的 JSON 字段。

## 错误响应

所有错误响应包含：

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "error": "错误描述"
}
```

客户端应根据 `code` 分支，`error` 只用于展示，不作为程序判断条件。公共数据写入必须带 `X-Expected-Revision`，服务端成功响应返回新的 `revision`。

`public_data` GET 返回基于 `revision` 的 `ETag` 和 `Cache-Control: public, no-cache`。客户端可以发送 `If-None-Match`，数据未变化时返回 304；Session、私有配置、写入和错误响应继续使用 `no-store`。Node.js 根据 `Accept-Encoding` 压缩可压缩 API 响应。

| 状态码 | code |
|---:|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 501 | `NOT_IMPLEMENTED` |
| 502 | `UPSTREAM_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` |

## 端点分组

- Session：`/login`、`/logout`、`/session`
- 公共数据：`?key=public_data`、`/data-metrics`
- 私有配置：`/admin-profile`、`/admin-credentials`
- 媒体：`/media`、`/remote-image`、`/media-gc`
- 维护：`/audit-logs`、`/transfer`
- 探针：`?key=driver`、`?key=ping`（进程探针）、`?key=ready`（存储就绪探针）

新增端点必须复用 `errorResponse`、同源校验、请求体限制、鉴权和审计策略，并补 SQLite/Redis 契约测试。

SQLite 的 `/data-metrics` 在公共文档指标外返回 `storage`，包含页大小、总页数、空闲页、媒体表字节数和旧媒体引用统计。Redis 不返回 SQLite 页指标。
