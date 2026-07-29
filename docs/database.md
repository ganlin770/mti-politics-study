# Supabase 数据库部署与验证

这个项目使用一套全新的 Supabase 数据模型，不依赖其他 MTI 项目的表：

- `politics_user_state`：每个登录用户只有一行，保存当前完整学习状态快照；写入通过带 revision 检查的 `politics_sync_user_state` 函数完成。
- `politics_study_events`：学习行为事件流；前端只能读取和追加，不能修改或删除历史事件。
- `politics_profile`：可选的目标院校、考试年份和每日时长等偏好。

三张表都以 Supabase Auth 的 `auth.users.id`（UUID）作为用户身份，并启用 RLS。`anon` 没有表权限；`authenticated` 只能访问 `user_id = auth.uid()` 的记录。

## 1. 创建并配置 Supabase 项目

1. 在 Supabase 新建一个项目，记下 Project Ref、Project URL 和前端可用的 Publishable Key（旧项目显示为 `anon` key 时也可使用）。
2. 在 **Authentication → URL Configuration** 设置网站的正式 Site URL，例如 `https://<github-user>.github.io/mti-politics-study/`。
3. 把本地地址 `http://127.0.0.1:4174/**` 和正式 GitHub Pages 地址加入 Redirect URLs。
4. 在 **Authentication → Providers → Email** 启用 Email/Magic Link。需要免邮件调试时可以创建测试用户，但不要在前端放 `service_role` key。

浏览器端只允许使用以下公开配置：

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

`service_role` 能绕过 RLS，只能保存在受保护的服务端环境中；这个静态 GitHub Pages 项目不需要它。`VITE_*` 会进入公开的浏览器代码，因此绝对不要把带 token、分享码或个人参数的夸克 URL 通过 Vite 配置发布。

## 2. 应用迁移

推荐用 Supabase CLI，把 `<project-ref>` 替换为实际 Project Ref：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

迁移文件是 [`supabase/migrations/20260728220000_politics_study.sql`](../supabase/migrations/20260728220000_politics_study.sql)。也可以在 Supabase 的 **SQL Editor** 新建查询，粘贴整个文件并运行一次。文件使用 `create ... if not exists`，索引、触发器和 RLS 策略也按可重复执行方式编写，适合在一次中断后重新运行。

## 3. 前端写入约定

完成 Auth 登录后，始终从当前会话取得用户 UUID，不要把用户 ID 写死：

```js
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) throw new Error('请先登录');

await supabase.rpc('politics_sync_user_state', {
  p_state: currentStudyState,
  p_schema_version: 1,
  p_expected_revision: lastServerRevision,
  p_client_updated_at: new Date().toISOString(),
});

await supabase.from('politics_study_events').insert({
  event_id: crypto.randomUUID(),
  user_id: user.id,
  session_id: currentSessionId,
  event_type: 'quiz.completed',
  item_key: questionId,
  payload: { correct: true, duration_ms: 18000 },
  occurred_at: new Date().toISOString(),
});
```

约束与用途：

- `state` 必须是 JSON 对象，最大约 1 MiB；它只保存最新快照。
- `payload` 必须是 JSON 对象，单个事件最大约 256 KiB。
- `preferences` 必须是 JSON 对象，最大约 64 KiB。
- `event_type` 使用小写命名空间格式，例如 `lesson.started`、`quiz.answered`、`review.completed`。
- 政治抽背记录保存在状态快照的 `recallProgress` 对象中；每张卡只保存到期日、间隔、复习次数、遗忘次数、连续答对数和最后判定，不保存课程或题库正文。
- 每次抽背判定追加 `recall.rated` 事件，`item_key` 为稳定卡片 ID，`payload` 只包含 `rating`、`dueOn` 与 `intervalDays`。
- 离线重试必须复用同一个 `event_id`；`(user_id, event_id)` 唯一约束会阻止重复事件。
- `created_at` 是数据库写入时间；`occurred_at` 才是客户端实际发生时间。
- 资料正文、课程视频或整套版权题库不应写入事件表；这里只保存资源 ID、进度、作答结果和统计数据。

## 4. 部署后检查

先在 SQL Editor 执行只读检查，确认三张表都启用并强制执行 RLS：

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'politics_user_state',
    'politics_profile',
    'politics_study_events'
  )
order by c.relname;
```

确认每项策略只授予 `authenticated`，且条件基于 `auth.uid()`：

```sql
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'politics_%'
order by tablename, cmd, policyname;
```

确认 `anon` 没有权限，并检查 `authenticated` 不具备事件更新或删除权限：

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'politics_user_state',
    'politics_profile',
    'politics_study_events'
  )
  and grantee in ('anon', 'authenticated')
order by grantee, table_name, privilege_type;
```

预期结果：没有 `anon` 行；`authenticated` 对 `politics_user_state` 只有 `SELECT`，状态写入只能调用 RPC；对 `politics_profile` 有 `SELECT/INSERT/UPDATE`，对事件表只有 `SELECT/INSERT`。

## 5. 实际 RLS 隔离测试

SQL Editor 默认使用可绕过 RLS 的管理员角色，直接 `select` 不能证明隔离有效。先在 **Authentication → Users** 准备两个测试用户，把下面的 UUID 替换为其中一个真实用户 ID，然后在事务里模拟 `authenticated`：

```sql
begin;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

select * from public.politics_sync_user_state(
  '{"schemaVersion":1,"lessons":{}}'::jsonb,
  1::smallint,
  0,
  statement_timestamp()
);

select * from public.politics_user_state;

rollback;
```

正确替换为真实用户 UUID 后，函数只能以 `auth.uid()` 写入该用户自己的行，后续 `select` 也只能返回该行。把 JWT claim 切换到第二个用户 UUID 后，上一用户的行应不可见。事务最后 `rollback`，不会留下测试数据。

最后从网站完成一次登录、保存进度和答题，再用管理员 SQL 验收最新记录：

```sql
select user_id, schema_version, revision, updated_at
from public.politics_user_state
order by updated_at desc
limit 10;

select user_id, event_type, item_key, occurred_at, created_at
from public.politics_study_events
order by id desc
limit 20;
```

网站端验收标准是：刷新后状态能恢复；同一账号跨浏览器能同步；两个不同账号互相看不到状态或事件；过期 revision 不能静默覆盖新状态；事件记录不能被浏览器客户端更新或删除。
