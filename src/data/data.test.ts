import { describe, expect, it } from 'vitest';
import {
  MARX_INTRO_SELF_TESTS,
  POLITICS_LESSONS,
  POLITICS_RECALL_CARDS,
  POLITICS_SUBJECTS,
  RESOURCE_AUDIT,
} from './index';

describe('politics curriculum seed', () => {
  it('contains the audited 56 lessons split across five subjects', () => {
    expect(POLITICS_SUBJECTS).toHaveLength(5);
    expect(POLITICS_LESSONS).toHaveLength(56);

    expect(
      Object.fromEntries(
        POLITICS_SUBJECTS.map((subject) => [
          subject.id,
          POLITICS_LESSONS.filter((lesson) => lesson.subject === subject.id).length,
        ]),
      ),
    ).toEqual({
      marx: 19,
      morals: 8,
      history: 10,
      mao: 7,
      'new-era': 12,
    });

    for (const subject of POLITICS_SUBJECTS) {
      expect(subject.lessonIds).toHaveLength(subject.expectedLessonCount);
      expect(new Set(subject.lessonIds).size).toBe(subject.expectedLessonCount);
    }
  });

  it('keeps the first verified lesson and its private-book exercise range intact', () => {
    expect(POLITICS_LESSONS[0]).toMatchObject({
      id: 'marx-01',
      title: '导论',
      duration: '53:04',
      practice: {
        source: '肖1000',
        label: '导论：单选1—7、多选1—2',
      },
    });
  });
});

describe('resource audit boundaries', () => {
  it('reports partial walkthrough-video coverage and the three real gaps', () => {
    expect(RESOURCE_AUDIT.course).toMatchObject({
      status: 'available',
      subjectCount: 5,
      lessonCount: 56,
    });

    expect(RESOURCE_AUDIT.items.find((item) => item.id === 'wrong-answer-videos')).toMatchObject({
      status: 'partial',
      coveredSubjects: ['marx', 'history'],
      missingSubjects: ['morals', 'mao', 'new-era'],
    });

    expect(RESOURCE_AUDIT.missingModules).toEqual([
      'current-affairs',
      'sprint',
      'past-papers',
    ]);
    expect(
      RESOURCE_AUDIT.items
        .filter((item) => item.status === 'missing')
        .map((item) => item.id),
    ).toEqual(['current-affairs', 'sprint-materials', 'past-papers']);
  });
});

describe('original diagnostic questions', () => {
  it('ships six clearly labelled original questions instead of copied book or past-paper items', () => {
    expect(MARX_INTRO_SELF_TESTS).toHaveLength(6);
    expect(new Set(MARX_INTRO_SELF_TESTS.map((question) => question.id)).size).toBe(6);

    for (const question of MARX_INTRO_SELF_TESTS) {
      expect(question.lessonId).toBe('marx-01');
      expect(question.source).toBe('original-positioning-check');
      expect(question.sourceLabel).toBe('原创定位自测（非肖1000、非历年真题）');
      expect(question.options).toHaveLength(4);
      expect(question.correctOptionIds.length).toBeGreaterThan(0);
      expect(question.explanation.length).toBeGreaterThan(20);
    }
  });
});

describe('politics recall deck', () => {
  it('ships 60 original cards in the same five-subject order as the Quark main route', () => {
    expect(POLITICS_RECALL_CARDS).toHaveLength(60);
    expect(new Set(POLITICS_RECALL_CARDS.map((card) => card.id)).size).toBe(60);
    expect(
      Object.fromEntries(POLITICS_SUBJECTS.map((subject) => [
        subject.id,
        POLITICS_RECALL_CARDS.filter((card) => card.subject === subject.id).length,
      ])),
    ).toEqual({ marx: 18, morals: 10, history: 12, mao: 8, 'new-era': 12 });

    for (const card of POLITICS_RECALL_CARDS) {
      expect(POLITICS_LESSONS.some((lesson) => lesson.id === card.lessonId)).toBe(true);
      expect(card.source).toBe('original-core-recall');
      expect(card.sourceLabel).toBe('原创核心抽背（非肖1000、非历年真题）');
      expect(card.answer.length).toBeGreaterThan(35);
      expect(card.keywords.length).toBeGreaterThanOrEqual(3);
    }
  });
});
