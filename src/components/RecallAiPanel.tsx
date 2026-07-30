import {
  LoaderCircle,
  LogIn,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { PoliticsLesson, PoliticsRecallAnswerBasis, PoliticsRecallCard } from '../types';
import { openAuthDialog } from '../lib/appEvents';
import {
  buildPoliticsAiCardContext,
  loadPoliticsAiEffort,
  POLITICS_AI_EFFORTS,
  PoliticsAiError,
  requestPoliticsAi,
  savePoliticsAiEffort,
  type PoliticsAiEffort,
  type PoliticsAiResponse,
} from '../lib/politicsAi';
import { useStudy } from '../state/StudyProvider';

interface RecallAiPanelProps {
  card: PoliticsRecallCard;
  lesson: PoliticsLesson | null;
  basis: PoliticsRecallAnswerBasis | null;
}

interface FollowupAnswer {
  question: string;
  response: PoliticsAiResponse;
}

function modelName(model: string) {
  if (model === 'kimi-k3' || model === 'k3') return 'Kimi K3';
  if (model === 'deepseek-v4-pro') return 'DeepSeek V4 Pro';
  if (model === 'gpt-5.6-terra') return 'GPT-5.6 Terra';
  return model || '实际模型未标注';
}

function AiAnswer({ response }: { response: PoliticsAiResponse }) {
  return (
    <article className="recall-ai-answer" data-testid="politics-ai-answer" aria-live="polite">
      <div className="recall-ai-answer-meta">
        <b>{modelName(response.model)} · {response.effort.toUpperCase()}</b>
        <span>{Math.max(1, Math.round(response.durationMs / 1_000))} 秒</span>
      </div>
      {response.fallbackFrom ? (
        <p className="recall-ai-fallback">首选模型 {modelName(response.fallbackFrom)} 暂不可用，本次实际由 {modelName(response.model)} 回答。</p>
      ) : null}
      <div className="recall-ai-copy">{response.answer}</div>
    </article>
  );
}

export function RecallAiPanel({ card, lesson, basis }: RecallAiPanelProps) {
  const { user, supabaseConfigured } = useStudy();
  const [effort, setEffort] = useState<PoliticsAiEffort>(loadPoliticsAiEffort);
  const [explanation, setExplanation] = useState<PoliticsAiResponse | null>(null);
  const [followups, setFollowups] = useState<FollowupAnswer[]>([]);
  const [question, setQuestion] = useState('');
  const [loadingMode, setLoadingMode] = useState<'explain' | 'followup' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const cardContext = useMemo(
    () => buildPoliticsAiCardContext(card, lesson, basis),
    [basis, card, lesson],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (!loadingMode) return undefined;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1_000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [loadingMode]);

  function selectEffort(nextEffort: PoliticsAiEffort) {
    if (loadingMode) return;
    setEffort(nextEffort);
    savePoliticsAiEffort(nextEffort);
  }

  async function execute(
    mode: 'explain' | 'followup',
    userQuestion: string | undefined,
    onSuccess: (response: PoliticsAiResponse) => void,
  ) {
    if (!user) {
      openAuthDialog();
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setLoadingMode(mode);
    setErrorMessage('');
    try {
      const response = await requestPoliticsAi({
        mode,
        effort,
        card: cardContext,
        question: userQuestion,
      }, controller.signal);
      if (controllerRef.current !== controller) return;
      onSuccess(response);
    } catch (error) {
      if (controllerRef.current !== controller) return;
      if (error instanceof PoliticsAiError) setErrorMessage(error.message);
      else setErrorMessage('AI 讲解暂时失败，标准答案和抽背记录不受影响。');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoadingMode(null);
      }
    }
  }

  function explainCard() {
    void execute('explain', undefined, (response) => {
      setExplanation(response);
      setFollowups([]);
    });
  }

  function askFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (!nextQuestion || !explanation || loadingMode) return;
    void execute('followup', nextQuestion, (response) => {
      setFollowups((items) => [...items, { question: nextQuestion, response }].slice(-8));
      setQuestion('');
    });
  }

  function stopRequest() {
    controllerRef.current?.abort();
  }

  const effortMeta = POLITICS_AI_EFFORTS.find((item) => item.id === effort) || POLITICS_AI_EFFORTS[2];
  const loadingLabel = effort === 'max' ? '正在深度思考' : '正在思考';

  return (
    <section className="recall-ai-panel" data-testid="politics-ai-panel" aria-label="Kimi K3 政治助教">
      <header className="recall-ai-heading">
        <span className="recall-ai-icon"><Sparkles aria-hidden="true" /></span>
        <div><span>AI 讲解</span><h3>Kimi K3 政治助教</h3><p>标准答案负责定标，AI 只做采分点拆解、易漏点提示与记忆强化。</p></div>
      </header>

      <div className="recall-ai-route">
        <div><span>思考算力</span><b>Kimi K3 · {effortMeta.label} {effortMeta.name}</b></div>
        <div className="recall-ai-efforts" role="group" aria-label="AI 思考算力">
          {POLITICS_AI_EFFORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`politics-ai-effort-${item.id}`}
              className={effort === item.id ? 'is-active' : ''}
              aria-pressed={effort === item.id}
              disabled={Boolean(loadingMode)}
              title={`${item.label} · ${item.tip}`}
              onClick={() => selectEffort(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <small>{effortMeta.tip}</small>
      </div>

      {!supabaseConfigured ? (
        <div className="recall-ai-gate is-warning" role="status">
          <b>服务端 AI 尚未连接</b>
          <p>当前部署仍可正常抽背；完成 Supabase Function 与服务端 Secret 配置后，这里才会启用，网关 Key 不会进入浏览器。</p>
        </div>
      ) : !user ? (
        <div className="recall-ai-gate" role="status">
          <b>登录后使用 AI 讲解</b>
          <p>登录用于保护服务端额度；标准答案、判定和复习记录仍可匿名使用。</p>
          <button type="button" data-testid="politics-ai-login" onClick={openAuthDialog}><LogIn aria-hidden="true" />登录并连接 Kimi K3</button>
        </div>
      ) : (
        <>
          {!explanation ? (
            <button
              className="recall-ai-generate"
              data-testid="politics-ai-generate"
              type="button"
              disabled={Boolean(loadingMode)}
              onClick={explainCard}
            >
              <Sparkles aria-hidden="true" /><span><b>AI 深度讲解这张卡</b><small>先拆主干，再给易漏点与考场复述模板</small></span>
            </button>
          ) : null}

          {loadingMode ? (
            <div className="recall-ai-loading" data-testid="politics-ai-loading">
              <span className="sr-only" role="status">{effortMeta.label} · {loadingLabel}</span>
              <LoaderCircle className="spin" aria-hidden="true" />
              <span><b>{effortMeta.label} · {loadingLabel}</b><small>已等待 {elapsed} 秒；Max 可能更久，当前标准答案不会被覆盖。</small></span>
              <button type="button" onClick={stopRequest}><Square aria-hidden="true" />停止</button>
            </div>
          ) : null}

          {errorMessage ? <p className="recall-ai-error" data-testid="politics-ai-error" role="alert">{errorMessage}</p> : null}
          {explanation ? (
            <>
              <AiAnswer response={explanation} />
              <button className="recall-ai-regenerate" type="button" disabled={Boolean(loadingMode)} onClick={explainCard}><RefreshCcw aria-hidden="true" />按当前档位重新讲解</button>

              {followups.map((item) => (
                <section className="recall-ai-followup" key={item.response.requestId}>
                  <b>你的追问</b><p>{item.question}</p><AiAnswer response={item.response} />
                </section>
              ))}

              <form className="recall-ai-question" onSubmit={askFollowup}>
                <label htmlFor={`politics-ai-question-${card.id}`}>继续追问当前知识点</label>
                <div>
                  <textarea
                    id={`politics-ai-question-${card.id}`}
                    data-testid="politics-ai-question"
                    value={question}
                    maxLength={1_000}
                    rows={3}
                    placeholder="例如：我总漏掉哪一个采分点？帮我压缩成 30 秒口述。"
                    disabled={Boolean(loadingMode)}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <button type="submit" disabled={Boolean(loadingMode) || !question.trim()}><Send aria-hidden="true" /><span>提问</span></button>
                </div>
                <small>每次追问都独立围绕当前卡；若资料未覆盖，AI 必须明确提示核验。</small>
              </form>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
