import type { PoliticsResourceAudit } from "../types";

/** Snapshot of the materials actually observed in the consolidated Quark folder. */
export const RESOURCE_AUDIT: PoliticsResourceAudit = {
  auditedAt: "2026-07-28",
  auditBasis: "Chrome 实测夸克目录；只记录存在性和覆盖范围，不复制课程或题库内容。",
  course: {
    status: "available",
    subjectCount: 5,
    lessonCount: 56,
    lessonCountsBySubject: {
      marx: 19,
      morals: 8,
      history: 10,
      mao: 7,
      "new-era": 12,
    },
  },
  items: [
    {
      id: "xu-tao-main-course",
      label: "徐涛政治强化主课",
      status: "available",
      detail: "目录层观察到五科 56 项，含 3 个阶段测试；本次实际打开并播放了马原导论 1/56，不将目录存在等同于全部播放验证。",
      coveredSubjects: ["marx", "morals", "history", "mao", "new-era"],
    },
    {
      id: "xiao-1000-question-book",
      label: "肖1000题试题分册",
      status: "available",
      detail: "已观察到试题分册文件；未逐页核对页数、缺页或内容完整性。",
      coveredSubjects: ["marx", "morals", "history", "mao", "new-era"],
    },
    {
      id: "xiao-1000-answer-book",
      label: "肖1000题答案解析册",
      status: "available",
      detail: "已观察到答案解析册文件；未逐页核对与试题分册的一一对应性。",
      coveredSubjects: ["marx", "morals", "history", "mao", "new-era"],
    },
    {
      id: "wrong-answer-videos",
      label: "肖1000逐题视频讲解",
      status: "partial",
      detail: "目前逐题视频只覆盖马原和史纲；其余三科应先使用文字解析订正。",
      coveredSubjects: ["marx", "history"],
      missingSubjects: ["morals", "mao", "new-era"],
    },
    {
      id: "quark-access-status",
      label: "夸克当前访问状态",
      status: "partial",
      detail: "目录可查看且导论视频已播放，但页面同时出现账号部分功能受限提示；未验证分享、下载等功能。",
    },
    {
      id: "current-affairs",
      label: "时政专项",
      status: "missing",
      detail: "当前整理目录不足以覆盖考前时政专项，需要在后续阶段单独补齐。",
    },
    {
      id: "sprint-materials",
      label: "冲刺背诵与模拟",
      status: "missing",
      detail: "未形成可审计的冲刺阶段资料包，不应把强化主课当作冲刺材料。",
    },
    {
      id: "past-papers",
      label: "历年真题",
      status: "missing",
      detail: "未观察到完整、按年份整理的历年真题与答案，需要另行补齐。",
    },
  ],
  missingModules: ["current-affairs", "sprint", "past-papers"],
};
