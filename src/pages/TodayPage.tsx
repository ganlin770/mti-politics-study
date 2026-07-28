import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FilePenLine,
  Landmark,
  Play,
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
import { durationToSeconds, formatSeconds, lessonPracticeLabel, lessonPracticeTarget, recentDays, subjectProgress } from '../utils/study';

const SUBJECT_ICONS = {
  marx: Landmark,
  morals: Scale,
  history: ScrollText,
  mao: Star,
  'new-era': BookOpen,
} satisfies Record<PoliticsSubjectId, typeof Landmark>;

export function TodayPage() {
  const { state, setLessonStatus, setWatchProgress, setActiveLesson } = useStudy();
  const lesson = POLITICS_LESSONS.find((item) => item.id === state.activeLessonId) || POLITICS_LESSONS[0];
  const progress = state.lessons[lesson.id] || { status: 'not-started' as const, watchedSeconds: 0 };
  const durationSeconds = durationToSeconds(lesson.duration);
  const watchPercent = durationSeconds ? Math.min(100, Math.round((progress.watchedSeconds / durationSeconds) * 100)) : 0;
  const targetQuestions = lessonPracticeTarget(lesson);
  const practiceLabel = lessonPracticeLabel(lesson);
  const latestPractice = state.practiceLogs.find((log) => log.lessonId === lesson.id);
  const watchDone = progress.status === 'completed' && progress.watchedSeconds >= 1_800;
  const practiceDone = Boolean(latestPractice && latestPractice.answered >= targetQuestions);
  const outputDone = Boolean(
    latestPractice && latestPractice.wrongReason.trim().length >= 20 && latestPractice.framework.trim().length >= 30,
  );
  const gateCount = [watchDone, practiceDone, outputDone].filter(Boolean).length;
  const partialVideo = RESOURCE_AUDIT.items.find((item) => item.id === 'wrong-answer-videos');
  const lessonIndex = POLITICS_LESSONS.findIndex((item) => item.id === lesson.id);
  const nextLesson = POLITICS_LESSONS[lessonIndex + 1];

  function openCourse() {
    setActiveLesson(lesson.id);
    if (progress.status === 'not-started') setLessonStatus(lesson.id, 'learning');
    window.open(quarkRootUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="page-stack today-page">
      <header className="page-heading today-heading">
        <div><div className="eyebrow">TODAY'S FOCUS</div><h1>今天只做三件事</h1><p>把复杂的政治复习压成一个闭环：输入、检验、输出。</p></div>
        <blockquote>把复杂的问题简单化，<br />把简单的事情重复做。<small>— 研政学习法则</small></blockquote>
      </header>

      <section className="study-chain" aria-label="今日三步学习闭环" data-testid="today-chain">
        <article className="chain-card chain-card--course">
          <div className="step-number">1</div><div className="step-title"><Play aria-hidden="true" /><span>看课</span></div>
          <div className="step-body"><div className="step-topline"><div><span className="subject-kicker">{lesson.resource}</span><h2>{POLITICS_SUBJECTS.find((s) => s.id === lesson.subject)?.shortName} · {lesson.title}</h2></div><b>{lesson.duration || '待核对'}</b></div>
            <div className="progress-track"><i style={{ width: `${watchPercent}%` }} /></div>
            <div className="progress-caption"><span>已学 {formatSeconds(progress.watchedSeconds)} / {lesson.duration || '未核对总时长'}</span><strong>{durationSeconds ? `${watchPercent}%` : progress.status === 'completed' ? '≥30分钟' : '待记录'}</strong></div>
            {durationSeconds ? <label className="watch-slider">调整已学位置<span className="sr-only">秒数</span><input aria-label="课程已学进度" type="range" min="0" max={durationSeconds} step="60" value={Math.min(progress.watchedSeconds, durationSeconds)} onChange={(event) => setWatchProgress(lesson.id, Number(event.target.value))} /></label> : null}
            <div className="card-actions"><button className="button button--primary" type="button" onClick={openCourse}><Play aria-hidden="true" />{progress.watchedSeconds ? '继续学习' : '打开私有课程'}</button><button className="button button--quiet" type="button" onClick={() => setLessonStatus(lesson.id, watchDone ? 'learning' : 'completed')}>{watchDone ? <CheckCircle2 /> : <BookMarked />}{watchDone ? '已学完' : '标记学完'}</button></div>
          </div>
        </article>

        <article className="chain-card chain-card--practice">
          <div className="step-number">2</div><div className="step-title"><FilePenLine aria-hidden="true" /><span>做题</span></div>
          <div className="step-body"><div className="step-topline"><div><span className="subject-kicker">27 版肖1000 · 题面留在私有资料</span><h2>{practiceLabel}</h2></div>{practiceDone ? <CheckCircle2 className="status-icon done" /> : <Circle className="status-icon" />}</div>
            <div className="metric-row"><span><Target />目标 <b>{targetQuestions}</b> 题</span><span>已做 <b>{latestPractice?.answered || 0}</b></span><span>正确 <b>{latestPractice?.correct || 0}</b></span></div>
            <Link className="button button--secondary full-button" to="/practice">进入练题与统计<ArrowRight /></Link>
          </div>
        </article>

        <article className="chain-card chain-card--output">
          <div className="step-number">3</div><div className="step-title"><BookMarked aria-hidden="true" /><span>输出</span></div>
          <div className="step-body"><div className="step-topline"><div><span className="subject-kicker">合上课程与解析后再写</span><h2>闭卷框架 + 错因复盘</h2></div>{outputDone ? <CheckCircle2 className="status-icon done" /> : <Circle className="status-icon" />}</div>
            <p className="output-preview">{latestPractice?.framework || '至少写 30 字知识框架，并用 20 字说明今天最主要的错误来源。'}</p>
            <Link className="button button--secondary full-button" to="/practice">{outputDone ? '查看我的输出' : '去完成输出'}<ArrowRight /></Link>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel subject-panel">
          <div className="panel-heading"><div><span>COURSE MAP</span><h2>五科进度地图</h2></div><Link to="/courses">进入课程地图<ArrowRight /></Link></div>
          <div className="subject-progress-grid">
            {POLITICS_SUBJECTS.map((subject) => {
              const current = subjectProgress(state, subject.id);
              const Icon = SUBJECT_ICONS[subject.id];
              return <div className="subject-progress" key={subject.id}><Icon aria-hidden="true" /><b>{subject.shortName}</b><span>{current.completed} / {current.total} 课次</span><div className="mini-track"><i style={{ width: `${current.percent}%` }} /></div><small>{current.percent}%</small></div>;
            })}
          </div>
        </section>

        <section className="panel audit-mini">
          <div className="panel-heading"><div><span>RESOURCE AUDIT</span><h2>资料覆盖审计</h2></div><ShieldAlert aria-hidden="true" /></div>
          <dl><div><dt>主课目录</dt><dd><b>5 科 56 项</b><em className="ok">目录已见</em></dd></div><div><dt>肖1000文件</dt><dd><b>试题 + 解析</b><em className="ok">文件已见</em></dd></div><div><dt>逐题视频</dt><dd><b>仅马原与史纲</b><em className="partial">部分</em></dd></div><div><dt>缺口</dt><dd><b>时政 / 冲刺 / 真题</b><em className="missing">缺口</em></dd></div></dl>
          <p>{partialVideo?.detail}</p><Link className="text-link" to="/audit">查看依据与补齐路线<ArrowRight /></Link>
        </section>

        <section className="panel heatmap-panel">
          <div className="panel-heading"><div><span>ACTIVITY</span><h2>最近 14 天学习热力</h2></div><Clock3 aria-hidden="true" /></div>
          <div className="heatmap" aria-label="最近十四天学习分钟数">
            {recentDays(14).map((day) => { const minutes = state.dailyMinutes[day] || 0; const level = minutes >= 90 ? 4 : minutes >= 60 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0; return <div className={`heat-cell heat-${level}`} key={day} title={`${day} · ${minutes} 分钟`}><span>{day.slice(5).replace('-', '/')}</span><b>{minutes || '—'}</b></div>; })}
          </div>
          <div className="heat-summary"><span>本周时长 <b>{Object.values(state.dailyMinutes).slice(-7).reduce((sum, item) => sum + item, 0)}</b> 分钟</span><span>周目标 <b>600</b> 分钟</span></div>
        </section>

        <section className={`panel gate-panel${gateCount === 3 ? ' is-passed' : ''}`}>
          <div className="panel-heading"><div><span>ACCEPTANCE GATE</span><h2>今日通关门槛</h2></div><Target aria-hidden="true" /></div>
          <ul>{[
            [watchDone, '看课 ≥ 30 分钟并标记完成', watchDone ? '已完成' : '未完成'],
            [practiceDone, `肖1000 本节共 ${targetQuestions} 题`, latestPractice ? `${latestPractice.answered} 题` : '0 题'],
            [outputDone, '错因 20 字 + 框架 30 字', outputDone ? '已完成' : '待完成'],
          ].map(([done, label, result]) => <li key={String(label)}>{done ? <Check /> : <Circle />}<span>{label}</span><b>{result}</b></li>)}</ul>
          <div className="gate-result"><strong>{gateCount === 3 ? '今日通关成功' : `还差 ${3 - gateCount} 项`}</strong><span>{gateCount === 3 ? '保持节奏，明天继续。' : '完成证据后才算真正学完。'}</span>{gateCount === 3 && nextLesson ? <button className="button button--secondary" type="button" onClick={() => setActiveLesson(nextLesson.id)}>开启下一课：{nextLesson.title}<ArrowRight /></button> : null}</div>
        </section>
      </div>
    </div>
  );
}
