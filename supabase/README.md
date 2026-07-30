# 研政数据库接入

网站使用 Supabase Auth + Postgres 保存学习状态；没有配置环境变量时自动回退到浏览器本地存储，因此本地预览不会因数据库未连接而白屏。

## 数据模型

- `politics_user_state`：每名用户一份带 `revision` 的完整学习快照，用于跨设备同步和乐观并发控制。
- `politics_profile`：学习起始日与当前课次。
- `politics_study_events`：看课、做题、抽背、错题与真题等追加式学习事件。
- `politics_sync_user_state(...)`：只接受下一版本快照的 RPC，避免旧设备覆盖新进度。
- `politics_append_study_event(...)`：写入归属于当前登录用户的事件。

迁移文件已包含外键、JSON 大小约束、用户索引、最小权限、RLS 与 `FORCE ROW LEVEL SECURITY`。所有用户数据都通过 `(select auth.uid())` 限定为本人可见。

## 本地连接

1. 在 Supabase 项目 SQL Editor 执行 `migrations/20260728220000_politics_study.sql`。
2. 复制 `.env.example` 为 `.env.local`，填写项目 URL 与 Publishable Key。不要提交真实密钥。
3. 运行 `npm run dev`，侧栏数据库状态应从“本机模式”变为“连接 Supabase”。
4. 使用邮箱登录后完成一次学习记录，再换浏览器登录同一账号验证进度同步。

## GitHub Pages

仓库工作流从 GitHub Actions Secrets 读取：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Publishable Key 可放在前端构建环境；数据保护依赖数据库中的 RLS。任何 service-role key 都不得放进前端或 GitHub Pages 构建变量。

## 验收查询

登录后可在 SQL Editor 中用管理员视角检查：

```sql
select user_id, revision, updated_at
from public.politics_user_state
order by updated_at desc;

select event_type, count(*)
from public.politics_study_events
group by event_type
order by event_type;
```

前端未配置 Supabase 时，验收标准是侧栏明确显示“本机模式”；配置后但未登录时显示“连接 Supabase”；登录且同步成功后显示“已同步”。

政治抽背不需要新增表：`recallProgress` 随 schema v1 JSON 快照同步，旧快照在读取时自动补为空对象；多设备冲突按每张卡的 `lastReviewedAt` 选择较新记录。

## Kimi K3 政治助教

公开网页不直连付费网关。调用链固定为：

```text
GitHub Pages → Supabase Auth JWT → politics-ai Edge Function → AI 网关
```

`politics-ai` 会在服务端固定 `model=kimi-k3`，只接受 `low`、`high`、`max` 三档 `reasoning_effort`，对应输出上限 4000、6000、8000 tokens。默认 Max。函数同时校验来源、登录用户白名单、60 张标准卡的 SHA-256、请求结构和大小；配额按用户原子限制 10 次/分钟、100 次/中国自然日，并以全站 12 次/分钟、120 次/日兜底。`politics_ai_requests` 只保存配额所需的请求 ID、用户、模式、档位和时间，不保存卡片内容、用户追问、系统提示词或 AI 正文。

### 安全部署

1. 使用 Supabase CLI 登录并链接到网站正在使用的项目。
2. 执行数据库迁移，创建 AI 配额表与 RPC。
3. 在本机新建已被 `.gitignore` 忽略的 `supabase/.env.ai.local`，只写服务端变量：

```dotenv
POLITICS_AI_GATEWAY_URL=https://ganlin-ai-token-gateway.ganlin-ai-gateway.workers.dev
POLITICS_AI_GATEWAY_KEY=replace-with-the-server-secret
POLITICS_AI_MODEL=kimi-k3
POLITICS_AI_ALLOWED_USER_IDS=replace-with-your-supabase-auth-user-uuid
```

4. 设置 Secret 并部署函数。函数在内部通过 Supabase Auth `/auth/v1/user` 再次验证 JWT，因此部署时关闭平台的旧版 JWT 网关校验，避免新 publishable key 被旧校验器误拒绝：

```bash
npx supabase db push
npx supabase secrets set --env-file supabase/.env.ai.local
npx supabase functions deploy politics-ai --no-verify-jwt
```

`POLITICS_AI_ALLOWED_USER_IDS` 是逗号分隔的 Supabase Auth 用户 UUID 白名单；函数在未配置白名单时会失败关闭，避免公开邮箱注册把付费网关变成公共代理。不要把真实网关 Key 写进命令参数、终端截图、Issue、GitHub Secret 的 `VITE_*` 项或任何前端文件。完成后删除本机临时 secret 文件也不会影响远端已设置的 Secret。

### 上线验收

- 未登录时 AI 区只提示登录，标准答案与抽背记录照常可用。
- 已登录后，浏览器 Network 只访问 Supabase Function；源码、`dist`、localStorage 和控制台中没有网关 Key。
- Low / High / Max 请求分别到达服务端；Max 表示 `kimi-k3 + reasoning_effort=max`，不是另一个模型 ID。
- 真实调用需同时确认 HTTP 200、正文非空、无 fallback 响应头且响应模型为 Kimi 上游标识；仅看到 `/v1/models` 中的 `kimi-k3` 不算路由证明。
- 若网关返回 `x-ganlin-fallback-model`，页面必须显示实际回答模型，不能继续标成 Kimi。

当前仓库只包含安全代理实现与部署说明。远端 migration、Secret 和 Function 必须在已登录的正确 Supabase 项目中执行；未完成前，页面会如实显示“服务端 AI 尚未连接”。
