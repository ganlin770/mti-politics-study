import type { PoliticsRecallCard, PoliticsSubjectId } from '../types';
import type { RecallProgress, RecallRating } from '../state/studyTypes';

export const RECALL_DAILY_TARGET = 20;

export type RecallFilter = 'all' | 'mistakes' | PoliticsSubjectId;

export function recallDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return recallDay(date);
}

export function nextRecallProgress(
  cardId: string,
  previous: RecallProgress | undefined,
  rating: RecallRating,
  now = new Date(),
): RecallProgress {
  const today = recallDay(now);
  const reviews = (previous?.reviews || 0) + 1;
  const lapses = (previous?.lapses || 0) + (rating === 'again' ? 1 : 0);

  if (rating === 'again') {
    return {
      cardId,
      dueOn: today,
      intervalDays: 0,
      reviews,
      lapses,
      streak: 0,
      lastRating: rating,
      lastReviewedAt: now.toISOString(),
    };
  }

  if (rating === 'fuzzy') {
    return {
      cardId,
      dueOn: addDays(today, 1),
      intervalDays: 1,
      reviews,
      lapses,
      streak: Math.max(1, previous?.streak || 0),
      lastRating: rating,
      lastReviewedAt: now.toISOString(),
    };
  }

  const priorInterval = previous?.intervalDays || 0;
  const intervalDays = priorInterval <= 1
    ? 3
    : Math.min(60, Math.max(3, Math.round(priorInterval * 2)));
  return {
    cardId,
    dueOn: addDays(today, intervalDays),
    intervalDays,
    reviews,
    lapses,
    streak: (previous?.streak || 0) + 1,
    lastRating: rating,
    lastReviewedAt: now.toISOString(),
  };
}

export function buildRecallQueue(
  cards: PoliticsRecallCard[],
  progress: Record<string, RecallProgress>,
  filter: RecallFilter,
  target = RECALL_DAILY_TARGET,
  today = recallDay(),
) {
  const eligible = cards.filter((card) => {
    if (filter === 'mistakes') return progress[card.id]?.lastRating === 'again';
    return filter === 'all' || card.subject === filter;
  });
  const due = eligible
    .filter((card) => progress[card.id] && progress[card.id].dueOn <= today)
    .sort((a, b) => progress[a.id].dueOn.localeCompare(progress[b.id].dueOn));
  const unseen = eligible.filter((card) => !progress[card.id]);
  return [...due, ...unseen].slice(0, target);
}

export function recallStats(progress: Record<string, RecallProgress>, today = recallDay()) {
  const reviewed = Object.values(progress).filter((item) => recallDay(new Date(item.lastReviewedAt)) === today);
  return {
    reviewed: reviewed.length,
    again: reviewed.filter((item) => item.lastRating === 'again').length,
    known: reviewed.filter((item) => item.lastRating === 'known').length,
    due: Object.values(progress).filter((item) => item.dueOn <= today).length,
  };
}
