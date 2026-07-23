# Node.js 版本策略

项目支持 Node.js `20.19.0` 及以上版本，生产 Docker 镜像和当前 CI 使用 Node.js 24。CI 同时验证最低支持版本和当前生产版本，确保 `better-sqlite3` 等原生依赖可重复构建。

升级 Node.js 主版本时，需要同步检查：

- `package.json` 的 `engines`
- Dockerfile 和 GitHub Actions
- 本地 `npm ci`、类型检查、测试、构建和容器启动
- Redis、SQLite 和 Vercel 入口的集成测试
