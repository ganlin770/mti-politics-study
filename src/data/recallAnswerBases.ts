import type { PoliticsRecallAnswerBasis, PoliticsSubjectId } from '../types';

export const POLITICS_RECALL_ANSWER_BASES: PoliticsRecallAnswerBasis[] = [
  {
    id: 'hep-marx-2023',
    subject: 'marx',
    title: '马克思主义基本原理',
    edition: '2023年版',
    publisher: '高等教育出版社',
    url: 'https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=65564e7f74ce561611bd988f',
  },
  {
    id: 'hep-morals-2023',
    subject: 'morals',
    title: '思想道德与法治',
    edition: '2023年版',
    publisher: '高等教育出版社',
    url: 'https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=65579e3374ce561611bd9891',
  },
  {
    id: 'hep-history-2023',
    subject: 'history',
    title: '中国近现代史纲要',
    edition: '2023年版',
    publisher: '高等教育出版社',
    url: 'https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=65564c2374ce561611bd9883',
  },
  {
    id: 'hep-mao-2023',
    subject: 'mao',
    title: '毛泽东思想和中国特色社会主义理论体系概论',
    edition: '2023年版',
    publisher: '高等教育出版社',
    url: 'https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=65564c9574ce561611bd988b',
  },
  {
    id: 'hep-new-era-2023',
    subject: 'new-era',
    title: '习近平新时代中国特色社会主义思想概论',
    edition: '2023年首版',
    publisher: '高等教育出版社',
    url: 'https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=64d518c9938b7cc2960f0bbe',
    supplementalTitle: '习近平新时代中国特色社会主义思想学习纲要（2023年版）',
    supplementalUrl: 'https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/2023/2023_zt04/yw/202304/t20230407_1054670.html',
  },
];

export const RECALL_ANSWER_BASIS_BY_ID = Object.fromEntries(
  POLITICS_RECALL_ANSWER_BASES.map((basis) => [basis.id, basis]),
) as Record<string, PoliticsRecallAnswerBasis>;

export const RECALL_ANSWER_BASIS_ID_BY_SUBJECT: Record<PoliticsSubjectId, string> = {
  marx: 'hep-marx-2023',
  morals: 'hep-morals-2023',
  history: 'hep-history-2023',
  mao: 'hep-mao-2023',
  'new-era': 'hep-new-era-2023',
};
