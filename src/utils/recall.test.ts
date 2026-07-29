import { describe, expect, it } from 'vitest';
import { POLITICS_RECALL_CARDS } from '../data';
import type { RecallProgress } from '../state/studyTypes';
import { buildRecallQueue, nextRecallProgress, recallStats } from './recall';

const NOW = new Date('2026-07-29T08:00:00+08:00');

describe('recall scheduling', () => {
  it('sends again to today, fuzzy to tomorrow, and known to a growing interval', () => {
    const again = nextRecallProgress('card-1', undefined, 'again', NOW);
    expect(again).toMatchObject({ dueOn: '2026-07-29', intervalDays: 0, lapses: 1, streak: 0 });

    const fuzzy = nextRecallProgress('card-1', again, 'fuzzy', NOW);
    expect(fuzzy).toMatchObject({ dueOn: '2026-07-30', intervalDays: 1, lastRating: 'fuzzy' });

    const known = nextRecallProgress('card-1', fuzzy, 'known', NOW);
    expect(known).toMatchObject({ dueOn: '2026-08-01', intervalDays: 3, lastRating: 'known' });

    const knownAgain = nextRecallProgress('card-1', known, 'known', NOW);
    expect(knownAgain).toMatchObject({ dueOn: '2026-08-04', intervalDays: 6, streak: 3 });
  });

  it('puts due cards before unseen cards and exposes only again cards in mistakes', () => {
    const known = nextRecallProgress(POLITICS_RECALL_CARDS[0].id, undefined, 'known', new Date('2026-07-20T08:00:00+08:00'));
    const again = nextRecallProgress(POLITICS_RECALL_CARDS[1].id, undefined, 'again', NOW);
    const progress: Record<string, RecallProgress> = {
      [known.cardId]: known,
      [again.cardId]: again,
    };
    const today = buildRecallQueue(POLITICS_RECALL_CARDS, progress, 'all', 3, '2026-07-29');
    expect(today.map((card) => card.id)).toEqual([
      POLITICS_RECALL_CARDS[0].id,
      POLITICS_RECALL_CARDS[1].id,
      POLITICS_RECALL_CARDS[2].id,
    ]);
    expect(buildRecallQueue(POLITICS_RECALL_CARDS, progress, 'mistakes', 20, '2026-07-29').map((card) => card.id)).toEqual([again.cardId]);
    expect(recallStats(progress, '2026-07-29')).toMatchObject({ reviewed: 1, again: 1, due: 2 });
  });
});
