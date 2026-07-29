export type PoliticsSubjectId =
  | "marx"
  | "morals"
  | "history"
  | "mao"
  | "new-era";

export type PoliticsLessonKind = "lecture" | "stage-test";

export interface QuestionNumberRange {
  from: number;
  to: number;
}

export interface LessonPracticeScope {
  source: "肖1000";
  singleChoice?: QuestionNumberRange;
  multipleChoice?: QuestionNumberRange;
  label: string;
}

export interface PoliticsLesson {
  /** Stable application identifier. Never derive persisted progress from title text. */
  id: string;
  subject: PoliticsSubjectId;
  /** One-based order inside the subject folder. */
  order: number;
  title: string;
  kind: PoliticsLessonKind;
  resource: "徐涛政治强化主课";
  /** Relative to the user's consolidated Quark politics root. No share token is stored. */
  relativePath: string;
  /** Only the first lesson path was opened directly; remaining file paths are folder-title inferences. */
  pathEvidence: "observed" | "inferred";
  /** Confirmed media duration; omitted when it has not been inspected. */
  duration?: string;
  practice?: LessonPracticeScope;
}

export interface PoliticsSubject {
  id: PoliticsSubjectId;
  name: string;
  shortName: string;
  order: number;
  expectedLessonCount: number;
  folder: string;
  lessonIds: string[];
}

export type SelfTestQuestionType = "single" | "multiple";
export type SelfTestOptionId = "A" | "B" | "C" | "D";

export interface SelfTestOption {
  id: SelfTestOptionId;
  text: string;
}

export interface SelfTestQuestion {
  id: string;
  lessonId: string;
  type: SelfTestQuestionType;
  stem: string;
  options: SelfTestOption[];
  correctOptionIds: SelfTestOptionId[];
  explanation: string;
  tags: string[];
  source: "original-positioning-check";
  sourceLabel: "原创定位自测（非肖1000、非历年真题）";
}

export type ResourceAuditStatus = "available" | "partial" | "missing";

export interface ResourceAuditItem {
  id: string;
  label: string;
  status: ResourceAuditStatus;
  detail: string;
  coveredSubjects?: PoliticsSubjectId[];
  missingSubjects?: PoliticsSubjectId[];
}

export interface PoliticsResourceAudit {
  auditedAt: string;
  auditBasis: string;
  course: {
    status: "available";
    subjectCount: number;
    lessonCount: number;
    lessonCountsBySubject: Record<PoliticsSubjectId, number>;
  };
  items: ResourceAuditItem[];
  missingModules: Array<"current-affairs" | "sprint" | "past-papers">;
}

export type PoliticsRecallCardKind =
  | "concept"
  | "relationship"
  | "method"
  | "significance";

export interface PoliticsRecallAnswerBasis {
  id: string;
  subject: PoliticsSubjectId;
  title: string;
  edition: string;
  publisher: "高等教育出版社";
  url: string;
  supplementalTitle?: string;
  supplementalUrl?: string;
}

export interface PoliticsRecallCard {
  id: string;
  subject: PoliticsSubjectId;
  lessonId: string;
  kind: PoliticsRecallCardKind;
  prompt: string;
  answer: string;
  memoryHook: string;
  keywords: string[];
  /** The official textbook record used to standardize the wording and scoring points. */
  answerBasisId: string;
  answerStatus: "textbook-aligned";
  answerVerifiedAt: "2026-07-29";
  source: "original-core-recall";
  sourceLabel: "原创核心抽背（非肖1000、非历年真题）";
}
