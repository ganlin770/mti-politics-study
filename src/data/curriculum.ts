import type {
  LessonPracticeScope,
  PoliticsLesson,
  PoliticsSubject,
  PoliticsSubjectId,
} from "../types";

export const COURSE_ROOT =
  "考研政治/00_只学这个_MTI政治主线/01_先学_徐涛强化主课";

const SUBJECT_META: Record<
  PoliticsSubjectId,
  {
    name: string;
    shortName: string;
    order: number;
    folder: string;
    titles: string[];
  }
> = {
  marx: {
    name: "马克思主义基本原理",
    shortName: "马原",
    order: 1,
    folder: "01.考点串讲-马原",
    titles: [
      "导论",
      "哲学及其基本问题",
      "物质观",
      "意识观、世界的物质统一性",
      "两大总特征",
      "对立统一规律",
      "量变质变规律、否定之否定规律",
      "五对基本范畴",
      "实践",
      "认识",
      "真理与价值、认识世界和改造世界",
      "历史观基本问题、社会基本矛盾",
      "社会形态更替、人民群众",
      "简单商品经济（上）",
      "简单商品经济（下）",
      "发达商品经济（上）",
      "发达商品经济（中）",
      "发达商品经济（下）",
      "垄断及当代资本主义",
    ],
  },
  morals: {
    name: "思想道德与法治",
    shortName: "思修",
    order: 2,
    folder: "02.考点串讲-思修",
    titles: [
      "绪论、人生观",
      "理想信念",
      "中国精神",
      "社会主义核心价值观",
      "道德",
      "社会主义法律的特征和运行、全面依法治国",
      "尊重宪法权威、尊法学法守法用法",
      "思修阶段测试",
    ],
  },
  history: {
    name: "中国近现代史纲要",
    shortName: "史纲",
    order: 3,
    folder: "03.考点串讲-史纲",
    titles: [
      "进入近代后中华民族的磨难与抗争",
      "不同社会力量对国家出路的早期探索",
      "辛亥革命",
      "新文化运动、五四运动和中国共产党诞生",
      "中国革命的新局面",
      "中国革命的新道路",
      "抗日战争",
      "解放战争与建立新中国",
      "新中国时期",
      "史纲阶段测试",
    ],
  },
  mao: {
    name: "毛泽东思想和中国特色社会主义理论体系概论",
    shortName: "毛中特",
    order: 4,
    folder: "04.考点串讲-毛中特",
    titles: [
      "导论、毛泽东思想及其历史地位",
      "新民主主义革命理论（上）",
      "新民主主义革命理论（下）",
      "社会主义改造理论",
      "社会主义建设道路初步探索的理论成果",
      "中国特色社会主义理论体系",
      "毛中特阶段测试",
    ],
  },
  "new-era": {
    name: "习近平新时代中国特色社会主义思想概论",
    shortName: "新思想",
    order: 5,
    folder: "05.考点串讲-新思想",
    titles: [
      "导论、新时代坚持和发展中国特色社会主义",
      "以中国式现代化全面推进中华民族伟大复兴",
      "坚持党的全面领导、坚持以人民为中心",
      "全面深化改革开放",
      "推动高质量发展（上）",
      "推动高质量发展（下）",
      "社会主义现代化建设的教育、科技、人才战略",
      "发展全过程人民民主",
      "全面依法治国",
      "建设社会主义文化强国",
      "以保障和改善民生为重点加强社会建设、建设社会主义生态文明",
      "内外条件",
    ],
  },
};

const MARX_INTRO_PRACTICE: LessonPracticeScope = {
  source: "肖1000",
  singleChoice: { from: 1, to: 7 },
  multipleChoice: { from: 1, to: 2 },
  label: "导论：单选1—7、多选1—2",
};

function makeSubjectLessons(subject: PoliticsSubjectId): PoliticsLesson[] {
  const meta = SUBJECT_META[subject];

  return meta.titles.map((title, index) => {
    const order = index + 1;
    const number = String(order).padStart(2, "0");
    const isStageTest = title.endsWith("阶段测试");
    const lesson: PoliticsLesson = {
      id: `${subject}-${number}`,
      subject,
      order,
      title,
      kind: isStageTest ? "stage-test" : "lecture",
      resource: "徐涛政治强化主课",
      relativePath: `${COURSE_ROOT}/${meta.folder}/${number}.${title}.mp4`,
      pathEvidence: subject === "marx" && order === 1 ? "observed" : "inferred",
    };

    if (subject === "marx" && order === 1) {
      lesson.duration = "53:04";
      lesson.practice = MARX_INTRO_PRACTICE;
    }

    return lesson;
  });
}

export const POLITICS_LESSONS: PoliticsLesson[] = (
  ["marx", "morals", "history", "mao", "new-era"] as PoliticsSubjectId[]
).flatMap(makeSubjectLessons);

export const POLITICS_SUBJECTS: PoliticsSubject[] = (
  ["marx", "morals", "history", "mao", "new-era"] as PoliticsSubjectId[]
).map((id) => {
  const meta = SUBJECT_META[id];
  const lessons = POLITICS_LESSONS.filter((lesson) => lesson.subject === id);

  return {
    id,
    name: meta.name,
    shortName: meta.shortName,
    order: meta.order,
    expectedLessonCount: meta.titles.length,
    folder: meta.folder,
    lessonIds: lessons.map((lesson) => lesson.id),
  };
});

export const LESSON_BY_ID: Readonly<Record<string, PoliticsLesson>> =
  Object.freeze(
    Object.fromEntries(
      POLITICS_LESSONS.map((lesson) => [lesson.id, lesson]),
    ),
  );
