import { Activity, BarChart3, BookOpenCheck, Target } from 'lucide-react';
import { POLITICS_LESSONS, POLITICS_SUBJECTS } from '../data';
import { useStudy } from '../state/StudyProvider';
import { recentDays, subjectProgress } from '../utils/study';

export function InsightsPage() {
  const { state } = useStudy();
  const completed = POLITICS_LESSONS.filter((lesson) => state.lessons[lesson.id]?.status === 'completed').length;
  const attempts = Object.values(state.quizAttempts);
  const quizCorrect = attempts.filter((attempt) => attempt.correct).length;
  const externalAnswered = state.practiceLogs.reduce((sum, log) => sum + log.answered, 0);
  const externalCorrect = state.practiceLogs.reduce((sum, log) => sum + log.correct, 0);
  const days = recentDays(28);
  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">MEASURE WHAT MATTERS</div><h1>数据趋势</h1><p>页面只显示真实保存的数据；没有训练就显示 0，不用虚假连续天数制造进度感。</p></div></header>
    <section className="metric-cards"><article><BookOpenCheck /><span>完成课次</span><strong>{completed}<small>/56</small></strong></article><article><Target /><span>原创自测正确率</span><strong>{attempts.length ? Math.round((quizCorrect / attempts.length) * 100) : 0}<small>%</small></strong></article><article><BarChart3 /><span>外部练题总量</span><strong>{externalAnswered}<small>题</small></strong></article><article><Activity /><span>外部练题正确率</span><strong>{externalAnswered ? Math.round((externalCorrect / externalAnswered) * 100) : 0}<small>%</small></strong></article></section>
    <div className="two-column"><section className="panel"><div className="section-heading"><div><span>28 DAYS</span><h2>学习分钟热力图</h2></div></div><div className="month-heatmap">{days.map((day) => { const minutes = state.dailyMinutes[day] || 0; const level = minutes >= 90 ? 4 : minutes >= 60 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0; return <div className={`month-cell heat-${level}`} key={day} title={`${day} · ${minutes}分钟`}><span>{day.slice(5)}</span><b>{minutes || '—'}</b></div>; })}</div></section>
      <section className="panel"><div className="section-heading"><div><span>SUBJECTS</span><h2>五科完成度</h2></div></div><div className="subject-bars">{POLITICS_SUBJECTS.map((subject) => { const progress = subjectProgress(state, subject.id); return <div key={subject.id}><span>{subject.shortName}</span><div className="progress-track"><i style={{ width: `${progress.percent}%` }} /></div><b>{progress.completed}/{progress.total}</b></div>; })}</div></section></div>
    <section className="panel data-explanation"><h2>这个页面怎样才会有数据？</h2><p>完成课程、提交原创自测、保存肖1000或真题训练记录后，统计会即时更新。登录 Supabase 后，同一份状态会在电脑与手机之间同步。</p></section>
  </div>;
}
