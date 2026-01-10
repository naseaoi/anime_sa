# NicheCard - 精致卡片收藏站

一个极简风格、卡片式布局的收藏展示网站，支持 WebDAV 数据同步，专为 Vercel 部署设计。

## 功能特性

- **前端展示**：极简卡片流，支持封面、评分、日期和标签筛选。
- **后台管理**：通过 `/tat` 路径访问，支持可视化管理卡片、分类和网站设置。
- **数据同步**：基于 WebDAV 协议，数据完全掌握在自己手中，支持坚果云等标准 WebDAV 服务。
- **响应式设计**：完美适配桌面端和移动端。

## 项目结构说明

为了方便维护，以下是关键文件的作用说明：

- **`services/webdavService.ts`**: **核心数据层**。负责与 WebDAV 服务器通信，执行读取和保存 JSON 数据的逻辑。请勿删除。
- **`api/webdav.ts`**: Vercel Serverless Function。作为 API 代理，解决浏览器的跨域(CORS)限制，并实现方法隧道(Tunneling)以绕过部分网络防火墙对 WebDAV 方法的拦截。
- **`types.ts`**: TypeScript 类型定义文件，定义了卡片(CardData)、公开数据(PublicData)等数据结构。
- **`components/Common.tsx`**: 通用组件库，包含按钮、输入框、模态框、Toast 提示等基础 UI 组件。

## 部署说明 (Vercel)

### 1. 环境变量配置
由于本项目基于 Vite 构建，在 Vercel 设置环境变量时，**必须添加 `VITE_` 前缀**，否则前端无法读取。

请在 Vercel 项目设置 (Settings -> Environment Variables) 中添加以下变量：

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `VITE_WEBDAV_URL` | WebDAV 服务器地址 | `https://dav.jianguoyun.com/dav/` |
| `VITE_WEBDAV_USERNAME` | WebDAV 账号 | `your_email@example.com` |
| `VITE_WEBDAV_PASSWORD` | WebDAV 密码/应用密码 | `your_password` |
| `VITE_WEBDAV_PATH` | 数据存储目录 (可选) | `my-collection/` |

> **注意**：修改环境变量后，需要 Redeploy 项目才能生效。

### 2. 首次使用
1. 部署完成后，访问网站。如果配置正确，页面加载完成后会显示空状态。
2. 在浏览器地址栏后添加 `/tat` (例如 `https://your-site.vercel.app/tat`) 进入后台。
3. 默认管理员账号：`admin`
4. 默认管理员密码：`password`
5. **重要**：请立即在后台“网站设置”中修改管理员账号密码。

## 数据结构
数据存储在 WebDAV 指定目录下的两个 JSON 文件中：
- `public_data.json`: 公开数据（卡片、标签、网站标题图标）。
- `private_data.json`: 隐私数据（管理员账号密码），仅后台验证时读取。

## 技术栈
- React + TypeScript
- Tailwind CSS (CDN Runtime for Demo / PostCSS for Prod)
- Lucide React Icons
- Vite
