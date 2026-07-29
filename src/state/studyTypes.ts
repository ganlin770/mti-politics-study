import type { SelfTestOptionId } from '../types';

export type LessonStatus = 'not-started' | 'learning' | 'completed';
export type CloudStatus = 'local' | 'connecting' | 'synced' | 'error';
export type RecallRating = 'again' | 'fuzzy' | 'known';

export interface LessonProgress {
  status: LessonStatus;
  watchedSeconds: number;
  completedAt?: string;
}
export interface QuizAttempt {
  questionId: string;
  lessonId: string;
  selectedOptionIds: SelfTestOptionId[];
  correct: boolean;
  answeredAt: string;
}

export interface PracticeLog {
  id: string;
  lessonId: string;
  date: string;
  resource: string;
  rangeLabel: string;
  answered: number;
  correct: number;
  wrongReason: string;
  framework: string;
  createdAt: string;
}

export interface RecallProgress {
  cardId: string;
  dueOn: string;
  intervalDays: number;
  reviews: number;
  lapses: number;
  streak: number;
  lastRating: RecallRating;
  lastReviewedAt: string;
}

export interface PoliticsStudyState {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  startedOn: string;
  activeLessonId: string;
  lessons: Record<string, LessonProgress>;
  quizAttempts: Record<string, QuizAttempt>;
  practiceLogs: PracticeLog[];
  recallProgress: Record<string, RecallProgress>;
  dailyMinutes: Record<string, number>;
}
