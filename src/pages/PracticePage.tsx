import { Check, CheckCircle2, CircleAlert, RotateCcw, Save, Target, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LESSON_BY_ID, MARX_INTRO_SELF_TESTS, POLITICS_SUBJECTS } from '../data';
import { useStudy } from '../state/StudyProvider';
import type { SelfTestOptionId, SelfTestQuestion } from '../types';
import { dateKey, lessonPracticeLabel, lessonPracticeTarget } from '../utils/study';

function QuestionCard({ question }: { question: SelfTestQuestion }) {
  const { state, answerQuestion } = useStudy();
  const attempt = state.quizAttempts[question.id];
  const [selected, setSelected] = useState<SelfTestOptionId[]>(attempt?.selectedOptionIds || []);

  function toggle(option: SelfTestOptionId) {
    if (attempt) return;
    setSelected((current) => {
      if (question.type === 'single') return [option];
      return current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
    });
  }

  return <article data-testid={question.id} className={`question-card${attempt ? (attempt.correct ? ' is-correct' : ' is-wrong') : ''}`}><div className="question-top"><span>{question.type === 'single' ? '单选' : '多选'}</span><em>{question.sourceLabel}</em>{attempt ? attempt.correct ? <CheckCircle2 /> : <CircleAlert /> : null}</div><h3>{question.stem}</h3><div className="option-list">{question.options.map((option) => { const chosen = selected.includes(option.id); const answer = attempt && question.correctOptionIds.includes(option.id); return <button key={option.id} data-testid={`${question.id}-option-${option.id}`} type="button" aria-pressed={chosen} disabled={Boolean(attempt)} className={`quiz-option${chosen ? ' is-selected' : ''}${answer ? ' is-answer' : ''}`} onClick={() => toggle(option.id)}><b>{option.id}</b><span>{option.text}</span>{answer ? <Check /> : chosen && attempt && !attempt.correct ? <X /> : null}</button>; })}</div>{attempt ? <div className="explanation"><b>{attempt.correct ? '回答正确' : '需要订正'}</b><p>{question.explanation}</p></div> : <button className="button button--primary answer-button" type="button" disabled={!selected.length} onClick={() => answerQuestion(question, selected)}>提交答案</button>}</article>;
}

export function PracticePage() {
  const { state, resetQuiz, savePracticeLog } = useStudy();
  const [saved, setSaved] = useState('');
  const lesson = LESSON_BY_ID[state.activeLessonId] || LESSON_BY_ID['marx-01'];
  const subjectName = POLITICS_SUBJECTS.find((subject) => subject.id === lesson.subject)?.shortName || '政治';
  const targetQuestions = lessonPracticeTarget(lesson);
  const rangeLabel = lessonPracticeLabel(lesson);
  const attempts = MARX_INTRO_SELF_TESTS.map((question) => state.quizAttempts[question.id]).filter(Boolean);
  const correct = attempts.filter((attempt) => attempt.correct).length;

  function handlePracticeLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answered = Math.max(0, Math.min(100, Number(form.get('answered')) || 0));
    const correctCount = Math.max(0, Math.min(answered, Number(form.get('correct')) || 0));
    const wrongReason = String(form.get('wrongReason') || '').trim();
    const framework = String(form.get('framework') || '').trim();
    savePracticeLog({
      lessonId: lesson.id,
      date: dateKey(new Date()),
      resource: String(form.get('resource') || '27版肖1000题'),
      rangeLabel: String(form.get('rangeLabel') || lesson.practice?.label || ''),
      answered,
      correct: correctCount,
      wrongReason,
      framework,
    });
    setSaved(answered >= targetQuestions && wrongReason.length >= 20 && framework.length >= 30 ? '本次练习已达到今日通关证据。' : '记录已保存，但题量或复盘字数尚未达标。');
  }

  return <div className="page-stack"><header className="page-heading"><div><div className="eyebrow">PRACTICE, THEN EXPLAIN</div><h1>练题中心</h1><p>先用 6 道原创题定位概念，再回到你的肖1000做真实章节题；两个题源严格分开。</p></div><div className="heading-stat"><strong>{correct}</strong><span>/ {MARX_INTRO_SELF_TESTS.length} 原创自测</span></div></header>
    <section className="source-boundary"><CircleAlert /><div><b>题源边界</b><p>下方网页题目是本站原创定位自测，非肖1000、非历年真题。肖1000只记录题号范围和训练结果，题面留在私有资料。</p></div></section>
    <section className="practice-layout"><div className="quiz-column"><div className="section-heading"><div><span>PART A</span><h2>马原导论 · 原创定位自测</h2></div>{attempts.length ? <button className="button button--quiet" type="button" onClick={() => resetQuiz('marx-01')}><RotateCcw />重新作答</button> : null}</div>{MARX_INTRO_SELF_TESTS.map((question) => <QuestionCard key={`${question.id}-${state.quizAttempts[question.id]?.answeredAt || 'fresh'}`} question={question} />)}</div>
      <aside className="practice-log-panel" data-testid="external-practice-log"><div className="section-heading"><div><span>PART B · {subjectName}</span><h2>{lesson.title} · 肖1000账本</h2></div><Target /></div><p>本节范围：<b>{rangeLabel}</b>。不要抄题面，只记结果与错因。</p><form className="practice-form" onSubmit={handlePracticeLog}><label>资料名称<input name="resource" maxLength={160} defaultValue="27版肖1000题" /></label><label>章节 / 题号范围<input name="rangeLabel" maxLength={240} defaultValue={rangeLabel} /></label><div className="form-grid"><label>完成题数<input name="answered" type="number" min="0" max="100" defaultValue={targetQuestions} /></label><label>正确题数<input name="correct" type="number" min="0" max="100" defaultValue="0" /></label></div><label>错因复盘 <small>至少 20 字</small><textarea name="wrongReason" rows={5} maxLength={4000} placeholder="例如：混淆了理论来源与社会根源；多选题漏选了阶级基础……" /></label><label>闭卷知识框架 <small>至少 30 字</small><textarea name="framework" rows={7} maxLength={8000} placeholder="合上资料，写出本节概念、关系、常见干扰项与错因。" /></label><button className="button button--primary full-button" type="submit"><Save />保存练习证据</button><p className="form-note" role="status">{saved || `门槛：${targetQuestions} 题 + 错因 20 字 + 闭卷框架 30 字。`}</p></form></aside></section>
  </div>;
}
