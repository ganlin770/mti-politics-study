import { FunctionsHttpError } from '@supabase/supabase-js';
import type { PoliticsLesson, PoliticsRecallAnswerBasis, PoliticsRecallCard } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

export type PoliticsAiEffort = 'low' | 'high' | 'max';
export type PoliticsAiMode = 'explain' | 'followup';

export const POLITICS_AI_EFFORTS: Array<{
  id: PoliticsAiEffort;
  label: string;
  name: string;
  tip: string;
}> = [
  { id: 'low', label: 'Low', name: '快速', tip: '抓主干，适合即时核对' },
  { id: 'high', label: 'High', name: '均衡', tip: '兼顾速度与完整度' },
  { id: 'max', label: 'Max', name: '深度', tip: '默认档，完整诊断采分点' },
];

const EFFORT_STORAGE_KEY = 'politics-ai-effort-v1';
const VALID_EFFORTS = new Set<PoliticsAiEffort>(['low', 'high', 'max']);

export interface PoliticsAiCardContext {
  id: string;
  subject: string;
  kind: string;
  prompt: string;
  answer: string;
  keywords: string[];
  memoryHook: string;
  lessonTitle: string;
  sourceLabel: string;
  answerVerifiedAt: string;
  basisTitle: string;
  basisEdition: string;
  basisPublisher: string;
}

export interface PoliticsAiRequest {
  mode: PoliticsAiMode;
  effort: PoliticsAiEffort;
  card: PoliticsAiCardContext;
  question?: string;
}

export interface PoliticsAiResponse {
  requestId: string;
  cardId: string;
  effort: PoliticsAiEffort;
  model: string;
  answer: string;
  fallbackFrom?: string;
  durationMs: number;
}

interface PoliticsAiErrorPayload {
  code?: string;
  message?: string;
}

export class PoliticsAiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PoliticsAiError';
    this.code = code;
  }
}

export function isPoliticsAiEffort(value: unknown): value is PoliticsAiEffort {
  return typeof value === 'string' && VALID_EFFORTS.has(value as PoliticsAiEffort);
}

export function loadPoliticsAiEffort(): PoliticsAiEffort {
  try {
    const saved = localStorage.getItem(EFFORT_STORAGE_KEY);
    return isPoliticsAiEffort(saved) ? saved : 'max';
  } catch {
    return 'max';
  }
}

export function savePoliticsAiEffort(effort: PoliticsAiEffort) {
  if (!isPoliticsAiEffort(effort)) return;
  try {
    localStorage.setItem(EFFORT_STORAGE_KEY, effort);
  } catch {
    // This is a non-sensitive display preference; failure should not block study.
  }
}

export function buildPoliticsAiCardContext(
  card: PoliticsRecallCard,
  lesson: PoliticsLesson | null,
  basis: PoliticsRecallAnswerBasis | null,
): PoliticsAiCardContext {
  return {
    id: card.id,
    subject: card.subject,
    kind: card.kind,
    prompt: card.prompt,
    answer: card.answer,
    keywords: [...card.keywords],
    memoryHook: card.memoryHook,
    lessonTitle: lesson?.title || '',
    sourceLabel: card.sourceLabel,
    answerVerifiedAt: card.answerVerifiedAt,
    basisTitle: basis?.title || '',
    basisEdition: basis?.edition || '',
    basisPublisher: basis?.publisher || '',
  };
}

export function isPoliticsAiResponse(value: unknown): value is PoliticsAiResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PoliticsAiResponse>;
  const safeModel = (model: unknown) => typeof model === 'string'
    && /^[A-Za-z0-9._:/-]{1,120}$/.test(model);
  return typeof item.requestId === 'string'
    && item.requestId.length > 0
    && item.requestId.length <= 120
    && typeof item.cardId === 'string'
    && isPoliticsAiEffort(item.effort)
    && safeModel(item.model)
    && (item.fallbackFrom === undefined || safeModel(item.fallbackFrom))
    && typeof item.answer === 'string'
    && item.answer.trim().length > 0
    && item.answer.length <= 24_000
    && typeof item.durationMs === 'number'
    && Number.isFinite(item.durationMs)
    && item.durationMs >= 0
    && item.durationMs <= 300_000;
}

function friendlyAiError(code: string) {
  const messages: Record<string, string> = {
    auth_required: '请先登录云同步账号，再使用 Kimi K3 政治助教。',
    access_denied: '当前账号未开通付费 AI 额度；标准答案和抽背记录仍可正常使用。',
    origin_forbidden: '当前页面来源不在 AI 服务允许范围内。',
    invalid_request: '这次请求内容不完整，请重新打开卡片后再试。',
    invalid_effort: '思考档位无效，请重新选择 Low、High 或 Max。',
    quota_exceeded: 'AI 使用次数已到当前限额，请按提示稍后再试。',
    upstream_timeout: 'Kimi K3 本次深度思考超时，请重试或暂时切到 High。',
    upstream_unavailable: 'AI 网关暂时不可用，标准答案和抽背记录不受影响。',
    service_unavailable: 'AI 服务尚未完成服务端配置，标准答案仍可正常使用。',
  };
  return messages[code] || 'AI 讲解暂时失败，标准答案和抽背记录不受影响。';
}

async function readFunctionError(error: unknown, signal?: AbortSignal): Promise<PoliticsAiError> {
  if (signal?.aborted) {
    return new PoliticsAiError('aborted', '已停止本次 AI 讲解。');
  }
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as PoliticsAiErrorPayload;
      const code = typeof payload.code === 'string' ? payload.code : 'upstream_unavailable';
      return new PoliticsAiError(code, friendlyAiError(code));
    } catch {
      return new PoliticsAiError('upstream_unavailable', friendlyAiError('upstream_unavailable'));
    }
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new PoliticsAiError('aborted', '已停止本次 AI 讲解。');
  }
  return new PoliticsAiError('upstream_unavailable', friendlyAiError('upstream_unavailable'));
}

export async function requestPoliticsAi(
  request: PoliticsAiRequest,
  signal?: AbortSignal,
): Promise<PoliticsAiResponse> {
  if (!isSupabaseConfigured || !supabase) {
    throw new PoliticsAiError('service_unavailable', friendlyAiError('service_unavailable'));
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new PoliticsAiError('auth_required', friendlyAiError('auth_required'));
  }
  const { data, error } = await supabase.functions.invoke('politics-ai', {
    body: request,
    signal,
    timeout: request.effort === 'max' ? 120_000 : request.effort === 'high' ? 90_000 : 60_000,
  });
  if (error) throw await readFunctionError(error, signal);
  if (!isPoliticsAiResponse(data) || data.cardId !== request.card.id || data.effort !== request.effort) {
    throw new PoliticsAiError('invalid_response', 'AI 返回与当前卡片不匹配，已拦截这次结果，请重试。');
  }
  return {
    ...data,
    answer: data.answer.trim(),
  };
}
