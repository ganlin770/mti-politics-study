import { POLITICS_SUBJECTS } from '../data';
import type { PoliticsStudyState } from '../state/studyTypes';
import type { PoliticsLesson, PoliticsSubjectId } from '../types';

export function durationToSeconds(duration?: string) {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

export function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export function subjectProgress(state: PoliticsStudyState, subjectId: PoliticsSubjectId) {
  const subject = POLITICS_SUBJECTS.find((item) => item.id === subjectId);
  const total = subject?.lessonIds.length || 0;
  const completed = subject?.lessonIds.filter((id) => state.lessons[id]?.status === 'completed').length || 0;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function lessonStatusLabel(lesson: PoliticsLesson, state: PoliticsStudyState) {
  const status = state.lessons[lesson.id]?.status || 'not-started';
  if (status === 'completed') return '已完成';
  if (status === 'learning') return '学习中';
  return lesson.kind === 'stage-test' ? '待测试' : '未开始';
}

export function lessonPracticeTarget(lesson: PoliticsLesson) {
  const countRange = (range?: { from: number; to: number }) =>
    range ? Math.max(0, range.to - range.from + 1) : 0;
  const verified = countRange(lesson.practice?.singleChoice) + countRange(lesson.practice?.multipleChoice);
  if (verified) return verified;
  return lesson.kind === 'stage-test' ? 20 : 10;
}

export function lessonPracticeLabel(lesson: PoliticsLesson) {
  return lesson.practice?.label || `${lesson.title}：完成对应章节选择题`;
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recentDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - index - 1));
    return dateKey(date);
  });
}
