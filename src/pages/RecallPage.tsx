import {
  Brain,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  History,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LESSON_BY_ID,
  POLITICS_RECALL_CARDS,
  POLITICS_SUBJECTS,
  RECALL_ANSWER_BASIS_BY_ID,
} from '../data';
import { useStudy } from '../state/StudyProvider';
import type { RecallRating } from '../state/studyTypes';
import type { PoliticsSubjectId } from '../types';
import {
  buildRecallQueue,
  formatRecallDue,
  recallDailySummary,
  recallStats,
  recentRecallSummaries,
  RECALL_DAILY_TARGET,
  RECALL_SCHEDULE_LABELS,
  type RecallFilter,
} from '../utils/recall';

const FILTERS: Array<{ id: RecallFilter; label: string }> = [
  { id: 'all', label: '今日' },
  { id: 'mistakes', label: '错题卡' },
  ...POLITICS_SUBJECTS.map((subject) => ({ id: subject.id, label: subject.shortName })),
];

const KIND_LABEL = {
  concept: '核心概念',
  relationship: '关系辨析',
  method: '方法论',
  significance: '意义作用',
} as const;

const RATING_LABEL: Record<RecallRating, string> = {
  again: '再看',
  fuzzy: '模糊',
  known: '会了',
};

const CARD_BY_ID = Object.fromEntries(POLITICS_RECALL_CARDS.map((card) => [card.id, card]));

function subjectName(subjectId: PoliticsSubjectId) {
  return POLITICS_SUBJECTS.find((subject) => subject.id === subjectId)?.shortName || subjectId;
}

function RecallSession({ filter }: { filter: RecallFilter }) {
  const { state, rateRecallCard } = useStudy();
  const initialCards = useMemo(
    () => buildRecallQueue(POLITICS_RECALL_CARDS, state.recallProgress, filter),
    // The session is deliberately frozen until the learner changes the filter or starts another round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter],
  );
  const [queue, setQueue] = useState(() => initialCards.map((card) => card.id));
  const [revealed, setRevealed] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionKnown, setSessionKnown] = useState(0);
  const current = POLITICS_RECALL_CARDS.find((card) => card.id === queue[0]);
  const initialCount = initialCards.length;
  const lesson = current ? LESSON_BY_ID[current.lessonId] : null;
  const basis = current ? RECALL_ANSWER_BASIS_BY_ID[current.answerBasisId] : null;
  const stats = recallStats(state.recallProgress, state.recallHistory);

  const startNextRound = useCallback(() => {
    setQueue(buildRecallQueue(POLITICS_RECALL_CARDS, state.recallProgress, filter).map((card) => card.id));
    setRevealed(false);
    setSessionReviewed(0);
    setSessionKnown(0);
  }, [filter, state.recallProgress]);

  const rateCurrent = useCallback((rating: RecallRating) => {
    if (!current || !revealed) return;
    rateRecallCard(current.id, rating);
    setSessionReviewed((value) => value + 1);
    if (rating === 'known') setSessionKnown((value) => value + 1);
    setQueue((items) => {
      const rest = items.slice(1);
      return rest;
    });
    setRevealed(false);
  }, [current, rateRecallCard, revealed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && event.key === '1') {
        rateCurrent('again');
      } else if (revealed && event.key === '2') {
        rateCurrent('fuzzy');
      } else if (revealed && event.key === '3') {
        rateCurrent('known');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rateCurrent, revealed]);

  if (!current) {
    const isMistakes = filter === 'mistakes';
    const pendingMistakes = Object.values(state.recallProgress)
      .filter((item) => item.lastRating === 'again')
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const pendingLabel = pendingMistakes[0] ? formatRecallDue(pendingMistakes[0].dueAt) : null;
    return (
      <section className="recall-empty" data-testid="recall-empty">
        <span className="recall-empty-icon"><CheckCircle2 aria-hidden="true" /></span>
        <h2>{isMistakes && pendingLabel ? '错题复习尚未到期' : isMistakes ? '错题卡已经清空' : '本轮抽背完成'}</h2>
        <p>{isMistakes && pendingLabel ? `最近一张将在${pendingLabel}；到期后自动进入队列。` : isMistakes ? '选择“再看”的卡片会按 10 分钟间隔回到这里。' : `本轮完成 ${sessionReviewed} 张，其中会了 ${sessionKnown} 张。`}</p>
        {!isMistakes ? <button className="button button--primary" type="button" onClick={startNextRound}>再抽 {RECALL_DAILY_TARGET} 张</button> : null}
      </section>
    );
  }

  const completed = Math.max(0, initialCount - queue.length);
  const progressPercent = initialCount ? Math.min(100, Math.round((completed / initialCount) * 100)) : 0;

  return (
    <>
      <div className="recall-progress-line" aria-label="本轮抽背进度">
        <div><span>本轮进度</span><b>{Math.min(completed + 1, initialCount)} / {initialCount}</b></div>
        <div className="progress-track"><i style={{ width: `${progressPercent}%` }} /></div>
        <small>今日已抽 {stats.reviewed} 张 · 待复习 {stats.due} 张</small>
      </div>

      <section className={`recall-workspace${revealed ? ' is-revealed' : ''}`} data-testid="recall-workspace">
        <aside className="recall-guide" aria-label="答案拆解">
          <header><Lightbulb aria-hidden="true" /><div><span>{revealed ? '答案拆解' : '闭卷提示'}</span><h2>{revealed ? '用三层结构记住' : '先完整说，再翻面'}</h2></div></header>
          {revealed ? (
            <div className="recall-explanation" data-testid="recall-answer">
              <section><span>标准化参考答案</span><p>{current.answer}</p></section>
              <section className="memory-hook"><span>记忆钩子</span><p>{current.memoryHook}</p></section>
              <section><span>采分关键词</span><div className="keyword-list">{current.keywords.map((keyword) => <b key={keyword}>{keyword}</b>)}</div></section>
              {basis ? (
                <section className="recall-answer-basis" data-testid="recall-answer-basis">
                  <span>教材核对 · {current.answerVerifiedAt}</span>
                  <a href={basis.url} target="_blank" rel="noreferrer">
                    <BookOpenCheck aria-hidden="true" />
                    <b>《{basis.title}》{basis.edition}</b>
                    <small>{basis.publisher} · 官方书目</small>
                    <ExternalLink aria-hidden="true" />
                  </a>
                </section>
              ) : null}
            </div>
          ) : (
            <ol className="recall-instructions">
              <li><span>1</span><div><b>先定类别</b><p>{KIND_LABEL[current.kind]}题，先说主干。</p></div></li>
              <li><span>2</span><div><b>再给层次</b><p>定义或结论 → 展开关系 → 方法或意义。</p></div></li>
              <li><span>3</span><div><b>最后自检</b><p>能否覆盖至少 3 个关键词，再显示答案。</p></div></li>
            </ol>
          )}
          <div className="recall-source-note"><Sparkles aria-hidden="true" /><span>{current.sourceLabel}<small>答案按官方教材标准化；最终以当年考试大纲、命题和阅卷要求为准。</small></span></div>
        </aside>

        <article className="recall-card" aria-live="polite">
          <div className="recall-card-meta">
            <span>{subjectName(current.subject)} · {KIND_LABEL[current.kind]}</span>
            <b>{lesson?.title}</b>
          </div>
          <div className="recall-question">
            <Brain aria-hidden="true" />
            <p>{current.prompt}</p>
            {!revealed ? <span>闭卷口述后，再显示答案</span> : <span className="is-ready"><Check aria-hidden="true" />答案已显示，请如实判定</span>}
          </div>
          <div className="recall-card-actions">
            {!revealed ? (
              <button data-testid="reveal-answer" className="recall-reveal-button" type="button" onClick={() => setRevealed(true)}><Eye aria-hidden="true" />显示答案 <kbd>Space</kbd></button>
            ) : (
              <div className="recall-rating-grid" aria-label="抽背结果">
                <button data-testid="recall-again" className="recall-rate recall-rate--again" type="button" onClick={() => rateCurrent('again')}><RotateCcw aria-hidden="true" /><span><b>再看</b><small>10 分钟后复习</small></span><kbd>1</kbd></button>
                <button data-testid="recall-fuzzy" className="recall-rate recall-rate--fuzzy" type="button" onClick={() => rateCurrent('fuzzy')}><Target aria-hidden="true" /><span><b>模糊</b><small>明天再背</small></span><kbd>2</kbd></button>
                <button data-testid="recall-known" className="recall-rate recall-rate--known" type="button" onClick={() => rateCurrent('known')}><CheckCircle2 aria-hidden="true" /><span><b>会了</b><small>排下次复习</small></span><kbd>3</kbd></button>
              </div>
            )}
          </div>
          <footer><Keyboard aria-hidden="true" /><span>空格翻面 · 1 再看 · 2 模糊 · 3 会了</span></footer>
        </article>
      </section>
    </>
  );
}

function DailyRecallReview() {
  const { state } = useStudy();
  const summary = recallDailySummary(state.recallHistory);
  const recentDays = recentRecallSummaries(state.recallHistory);
  const recentEvents = state.recallHistory.slice(0, 6);

  return (
    <section className="daily-recall-review" data-testid="daily-recall-review">
      <header>
        <div><span><History aria-hidden="true" />每日留痕</span><h2>今日复盘</h2><p>每次判定都保留，不会被下一次复习覆盖。</p></div>
        <div className="recall-mastery"><TrendingUp aria-hidden="true" /><span>今日掌握率</span><strong>{summary.masteryRate}%</strong></div>
      </header>

      <div className="recall-summary-grid" aria-label="今日抽背统计">
        <div><span>抽背次数</span><strong>{summary.reviews}</strong><small>{summary.uniqueCards} 张不同卡片</small></div>
        <div><span>会了</span><strong>{summary.known}</strong><small>进入下个间隔</small></div>
        <div><span>模糊</span><strong>{summary.fuzzy}</strong><small>明天复习</small></div>
        <div><span>再看</span><strong>{summary.again}</strong><small>10 分钟后复习</small></div>
      </div>

      <div className="recall-schedule" data-testid="recall-schedule">
        <div><CalendarClock aria-hidden="true" /><span><b>间隔复习阶梯</b><small>错答回到 10 分钟；连续“会了”逐级推进</small></span></div>
        <ol>{RECALL_SCHEDULE_LABELS.map((label) => <li key={label}>{label}</li>)}</ol>
        <p>这是依据间隔效应设置的艾宾浩斯启发式默认节奏；最佳间隔会随目标保持时间和个人表现变化。</p>
      </div>

      <div className="recall-review-columns">
        <section className="recall-event-panel">
          <h3>最近复习记录</h3>
          {recentEvents.length ? (
            <ul data-testid="recall-history-list">
              {recentEvents.map((event) => {
                const card = CARD_BY_ID[event.cardId];
                return (
                  <li key={event.id}>
                    <i className={`is-${event.rating}`} aria-hidden="true" />
                    <div><b>{card?.prompt || '政治知识点'}</b><span>{new Date(event.reviewedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {RATING_LABEL[event.rating]}</span></div>
                    <small>{formatRecallDue(event.dueAt)}</small>
                  </li>
                );
              })}
            </ul>
          ) : <p className="recall-review-empty">完成第一张抽背后，这里会自动生成复习记录。</p>}
        </section>

        <section className="recall-week-panel">
          <h3>最近 7 天</h3>
          <div className="recall-week-list">
            {recentDays.map((day) => (
              <div key={day.day} className={day.day === summary.day ? 'is-today' : ''}>
                <span>{day.day === summary.day ? '今天' : `${Number(day.day.slice(5, 7))}/${Number(day.day.slice(8, 10))}`}</span>
                <i><b style={{ width: `${Math.min(100, day.reviews * 5)}%` }} /></i>
                <strong>{day.reviews} 次</strong>
                <small>{day.masteryRate}%</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function RecallPage() {
  const [filter, setFilter] = useState<RecallFilter>('all');
  const { state } = useStudy();
  const stats = recallStats(state.recallProgress, state.recallHistory);
  const dailyPercent = Math.min(100, Math.round((stats.reviewed / RECALL_DAILY_TARGET) * 100));

  return (
    <div className="page-stack recall-page">
      <header className="page-heading recall-heading">
        <div><span className="recall-kicker"><Brain aria-hidden="true" />夸克主线核心知识点</span><h1>政治抽背</h1><p>每天先抽 20 张。马原 → 思修 → 史纲 → 毛中特 → 新思想，按到期顺序自动复习。</p></div>
        <div className="recall-daily-stat"><span>今日目标</span><strong>{Math.min(stats.reviewed, RECALL_DAILY_TARGET)}<small> / {RECALL_DAILY_TARGET} 张</small></strong><div className="mini-track"><i style={{ width: `${dailyPercent}%` }} /></div></div>
      </header>

      <nav className="recall-filters" aria-label="抽背范围">
        {FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'mistakes' && stats.again ? <small>{stats.again}</small> : null}</button>)}
      </nav>

      <RecallSession key={filter} filter={filter} />
      <DailyRecallReview />
    </div>
  );
}
