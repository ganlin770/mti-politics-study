import {
  ArrowRight,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Brain,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  FileSearch,
  Landmark,
  Play,
  RotateCcw,
  Scale,
  ScrollText,
  ShieldAlert,
  Star,
  Target,
} from 'lucide-react';
import { HashLink as Link } from '../components/HashLink';
import { POLITICS_LESSONS, POLITICS_SUBJECTS, RESOURCE_AUDIT } from '../data';
import { quarkRootUrl } from '../lib/supabase';
import { useStudy } from '../state/StudyProvider';
import type { PoliticsSubjectId } from '../types';
import { durationToSeconds, formatSeconds, lessonPracticeTarget, recentDays, subjectProgress } from '../utils/study';

const SUBJECT_ICONS = {
  marx: Landmark,
  morals: Scale,
  history: ScrollText,
  mao: Star,
  'new-era': BookOpen,
} satisfies Record<PoliticsSubjectId, typeof Landmark>;

const QUICK_ACTIONS = [
  { to: '/recall', label: '政治抽背', icon: Brain },
  { to: '/mistakes', label: '错题复盘', icon: RotateCcw },
  { to: '/papers', label: '真题', icon: FileSearch },
] as const;

export function TodayPage() {
  const { state, setLessonStatus, setWatchProgress, setActiveLesson } = useStudy();
  const lesson = POLITICS_LESSONS.find((item) => item.id === state.activeLessonId) || POLITICS_LESSONS[0];
  const progress = state.lessons[lesson.id] || { status: 'not-started' as const, watchedSeconds: 0 };
  const durationSeconds = durationToSeconds(lesson.duration);
  const watchPercent = durationSeconds ? Math.min(100, Math.round((progress.watchedSeconds / durationSeconds) * 100)) : 0;
  const targetQuestions = lessonPracticeTarget(lesson);
  const currentSubject = POLITICS_SUBJECTS.find((subject) => subject.id === lesson.subject);
  const latestPractice = state.practiceLogs.find((log) => log.lessonId === lesson.id);
  const watchDone = progress.status === 'completed' && progress.watchedSeconds >= 1_800;
  const practiceDone = Boolean(latestPractice && latestPractice.answered >= targetQuestions);
  const outputDone = Boolean(latestPractice && latestPractice.wrongReason.trim().length >= 20 && latestPractice.framework.trim().length >= 30);
  const gateCount = [watchDone, practiceDone, outputDone].filter(Boolean).length;
  const partialVideo = RESOURCE_AUDIT.items.find((item) => item.id === 'wrong-answer-videos');
  const lessonIndex = POLITICS_LESSONS.findIndex((item) => item.id === lesson.id);
  const nextLesson = POLITICS_LESSONS[lessonIndex + 1];

  function prepareCourse() {
    setActiveLesson(lesson.id);
    if (progress.status === 'not-started') setLessonStatus(lesson.id, 'learning');
  }

  return (
    <div className="page-stack today-page">
      <header className="page-heading today-heading">
        <span className="today-brand-mark"><BookOpen aria-hidden="true" /></span>
        <div><h1>今天，从{currentSubject?.shortName}{lesson.title}开始</h1><p>看课、做题、输出。完成一个闭环，再开始下一课。</p></div>
      </header>

      <section className="study-chain study-composer" aria-label="今日主任务" data-testid="today-chain">
        <article className="focus-card">
          <div className="step-number is-active">1</div>
          <div className="focus-card-body">
            <div className="focus-title-row"><h2>{POLITICS_SUBJECTS.find((subject) => subject.id === lesson.subject)?.shortName} · {lesson.title}</h2><b>{lesson.duration || '待核对'}</b></div>
            <p className="focus-resource">{lesson.resource}</p>
            <div className="progress-track"><i style={{ width: `${watchPercent}%` }} /></div>
            <div className="progress-caption"><span>已学 {formatSeconds(progress.watchedSeconds)} / {lesson.duration || '未核对总时长'}</span><strong>{durationSeconds ? `${watchPercent}%` : progress.status === 'completed' ? '≥30分钟' : '待记录'}</strong></div>
            {durationSeconds ? <label className="watch-slider"><span>学习进度</span><input aria-label="课程已学进度" type="range" min="0" max={durationSeconds} step="60" value={Math.min(progress.watchedSeconds, durationSeconds)} onChange={(event) => setWatchProgress(lesson.id, Number(event.target.value))} /></label> : null}
            <div className="card-actions">
              <a data-testid="course-link" className="button button--primary" href={quarkRootUrl} target="_blank" rel="noopener noreferrer" onClick={prepareCourse}><Play aria-hidden="true" />{progress.watchedSeconds ? '继续学习' : '开始学习'}</a>
              <button className="button button--quiet" type="button" onClick={() => setLessonStatus(lesson.id, watchDone ? 'learning' : 'completed')}>{watchDone ? <CheckCircle2 aria-hidden="true" /> : <BookMarked aria-hidden="true" />}{watchDone ? '已学完' : '标记学完'}</button>
            </div>
          </div>
        </article>
      </section>

      <nav className="quick-actions" aria-label="今日快捷入口">
        <Link to="/courses" className="quick-action"><BookOpenCheck aria-hidden="true" /><span>课程</span></Link>
        <Link to="/practice" className="quick-action"><ClipboardCheck aria-hidden="true" /><span>做题 · {targetQuestions}题</span></Link>
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="quick-action"><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>

      <section className={`today-gate-context${gateCount === 3 ? ' is-passed' : ''}`} aria-labelledby="today-gate-title">
        <div className="context-heading"><h2 id="today-gate-title">今日通关</h2><span>{gateCount} / 3</span></div>
        <Link className="gate-row" to="/courses">{watchDone ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>看课 ≥ 30 分钟</span><b>{watchDone ? '已完成' : '未完成'}</b><ArrowRight aria-hidden="true" /></Link>
        <Link className="gate-row" to="/practice">{practiceDone ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>肖1000 导论 {targetQuestions} 题</span><b>{latestPractice ? `${latestPractice.answered} 题` : '0 题'}</b><ArrowRight aria-hidden="true" /></Link>
        <Link className="gate-row" to="/practice">{outputDone ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>错因 20 字 + 框架 30 字</span><b>{outputDone ? '已完成' : '待完成'}</b><ArrowRight aria-hidden="true" /></Link>
        {gateCount === 3 && nextLesson ? <button className="next-lesson-button" type="button" onClick={() => setActiveLesson(nextLesson.id)}>开启下一课：{nextLesson.title}<ArrowRight aria-hidden="true" /></button> : null}
      </section>

      <section className="support-dashboard" aria-labelledby="progress-overview-title">
        <div className="support-heading"><div><h2 id="progress-overview-title">学习概览</h2><p>主任务保持单线执行；进度和资料证据放在第二屏查看。</p></div><Target aria-hidden="true" /></div>
        <div className="dashboard-grid">
          <section className="panel subject-panel">
            <div className="panel-heading"><h2>五科进度</h2><Link to="/courses">查看全部<ArrowRight aria-hidden="true" /></Link></div>
            <div className="subject-progress-grid">
              {POLITICS_SUBJECTS.map((subject) => {
                const current = subjectProgress(state, subject.id);
                const Icon = SUBJECT_ICONS[subject.id];
                return <div className="subject-progress" key={subject.id}><Icon aria-hidden="true" /><b>{subject.shortName}</b><span>{current.completed} / {current.total} 课次</span><div className="mini-track"><i style={{ width: `${current.percent}%` }} /></div><small>{current.percent}%</small></div>;
              })}
            </div>
          </section>

          <section className="panel audit-mini">
            <div className="panel-heading"><h2>资料覆盖审计</h2><ShieldAlert aria-hidden="true" /></div>
            <dl><div><dt>主课目录</dt><dd><b>5 科 56 项</b><em className="ok">目录已见</em></dd></div><div><dt>肖1000文件</dt><dd><b>试题 + 解析</b><em className="ok">文件已见</em></dd></div><div><dt>逐题视频</dt><dd><b>仅马原与史纲</b><em className="partial">部分</em></dd></div><div><dt>缺口</dt><dd><b>时政 / 冲刺 / 真题</b><em className="missing">缺口</em></dd></div></dl>
            <p>{partialVideo?.detail}</p><Link className="text-link" to="/audit">查看依据与补齐路线<ArrowRight aria-hidden="true" /></Link>
          </section>

          <section className="panel heatmap-panel">
            <div className="panel-heading"><h2>最近 14 天学习</h2><Clock3 aria-hidden="true" /></div>
            <div className="heatmap" aria-label="最近十四天学习分钟数">
              {recentDays(14).map((day) => { const minutes = state.dailyMinutes[day] || 0; const level = minutes >= 90 ? 4 : minutes >= 60 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0; return <div className={`heat-cell heat-${level}`} key={day} title={`${day} · ${minutes} 分钟`}><span>{day.slice(5).replace('-', '/')}</span><b>{minutes || '—'}</b></div>; })}
            </div>
            <div className="heat-summary"><span>本周时长 <b>{Object.values(state.dailyMinutes).slice(-7).reduce((sum, item) => sum + item, 0)}</b> 分钟</span><span>周目标 <b>600</b> 分钟</span></div>
          </section>
        </div>
      </section>
    </div>
  );
}
