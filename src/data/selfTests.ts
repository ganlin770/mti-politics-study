import type { SelfTestQuestion } from "../types";

const SOURCE = "original-positioning-check" as const;
const SOURCE_LABEL = "原创定位自测（非肖1000、非历年真题）" as const;

/**
 * Six original diagnostic questions for marx-01.
 * They locate weak concepts before the learner opens the licensed exercise book;
 * they do not reproduce or paraphrase any 肖1000 or past-paper item.
 */
export const MARX_INTRO_SELF_TESTS: SelfTestQuestion[] = [
  {
    id: "marx-01-original-01",
    lessonId: "marx-01",
    type: "single",
    stem: "如果要用三个相互联系的领域概括马克思主义理论体系，哪一组最准确？",
    options: [
      { id: "A", text: "马克思主义哲学、马克思主义政治经济学、科学社会主义" },
      { id: "B", text: "伦理学、法学、管理学" },
      { id: "C", text: "自然哲学、经验经济学、空想社会主义" },
      { id: "D", text: "历史学、社会学、国际关系学" },
    ],
    correctOptionIds: ["A"],
    explanation:
      "三个基本组成部分共同构成完整理论体系：哲学提供世界观和方法论，政治经济学揭示资本主义经济运动规律，科学社会主义指明社会发展的现实道路。",
    tags: ["理论构成", "基础定位"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "marx-01-original-02",
    lessonId: "marx-01",
    type: "multiple",
    stem: "19世纪马克思主义能够产生，离不开哪些相互配合的历史条件？",
    options: [
      { id: "A", text: "资本主义大工业的发展及其矛盾日益显现" },
      { id: "B", text: "无产阶级作为独立政治力量登上历史舞台" },
      { id: "C", text: "德国古典哲学、英国古典政治经济学和英法空想社会主义等思想成果" },
      { id: "D", text: "少数思想家脱离社会实践的偶然灵感" },
    ],
    correctOptionIds: ["A", "B", "C"],
    explanation:
      "理论不是凭空出现的。社会经济发展形成社会根源，无产阶级斗争形成阶级基础，人类既有优秀思想成果提供思想渊源；把理论归因于偶然灵感会割裂理论与时代实践。",
    tags: ["产生条件", "社会根源", "阶级基础", "思想渊源"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "marx-01-original-03",
    lessonId: "marx-01",
    type: "single",
    stem: "判断一种主张是否坚持马克思主义根本立场，首先应看它是否站在谁的立场上？",
    options: [
      { id: "A", text: "抽象观念本身" },
      { id: "B", text: "最广大人民" },
      { id: "C", text: "少数资本所有者" },
      { id: "D", text: "任何既有制度" },
    ],
    correctOptionIds: ["B"],
    explanation:
      "人民立场是马克思主义的根本政治立场。检验理论和实践时，要看其是否致力于实现以劳动人民为主体的最广大人民的根本利益。",
    tags: ["根本立场", "人民性"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "marx-01-original-04",
    lessonId: "marx-01",
    type: "multiple",
    stem: "下列哪些学习表现符合马克思主义的鲜明特征？",
    options: [
      { id: "A", text: "用事实和规律检验理论判断，体现科学性" },
      { id: "B", text: "从人民利益和人民实践出发，体现人民性" },
      { id: "C", text: "在实践中运用并随实践发展理论，体现实践性和发展性" },
      { id: "D", text: "把个别历史结论固定成任何时代都不变的答案" },
    ],
    correctOptionIds: ["A", "B", "C"],
    explanation:
      "科学性、人民性、实践性和发展性彼此贯通。理论需要接受实践检验并在实践中发展，因此把具体结论教条化恰恰违背其鲜明特征。",
    tags: ["鲜明特征", "科学性", "人民性", "实践性", "发展性"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "marx-01-original-05",
    lessonId: "marx-01",
    type: "single",
    stem: "面对一个新的社会现象，哪种做法最能体现对马克思主义立场、观点和方法的掌握？",
    options: [
      { id: "A", text: "只寻找一句能够直接套用的旧结论" },
      { id: "B", text: "回避现实材料，只讨论概念定义" },
      { id: "C", text: "从实际关系和人民立场出发分析矛盾，再用实践检验判断" },
      { id: "D", text: "先接受流行答案，再选择支持它的材料" },
    ],
    correctOptionIds: ["C"],
    explanation:
      "掌握马克思主义不等于背诵孤立结论，而是把根本立场、基本观点和科学方法用于具体问题，并让判断回到实践中接受检验。",
    tags: ["立场观点方法", "理论联系实际"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "marx-01-original-06",
    lessonId: "marx-01",
    type: "multiple",
    stem: "在当代继续学习马克思主义，可以发挥哪些基础作用？",
    options: [
      { id: "A", text: "提供观察当代世界变化的科学方法" },
      { id: "B", text: "为认识和推进当代中国实践提供行动指南" },
      { id: "C", text: "为追求人类解放和社会进步提供价值方向" },
      { id: "D", text: "替代对具体国情、数据和现实问题的调查" },
    ],
    correctOptionIds: ["A", "B", "C"],
    explanation:
      "马克思主义的当代价值体现在认识世界、指导中国实践和推动人类进步等方面。科学理论提供方法和方向，但不能代替具体调查研究。",
    tags: ["当代价值", "方法论", "实践指南"],
    source: SOURCE,
    sourceLabel: SOURCE_LABEL,
  },
];
