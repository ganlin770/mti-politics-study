import { describe, expect, it } from 'vitest';
import { POLITICS_AI_CARD_HASHES } from '../../supabase/functions/_shared/politics-ai-card-hashes';
import { buildPoliticsAiCardContext } from '../lib/politicsAi';
import { LESSON_BY_ID, POLITICS_RECALL_CARDS, RECALL_ANSWER_BASIS_BY_ID } from './index';

describe('politics AI canonical card integrity', () => {
  it('keeps every published recall card aligned with the server allowlist', async () => {
    expect(Object.keys(POLITICS_AI_CARD_HASHES)).toHaveLength(POLITICS_RECALL_CARDS.length);

    for (const card of POLITICS_RECALL_CARDS) {
      const context = buildPoliticsAiCardContext(
        card,
        LESSON_BY_ID[card.lessonId] || null,
        RECALL_ANSWER_BASIS_BY_ID[card.answerBasisId] || null,
      );
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(context)),
      );
      const hex = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      expect(POLITICS_AI_CARD_HASHES[card.id], card.id).toBe(hex);
    }
  });
});
