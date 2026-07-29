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
  dueAt: string;
  /** 0 is the 10-minute relearning step; 1-7 are the expanding day intervals. */
  stage: number;
  intervalDays: number;
  reviews: number;
  lapses: number;
  streak: number;
  lastRating: RecallRating;
  lastReviewedAt: string;
}

export interface RecallReviewLog {
  id: string;
  cardId: string;
  rating: RecallRating;
  reviewedAt: string;
  previousStage: number;
  nextStage: number;
  dueAt: string;
  intervalLabel: string;
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
  recallHistory: RecallReviewLog[];
  dailyMinutes: Record<string, number>;
}
