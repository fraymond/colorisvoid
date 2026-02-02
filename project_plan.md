# Colorisvoid.com — Project Plan (V1)

> Colorisvoid.com 是一座数字时代的禅院。  
> 留白、克制、不解释、不劝导、不急着给答案。

## 目标

- **站点定位**：不是产品官网，也不是技术博客；记录人与 AI 相遇、对话、迟疑、映照中的片刻。
- **核心功能**：
  - **问道**：沉静式聊天空间（服务端调用 OpenAI）
  - **顿悟**：可登录发布的博客系统（站内写作/发布）
- **部署目标**：Google Cloud（Cloud Run + Cloud SQL + Secret Manager + Cloud Build）

## 设计约束（必须遵循）

- **视觉**：大量留白、白底为主、极淡灰墨元素；红色点睛（≤ 5%）
- **交互**：无 loading 动画、无“AI 正在思考”、无打字机效果；允许短、慢、不完整与沉默

## 站点结构与路由

- `/`：Home（大 Logo + 极淡文字 + 缘起正文同页）
- `/preface`：缘起（保留为兼容入口，重定向到 `/#preface`）
- `/chat`：问道（Chat Interface）
- `/stories`：顿悟（Stories / Blog）
- `/notes`：修炼（News / Notes，占位/后续扩展）
- `/tools`：法器（Tools，占位/后续扩展）
- `/portal`：空门（External Link）

## 里程碑（Milestones）

### M1 — 基础骨架与视觉系统

- Next.js App Router 工程骨架
- 全站布局：顶部极简导航 + 内容容器 + 极淡页脚
- CSS 变量与排版系统（留白、克制）
- Home：大 Logo + 极淡文字（tagline）+ 缘起正文同页（桌面/移动端均适配）

### M2 — 顿悟：站内发表的博客系统

#### 公共展示

- 文章列表：`/stories`（仅展示已发布）
- 文章详情：`/stories/[slug]`
- 正文：Markdown → HTML（服务端渲染 + sanitize，排版克制）

#### 管理后台（需登录）

- 后台列表：`/stories/admin`
- 新建：`/stories/admin/new`
- 编辑：`/stories/admin/[id]`
- 动作：保存 / 发布 / 撤回（不做“成功动效”）
- 写作形式：以 **Markdown 文本** 为主，避免富编辑器的“工具感”

### M3 — 登录系统（管理员）

#### 目标

- **管理员模式**：仅允许白名单账号进入后台写作（最贴合“克制”）

#### Provider（V1）

- Google（Gmail / Workspace）
- Meta（Facebook；Instagram 走 Meta 体系入口）
- WeChat（网页 OAuth/扫码）

#### 授权策略

- 白名单：`ADMIN_EMAILS` 或 `ADMIN_EMAIL_DOMAIN`
- Session：HttpOnly Cookie
- 后台路由保护：保护 `/stories/admin/*` 与写入 API

### M4 — 问道：沉静式对话

- UI：对话区（我/AI左右对齐，极简气泡，无头像）+ 输入框
- 输入：多行，Enter 发送，Shift+Enter 换行
- 交互：无 typing indicator、无打字机、失败时极淡“……”兜底

### M5 — OpenAI 接入（服务端安全）

- `OPENAI_API_KEY` 仅在服务端读取
- 系统提示词（System Prompt）约束 AI 风格：

```text
You are not an assistant.
You are a presence.

When responding:
- Do not give advice unless explicitly asked
- Do not conclude
- Do not reassure
- Use short paragraphs
- Sometimes respond with a question
- Allow silence and minimal responses
```

### M6 — GCP 部署（Cloud Run + Cloud SQL + Secrets）

- **Cloud Build**：构建容器镜像并推送到 Artifact Registry
- **Cloud Run**：运行 Next.js（含 `app/api/*`）
- **Cloud SQL for PostgreSQL**：保存文章/登录数据
- **Secret Manager**：管理敏感配置（DB URL、Auth secret、OpenAI key、OAuth secrets、白名单）
- **迁移**：通过 Cloud Run Job 执行迁移（或发布前执行一次）
- **观测**：Cloud Logging（前端保持“降噪”）

## 数据模型（概览）

- `Story`：`id`, `slug`(unique), `title`, `body`(Markdown), `status`(draft/published), `publishedAt`, `createdAt`, `updatedAt`, `authorId`
- `User/Account/Session/VerificationToken`：用于 Auth.js/NextAuth + Prisma Adapter

## 验收标准（Definition of Done）

- **视觉**：留白明确，红色点睛不过量；无多余 UI 抢注意力
- **顿悟**：
  - 公开页可访问
  - 管理后台可登录并发布/撤回
- **问道**：无 loading/无思考中/无打字机；对话可停下、可结束
- **部署**：Cloud Run 可访问，Cloud SQL 可连接并完成迁移

## 后续增强（V2+ 可选）

- MDX/内容系统（缘起/修炼/法器更舒适）
- 顿悟：草稿自动保存、版本历史、预览切换、图片/附件
- 问道：会话持久化（本地/数据库）、更精细的速率限制
- 主题微调（暗色模式但仍留白克制）

