# 备份与恢复

## SQLite

备份 `data/local.db`。复制文件前停止 Node.js 进程或 Docker 容器。

```powershell
docker stop anime_sa
Copy-Item .\data\local.db .\backups\local.db
docker start anime_sa
```

恢复时停止服务，替换 `data/local.db`，再启动服务并检查前台、后台登录和封面。

## Redis

使用托管平台提供的快照、导出或备份功能保存完整 Key 空间。备份范围包括：

- `<prefix>:public_data`
- `<prefix>:private_data`
- `<prefix>:media:*`
- `<prefix>:audit`

Session 和限流 Key 无需恢复。恢复后重新部署并检查 `/api/storage?key=ping`、后台登录、公共数据和封面。

## 操作要求

- 管理员凭据和数据库备份按敏感数据保存。
- 备份文件不得提交到 Git。
- 数据结构升级和批量媒体清理前创建备份。
- 至少保留 3 个可用版本并定期验证恢复。
