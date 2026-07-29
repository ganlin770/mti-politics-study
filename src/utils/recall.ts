import type { PoliticsRecallCard, PoliticsSubjectId } from '../types';
import type { RecallProgress, RecallRating, RecallReviewLog } from '../state/studyTypes';

export const RECALL_DAILY_TARGET = 20;
export const RECALL_AGAIN_MINUTES = 10;
export const RECALL_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30, 60] as const;
export const RECALL_SCHEDULE_LABELS = ['10分钟', '1天', '2天', '4天', '7天', '15天', '30天', '60天'] as const;

export type RecallFilter = 'all' | 'mistakes' | PoliticsSubjectId;

export function recallDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMinutes(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 60_000);
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function recallStageFromInterval(intervalDays: number) {
  if (intervalDays <= 0) return 0;
  const exact = RECALL_INTERVALS_DAYS.findIndex((days) => days === intervalDays);
  if (exact >= 0) return exact + 1;
  const closest = RECALL_INTERVALS_DAYS.reduce((best, days, index) => (
    Math.abs(days - intervalDays) < Math.abs(RECALL_INTERVALS_DAYS[best] - intervalDays) ? index : best
  ), 0);
  return closest + 1;
}

export function recallIntervalLabel(progress: Pick<RecallProgress, 'stage' | 'intervalDays'>) {
  return progress.stage === 0 ? `${RECALL_AGAIN_MINUTES}分钟` : `${progress.intervalDays}天`;
}

export function nextRecallProgress(
  cardId: string,
  previous: RecallProgress | undefined,
  rating: RecallRating,
  now = new Date(),
): RecallProgress {
  const reviews = (previous?.reviews || 0) + 1;
  const lapses = (previous?.lapses || 0) + (rating === 'again' ? 1 : 0);
  let stage: number;
  let intervalDays: number;
  let due: Date;

  if (rating === 'again') {
    stage = 0;
    intervalDays = 0;
    due = addMinutes(now, RECALL_AGAIN_MINUTES);
  } else if (rating === 'fuzzy') {
    stage = Math.max(1, Math.min(RECALL_INTERVALS_DAYS.length, (previous?.stage || 1) - 1));
    intervalDays = 1;
    due = addDays(now, intervalDays);
  } else {
    stage = Math.min(RECALL_INTERVALS_DAYS.length, Math.max(1, (previous?.stage || 0) + 1));
    intervalDays = RECALL_INTERVALS_DAYS[stage - 1];
    due = addDays(now, intervalDays);
  }

  return {
    cardId,
    dueOn: recallDay(due),
    dueAt: due.toISOString(),
    stage,
    intervalDays,
    reviews,
    lapses,
    streak: rating === 'again' ? 0 : (previous?.streak || 0) + 1,
    lastRating: rating,
    lastReviewedAt: now.toISOString(),
  };
}

export function buildRecallQueue(
  cards: PoliticsRecallCard[],
  progress: Record<string, RecallProgress>,
  filter: RecallFilter,
  target = RECALL_DAILY_TARGET,
  now = new Date(),
) {
  const eligible = cards.filter((card) => {
    if (filter === 'mistakes') return progress[card.id]?.lastRating === 'again';
    return filter === 'all' || card.subject === filter;
  });
  const due = eligible
    .filter((card) => progress[card.id] && Date.parse(progress[card.id].dueAt) <= now.getTime())
    .sort((a, b) => progress[a.id].dueAt.localeCompare(progress[b.id].dueAt));
  const unseen = eligible.filter((card) => !progress[card.id]);
  return [...due, ...unseen].slice(0, target);
}

export interface RecallDailySummary {
  day: string;
  reviews: number;
  uniqueCards: number;
  again: number;
  fuzzy: number;
  known: number;
  masteryRate: number;
}

export function recallDailySummary(history: RecallReviewLog[], day = recallDay()): RecallDailySummary {
  const events = history.filter((item) => recallDay(new Date(item.reviewedAt)) === day);
  const known = events.filter((item) => item.rating === 'known').length;
  return {
    day,
    reviews: events.length,
    uniqueCards: new Set(events.map((item) => item.cardId)).size,
    again: events.filter((item) => item.rating === 'again').length,
    fuzzy: events.filter((item) => item.rating === 'fuzzy').length,
    known,
    masteryRate: events.length ? Math.round((known / events.length) * 100) : 0,
  };
}

export function recentRecallSummaries(history: RecallReviewLog[], days = 7, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(now, -(days - index - 1));
    return recallDailySummary(history, recallDay(date));
  });
}

export function recallStats(
  progress: Record<string, RecallProgress>,
  history: RecallReviewLog[] = [],
  now = new Date(),
) {
  const today = recallDay(now);
  const summary = recallDailySummary(history, today);
  const legacyReviewed = history.length
    ? []
    : Object.values(progress).filter((item) => recallDay(new Date(item.lastReviewedAt)) === today);
  return {
    reviewed: history.length ? summary.uniqueCards : legacyReviewed.length,
    reviews: history.length ? summary.reviews : legacyReviewed.length,
    again: history.length ? summary.again : legacyReviewed.filter((item) => item.lastRating === 'again').length,
    fuzzy: history.length ? summary.fuzzy : legacyReviewed.filter((item) => item.lastRating === 'fuzzy').length,
    known: history.length ? summary.known : legacyReviewed.filter((item) => item.lastRating === 'known').length,
    due: Object.values(progress).filter((item) => Date.parse(item.dueAt) <= now.getTime()).length,
  };
}

export function formatRecallDue(dueAt: string, now = new Date()) {
  const due = new Date(dueAt);
  const difference = due.getTime() - now.getTime();
  if (!Number.isFinite(due.getTime()) || difference <= 0) return '现在到期';
  if (difference < 60 * 60_000) return `${Math.max(1, Math.ceil(difference / 60_000))}分钟后`;
  if (recallDay(due) === recallDay(now)) return `今天 ${due.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  const tomorrow = addDays(now, 1);
  if (recallDay(due) === recallDay(tomorrow)) return '明天复习';
  return `${due.getMonth() + 1}月${due.getDate()}日复习`;
}
