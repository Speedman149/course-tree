import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PROGRESS_KEY } from '../src/lib/progress';

const sap = JSON.parse(readFileSync(new URL('../public/data/courses.json', import.meta.url), 'utf8'));
const catalogs = JSON.parse(readFileSync(new URL('../public/data/catalogs.json', import.meta.url), 'utf8'));
const test = base.extend<{ securityRuntime: void }>({
  securityRuntime: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://formspree.io/**', route => route.abort());
    await page.addInitScript(() => { (window as any).__xss = 0; });
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});
const payload = '<img src=x onerror="window.__xss=1"> ∫ קורס';

test('HTML-like course, faculty, catalog and group names render as literal text', async ({ page }) => {
  const data = structuredClone(sap);
  const root = data.courses.find((course: any) => course.id === '02340114');
  root.name = payload;
  root.faculty = payload;
  const cat = structuredClone(catalogs);
  const program = cat.programs.find((program: any) => program.catalogYear === '2025-2026' && program.electiveGroups.length);
  program.officialName = payload;
  program.track = undefined;
  program.electiveGroups[0].name = payload;
  await page.route('**/data/courses.json', route => route.fulfill({ json: data }));
  await page.route('**/data/catalogs.json', route => route.fulfill({ json: cat }));
  await page.goto('/');
  await expect(page.locator('.root-node .node-name')).toHaveText(payload);
  const search = page.locator('.desktop-course-search .search-input');
  await search.fill('02340114');
  await expect(page.getByRole('option').filter({ hasText: '02340114' })).toContainText(payload);
  await search.press('Escape');
  await page.getByRole('button', { name: 'פתיחת מסנני המפה' }).click();
  await page.getByRole('tab', { name: /קטלוג תואר/ }).click();
  await page.getByRole('textbox', { name: 'חיפוש תואר', exact: true }).fill(payload);
  await page.locator('.catalog-option').click();
  await expect(page.locator('.catalog-details h3')).toHaveText(payload);
  await expect(page.locator('.catalog-details summary').filter({ hasText: payload })).toHaveCount(1);
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
});

test('script-like search, course query and unknown hash remain safe', async ({ page }) => {
  await page.goto('/?course=' + encodeURIComponent('javascript:window.__xss=1') + '#/about<img>');
  await expect(page.locator('.root-node .course-link')).toHaveText('02340114');
  const search = page.locator('.desktop-course-search .search-input');
  await search.fill(payload);
  await expect(page.getByText('לא נמצאו קורסים', { exact: true })).toBeVisible();
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
  await page.goto('/?course=' + '0'.repeat(2000));
  await expect(page.locator('.root-node .course-link')).toHaveText('02340114');
});

for (const scenario of ['bad JSON', 'wrong name type', 'duplicate ID', 'dangerous URL', 'deep prerequisite']) {
  test('invalid course payload recovers to load error for ' + scenario, async ({ page }) => {
    const data = structuredClone(sap);
    if (scenario === 'wrong name type') data.courses[0].name = {};
    if (scenario === 'duplicate ID') data.courses.push(structuredClone(data.courses[0]));
    if (scenario === 'dangerous URL') data.courses[0].source.url = 'javascript:window.__xss=1';
    if (scenario === 'deep prerequisite') {
      let rule: any = { type: 'course', courseId: '02340114', relation: 'strong' };
      for (let i = 0; i < 200; i++) rule = { type: 'and', items: [rule] };
      data.courses[0].requirements = rule;
    }
    await page.route('**/data/courses.json', route => scenario === 'bad JSON' ? route.fulfill({ body: '{broken', contentType: 'application/json' }) : route.fulfill({ json: data }));
    await page.goto('/');
    await expect(page.locator('.loading-state button')).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
  });
}

test('invalid catalog metadata preserves the working graph and saved markings', async ({ page }) => {
  const cat = structuredClone(catalogs);
  cat.meta.years = {};
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 2, progress: { rootId: '02340114', markedCourseIds: ['02340114'], expandedForward: ['root'] } })), PROGRESS_KEY);
  await page.route('**/data/catalogs.json', route => route.fulfill({ json: cat }));
  await page.goto('/');
  await expect(page.locator('.root-node.user-marked')).toBeVisible();
  await page.getByRole('button', { name: 'פתיחת מסנני המפה' }).click();
  await page.getByRole('tab', { name: /קטלוג תואר/ }).click();
  await expect(page.locator('.catalog-option')).toHaveCount(0);
});

test('hostile storage fields retain a valid root and mark without prototype changes', async ({ page }) => {
  await page.addInitScript(key => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
    Object.assign(hostile, { rootId: '02340114', expandedForward: ['root', {}, 'root/f:__proto__:strong'], expandedBackward: ['bad', ['root', [{}]]], markedCourseIds: ['02340114', {}, '__proto__'], viewport: { x: 'oops', y: 0, zoom: -10 }, facultyIds: null });
    localStorage.setItem(key, JSON.stringify({ version: 2, progress: hostile }));
  }, PROGRESS_KEY);
  await page.goto('/');
  await expect(page.locator('.root-node.user-marked')).toBeVisible();
  await expect(page.locator('.canvas-controls')).toBeVisible();
  expect(await page.evaluate(() => ({} as any).polluted)).toBeUndefined();
});

test('security headers are present and development files are absent from production output', async ({ request }) => {
  for (const path of ['/', '/feedback', '/feedback/', '/data/courses.json']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
  }
  const html = await (await request.get('/')).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]);
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) expect((await request.get(script + '.map')).status()).toBe(404);
  for (const path of ['/.env', '/.git/config', '/src/App.tsx', '/package.json', '/vite.config.ts', '/SECURITY_AUDIT.md', '/@vite/client']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('enforced CSP blocks inline JavaScript while graph controls remain functional', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__violations = [];
    document.addEventListener('securitypolicyviolation', event => (window as any).__violations.push(event.violatedDirective));
  });
  await page.goto('/');
  await expect(page.locator('.root-node')).toBeVisible();
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__xss=1';
    document.body.append(script);
  });
  expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__violations)).toContain('script-src-elem');
  await page.locator('.root-node .expand-button').focus();
  await page.locator('.root-node .expand-button').press('Enter');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await page.locator('.root-node .expand-button').focus();
  await page.locator('.root-node .expand-button').press('Enter');
  expect(await page.locator('.react-flow__node').count()).toBeGreaterThan(1);
});

test('Analytics still loads from same origin and applies URL redaction under CSP', async ({ page }) => {
  await page.route('**/_vercel/insights/script.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: "const entry=window.vaq.find(item=>item[0]==='beforeSend');window.__analyticsResult=entry[1]({type:'pageview',url:location.href});",
  }));
  await page.goto('/feedback?email=private@example.com&token=secret#private');
  await expect.poll(() => page.evaluate(() => (window as any).__analyticsResult?.url)).toMatch(/\/feedback$/);
  const result = await page.evaluate(() => (window as any).__analyticsResult);
  expect(JSON.stringify(result)).not.toMatch(/private|secret|email|token/);
});

test('malicious feedback text and malformed responses stay inert and duplicate submits are guarded', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://formspree.io/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': '*' } });
    requests++;
    await pending;
    await route.fulfill({ status: 422, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"errors":[null]}' });
  });
  await page.goto('/feedback');
  await page.getByLabel('סוג המשוב').selectOption('bug');
  await page.locator('#feedback-description').fill(payload);
  await page.getByRole('button', { name: 'שליחת משוב', exact: true }).click();
  await page.locator('form').evaluate(form => { for (let i = 0; i < 10; i++) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(page.locator('.feedback-error-summary')).toBeVisible();
  await expect(page.locator('#feedback-description')).toHaveValue(payload);
  await expect(page.locator('.feedback-success')).toHaveCount(0);
  await expect(page.locator('img[src=x]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBe(0);
});

test('a large shared saved graph deduplicates and can collapse without losing markings', async ({ page }) => {
  test.setTimeout(90_000);
  const root = '00000001';
  const parents = Array.from({ length: 50 }, (_, i) => String(i + 100).padStart(8, '0'));
  const leaves = Array.from({ length: 50 }, (_, i) => String(i + 1000).padStart(8, '0'));
  const leaf = (id: string) => ({ type: 'course', courseId: id, relation: 'strong' });
  const course = (id: string, requirements: any = null) => ({ id, name: 'קורס בדיקת עומס ' + id, faculty: 'הפקולטה למדעי המחשב', requirements, requirementsStatus: requirements ? 'known' : 'none', source: { url: 'https://portalex.technion.ac.il/' } });
  const data = { meta: {}, courses: [course(root), ...parents.map(id => course(id, leaf(root))), ...leaves.map(id => course(id, { type: 'and', items: parents.map(leaf) }))] };
  await page.route('**/data/courses.json', route => route.fulfill({ json: data }));
  await page.addInitScript(({ key, root, parents }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, progress: { rootId: root, expandedForward: ['root', ...parents.map(id => 'root/f:' + id + ':strong')], markedCourseIds: [root] } }));
  }, { key: PROGRESS_KEY, root, parents });
  await page.goto('/?course=' + root);
  await expect(page.locator('.react-flow__node')).toHaveCount(101, { timeout: 60_000 });
  expect(await page.locator('.react-flow__node').evaluateAll(nodes => new Set(nodes.map(node => node.getAttribute('data-id'))).size)).toBe(101);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2550);
  // This complete canonical graph fits the emergency budget; no partial-graph warning is warranted.
  await expect(page.getByText('המפה גדולה מאוד, ולכן מוצג חלק ממנה.', { exact: false })).toHaveCount(0);
  const toggle = page.locator('.root-node .expand-button');
  await toggle.focus();
  await toggle.press('Enter');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.root-node.user-marked')).toBeVisible();
});
