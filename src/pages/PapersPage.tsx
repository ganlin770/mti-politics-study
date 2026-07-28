import { FileQuestion, Save, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStudy } from '../state/StudyProvider';
import { dateKey } from '../utils/study';

export function PapersPage() {
  const { state, savePracticeLog } = useStudy();
  const [message, setMessage] = useState('');
  const records = state.practiceLogs.filter((log) => log.lessonId === 'past-paper');

  function savePaper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answered = Math.max(0, Math.min(100, Number(form.get('answered')) || 0));
    savePracticeLog({
      lessonId: 'past-paper',
      date: String(form.get('date') || dateKey(new Date())),
      resource: `${String(form.get('year') || '')} 考研政治真题`,
      rangeLabel: String(form.get('rangeLabel') || '选择题'),
      answered,
      correct: Math.max(0, Math.min(answered, Number(form.get('correct')) || 0)),
      wrongReason: String(form.get('wrongReason') || ''),
      framework: String(form.get('framework') || ''),
    });
    setMessage('真题训练结果已保存；本站没有复制或公开题面。');
  }

  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">PAST PAPERS</div><h1>真题训练</h1><p>当前夸克主线尚未发现完整历年真题包。本页先把训练、得分和复盘系统搭好，等你补齐合法题源后直接使用。</p></div><div className="heading-stat danger"><strong>缺口</strong><span>需补齐题源</span></div></header>
    <section className="source-boundary source-boundary--danger"><ShieldAlert /><div><b>不把“肖1000”当成“历年真题”</b><p>二者用途不同。真题用来校准命题风格与时间分配；肖1000用于章节巩固。补齐真题前，页面不会生成或冒充真题题面。</p></div></section>
    <div className="two-column"><section className="panel"><div className="section-heading"><div><span>LOG A PAPER</span><h2>记录一次真题训练</h2></div><FileQuestion /></div><form className="practice-form" onSubmit={savePaper}><div className="form-grid"><label>真题年份<input name="year" type="number" min="2010" max="2030" placeholder="例如 2025" required /></label><label>训练日期<input name="date" type="date" defaultValue={dateKey(new Date())} required /></label></div><label>训练范围<input name="rangeLabel" placeholder="例如：选择题 1—33" required /></label><div className="form-grid"><label>完成题数<input name="answered" type="number" min="1" max="100" required /></label><label>正确题数<input name="correct" type="number" min="0" max="100" required /></label></div><label>错因复盘<textarea name="wrongReason" rows={5} required placeholder="按知识盲点、审题、干扰项、时间分配分类。" /></label><label>本套题框架 / 易错结论<textarea name="framework" rows={5} required /></label><button className="button button--primary full-button" type="submit"><Save />保存真题记录</button><p className="form-note" role="status">{message}</p></form></section>
      <section className="panel"><div className="section-heading"><div><span>HISTORY</span><h2>已记录真题</h2></div></div>{records.length ? <div className="paper-records">{records.map((record) => <article key={record.id}><div><b>{record.resource}</b><span>{record.date}</span></div><strong>{record.correct}/{record.answered}</strong><p>{record.wrongReason}</p></article>)}</div> : <div className="empty-state"><FileQuestion /><h3>还没有真题记录</h3><p>先补齐合法、完整、按年份整理的真题与答案，再在左侧记录第一次限时训练。</p></div>}</section></div>
  </div>;
}
