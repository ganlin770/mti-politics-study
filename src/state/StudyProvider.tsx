import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { POLITICS_LESSONS } from '../data';
import { authRedirectUrl, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { SelfTestOptionId, SelfTestQuestion } from '../types';
import {
  nextRecallProgress,
  recallDay,
  recallIntervalLabel,
  recallStageFromInterval,
} from '../utils/recall';
import type {
  CloudStatus,
  LessonProgress,
  LessonStatus,
  PoliticsStudyState,
  PracticeLog,
  QuizAttempt,
  RecallProgress,
  RecallRating,
  RecallReviewLog,
} from './studyTypes';

const STORAGE_PREFIX = 'politics-lab-state-v1';
const FIRST_LESSON_ID = POLITICS_LESSONS[0]?.id ?? 'marx-01';

function isoDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function durationSeconds(duration?: string) {
  if (!duration) return 0;
  const [minutes, seconds] = duration.split(':').map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0;
}

function freshState(): PoliticsStudyState {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: new Date().toISOString(),
    startedOn: isoDay(),
    activeLessonId: FIRST_LESSON_ID,
    lessons: {},
    quizAttempts: {},
    practiceLogs: [],
    recallProgress: {},
    recallHistory: [],
    dailyMinutes: {},
  };
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function normalizeState(value: unknown): PoliticsStudyState {
  if (!value || typeof value !== 'object') return freshState();
  const candidate = value as Partial<PoliticsStudyState>;
  if (candidate.schemaVersion !== 1) return freshState();
  const lessons: PoliticsStudyState['lessons'] = {};
  if (candidate.lessons && typeof candidate.lessons === 'object') {
    for (const [lessonId, raw] of Object.entries(candidate.lessons)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<LessonProgress>;
      const status: LessonStatus = ['not-started', 'learning', 'completed'].includes(String(item.status))
        ? item.status as LessonStatus
        : 'not-started';
      lessons[lessonId] = {
        status,
        watchedSeconds: Math.max(0, Math.min(86_400, Number(item.watchedSeconds) || 0)),
        completedAt: status === 'completed' && typeof item.completedAt === 'string' ? item.completedAt : undefined,
      };
    }
  }
  const quizAttempts: PoliticsStudyState['quizAttempts'] = {};
  if (candidate.quizAttempts && typeof candidate.quizAttempts === 'object') {
    for (const [questionId, raw] of Object.entries(candidate.quizAttempts)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<QuizAttempt>;
      const selected = Array.isArray(item.selectedOptionIds)
        ? item.selectedOptionIds.filter((option): option is SelfTestOptionId => ['A', 'B', 'C', 'D'].includes(String(option)))
        : [];
      if (!item.lessonId || !selected.length) continue;
      quizAttempts[questionId] = {
        questionId,
        lessonId: safeText(item.lessonId, 80),
        selectedOptionIds: [...new Set(selected)],
        correct: Boolean(item.correct),
        answeredAt: safeText(item.answeredAt, 40) || new Date().toISOString(),
      };
    }
  }
  const practiceLogs: PracticeLog[] = Array.isArray(candidate.practiceLogs)
    ? candidate.practiceLogs.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const item = raw as Partial<PracticeLog>;
        if (!item.id || !item.lessonId) return [];
        const answered = Math.max(0, Math.min(100, Number(item.answered) || 0));
        return [{
          id: safeText(item.id, 120),
          lessonId: safeText(item.lessonId, 80),
          date: safeText(item.date, 10),
          resource: safeText(item.resource, 160),
          rangeLabel: safeText(item.rangeLabel, 240),
          answered,
          correct: Math.max(0, Math.min(answered, Number(item.correct) || 0)),
          wrongReason: safeText(item.wrongReason, 4_000),
          framework: safeText(item.framework, 8_000),
          createdAt: safeText(item.createdAt, 40) || new Date().toISOString(),
        }];
      }).slice(0, 300)
    : [];
  const dailyMinutes: Record<string, number> = {};
  if (candidate.dailyMinutes && typeof candidate.dailyMinutes === 'object') {
    for (const [day, raw] of Object.entries(candidate.dailyMinutes)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      dailyMinutes[day] = Math.max(0, Math.min(1_440, Number(raw) || 0));
    }
  }
  const recallProgress: PoliticsStudyState['recallProgress'] = {};
  if (candidate.recallProgress && typeof candidate.recallProgress === 'object') {
    for (const [cardId, raw] of Object.entries(candidate.recallProgress).slice(0, 500)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<RecallProgress>;
      const lastRating = ['again', 'fuzzy', 'known'].includes(String(item.lastRating))
        ? item.lastRating as RecallRating
        : null;
      if (!lastRating || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.dueOn))) continue;
      const intervalDays = Math.max(0, Math.min(60, Number(item.intervalDays) || 0));
      const legacyDueDate = new Date(`${String(item.dueOn)}T00:00:00`);
      const legacyDueAt = Number.isFinite(legacyDueDate.getTime())
        ? legacyDueDate.toISOString()
        : new Date().toISOString();
      const dueAt = typeof item.dueAt === 'string' && Number.isFinite(Date.parse(item.dueAt))
        ? item.dueAt
        : legacyDueAt;
      recallProgress[cardId] = {
        cardId: safeText(item.cardId, 100) || safeText(cardId, 100),
        dueOn: String(item.dueOn),
        dueAt,
        stage: Math.max(0, Math.min(7, Number.isFinite(Number(item.stage))
          ? Number(item.stage)
          : recallStageFromInterval(intervalDays))),
        intervalDays,
        reviews: Math.max(1, Math.min(10_000, Number(item.reviews) || 1)),
        lapses: Math.max(0, Math.min(10_000, Number(item.lapses) || 0)),
        streak: Math.max(0, Math.min(10_000, Number(item.streak) || 0)),
        lastRating,
        lastReviewedAt: safeText(item.lastReviewedAt, 40) || new Date().toISOString(),
      };
    }
  }
  const recallHistoryMap = new Map<string, RecallReviewLog>();
  if (Array.isArray(candidate.recallHistory)) {
    for (const raw of candidate.recallHistory.slice(0, 5_000)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<RecallReviewLog>;
      const rating = ['again', 'fuzzy', 'known'].includes(String(item.rating))
        ? item.rating as RecallRating
        : null;
      const reviewedAt = safeText(item.reviewedAt, 40);
      const dueAt = safeText(item.dueAt, 40);
      if (!item.id || !item.cardId || !rating || !Number.isFinite(Date.parse(reviewedAt)) || !Number.isFinite(Date.parse(dueAt))) continue;
      const log: RecallReviewLog = {
        id: safeText(item.id, 120),
        cardId: safeText(item.cardId, 100),
        rating,
        reviewedAt,
        previousStage: Math.max(0, Math.min(7, Number(item.previousStage) || 0)),
        nextStage: Math.max(0, Math.min(7, Number(item.nextStage) || 0)),
        dueAt,
        intervalLabel: safeText(item.intervalLabel, 40) || '待复习',
      };
      recallHistoryMap.set(log.id, log);
    }
  }
  const recordedReviews = new Set(
    [...recallHistoryMap.values()].map((item) => `${item.cardId}|${item.reviewedAt}`),
  );
  for (const item of Object.values(recallProgress)) {
    const signature = `${item.cardId}|${item.lastReviewedAt}`;
    if (recordedReviews.has(signature)) continue;
    const migrated: RecallReviewLog = {
      id: `recall-legacy-${item.cardId}-${item.lastReviewedAt}`.slice(0, 120),
      cardId: item.cardId,
      rating: item.lastRating,
      reviewedAt: item.lastReviewedAt,
      previousStage: Math.max(0, item.stage - 1),
      nextStage: item.stage,
      dueAt: item.dueAt,
      intervalLabel: recallIntervalLabel(item),
    };
    recallHistoryMap.set(migrated.id, migrated);
  }
  const recallHistory = [...recallHistoryMap.values()]
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, 3_000);
  const activeLessonId = POLITICS_LESSONS.some((lesson) => lesson.id === candidate.activeLessonId)
    ? candidate.activeLessonId as string
    : FIRST_LESSON_ID;
  return {
    schemaVersion: 1,
    revision: Math.max(0, Number(candidate.revision) || 0),
    updatedAt: safeText(candidate.updatedAt, 40) || new Date().toISOString(),
    startedOn: /^\d{4}-\d{2}-\d{2}$/.test(String(candidate.startedOn)) ? String(candidate.startedOn) : isoDay(),
    activeLessonId,
    lessons,
    quizAttempts,
    practiceLogs,
    recallProgress,
    recallHistory,
    dailyMinutes,
  };
}

function storageKey(userId: string | null) {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

function readLocalState(userId: string | null) {
  try {
    const scoped = localStorage.getItem(storageKey(userId));
    const legacy = userId ? null : localStorage.getItem(STORAGE_PREFIX);
    return normalizeState(JSON.parse(scoped || legacy || 'null'));
  } catch {
    return freshState();
  }
}

function nextId(prefix: string) {
  if (typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function eventUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mergeStudyStates(remoteValue: PoliticsStudyState, localValue: PoliticsStudyState) {
  const remote = normalizeState(remoteValue);
  const local = normalizeState(localValue);
  const statusRank: Record<LessonStatus, number> = { 'not-started': 0, learning: 1, completed: 2 };
  const lessons: PoliticsStudyState['lessons'] = {};
  for (const lessonId of new Set([...Object.keys(remote.lessons), ...Object.keys(local.lessons)])) {
    const remoteLesson = remote.lessons[lessonId];
    const localLesson = local.lessons[lessonId];
    if (!remoteLesson) lessons[lessonId] = localLesson;
    else if (!localLesson) lessons[lessonId] = remoteLesson;
    else {
      const status = statusRank[localLesson.status] >= statusRank[remoteLesson.status]
        ? localLesson.status
        : remoteLesson.status;
      const completedAt = [remoteLesson.completedAt, localLesson.completedAt]
        .filter((item): item is string => Boolean(item))
        .sort()
        .at(-1);
      lessons[lessonId] = {
        status,
        watchedSeconds: Math.max(remoteLesson.watchedSeconds, localLesson.watchedSeconds),
        completedAt: status === 'completed' ? completedAt : undefined,
      };
    }
  }
  const quizAttempts = { ...remote.quizAttempts };
  for (const [questionId, attempt] of Object.entries(local.quizAttempts)) {
    const existing = quizAttempts[questionId];
    if (!existing || attempt.answeredAt >= existing.answeredAt) quizAttempts[questionId] = attempt;
  }
  const logMap = new Map(remote.practiceLogs.map((log) => [log.id, log]));
  for (const log of local.practiceLogs) logMap.set(log.id, log);
  const dailyMinutes = { ...remote.dailyMinutes };
  for (const [day, minutes] of Object.entries(local.dailyMinutes)) {
    dailyMinutes[day] = Math.max(dailyMinutes[day] || 0, minutes);
  }
  const recallProgress = { ...remote.recallProgress };
  for (const [cardId, item] of Object.entries(local.recallProgress)) {
    const existing = recallProgress[cardId];
    if (!existing || item.lastReviewedAt >= existing.lastReviewedAt) recallProgress[cardId] = item;
  }
  const recallHistoryMap = new Map(remote.recallHistory.map((item) => [item.id, item]));
  for (const item of local.recallHistory) recallHistoryMap.set(item.id, item);
  const localIsNewer = Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt);
  return normalizeState({
    schemaVersion: 1,
    revision: Math.max(remote.revision, local.revision) + 1,
    updatedAt: new Date().toISOString(),
    startedOn: [remote.startedOn, local.startedOn].sort()[0],
    activeLessonId: localIsNewer ? local.activeLessonId : remote.activeLessonId,
    lessons,
    quizAttempts,
    practiceLogs: [...logMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300),
    recallProgress,
    recallHistory: [...recallHistoryMap.values()]
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
      .slice(0, 3_000),
    dailyMinutes,
  });
}

interface StudyContextValue {
  state: PoliticsStudyState;
  cloudStatus: CloudStatus;
  cloudMessage: string;
  user: User | null;
  supabaseConfigured: boolean;
  setLessonStatus: (lessonId: string, status: LessonStatus) => void;
  setWatchProgress: (lessonId: string, watchedSeconds: number) => void;
  setActiveLesson: (lessonId: string) => void;
  answerQuestion: (question: SelfTestQuestion, selected: SelfTestOptionId[]) => void;
  resetQuiz: (lessonId: string) => void;
  savePracticeLog: (input: Omit<PracticeLog, 'id' | 'createdAt'>) => PracticeLog;
  rateRecallCard: (cardId: string, rating: RecallRating) => RecallProgress;
  sendMagicLink: (email: string) => Promise<string>;
  importGuestProgress: () => Promise<string>;
  signOut: () => Promise<void>;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PoliticsStudyState>(() => readLocalState(null));
  const [session, setSession] = useState<Session | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('local');
  const [cloudMessage, setCloudMessage] = useState('仅保存在当前设备');
  const stateRef = useRef(state);
  const sessionRef = useRef<Session | null>(null);
  const storageScopeRef = useRef<string | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const cloudRevisionRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
    try {
      localStorage.setItem(storageKey(storageScopeRef.current), JSON.stringify(state));
    } catch {
      console.warn('local progress save failed');
    }
  }, [state]);

  const uploadState = useCallback(async (userId: string, value: PoliticsStudyState) => {
    const client = supabase;
    if (!client) return false;
    if (sessionRef.current?.user.id !== userId) return false;
    setCloudStatus('connecting');
    setCloudMessage('正在同步…');
    type SyncRow = { out_state: unknown; out_revision: number; applied: boolean };
    const sync = (nextValue: PoliticsStudyState, expectedRevision: number) => client.rpc(
      'politics_sync_user_state',
      {
        p_state: nextValue,
        p_schema_version: nextValue.schemaVersion,
        p_expected_revision: expectedRevision,
        p_client_updated_at: nextValue.updatedAt,
      },
    );
    const first = await sync(value, cloudRevisionRef.current);
    const firstRow = (Array.isArray(first.data) ? first.data[0] : null) as SyncRow | null;
    if (first.error || !firstRow) {
      setCloudStatus('error');
      setCloudMessage('云端同步函数尚未就绪，本机记录未丢失');
      return false;
    }

    if (!firstRow.applied) {
      const merged = mergeStudyStates(normalizeState(firstRow.out_state), value);
      cloudRevisionRef.current = Number(firstRow.out_revision) || 0;
      stateRef.current = merged;
      setState(merged);
      const retry = await sync(merged, cloudRevisionRef.current);
      const retryRow = (Array.isArray(retry.data) ? retry.data[0] : null) as SyncRow | null;
      if (retry.error || !retryRow?.applied) {
        setCloudStatus('error');
        setCloudMessage('检测到多设备冲突，已在本机合并，稍后重试云同步');
        return false;
      }
      cloudRevisionRef.current = Number(retryRow.out_revision) || cloudRevisionRef.current + 1;
    } else {
      cloudRevisionRef.current = Number(firstRow.out_revision) || cloudRevisionRef.current + 1;
    }
    setCloudStatus('synced');
    setCloudMessage('已安全同步');
    return true;
  }, []);

  const appendEvent = useCallback(
    (eventType: string, itemKey: string | null, payload: Record<string, unknown>) => {
      const activeSession = sessionRef.current;
      if (!supabase || !activeSession) return;
      void supabase
        .from('politics_study_events')
        .insert({
          event_id: eventUuid(),
          user_id: activeSession.user.id,
          event_type: eventType,
          item_key: itemKey,
          payload,
          occurred_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn('study event sync failed');
        });
    },
    [],
  );

  const hydrateUser = useCallback(
    async (activeSession: Session, localState?: PoliticsStudyState) => {
      if (!supabase) return;
      const userId = activeSession.user.id;
      setCloudStatus('connecting');
      setCloudMessage('正在读取云端进度…');
      const { data, error } = await supabase
        .from('politics_user_state')
        .select('state, revision, client_updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        hydratedUserRef.current = null;
        setCloudStatus('error');
        setCloudMessage('数据库尚未就绪，继续使用本机记录');
        return;
      }

      const local = localState || readLocalState(userId);
      if (!data?.state) {
        cloudRevisionRef.current = 0;
        hydratedUserRef.current = userId;
        await uploadState(userId, local);
        return;
      }

      const remote = normalizeState(data.state);
      cloudRevisionRef.current = Math.max(0, Number(data.revision) || 0);
      hydratedUserRef.current = userId;
      const merged = mergeStudyStates(remote, local);
      stateRef.current = merged;
      setState(merged);
      await uploadState(userId, merged);
    },
    [uploadState],
  );

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    const activateSession = (nextSession: Session | null) => {
      const previousUserId = sessionRef.current?.user.id || null;
      const nextUserId = nextSession?.user.id || null;
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (previousUserId === nextUserId && storageScopeRef.current === nextUserId) return;

      hydratedUserRef.current = null;
      cloudRevisionRef.current = 0;
      storageScopeRef.current = nextUserId;
      const scopedState = readLocalState(nextUserId);
      stateRef.current = scopedState;
      setState(scopedState);
      if (nextSession) {
        window.setTimeout(() => void hydrateUser(nextSession, scopedState), 0);
      } else {
        setCloudStatus('local');
        setCloudMessage('仅保存在当前设备');
      }
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      activateSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      activateSession(nextSession);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [hydrateUser]);

  useEffect(() => {
    const activeSession = sessionRef.current;
    if (!activeSession || hydratedUserRef.current !== activeSession.user.id) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void uploadState(activeSession.user.id, stateRef.current);
    }, 700);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [state, uploadState]);

  const mutate = useCallback((updater: (current: PoliticsStudyState) => PoliticsStudyState) => {
    setState((current) => {
      const next = updater(current);
      return {
        ...next,
        schemaVersion: 1,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setLessonStatus = useCallback(
    (lessonId: string, status: LessonStatus) => {
      mutate((current) => {
        const previous: LessonProgress = current.lessons[lessonId] || {
          status: 'not-started',
          watchedSeconds: 0,
        };
        const lesson = POLITICS_LESSONS.find((item) => item.id === lessonId);
        const confirmedDuration = durationSeconds(lesson?.duration);
        const completionSeconds = confirmedDuration || 1_800;
        const completedNow = status === 'completed' && previous.status !== 'completed';
        const watchedSeconds = status === 'completed'
          ? Math.max(previous.watchedSeconds, completionSeconds)
          : previous.watchedSeconds;
        const addedMinutes = completedNow
          ? Math.max(0, Math.ceil((completionSeconds - previous.watchedSeconds) / 60))
          : 0;
        const today = isoDay();
        return {
          ...current,
          activeLessonId: status === 'completed' ? current.activeLessonId : lessonId,
          lessons: {
            ...current.lessons,
            [lessonId]: {
              ...previous,
              status,
              watchedSeconds,
              completedAt: status === 'completed' ? new Date().toISOString() : undefined,
            },
          },
          dailyMinutes: addedMinutes
            ? { ...current.dailyMinutes, [today]: (current.dailyMinutes[today] || 0) + addedMinutes }
            : current.dailyMinutes,
        };
      });
      appendEvent('lesson.status', lessonId, { status });
    },
    [appendEvent, mutate],
  );

  const setWatchProgress = useCallback(
    (lessonId: string, watchedSeconds: number) => {
      mutate((current) => {
        const previous = current.lessons[lessonId] || {
          status: 'not-started' as LessonStatus,
          watchedSeconds: 0,
        };
        return {
          ...current,
          activeLessonId: lessonId,
          lessons: {
            ...current.lessons,
            [lessonId]: {
              ...previous,
              status: previous.status === 'completed'
                ? 'completed'
                : watchedSeconds > 0 ? 'learning' : previous.status,
              watchedSeconds: Math.max(0, Math.round(watchedSeconds)),
            },
          },
        };
      });
    },
    [mutate],
  );

  const setActiveLesson = useCallback(
    (lessonId: string) => mutate((current) => ({ ...current, activeLessonId: lessonId })),
    [mutate],
  );

  const answerQuestion = useCallback(
    (question: SelfTestQuestion, selected: SelfTestOptionId[]) => {
      const normalized = [...selected].sort();
      const correct =
        normalized.length === question.correctOptionIds.length &&
        normalized.every((option, index) => option === [...question.correctOptionIds].sort()[index]);
      const attempt: QuizAttempt = {
        questionId: question.id,
        lessonId: question.lessonId,
        selectedOptionIds: normalized,
        correct,
        answeredAt: new Date().toISOString(),
      };
      mutate((current) => ({
        ...current,
        quizAttempts: { ...current.quizAttempts, [question.id]: attempt },
      }));
      appendEvent('quiz.answered', question.id, { correct, selected: normalized });
    },
    [appendEvent, mutate],
  );

  const resetQuiz = useCallback(
    (lessonId: string) => {
      mutate((current) => ({
        ...current,
        quizAttempts: Object.fromEntries(
          Object.entries(current.quizAttempts).filter(([, attempt]) => attempt.lessonId !== lessonId),
        ),
      }));
      appendEvent('quiz.reset', lessonId, {});
    },
    [appendEvent, mutate],
  );

  const savePracticeLog = useCallback(
    (input: Omit<PracticeLog, 'id' | 'createdAt'>) => {
      const log: PracticeLog = {
        ...input,
        id: nextId('practice'),
        createdAt: new Date().toISOString(),
      };
      mutate((current) => ({
        ...current,
        practiceLogs: [log, ...current.practiceLogs].slice(0, 300),
      }));
      appendEvent('practice.logged', input.lessonId, {
        answered: input.answered,
        correct: input.correct,
        rangeLabel: input.rangeLabel,
      });
      return log;
    },
    [appendEvent, mutate],
  );

  const rateRecallCard = useCallback(
    (cardId: string, rating: RecallRating) => {
      const now = new Date();
      const previous = stateRef.current.recallProgress[cardId];
      const next = nextRecallProgress(cardId, previous, rating, now);
      const review: RecallReviewLog = {
        id: nextId('recall'),
        cardId,
        rating,
        reviewedAt: now.toISOString(),
        previousStage: previous?.stage || 0,
        nextStage: next.stage,
        dueAt: next.dueAt,
        intervalLabel: recallIntervalLabel(next),
      };
      const today = recallDay(now);
      const firstReviewToday = !previous || recallDay(new Date(previous.lastReviewedAt)) !== today;
      mutate((current) => ({
        ...current,
        recallProgress: { ...current.recallProgress, [cardId]: next },
        recallHistory: [review, ...current.recallHistory].slice(0, 3_000),
        dailyMinutes: firstReviewToday
          ? { ...current.dailyMinutes, [today]: (current.dailyMinutes[today] || 0) + 1 }
          : current.dailyMinutes,
      }));
      appendEvent('recall.rated', cardId, {
        rating,
        dueOn: next.dueOn,
        dueAt: next.dueAt,
        stage: next.stage,
        intervalDays: next.intervalDays,
        reviewId: review.id,
      });
      return next;
    },
    [appendEvent, mutate],
  );

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('云同步尚未配置，当前仍可本机使用。');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
    });
    if (error) throw error;
    return '登录链接已发送，请到邮箱中点击。';
  }, []);

  const importGuestProgress = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) throw new Error('请先登录云同步账号。');
    const guest = readLocalState(null);
    const hasProgress =
      Object.keys(guest.lessons).length > 0 ||
      Object.keys(guest.quizAttempts).length > 0 ||
      guest.practiceLogs.length > 0 ||
      Object.keys(guest.recallProgress).length > 0 ||
      guest.recallHistory.length > 0;
    if (!hasProgress) return '本机匿名进度为空，无需导入。';

    const imported: PoliticsStudyState = {
      ...guest,
      revision: Math.max(guest.revision, stateRef.current.revision) + 1,
      updatedAt: new Date().toISOString(),
    };
    storageScopeRef.current = activeSession.user.id;
    hydratedUserRef.current = activeSession.user.id;
    stateRef.current = imported;
    setState(imported);
    const uploaded = await uploadState(activeSession.user.id, imported);
    return uploaded ? '已将本机匿名进度导入当前账号。' : '已导入到当前账号的本机区，云端稍后重试。';
  }, [uploadState]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<StudyContextValue>(
    () => ({
      state,
      cloudStatus,
      cloudMessage,
      user: session?.user ?? null,
      supabaseConfigured: isSupabaseConfigured,
      setLessonStatus,
      setWatchProgress,
      setActiveLesson,
      answerQuestion,
      resetQuiz,
      savePracticeLog,
      rateRecallCard,
      sendMagicLink,
      importGuestProgress,
      signOut,
    }),
    [
      state,
      cloudStatus,
      cloudMessage,
      session,
      setLessonStatus,
      setWatchProgress,
      setActiveLesson,
      answerQuestion,
      resetQuiz,
      savePracticeLog,
      rateRecallCard,
      sendMagicLink,
      importGuestProgress,
      signOut,
    ],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

// The hook intentionally shares this module with its provider so their private context cannot diverge.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error('useStudy must be used within StudyProvider');
  return context;
}
