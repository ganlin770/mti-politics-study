import { beforeEach, describe, expect, it } from 'vitest';
import { LESSON_BY_ID, POLITICS_RECALL_CARDS, RECALL_ANSWER_BASIS_BY_ID } from '../data';
import {
  buildPoliticsAiCardContext,
  isPoliticsAiResponse,
  isPoliticsAiEffort,
  loadPoliticsAiEffort,
  savePoliticsAiEffort,
} from './politicsAi';

describe('politics AI client contract', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Kimi K3 Max depth and only accepts the three documented efforts', () => {
    expect(loadPoliticsAiEffort()).toBe('max');
    expect(['low', 'high', 'max'].every(isPoliticsAiEffort)).toBe(true);
    expect(isPoliticsAiEffort('fast')).toBe(false);
    expect(isPoliticsAiEffort('deep')).toBe(false);
  });

  it('persists only a validated non-sensitive effort preference', () => {
    savePoliticsAiEffort('high');
    expect(loadPoliticsAiEffort()).toBe('high');
    localStorage.setItem('politics-ai-effort-v1', 'attacker-model');
    expect(loadPoliticsAiEffort()).toBe('max');
  });

  it('builds the bounded card context without any gateway or credential fields', () => {
    const card = POLITICS_RECALL_CARDS[0];
    const lesson = LESSON_BY_ID[card.lessonId] || null;
    const basis = RECALL_ANSWER_BASIS_BY_ID[card.answerBasisId] || null;
    const context = buildPoliticsAiCardContext(card, lesson, basis);

    expect(context).toMatchObject({
      id: card.id,
      prompt: card.prompt,
      answer: card.answer,
      lessonTitle: lesson?.title,
      basisTitle: basis?.title,
      answerVerifiedAt: '2026-07-29',
    });
    expect(Object.keys(context)).not.toContain('model');
    expect(Object.keys(context)).not.toContain('key');
    expect(Object.keys(context)).not.toContain('gatewayUrl');
  });

  it('rejects malformed or oversized function responses before React renders them', () => {
    const valid = {
      requestId: 'request-1',
      cardId: 'recall-marx-01',
      effort: 'max',
      model: 'k3',
      answer: '完整讲解',
      durationMs: 1_200,
    };
    expect(isPoliticsAiResponse(valid)).toBe(true);
    expect(isPoliticsAiResponse({ ...valid, fallbackFrom: { unsafe: true } })).toBe(false);
    expect(isPoliticsAiResponse({ ...valid, model: '<script>' })).toBe(false);
    expect(isPoliticsAiResponse({ ...valid, answer: '答'.repeat(24_001) })).toBe(false);
    expect(isPoliticsAiResponse({ ...valid, durationMs: Number.POSITIVE_INFINITY })).toBe(false);
  });
});
