import {
  ArrowRight,
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
  ListChecks,
  Maximize2,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

const ANSWER_STRUCTURE = {
  concept: ['先给出准确的定义或核心结论', '展开概念的主要内涵与适用边界', '补充地位、作用或实践要求'],
  relationship: ['先说明两者的总体关系', '分别展开区别、联系或相互作用', '落到统一原则与实践要求'],
  method: ['先指出对应原理或判断依据', '说明必须坚持的方法和具体要求', '补充反对的错误倾向或现实落点'],
  significance: ['先概括总体意义或作用', '分层说明理论、历史与现实价值', '落到目标任务或实践要求'],
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

function RecallSession({ filter, onExit }: { filter: RecallFilter; onExit: () => void }) {
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onExit();
      } else if (event.code === 'Space') {
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
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onExit, rateCurrent, revealed]);

  const sessionHeader = (
    <header className="recall-focus-header">
      <div className="recall-focus-brand">
        <span><Brain aria-hidden="true" /></span>
        <div><b>政治抽背</b><small>{FILTERS.find((item) => item.id === filter)?.label || '今日'} · 全屏专注</small></div>
      </div>
      <div className="recall-focus-progress">
        <div><span>本轮进度</span><b>{current ? Math.min(Math.max(0, initialCount - queue.length) + 1, initialCount) : initialCount} / {initialCount}</b></div>
        <div className="progress-track"><i style={{ width: `${initialCount ? Math.min(100, Math.round(((initialCount - queue.length) / initialCount) * 100)) : 0}%` }} /></div>
        <small>今日已抽 {stats.reviewed} 张 · 待复习 {stats.due} 张</small>
      </div>
      <button className="recall-focus-exit" data-testid="exit-focus-recall" type="button" onClick={onExit} aria-label="退出全屏抽背">
        <X aria-hidden="true" /><span>退出抽背</span><kbd>Esc</kbd>
      </button>
    </header>
  );

  if (!current) {
    const isMistakes = filter === 'mistakes';
    const pendingMistakes = Object.values(state.recallProgress)
      .filter((item) => item.lastRating === 'again')
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const pendingLabel = pendingMistakes[0] ? formatRecallDue(pendingMistakes[0].dueAt) : null;
    return createPortal(
      <section className="recall-focus-overlay" data-testid="recall-focus-overlay" role="dialog" aria-modal="true" aria-label="政治全屏抽背">
        <div className="recall-focus-shell">
          {sessionHeader}
          <main className="recall-focus-main">
            <section className="recall-empty" data-testid="recall-empty">
              <span className="recall-empty-icon"><CheckCircle2 aria-hidden="true" /></span>
              <h2>{isMistakes && pendingLabel ? '错题复习尚未到期' : isMistakes ? '错题卡已经清空' : '本轮抽背完成'}</h2>
              <p>{isMistakes && pendingLabel ? `最近一张将在${pendingLabel}；到期后自动进入队列。` : isMistakes ? '选择“再看”的卡片会按 10 分钟间隔回到这里。' : `本轮完成 ${sessionReviewed} 张，其中会了 ${sessionKnown} 张。`}</p>
              <div className="recall-empty-actions">
                {!isMistakes ? <button className="button button--primary" type="button" onClick={startNextRound}>再抽 {RECALL_DAILY_TARGET} 张</button> : null}
                <button className="button button--secondary" type="button" onClick={onExit}>退出并查看复盘</button>
              </div>
            </section>
          </main>
        </div>
      </section>,
      document.body,
    );
  }

  return createPortal(
    <section className="recall-focus-overlay" data-testid="recall-focus-overlay" role="dialog" aria-modal="true" aria-label="政治全屏抽背">
      <div className="recall-focus-shell">
        {sessionHeader}
        <main className="recall-focus-main">
          <section className={`recall-workspace recall-workspace--immersive${revealed ? ' is-revealed' : ''}`} data-testid="recall-workspace">
        <aside className="recall-guide" aria-label="答案拆解">
          <header><Lightbulb aria-hidden="true" /><div><span>{revealed ? '完整答案与采分点' : '闭卷提示'}</span><h2>{revealed ? '按作答结构逐项核对' : '先完整说，再翻面'}</h2></div></header>
          {revealed ? (
            <div className="recall-explanation" data-testid="recall-answer">
              <section className="recall-complete-answer"><span>完整标准化参考答案</span><p>{current.answer}</p></section>
              <section><span>采分关键词</span><div className="keyword-list">{current.keywords.map((keyword) => <b key={keyword}>{keyword}</b>)}</div></section>
              <section className="recall-answer-structure" data-testid="recall-answer-structure">
                <span>完整作答结构</span>
                <ol>{ANSWER_STRUCTURE[current.kind].map((item, index) => <li key={item}><b>{index + 1}</b><p>{item}</p></li>)}</ol>
              </section>
              <section className="memory-hook"><span>记忆钩子</span><p>{current.memoryHook}</p></section>
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
          <footer><Keyboard aria-hidden="true" /><span>空格翻面 · 1 再看 · 2 模糊 · 3 会了 · Esc 退出</span></footer>
        </article>
          </section>
        </main>
      </div>
    </section>,
    document.body,
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
  const [isFocusMode, setIsFocusMode] = useState(false);
  const { state } = useStudy();
  const stats = recallStats(state.recallProgress, state.recallHistory);
  const dailyPercent = Math.min(100, Math.round((stats.reviewed / RECALL_DAILY_TARGET) * 100));
  const selectedFilter = FILTERS.find((item) => item.id === filter);
  const preparedCount = useMemo(
    () => buildRecallQueue(POLITICS_RECALL_CARDS, state.recallProgress, filter).length,
    [filter, state.recallProgress],
  );

  return (
    <div className="page-stack recall-page">
      <header className="page-heading recall-heading">
        <div><span className="recall-kicker"><Brain aria-hidden="true" />夸克主线核心知识点</span><h1>政治抽背</h1><p>每天先抽 20 张。马原 → 思修 → 史纲 → 毛中特 → 新思想，按到期顺序自动复习。</p></div>
        <div className="recall-daily-stat"><span>今日目标</span><strong>{Math.min(stats.reviewed, RECALL_DAILY_TARGET)}<small> / {RECALL_DAILY_TARGET} 张</small></strong><div className="mini-track"><i style={{ width: `${dailyPercent}%` }} /></div></div>
      </header>

      <section className="recall-preparation" data-testid="recall-preparation">
        <div className="recall-preparation-main">
          <span className="recall-preparation-icon"><Maximize2 aria-hidden="true" /></span>
          <span className="recall-preparation-kicker">今日抽背准备</span>
          <h2>准备好后，进入全屏专注抽背</h2>
          <p>先选范围，再进入独立的大界面闭卷口述。显示答案后，按完整答案、采分点和作答结构逐项核对。</p>

          <nav className="recall-filters" aria-label="抽背范围">
            {FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'mistakes' && stats.again ? <small>{stats.again}</small> : null}</button>)}
          </nav>

          <button className="recall-start-button" data-testid="start-focus-recall" type="button" onClick={() => setIsFocusMode(true)}>
            <Maximize2 aria-hidden="true" /><span><b>开始全屏抽背</b><small>{selectedFilter?.label || '今日'}范围 · 本轮 {preparedCount} 张</small></span><ArrowRight aria-hidden="true" />
          </button>
        </div>

        <aside className="recall-preparation-aside" aria-label="本轮抽背规则">
          <div className="recall-preparation-count"><span>本轮已准备</span><strong>{preparedCount}<small> 张</small></strong><p>按到期优先与夸克主线顺序排列</p></div>
          <div className="recall-preparation-rules">
            <span><ListChecks aria-hidden="true" />一次完整抽背</span>
            <ol>
              <li><b>1</b><p>闭卷口述问题答案</p></li>
              <li><b>2</b><p>显示完整答案与采分点</p></li>
              <li><b>3</b><p>判定结果并自动排期</p></li>
            </ol>
          </div>
          <small>快捷键：空格显示答案，1 / 2 / 3 判定，Esc 退出。</small>
        </aside>
      </section>

      {isFocusMode ? <RecallSession key={filter} filter={filter} onExit={() => setIsFocusMode(false)} /> : null}
      <DailyRecallReview />
    </div>
  );
}
