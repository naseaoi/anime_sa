# 发布流程

## 发版流程

- 目标版本必须是 `vX.Y.Z`
- 不修改 `package.json` 和 `package-lock.json` 的版本号
- Release 说明范围是上一个版本 tag 到当前发布提交：`上一个 v* tag..HEAD`
- Release 说明只写该范围内的改动
- 发布前必须完成检查命令
- tag 必须打在已推送到 `origin/main` 的发布提交上

## 版本规则

- 版本号使用 SemVer：`X.Y.Z`
- Git tag 使用 `vX.Y.Z`
- 应用版本从 Git tag 注入：`VITE_APP_VERSION=vX.Y.Z`
- `package.json` 的 `version` 不参与发布版本号
- Docker 镜像地址：`ghcr.io/naseaoi/anime_sa`

## 发布前检查

```powershell
git checkout main
git pull --ff-only origin main
git status --short
npm ci
npm run lint
npm run audit:prod
npm run audit:all
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run build
```

## 确认上一个版本

```powershell
git fetch --tags origin
$PreviousTag = git describe --tags --abbrev=0 --match "v[0-9]*"
git log --reverse --no-merges --pretty=format:"%h %s" "$PreviousTag..HEAD"
git diff --stat "$PreviousTag..HEAD"
```

## 提交改动

```powershell
git add .
git commit -m "chore: prepare release vX.Y.Z"
```

## 打 tag

```powershell
git tag -a vX.Y.Z -m "vX.Y.Z"
git tag --list "vX.Y.Z"
```

## 推送 GitHub

```powershell
git push origin main
git push origin vX.Y.Z
```

## 编写 Release 说明

Release 说明基于 `$PreviousTag..HEAD` 的提交和 diff 摘要。

```powershell
git log --reverse --no-merges --pretty=format:"%h %s" "$PreviousTag..HEAD"
git diff --stat "$PreviousTag..HEAD"
```

写入临时文件：

```powershell
$NotesFile = Join-Path $env:TEMP "anime_sa-release-vX.Y.Z.md"
@"
## 更新内容

- ...

## 验证

- ``npm run lint``
- ``npm run audit:prod``
- ``npm run audit:all``
- ``npm test``
- ``npm run build``
"@ | Set-Content -Encoding UTF8 $NotesFile
```

## 检查自动构建

- GitHub Actions：检查 `CI`
- GitHub Actions：检查 `Docker Publish`
- GitHub Actions：检查 `container-scan`
- GitHub Packages：检查镜像 tag
- 目标镜像：`ghcr.io/naseaoi/anime_sa:X.Y.Z`
- 前端版本变量：`VITE_APP_VERSION=vX.Y.Z`

## 创建 GitHub Release

```powershell
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file $NotesFile
```

## 发布后核对

```powershell
git status --short
git tag --list "vX.Y.Z"
gh release view vX.Y.Z
```
