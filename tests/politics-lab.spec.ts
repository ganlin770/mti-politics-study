import { expect, test, type Page } from '@playwright/test';

async function openPrimarySection(page: Page, projectName: string, name: '练题' | '审计') {
  if (projectName.startsWith('mobile')) {
    await page.getByRole('button', { name: '打开菜单' }).click();
    const mobileMenu = page.getByRole('dialog', { name: '研政' });
    await expect(mobileMenu).toBeVisible();
    await mobileMenu.getByRole('link', { name: name === '练题' ? '练题中心' : '资料审计' }).click();
    return;
  }

  const desktopNav = page.getByRole('navigation', { name: '主导航' });
  await desktopNav.getByRole('link', { name: name === '练题' ? '练题中心' : '资料审计' }).click();
}

async function openRecall(page: Page, projectName: string) {
  if (projectName.startsWith('mobile')) {
    await page.getByRole('button', { name: '打开菜单' }).click();
    const mobileMenu = page.getByRole('dialog', { name: '研政' });
    await mobileMenu.getByRole('link', { name: '政治抽背' }).click();
    return;
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '政治抽背' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('renders the study-first home screen at desktop and mobile sizes', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await expect(page).toHaveTitle(/研政/);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: '今天，从马原导论开始' })).toBeVisible();
  await expect(page.getByTestId('today-chain')).toContainText('马原 · 导论');
  await expect(page.getByRole('navigation', { name: '今日快捷入口' })).toContainText('做题 · 9题');
  await expect(page.getByText('5 科 56 项')).toBeVisible();
  await expect(page.getByTestId('course-link')).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('course-link')).toHaveAttribute('href', /^https:\/\/pan\.quark\.cn\//);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);

  if (testInfo.project.name.startsWith('mobile')) {
    await expect(page.getByRole('button', { name: '打开菜单' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '手机主导航' })).toHaveCount(0);
  } else {
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  }

  expect(consoleErrors).toEqual([]);
});

test('navigates, answers an original question, and exposes the audited resource gaps', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openPrimarySection(page, testInfo.project.name, '练题');
  await expect(page).toHaveURL(/#\/practice$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: '练题中心' })).toBeVisible();
  const firstQuestion = page.getByTestId('marx-01-original-01');
  await expect(firstQuestion.getByText('原创定位自测（非肖1000、非历年真题）')).toBeVisible();

  await page.getByTestId('marx-01-original-01-option-A').click();
  await firstQuestion.getByRole('button', { name: '提交答案' }).click();
  await expect(firstQuestion.getByText('回答正确')).toBeVisible();
  await expect(firstQuestion.locator('.explanation')).toContainText('三个基本组成部分');

  await openPrimarySection(page, testInfo.project.name, '审计');
  await expect(page).toHaveURL(/#\/audit$/);
  await expect(page.getByRole('heading', { name: '资料审计' })).toBeVisible();
  await expect(page.locator('.audit-overview')).toContainText('关键缺口');
  await expect(page.locator('.audit-overview')).toContainText('时政、冲刺、历年真题');
  await expect(page.getByTestId('audit-wrong-answer-videos')).toBeVisible();
  await expect(page.locator('[data-audit-status="missing"]')).toHaveCount(3);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('keeps a later active lesson aligned with its external practice log', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    localStorage.setItem('politics-lab-state-v1:guest', JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: new Date().toISOString(),
      startedOn: '2026-07-28',
      activeLessonId: 'marx-02',
      lessons: {},
      quizAttempts: {},
      practiceLogs: [],
      dailyMinutes: {},
    }));
  });
  await page.reload();
  await openPrimarySection(page, testInfo.project.name, '练题');

  await expect(page.getByTestId('external-practice-log')).toContainText('哲学及其基本问题 · 肖1000账本');
  await expect(page.locator('input[name="rangeLabel"]')).toHaveValue('哲学及其基本问题：完成对应章节选择题');
  await page.locator('textarea[name="wrongReason"]').fill('我混淆了哲学基本问题的两个方面，需要重新区分并核对概念。');
  await page.locator('textarea[name="framework"]').fill('哲学基本问题包含思维和存在何者为第一性，以及思维能否正确认识存在两个方面，对应不同理论立场。');
  await page.getByRole('button', { name: '保存练习证据' }).click();
  await expect(page.getByRole('status')).toContainText('已达到今日通关证据');
});

test('recovers from malformed legacy local progress instead of blanking the app', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('politics-lab-state-v1:guest', JSON.stringify({
      schemaVersion: 1,
      activeLessonId: 'missing-lesson',
      lessons: { 'marx-01': null },
      quizAttempts: { broken: null },
      practiceLogs: [{ id: 'bad', lessonId: 'marx-01', wrongReason: null }],
      dailyMinutes: { nope: 'many' },
    }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '今天，从马原导论开始' })).toBeVisible();
  await expect(page.getByTestId('today-chain')).toContainText('马原 · 导论');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('runs the politics recall loop and persists the wrong-card queue', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await openRecall(page, testInfo.project.name);
  await expect(page).toHaveURL(/#\/recall$/);
  await expect(page.getByRole('heading', { name: '政治抽背' })).toBeVisible();
  await expect(page.getByTestId('recall-workspace')).toContainText('马克思主义最鲜明的政治立场是什么？');
  await expect(page.getByText('原创核心抽背（非肖1000、非历年真题）')).toBeVisible();
  await expect(page.getByTestId('recall-answer')).toHaveCount(0);

  await page.getByTestId('reveal-answer').click();
  await expect(page.getByTestId('recall-answer')).toContainText('人民群众的根本利益');
  await page.getByTestId('recall-again').click();
  await expect(page.getByTestId('recall-workspace')).toContainText('哲学基本问题包含哪两个方面？');

  await page.getByRole('button', { name: /错题卡/ }).click();
  await expect(page.getByTestId('recall-workspace')).toContainText('马克思主义最鲜明的政治立场是什么？');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('politics-lab-state-v1:guest') || '{}'));
  expect(persisted.recallProgress['recall-marx-01']).toMatchObject({ lastRating: 'again', dueOn: expect.any(String) });

  await page.reload();
  await expect(page.getByTestId('recall-workspace')).toContainText('马克思主义最鲜明的政治立场是什么？');
  await expect(page.getByTestId('recall-answer')).toHaveCount(0);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('keeps skip-link focus inside the current route and exposes reliable navigation controls', async ({ page }, testInfo) => {
  await openPrimarySection(page, testInfo.project.name, '练题');
  await expect(page).toHaveURL(/#\/practice$/);

  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/practice$/);
  await expect(page.locator('#main-content')).toBeFocused();

  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: '打开菜单' }).click();
    const dialog = page.getByRole('dialog', { name: '研政' });
    await expect(dialog.getByRole('navigation', { name: '手机主导航' })).toBeVisible();
    await dialog.getByRole('button', { name: '关闭菜单' }).click();
    await expect(dialog).toHaveCount(0);
  } else {
    const sidebar = page.getByRole('complementary', { name: '研政侧栏' });
    await sidebar.getByRole('button', { name: '收起侧栏' }).click();
    await expect(sidebar.getByRole('button', { name: '展开侧栏' })).toBeVisible();
  }
});
