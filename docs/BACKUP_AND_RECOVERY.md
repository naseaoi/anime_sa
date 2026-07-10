# 备份与恢复

## 备份范围

| 存储 | 必备内容 |
|---|---|
| SQLite | `data/local.db` |
| WebDAV | `public_data.json`、`private_data.json`、`covers/` |
| 配置 | 部署平台中的环境变量 |

备份文件不得提交到 Git。包含 `private_data.json` 和环境变量的备份按敏感数据保存。

## SQLite 备份

### 停机备份

```powershell
docker stop anime_sa
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path '.\backups' -Force | Out-Null
Copy-Item -LiteralPath '.\data\local.db' -Destination ".\backups\local-$Timestamp.db"
docker start anime_sa
```

非 Docker 部署在停止 Node.js 进程后执行相同的文件复制。

### 恢复

```powershell
docker stop anime_sa
Copy-Item -LiteralPath '.\backups\local-YYYYMMDD-HHMMSS.db' -Destination '.\data\local.db' -Force
docker start anime_sa
```

恢复后检查前台数据、后台登录、封面读取和审计日志。

## WebDAV 备份

使用 WebDAV 客户端下载完整存储目录，目录内容必须包含：

```text
public_data.json
private_data.json
covers/
```

恢复时先上传 `covers/`，再上传 `public_data.json`，最后上传 `private_data.json`。恢复完成后重新登录后台并检查数据版本。

## 操作要求

以下操作前必须创建备份：

- SQLite 与 WebDAV 覆盖同步
- 批量封面清理
- 管理员凭据跨存储同步
- 数据结构升级
- 容器卷迁移

至少保留 3 个可用版本，并定期在独立目录验证数据库可读取、JSON 可解析、封面文件可访问。
