import { Check, ChevronRight, Circle, Clock3, Play, TestTube2 } from 'lucide-react';
import { useMemo } from 'react';
import { HashLink as Link } from '../components/HashLink';
import { POLITICS_LESSONS, POLITICS_SUBJECTS } from '../data';
import { quarkRootUrl } from '../lib/supabase';
import { useStudy } from '../state/StudyProvider';
import { lessonStatusLabel, subjectProgress } from '../utils/study';

export function CoursesPage() {
  const { state, setActiveLesson, setLessonStatus } = useStudy();
  const activeSubject = POLITICS_LESSONS.find((lesson) => lesson.id === state.activeLessonId)?.subject || 'marx';
  const grouped = useMemo(() => new Map(POLITICS_SUBJECTS.map((subject) => [subject.id, POLITICS_LESSONS.filter((lesson) => lesson.subject === subject.id)])), []);

  function prepareLesson(lessonId: string) {
    setActiveLesson(lessonId);
    if (state.lessons[lessonId]?.status !== 'completed') setLessonStatus(lessonId, 'learning');
  }

  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">56-LESSON ROADMAP</div><h1>课程地图</h1><p>主课按文件夹原顺序学习；阶段测试保留在路线中，学完一节再推进下一节。</p></div><div className="heading-stat"><strong>{POLITICS_SUBJECTS.reduce((sum, subject) => sum + subjectProgress(state, subject.id).completed, 0)}</strong><span>/ 56 已完成</span></div></header>
    <div className="course-summary-row">{POLITICS_SUBJECTS.map((subject) => { const progress = subjectProgress(state, subject.id); return <div key={subject.id}><span>{subject.shortName}</span><b>{progress.completed}/{progress.total}</b><div className="mini-track"><i style={{ width: `${progress.percent}%` }} /></div></div>; })}</div>
    <section className="course-list" data-testid="course-map">{POLITICS_SUBJECTS.map((subject) => { const lessons = grouped.get(subject.id) || []; const progress = subjectProgress(state, subject.id); return <details key={subject.id} open={subject.id === activeSubject}><summary><div><span>{String(subject.order).padStart(2, '0')}</span><div><h2>{subject.name}</h2><p>{subject.folder}</p></div></div><div><b>{progress.completed}/{progress.total}</b><ChevronRight /></div></summary><ol>{lessons.map((lesson) => { const status = state.lessons[lesson.id]?.status || 'not-started'; return <li key={lesson.id} className={lesson.id === state.activeLessonId ? 'is-current' : ''}><span className={`lesson-marker lesson-marker--${status}`}>{status === 'completed' ? <Check /> : lesson.kind === 'stage-test' ? <TestTube2 /> : <Circle />}</span><div className="lesson-main"><small>{String(lesson.order).padStart(2, '0')} · {lesson.kind === 'stage-test' ? '阶段测试' : '强化课'}</small><h3>{lesson.title}</h3><p>{lesson.pathEvidence === 'observed' ? '实测路径' : '建议查找路径'}：{lesson.relativePath}</p></div><div className="lesson-meta">{lesson.duration ? <span><Clock3 />{lesson.duration}</span> : null}<em>{lessonStatusLabel(lesson, state)}</em></div><div className="lesson-actions"><button type="button" className="button button--quiet" aria-label={`${status === 'completed' ? '取消完成' : '标记完成'}：${lesson.title}`} onClick={() => setLessonStatus(lesson.id, status === 'completed' ? 'learning' : 'completed')}>{status === 'completed' ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>{status === 'completed' ? '取消完成' : '标记完成'}</span></button><a className="icon-button" aria-label={`打开${lesson.title}`} href={quarkRootUrl} target="_blank" rel="noopener noreferrer" onClick={() => prepareLesson(lesson.id)}><Play /></a></div></li>; })}</ol></details>; })}</section>
    <div className="bottom-callout"><p>网站不托管课程文件。点击打开后，请在夸克按相对路径进入私有资料；未核对总时长的课次，“标记完成”按通关下限记录 30 分钟。</p><Link className="button button--primary" to="/practice">学完去练题<ChevronRight /></Link></div>
  </div>;
}
