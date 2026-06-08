# 发布流程

## 版本规则

- 版本号使用 SemVer：`X.Y.Z`
- Git tag 使用 `vX.Y.Z`
- `package.json` 的 `version` 使用 `X.Y.Z`
- Docker 镜像地址：`ghcr.io/naseaoi/anime_sa`

## 发布前检查

```powershell
git checkout main
git pull --ff-only origin main
git status --short
npm ci
npm run typecheck
npm test
npm run build
```

## 更新项目版本

把 `X.Y.Z` 替换成目标版本。

```powershell
npm version X.Y.Z --no-git-tag-version
git diff -- package.json package-lock.json
```

## 提交版本变更

```powershell
git add package.json package-lock.json
git commit -m "chore: release vX.Y.Z"
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

## 检查自动构建

- GitHub Actions：检查 `CI`
- GitHub Actions：检查 `Docker Publish`
- GitHub Packages：检查镜像 tag
- 目标镜像：`ghcr.io/naseaoi/anime_sa:X.Y.Z`

## 创建 GitHub Release

```powershell
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release vX.Y.Z"
```

## 发布后核对

```powershell
git status --short
git tag --list "vX.Y.Z"
gh release view vX.Y.Z
```
