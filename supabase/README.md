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
