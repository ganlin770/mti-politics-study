# 研政 · Politics Lab

一个与原 MTI 应用完全分离的考研政治学习站。它不复制私有课程或题库，而是把夸克中的课程路线组织成每天可执行的闭环：

> 看课 ≥ 30 分钟 → 完成对应章节题 → 闭卷框架 + 错因复盘

线上站点：[https://ganlin770.github.io/mti-politics-study/](https://ganlin770.github.io/mti-politics-study/)

## 已实现

- 今日执行：只显示一条主线，记录看课、做题和输出证据。
- 课程地图：马原 19、思修 8、史纲 10、毛中特 7、新思想 12，共 56 项。
- 练题中心：6 道马原导论原创定位题，以及按当前课次记录的肖1000训练账本。
- 错题复盘：分开展示网页原创错题与私有题册的错因记录。
- 真题训练：只记录年份、得分和复盘，不生成、复制或冒充历年真题题面。
- 资料审计：分开标记目录存在、实际播放、部分覆盖与待补缺口。
- 数据趋势：五科完成度、练题量、正确率和学习热力。
- 本机 + 云同步：未登录也可用；登录后使用 Supabase Auth、RLS 和 revision 冲突检测同步。
- 政治抽背 AI 助教：翻面后可用 Kimi K3 讲解和追问，Low / High / Max 可调且默认 Max；静态标准答案始终作为核对基线。

## 资料结论

2026-07-28 的 Chrome 审计只支持以下结论：

- 目录层观察到 5 科 56 项强化主课；实际打开播放了马原导论 1/56，时长 53:04。
- 观察到 27 版肖1000试题分册和答案解析册文件，未逐页审计完整性。
- 逐题视频只观察到马原和史纲，不是五科全覆盖。
- 需另补年度时政、冲刺资料和完整历年真题。
- 夸克页面有部分账号功能受限提示，不把目录可见说成分享或下载已验证。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev -- --port 4174
```

打开 `http://127.0.0.1:4174/mti-politics-study/`。Supabase 未配置时网站保持本机模式。

## 验证

```bash
npm run check
npm run test:e2e
```

`npm run check` 包含 lint、TypeScript、Vitest 和生产构建。Playwright 同时验证桌面 Chromium 和手机 Chromium。

## 数据库与安全

迁移、RLS、AI Edge Function 与部署验收见 [supabase/README.md](supabase/README.md) 和 [docs/database.md](docs/database.md)。所有表都使用独立的 `politics_*` 命名，不复用旧 MTI 应用的数据表。

公开构建中只允许 Supabase publishable key。AI 网关 URL、网关 Key、固定模型和系统提示词都由 `politics-ai` Edge Function 在服务端持有；不要把网关 Key、`service_role` 或带 token 的个人夸克链接放入任何 `VITE_*` 环境变量、localStorage 或 GitHub Pages 构建变量。

## 视觉验收

设计参考、桌面/手机截图与差异记录见 [design/design-qa.md](design/design-qa.md)。
