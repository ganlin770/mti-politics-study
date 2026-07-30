import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSON_BY_ID, POLITICS_RECALL_CARDS, RECALL_ANSWER_BASIS_BY_ID } from '../data';
import { OPEN_AUTH_DIALOG_EVENT } from '../lib/appEvents';
import {
  PoliticsAiError,
  requestPoliticsAi,
  type PoliticsAiResponse,
} from '../lib/politicsAi';
import { useStudy } from '../state/StudyProvider';
import { RecallAiPanel } from './RecallAiPanel';

vi.mock('../state/StudyProvider', () => ({ useStudy: vi.fn() }));
vi.mock('../lib/politicsAi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/politicsAi')>();
  return { ...actual, requestPoliticsAi: vi.fn() };
});

const CARD = POLITICS_RECALL_CARDS[0];
const USER = { id: '0e9a9d0e-3de4-4c31-8d80-02cbd37cd792' } as User;

function response(overrides: Partial<PoliticsAiResponse> = {}): PoliticsAiResponse {
  return {
    requestId: 'request-1',
    cardId: CARD.id,
    effort: 'max',
    model: 'k3',
    answer: '核心结论：人民立场。\n\n30 秒口述：马克思主义坚持人民至上。',
    durationMs: 2_400,
    ...overrides,
  };
}

function renderPanel(card = CARD) {
  const lesson = LESSON_BY_ID[card.lessonId] || null;
  const basis = RECALL_ANSWER_BASIS_BY_ID[card.answerBasisId] || null;
  return render(<RecallAiPanel key={card.id} card={card} lesson={lesson} basis={basis} />);
}

describe('RecallAiPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useStudy).mockReturnValue({
      user: USER,
      supabaseConfigured: true,
    } as ReturnType<typeof useStudy>);
  });

  afterEach(cleanup);

  it('defaults to Max and opens the existing login flow for anonymous learners', () => {
    vi.mocked(useStudy).mockReturnValue({
      user: null,
      supabaseConfigured: true,
    } as ReturnType<typeof useStudy>);
    const authEvents = vi.fn();
    window.addEventListener(OPEN_AUTH_DIALOG_EVENT, authEvents);

    renderPanel();

    expect(screen.getByTestId('politics-ai-effort-max')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('politics-ai-login'));
    expect(authEvents).toHaveBeenCalledTimes(1);
    expect(requestPoliticsAi).not.toHaveBeenCalled();

    window.removeEventListener(OPEN_AUTH_DIALOG_EVENT, authEvents);
  });

  it('sends the selected effort and labels an actual fallback model honestly', async () => {
    vi.mocked(requestPoliticsAi).mockResolvedValueOnce(response({
      effort: 'high',
      model: 'deepseek-v4-pro',
      fallbackFrom: 'kimi-k3',
    }));
    renderPanel();

    fireEvent.click(screen.getByTestId('politics-ai-effort-high'));
    fireEvent.click(screen.getByTestId('politics-ai-generate'));

    await screen.findByTestId('politics-ai-answer');
    expect(requestPoliticsAi).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'explain', effort: 'high' }),
      expect.any(AbortSignal),
    );
    expect(screen.getByText(/本次实际由 DeepSeek V4 Pro 回答/)).toBeVisible();
    expect(localStorage.getItem('politics-ai-effort-v1')).toBe('high');
  });

  it('keeps a completed explanation when regeneration fails', async () => {
    vi.mocked(requestPoliticsAi)
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new PoliticsAiError('upstream_timeout', '本次讲解超时。'));
    renderPanel();

    fireEvent.click(screen.getByTestId('politics-ai-generate'));
    await screen.findByText(/核心结论：人民立场/);
    fireEvent.click(screen.getByRole('button', { name: /按当前档位重新讲解/ }));

    await screen.findByRole('alert');
    expect(screen.getByText(/核心结论：人民立场/)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('本次讲解超时');
  });

  it('anchors a follow-up to the current canonical card', async () => {
    const initial = response();
    const followup = response({
      requestId: 'request-2',
      answer: '这道题要先说人民立场，再落到根本利益。',
    });
    vi.mocked(requestPoliticsAi)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(followup);
    renderPanel();

    fireEvent.click(screen.getByTestId('politics-ai-generate'));
    await screen.findByText(/核心结论：人民立场/);
    fireEvent.change(screen.getByTestId('politics-ai-question'), {
      target: { value: '帮我压缩成 30 秒口述。' },
    });
    fireEvent.submit(screen.getByTestId('politics-ai-question').closest('form')!);

    await screen.findByText('这道题要先说人民立场，再落到根本利益。');
    expect(requestPoliticsAi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'followup',
        question: '帮我压缩成 30 秒口述。',
        card: expect.objectContaining({ id: CARD.id }),
      }),
      expect.any(AbortSignal),
    );
  });

  it('aborts an in-flight answer when the learner changes cards', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(requestPoliticsAi).mockImplementationOnce((_request, nextSignal) => {
      signal = nextSignal;
      return new Promise(() => undefined);
    });
    const view = renderPanel();

    fireEvent.click(screen.getByTestId('politics-ai-generate'));
    await waitFor(() => expect(signal).toBeDefined());
    const nextCard = POLITICS_RECALL_CARDS[1];
    view.rerender(
      <RecallAiPanel
        key={nextCard.id}
        card={nextCard}
        lesson={LESSON_BY_ID[nextCard.lessonId] || null}
        basis={RECALL_ANSWER_BASIS_BY_ID[nextCard.answerBasisId] || null}
      />,
    );

    expect(signal?.aborted).toBe(true);
  });
});
