import { describe, expect, it } from 'vitest';
import { POLITICS_RECALL_CARDS } from '../data';
import type { RecallProgress, RecallReviewLog } from '../state/studyTypes';
import {
  buildRecallQueue,
  formatRecallDue,
  nextRecallProgress,
  recallDailySummary,
  recallStats,
  recentRecallSummaries,
} from './recall';

const NOW = new Date('2026-07-29T08:00:00+08:00');

describe('recall scheduling', () => {
  it('uses the 10-minute and expanding 1/2/4-day relearning stages', () => {
    const again = nextRecallProgress('card-1', undefined, 'again', NOW);
    expect(again).toMatchObject({ dueOn: '2026-07-29', stage: 0, intervalDays: 0, lapses: 1, streak: 0 });
    expect(Date.parse(again.dueAt) - NOW.getTime()).toBe(10 * 60_000);

    const fuzzy = nextRecallProgress('card-1', again, 'fuzzy', NOW);
    expect(fuzzy).toMatchObject({ dueOn: '2026-07-30', stage: 1, intervalDays: 1, lastRating: 'fuzzy' });

    const known = nextRecallProgress('card-1', fuzzy, 'known', NOW);
    expect(known).toMatchObject({ dueOn: '2026-07-31', stage: 2, intervalDays: 2, lastRating: 'known' });

    const knownAgain = nextRecallProgress('card-1', known, 'known', NOW);
    expect(knownAgain).toMatchObject({ dueOn: '2026-08-02', stage: 3, intervalDays: 4, streak: 3 });
  });

  it('keeps not-yet-due wrong cards out of the queue until their exact due time', () => {
    const known = nextRecallProgress(POLITICS_RECALL_CARDS[0].id, undefined, 'known', new Date('2026-07-20T08:00:00+08:00'));
    const again = nextRecallProgress(POLITICS_RECALL_CARDS[1].id, undefined, 'again', NOW);
    const progress: Record<string, RecallProgress> = {
      [known.cardId]: known,
      [again.cardId]: again,
    };
    const beforeAgainDue = buildRecallQueue(POLITICS_RECALL_CARDS, progress, 'all', 3, NOW);
    expect(beforeAgainDue.map((card) => card.id)).toEqual([
      POLITICS_RECALL_CARDS[0].id,
      POLITICS_RECALL_CARDS[2].id,
      POLITICS_RECALL_CARDS[3].id,
    ]);
    expect(buildRecallQueue(POLITICS_RECALL_CARDS, progress, 'mistakes', 20, NOW)).toEqual([]);

    const afterAgainDue = new Date(NOW.getTime() + 11 * 60_000);
    expect(buildRecallQueue(POLITICS_RECALL_CARDS, progress, 'mistakes', 20, afterAgainDue).map((card) => card.id)).toEqual([again.cardId]);
    expect(recallStats(progress, [], NOW)).toMatchObject({ reviewed: 1, again: 1, due: 1 });
  });

  it('builds daily and seven-day review summaries from immutable history events', () => {
    const history: RecallReviewLog[] = [
      { id: 'r1', cardId: 'card-1', rating: 'again', reviewedAt: NOW.toISOString(), previousStage: 0, nextStage: 0, dueAt: new Date(NOW.getTime() + 600_000).toISOString(), intervalLabel: '10分钟' },
      { id: 'r2', cardId: 'card-1', rating: 'known', reviewedAt: new Date(NOW.getTime() + 1_000).toISOString(), previousStage: 0, nextStage: 1, dueAt: new Date(NOW.getTime() + 86_400_000).toISOString(), intervalLabel: '1天' },
      { id: 'r3', cardId: 'card-2', rating: 'fuzzy', reviewedAt: new Date(NOW.getTime() + 2_000).toISOString(), previousStage: 2, nextStage: 1, dueAt: new Date(NOW.getTime() + 86_400_000).toISOString(), intervalLabel: '1天' },
    ];
    expect(recallDailySummary(history, '2026-07-29')).toEqual({
      day: '2026-07-29', reviews: 3, uniqueCards: 2, again: 1, fuzzy: 1, known: 1, masteryRate: 33,
    });
    expect(recentRecallSummaries(history, 7, NOW)).toHaveLength(7);
    expect(formatRecallDue(history[0].dueAt, NOW)).toBe('10分钟后');
  });
});
