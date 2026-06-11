# 前台重构施工文档 —「沉浸剧场」

> 分支：`redesign/theater`
> 进度标记：`[]` 未完成 · `[✅]` 已完成
> 范围：首页 + 详情页视觉层重构，token 按全站标准制定；行为逻辑层不动。

---

## 一、设计方向

**沉浸剧场**：暗色优先，全宽 Hero + 封面取色氛围光，分区改横向 shelf，导航上移至顶栏。亮色主题保留，定位为「日场」适配变体。

### 1. 设计 Token

组件一律从 CSS 变量取值，禁止硬编码色值（语义色 amber/sky 状态标识除外，见 §4）。

| Token | 暗色（主场景） | 亮色（日场） | 说明 |
|---|---|---|---|
| `--bg` | `#0b0c10` | `#f6f5f2` | 放映厅黑（冷蓝调）/ 暖灰白 |
| `--bg-soft` | `#12141a` | `#edece8` | shelf 分层背景 |
| `--surface` | `#181b22` | `#ffffff` | 卡片、面板 |
| `--surface-muted` | `rgba(24,27,34,0.72)` | `rgba(255,255,255,0.78)` | 顶栏、玻璃面板 |
| `--text-primary` | `#f2f0eb` | `#1c1b18` | 银幕暖白 / 墨色 |
| `--text-secondary` | `#9a9890` | `#6e6c66` | |
| `--line` | `rgba(255,255,255,0.08)` | `rgba(28,27,24,0.1)` | 细弱化 |
| `--accent` | 后台可配 | 后台可配 | `applyThemeColor` 机制不动 |
| `--ambient` | 动态取色 | 动态取色 | 签名元素，默认回退 `--accent` |
| `--ambient-soft` | 动态取色 | 动态取色 | 氛围光低透明度变体 |

### 2. 字体

- 标题：`Playfair Display` + `Noto Serif SC` 衬线栈（现有 `.font-display`，沿用）
- 正文：`Manrope` + 系统中文栈（沿用）
- 眉题：宽字距大写小字（现有手法，保留强化）
- 待定项：Win10 无 Noto Serif SC 时中文标题回退宋体，观感打折；后续评估是否引入子集化 webfont

### 3. 签名元素：封面取色氛围光

- Hero 当前帧封面经 canvas 缩至 16×16 提取主色，按 cardId 缓存
- 主色写入 `--ambient`，以大半径径向光晕渗入页面背景，轮播切换时颜色过渡
- 详情页用同一机制做全屏 backdrop 氛围
- 取色失败（WebDAV 封面跨域 taint canvas）静默回退 `--accent`

### 4. 状态语义色

`isRecommended`（amber）/ `isWatching`（sky）的角标语义保留，卡片彩色描边阴影取消，hover 反馈改用氛围光。

---

## 二、布局结构

```
┌─────────────────────────────────────────────┐
│ LOGO  全部 推荐 在看 标签…      🔍搜索  ◐   │ ← 顶部导航（吸顶）
├─────────────────────────────────────────────┤
│ ░░░░░░░░ 全宽 HERO ~65vh ░░░░░░░░░░░░░░░░░  │
│ ░ 氛围光 + 衬线大标题 + 简介 + 评分 ░░░░░░  │
│ ░░░░░░░░░░░░░░░░░░░ ▭▭▭▭▭ ←缩略图导航 ░░░  │
├─────────────────────────────────────────────┤
│ ▶ 正在观看 12        ‹ ▭ ▭ ▭ ▭ ▭ ▭ ›       │ ← 横向 shelf
│ ★ 精选推荐 24        ‹ ▭ ▭ ▭ ▭ ▭ ▭ ›       │   snap 滚动
│ # 各标签分区…        ‹ ▭ ▭ ▭ ▭ ▭ ▭ ›       │
└─────────────────────────────────────────────┘
```

- **顶部导航**合并 `PublicSidebar` + `PublicMobileTagBar` + `PublicToolbar` 三者职责：logo（三连击进后台彩蛋迁移）、分区入口（超宽横向滚动）、搜索、排序、主题切换、管理员快速添加
- 分区计数（cardStats）放进溢出/下拉菜单，顶栏只显示名称
- **Shelf 仅用于首页**：snap 滚动、桌面端悬停露出箭头、移动端原生触摸
- **分区页 / 搜索结果**：保持网格 + 无限加载，卡片 16:9 按新风格重绘
- **详情页**：封面放大为全屏模糊 backdrop + 取色氛围，信息层悬浮其上

---

## 三、重构边界

### 保留（不动）

- Hooks：`useHeroRotation`、`useBackToTop`
- `PublicHome.tsx` 内：滚动位置恢复、sessionStorage 持久化、路由迁移、无限加载逻辑
- 数据层、`CardEditModal`、后台全部
- `applyThemeColor` 与 index.html 内联防闪烁脚本
- 亮/暗/system 三态主题机制（ThemeContext）

### 适配

- `useStructuredHomeSections`：shelf 不受 `gridColumns × 2` 截断，`sectionCardLimit` 语义改为 shelf 容量
- `useGridColumns`：随网格列数耦合解除而退役，文件与旧组件一并待删

### 重写

- `styles.css` token 层
- `PublicSidebar` + `PublicMobileTagBar` + `PublicToolbar` → 新顶部导航
- `PublicStructuredHome` → Hero 全宽 + Shelf 组合
- `PublicCardGrid` → 新卡片样式（含 Hero 拆出独立组件）
- `PublicSkeletons` → 与新组件逐一同步
- `PublicDetail` → 剧场化

---

## 四、施工阶段

### 阶段 1：Token + 字体 `[✅]`
- `[✅]` styles.css 变量层重写（暗色主 + 日场变体 + `--ambient` 系列）
- `[✅]` 字体方案确认（沿用 Playfair Display / Noto Serif SC + Manrope）

### 阶段 2：顶部导航 `[✅]`
- `[✅]` 新建 `PublicTopNav`（桌面 + 移动一体）
- `[✅]` 迁移：三连击 logo、主题切换、搜索、排序、快速添加
- `[✅]` 分区计数移入「分区总览」下拉菜单
- `[✅]` 移除 `PublicSidebar`、`PublicMobileTagBar`、`PublicToolbar` 引用（文件删除待确认）
- `[✅]` 对应骨架屏同步

### 阶段 3：Hero + 取色 `[✅]`
- `[✅]` 新建 `utils/coverAmbientColor.ts`（canvas 取色 + cardId 缓存 + 回退）
- `[✅]` 新建 `PublicHero`（全宽、氛围光、缩略图条带自动居中、触摸滑动沿用 useHeroRotation）
- `[✅]` `prefers-reduced-motion` 下停轮播
- `[✅]` 对应骨架屏同步

### 阶段 4：Shelf + 首页重组 `[✅]`
- `[✅]` 新建 `PublicShelf`（snap 滚动 + 桌面箭头）
- `[✅]` `useStructuredHomeSections` 适配 shelf 容量（新增「最新收录」shelf）
- `[✅]` `PublicStructuredHome` 重写为 Hero + Shelf 组合
- `[✅]` 对应骨架屏同步

### 阶段 5：分区页网格卡片 `[✅]`
- `[✅]` `PublicCardGrid` 重绘（共享 `PublicCard`，新 token、氛围光 hover、去彩色描边）
- `[✅]` 空状态、加载更多骨架同步
- `[✅]` 回归：首页 → 详情 → 返回滚动恢复

### 阶段 6：详情页剧场化 `[]`
- `[]` 全屏模糊 backdrop + 取色氛围
- `[]` 信息层重排（衬线大标题、评分、时间周期、观后感）
- `[]` 原图预览、编辑入口、返回逻辑保持

### 阶段 7：整体回归 `[]`
- `[]` `npm run lint` + `npm test` 通过
- `[]` 手动路径：详情返回滚动恢复 / 跨标签页状态 / 亮暗 system 三态 / 移动端 shelf 触摸
- `[]` 键盘焦点可见、`prefers-reduced-motion` 全检
- `[]` 后台页面在新 token 下无样式回归

---

## 五、风险清单

- **滚动恢复**：布局高度变化影响恢复时机，阶段 4/5 后必须回归「首页 → 详情 → 返回」
- **取色 CORS**：WebDAV 模式封面跨域时 canvas 被 taint，已设计 `--accent` 回退
- **亮色模式**：暗色优先最易把亮色做废，每阶段两主题都过一遍
- **后台连带**：后台组件共用 `--bg/--surface` 等 token，阶段 1 改动后需目检后台

## 六、施工备注

- Tailwind v3 不支持 `bg-[color:var(--x)]/NN` 透明度修饰符（静默失效，input 等元素回退 UA 白底），统一写 `bg-[color:color-mix(in_srgb,var(--x)_NN%,transparent)]`
- 待删文件（已无引用，删除需确认）：`PublicSidebar.tsx`、`PublicMobileTagBar.tsx`、`PublicToolbar.tsx`、`useGridColumns.ts`
- `fetchPriority` React 告警为 ImagePreview 既有问题，与本次重构无关
- 既有问题（main 已存在，与本次重构无关）：中文标签名经 `slugifyName` 全部退化为 `tag`，多个中文标签的分区路由互相覆盖（如「番剧」「游戏」均为 `/tag`，点「番剧」实际进「游戏」分区）
