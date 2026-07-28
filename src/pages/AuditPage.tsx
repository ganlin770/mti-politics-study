import { AlertCircle, CheckCircle2, CircleX, ExternalLink, ShieldCheck } from 'lucide-react';
import { RESOURCE_AUDIT } from '../data';
import { quarkRootUrl } from '../lib/supabase';

const STATUS = {
  available: { label: '已覆盖', icon: CheckCircle2 },
  partial: { label: '部分覆盖', icon: AlertCircle },
  missing: { label: '缺口', icon: CircleX },
} as const;

export function AuditPage() {
  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">EVIDENCE, NOT GUESSWORK</div><h1>资料审计</h1><p>结论来自 2026-07-28 在 Chrome 中实际查看的夸克目录；“目录存在”、“实际可播”与“内容完整”是三个不同证据层级。</p></div><button className="button button--secondary" type="button" onClick={() => window.open(quarkRootUrl, '_blank', 'noopener,noreferrer')}><ExternalLink />打开私有夸克</button></header>
    <section className="audit-overview"><div><span>主课目录</span><strong>5<small>科</small></strong><p>观察到 56 项，实播 1 项</p></div><div><span>题册文件</span><strong>2<small>册</small></strong><p>文件存在，未逐页审计</p></div><div className="partial"><span>视题讲解</span><strong>2<small>/5 科</small></strong><p>只观察到马原、史纲</p></div><div className="missing"><span>关键缺口</span><strong>3<small>类</small></strong><p>时政、冲刺、历年真题</p></div></section>
    <section className="source-boundary"><AlertCircle /><div><b>当前访问边界</b><p>夸克目录可查看，马原导论已播放；账号页面同时有部分功能受限提示，因此本站不承诺分享或下载能力。</p></div></section>
    <section className="panel audit-table"><div className="section-heading"><div><span>AUDIT DETAILS</span><h2>逐项覆盖结论</h2></div><ShieldCheck /></div><div className="audit-rows">{RESOURCE_AUDIT.items.map((item) => { const meta = STATUS[item.status]; const Icon = meta.icon; return <article key={item.id} className={`audit-row audit-row--${item.status}`}><Icon /><div><h3>{item.label}</h3><p>{item.detail}</p></div><b>{meta.label}</b></article>; })}</div><p className="audit-basis">审计依据：{RESOURCE_AUDIT.auditBasis}</p></section>
    <section className="panel gap-roadmap"><div className="section-heading"><div><span>NEXT SUPPLY</span><h2>缺口补齐顺序</h2></div></div><ol><li><b>现在先不补老师</b><span>用现有 5 科强化主课 + 肖1000完成第一轮，不在重复课程间跳转。</span></li><li><b>10—11 月补年度时政</b><span>选择一套按月份整理、可核验来源的时政资料，纳入专项练习。</span></li><li><b>11 月补冲刺背诵与模拟</b><span>只选一套冲刺主线，重点解决分析题框架与选择题高频易错。</span></li><li><b>尽快补完整真题</b><span>至少按年份整理题面、答案与首次得分，用于命题风格和时间校准。</span></li></ol></section>
  </div>;
}
