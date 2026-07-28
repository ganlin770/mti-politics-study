import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { MARX_INTRO_SELF_TESTS } from '../data';
import { useStudy } from '../state/StudyProvider';

export function MistakesPage() {
  const { state, resetQuiz } = useStudy();
  const questions = new Map(MARX_INTRO_SELF_TESTS.map((question) => [question.id, question]));
  const wrongAttempts = Object.values(state.quizAttempts).filter((attempt) => !attempt.correct);
  const logsWithReview = state.practiceLogs.filter((log) => log.wrongReason.trim());
  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">ERRORS BECOME ASSETS</div><h1>错题复盘</h1><p>网页原创题与肖1000训练记录分栏呈现；真正要复习的是错误原因，不是答案字母。</p></div><div className="heading-stat"><strong>{wrongAttempts.length}</strong><span>道原创错题</span></div></header>
    <div className="two-column"><section className="panel"><div className="section-heading"><div><span>ORIGINAL CHECK</span><h2>原创自测错题</h2></div>{wrongAttempts.length ? <button className="button button--quiet" type="button" onClick={() => resetQuiz('marx-01')}><RotateCcw />整组重练</button> : null}</div>{wrongAttempts.length ? <div className="review-list">{wrongAttempts.map((attempt) => { const question = questions.get(attempt.questionId); if (!question) return null; return <article key={attempt.questionId}><AlertTriangle /><div><h3>{question.stem}</h3><p>你的选择：{attempt.selectedOptionIds.join('、')} · 正确选项：{question.correctOptionIds.join('、')}</p><blockquote>{question.explanation}</blockquote></div></article>; })}</div> : <div className="empty-state"><CheckCircle2 /><h3>暂时没有原创错题</h3><p>完成练题中心的 6 道定位自测后，答错的题会自动来到这里。</p></div>}</section>
      <section className="panel"><div className="section-heading"><div><span>EXTERNAL PRACTICE</span><h2>肖1000 / 真题错因</h2></div></div>{logsWithReview.length ? <div className="review-list">{logsWithReview.map((log) => <article key={log.id}><AlertTriangle /><div><h3>{log.resource} · {log.rangeLabel}</h3><p>{log.date} · {log.correct}/{log.answered} 正确</p><blockquote>{log.wrongReason}</blockquote><small>闭卷框架：{log.framework}</small></div></article>)}</div> : <div className="empty-state"><CheckCircle2 /><h3>还没有外部练习复盘</h3><p>在练题中心录入肖1000的题数、正确数与错因，系统才会形成真正的错题资产。</p></div>}</section></div>
  </div>;
}
