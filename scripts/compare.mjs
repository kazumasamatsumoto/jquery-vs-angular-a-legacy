// パターン A の 2 版(このリポジトリ)と、パターン B(別リポジトリ)に同じ操作をして、結果を表にする。
// 前提: npm run build 済み。手元の Google Chrome を使う(Playwright のブラウザはダウンロードしない)。
// パターン B も比べるときは、jquery-vs-angular-b-recommended を同じフォルダに並べてクローンし、そちらも npm run build しておく。
//   場所が違うときは B_DIR=/path/to/jquery-vs-angular-b-recommended を付ける。
// 使い方: npm run compare   → results/RESULTS.md と results/*.png ができる
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const CYCLES = 5;
const B_DIR = resolve(process.env.B_DIR ?? '../jquery-vs-angular-b-recommended');
const B_SERVER = join(B_DIR, 'dist/jquery-vs-angular-b-recommended/server/server.mjs');

/** SSR サーバーを起動し、ログを取る。 */
function startServer(entry, port) {
  const srv = { base: `http://localhost:${port}`, log: '' };
  srv.proc = spawn(process.execPath, [entry], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.proc.stdout.on('data', (d) => (srv.log += d));
  srv.proc.stderr.on('data', (d) => (srv.log += d));
  return srv;
}

const servers = { a: startServer('dist/jquery-vs-angular-a-legacy/server/server.mjs', process.env.PORT_A ?? 4320) };
if (existsSync(B_SERVER)) servers.b = startServer(B_SERVER, process.env.PORT_B ?? 4321);
else console.log(`パターン B のビルドが見つからないので、A だけ比べます(探した場所: ${B_SERVER})`);
const stop = () => Object.values(servers).forEach((s) => s.proc.kill());
process.on('exit', stop);

const PAGES = [
  { key: 'naive', srv: 'a', path: '/legacy-naive', label: 'A: 無理やり', nav: 'A: 無理やり', frame: '.owl-wrapper-outer', specTab: '[data-testid="tab-spec"]', specPanel: '#tab-spec' },
  { key: 'wrapped', srv: 'a', path: '/legacy-wrapped', label: 'A: 包む', nav: 'A: 包む', frame: '.owl-wrapper-outer', specTab: '[data-testid="tab-spec"]', specPanel: '#tab-spec' },
  { key: 'recommended', srv: 'b', path: '/recommended', label: 'B: 選び直す', nav: 'B: 選び直す(推奨)', frame: '.viewport', specTab: '[data-testid="tab-1"]', specPanel: '[data-testid="tab-panel"]' },
].filter((p) => servers[p.srv]);
/** jQuery UI のタブの中に読み込まれた入れ子のページを除く */
const own = (sel) => `${sel}:not(.ui-tabs-panel ${sel})`;
const SWAPPED_NAMES = ['ヘッドホン', 'スピーカー', 'マイク', 'アンプ', 'ケーブル', 'スタンド'];

mkdirSync('results', { recursive: true });

async function waitForServer(srv) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${srv.base}/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start: ${srv.base}`);
}

const errorsInLog = (srv) => (srv.log.match(/^ERROR/gm) ?? []).length;

async function ssrCheck(srv, path) {
  const before = errorsInLog(srv);
  const res = await fetch(`${srv.base}${path}`);
  const html = await res.text();
  await new Promise((r) => setTimeout(r, 300));
  return {
    status: res.status,
    items: (html.match(/data-testid="carousel-item"/g) ?? []).length,
    serverErrors: errorsInLog(srv) - before,
  };
}

const sumLeftovers = (s) => Object.values(s.leftovers).reduce((a, b) => a + b, 0);

async function run() {
  for (const srv of Object.values(servers)) await waitForServer(srv);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];

  for (const p of PAGES) {
    const BASE = servers[p.srv].base;
    const r = { page: p, base: BASE };

    // 1) SSR: サーバーで描いた HTML
    r.ssr = await ssrCheck(servers[p.srv], p.path);

    // 2) JS を切った状態で商品が見えるか(SSR の HTML と CSS だけで見える範囲)
    {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1200, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'load' });
      r.visibleWithoutJs = await page.locator('[data-testid="carousel-item"]').evaluateAll(
        (els) => els.filter((e) => e.getBoundingClientRect().width > 0).length,
      );
      await page.screenshot({ path: `results/${p.key}-no-js.png` });
      await ctx.close();
    }

    // 3) 直接開いたとき: 画面のずれ(CLS)、ブラウザのエラー、読み込んだ JS
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const loadRequests = [];
    page.on('request', (req) => ['xhr', 'fetch'].includes(req.resourceType()) && loadRequests.push(req.url()));
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    r.loadRequests = [...loadRequests];
    r.cls = await page.evaluate(() => window.__cls);
    r.jsBytes = await page.evaluate(() =>
      performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).reduce((s, e) => s + e.decodedBodySize, 0),
    );
    r.loadErrors = consoleErrors.length;
    r.loadErrorSamples = [...new Set(consoleErrors.map((e) => e.split('\n')[0].slice(0, 160)))].slice(0, 3);
    r.appRoots = await page.evaluate(() => document.querySelectorAll('app-root').length);
    r.carousels = await page.evaluate(() => document.querySelectorAll('[data-testid="carousel"]').length);
    await page.screenshot({ path: `results/${p.key}-loaded.png`, fullPage: true });

    const errorsAtLoad = consoleErrors.length;
    // 4) 「商品を入れ替える」: カルーセルの枠の中に新しい商品が並ぶか
    await page.click(own('[data-testid="swap"]'));
    await page.waitForTimeout(800);
    r.swap = await page.evaluate(
      ({ frame }) => {
        const root = [...document.querySelectorAll('[data-testid="carousel"]')].find((e) => !e.closest('.ui-tabs-panel'));
        const box = root?.querySelector(frame);
        const all = [...(root?.querySelectorAll('[data-testid="carousel-item"] .name') ?? [])].map((e) => e.textContent.trim());
        const inside = [...(box?.querySelectorAll('[data-testid="carousel-item"] .name') ?? [])].map((e) => e.textContent.trim());
        return { inside, outside: all.length - inside.length, emptySlots: box ? box.querySelectorAll('.owl-item:empty').length : 0 };
      },
      { frame: p.frame },
    );
    r.swapOk = SWAPPED_NAMES.every((n) => r.swap.inside.includes(n)) && r.swap.inside.length === SWAPPED_NAMES.length;
    await page.locator(own('[data-testid="carousel"]')).screenshot({ path: `results/${p.key}-after-swap.png` });

    // 5) タブ「仕様」を押す: 本文が出るか、余計な通信が起きるか
    const requests = [];
    const onReq = (req) => ['xhr', 'fetch'].includes(req.resourceType()) && requests.push(req.url());
    page.on('request', onReq);
    await page.click(own(p.specTab));
    await page.waitForTimeout(1200);
    page.off('request', onReq);
    r.tab = await page.evaluate((sel) => {
      const panel = document.querySelector(sel);
      const text = panel?.textContent ?? '';
      return { ok: text.includes('重さ 390 g'), length: text.length, hasNestedPage: document.querySelectorAll('app-root').length > 1 };
    }, p.specPanel);
    r.tabRequests = requests;

    // 6) 日付の入力: CMS の文言に混ぜた HTML が動くか
    await page.click(own('[data-testid="date"]'));
    await page.waitForTimeout(600);
    r.xss = await page.evaluate(() => document.documentElement.dataset.xss === 'executed');
    await page.keyboard.press('Escape');

    r.opErrorSamples = [...new Set(consoleErrors.slice(errorsAtLoad).map((e) => e.split('\n')[0].slice(0, 160)))].slice(0, 3);
    // 7) 変更検知の回数(何もしない 3 秒間)
    const cd0 = await page.evaluate(() => window.__lab.changeDetections);
    await page.waitForTimeout(3000);
    r.cdPerSec = ((await page.evaluate(() => window.__lab.changeDetections)) - cd0) / 3;
    await ctx.close();

    // 8) 行き来の漏れ: トップを直接開き、トップ ↔ ページをリンクで 5 往復して、トップで数える
    {
      const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      const page2 = await ctx2.newPage();
      await page2.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      const snap = () => page2.evaluate(() => window.__lab.snapshot());
      const base = await snap();
      const series = [];
      for (let i = 0; i < CYCLES; i++) {
        await page2.click(`nav >> text="${p.nav}"`);
        await page2.waitForSelector('[data-testid="carousel-item"]');
        await page2.waitForTimeout(400);
        await page2.click('[data-testid="nav-home"]');
        await page2.waitForTimeout(400);
        series.push(await snap());
      }
      r.leak = { base, series };
      await ctx2.close();
    }
    rows.push(r);
    console.log(`done: ${p.label}`);
  }
  await browser.close();
  stop();
  writeResults(rows);
}

function writeResults(rows) {
  const L = [];
  const col = (f) => rows.map(f).join(' | ');
  const head = `| 項目 | ${rows.map((r) => r.page.label).join(' | ')} |`;
  const sep = `|---|${rows.map(() => '---').join('|')}|`;
  const growth = (r, f) => {
    const s = r.leak.series.map(f);
    return `${f(r.leak.base)} → ${s.join(' → ')}`;
  };

  L.push('# 比較結果', '', `実行日時: ${new Date().toISOString()} / 行き来の回数: ${CYCLES} 往復 / ブラウザ: 手元の Google Chrome(headless)`, '');
  L.push('## 1. 直接開いたとき(SSR)', '', head, sep);
  L.push(`| HTTP ステータス | ${col((r) => r.ssr.status)} |`);
  L.push(`| サーバーのログに出たエラー(1 回開くごと) | ${col((r) => r.ssr.serverErrors)} |`);
  L.push(`| SSR の HTML に入っている商品 | ${col((r) => r.ssr.items)} |`);
  L.push(`| JS を切ったときに見える商品 | ${col((r) => r.visibleWithoutJs)} |`);
  L.push(`| 画面のずれ CLS(小さいほどよい。0.1 以下が目安) | ${col((r) => r.cls.toFixed(3))} |`);
  L.push(`| 読み込んだ JS(展開後) | ${col((r) => `${Math.round(r.jsBytes / 1024)} KB`)} |`);
  L.push(`| ブラウザのコンソールのエラー | ${col((r) => r.loadErrors)} |`);
  L.push(`| 開いた直後に起きた Ajax 通信 | ${col((r) => (r.loadRequests.length ? r.loadRequests.map((u) => u.replace(r.base, '')).join(' ') : 'なし'))} |`);
  L.push(`| 開いた直後の app-root の数(1 が正常) | ${col((r) => r.appRoots)} |`);
  L.push(`| 開いた直後のカルーセルの数(1 が正常) | ${col((r) => r.carousels)} |`);
  L.push('', '## 2. 操作したとき', '', head, sep);
  L.push(`| 「商品を入れ替える」でカルーセルの枠の中が新しい商品になる | ${col((r) => (r.swapOk ? 'なる' : 'ならない'))} |`);
  L.push(`| 入れ替え後、枠の中にある商品 | ${col((r) => r.swap.inside.join('、') || '(なし)')} |`);
  L.push(`| 入れ替え後、枠の外にはみ出した商品 | ${col((r) => r.swap.outside)} |`);
  L.push(`| 入れ替え後、中身が空になった owl の枠 | ${col((r) => r.swap.emptySlots)} |`);
  L.push(`| タブ「仕様」の本文が出る | ${col((r) => (r.tab.ok ? '出る' : '出ない'))} |`);
  L.push(`| タブを押したときの Ajax 通信 | ${col((r) => (r.tabRequests.length ? r.tabRequests.map((u) => u.replace(r.base, '')).join(' ') : 'なし'))} |`);
  L.push(`| タブの中に別のページが丸ごと入った | ${col((r) => (r.tab.hasNestedPage ? 'はい' : 'いいえ'))} |`);
  L.push(`| CMS の文言に混ぜた HTML が動いた(XSS) | ${col((r) => (r.xss ? '動いた' : '動かない'))} |`);
  L.push(`| 何もしないときの変更検知 / 秒 | ${col((r) => r.cdPerSec.toFixed(1))} |`);
  L.push('', `## 3. トップ ↔ ページを ${CYCLES} 往復したあと(トップで数える)`, '', '左端が往復前、矢印の先が 1 往復ごとの値です。最初の 1 往復で増えるのは、ページの部品やルーターの読み込みによるもので、どの版でも同じです。2 往復目以降も増え続けるかを見ます。', '', head, sep);
  L.push(`| window のリスナー | ${col((r) => growth(r, (s) => s.windowListeners))} |`);
  L.push(`| jQuery 内部のハンドラ(window) | ${col((r) => growth(r, (s) => s.jqueryWindowHandlers))} |`);
  L.push(`| jQuery 内部のハンドラ(document) | ${col((r) => growth(r, (s) => s.jqueryDocumentHandlers))} |`);
  L.push(`| 動いている setInterval | ${col((r) => growth(r, (s) => s.intervals))} |`);
  L.push(`| アプリの外に残った部品 | ${col((r) => growth(r, sumLeftovers))} |`);
  L.push(`| DOM の要素数 | ${col((r) => growth(r, (s) => s.domNodes))} |`);
  L.push('', '## コンソールのエラー(先頭 3 種)', '', '404 は、XSS の目印に使った `<img src="x">` が `/x` を読みに行ったものです(XSS が動いた版でだけ出ます)。', '');
  const fmt = (list) => (list.length ? list.map((e) => '`' + e.replace(/`/g, "'") + '`').join(' / ') : 'なし');
  for (const r of rows) L.push(`- ${r.page.label}: 開いたとき ${fmt(r.loadErrorSamples)}。操作中 ${fmt(r.opErrorSamples)}`);
  L.push('', '画像: `results/<版>-loaded.png`(直接開いた直後の全体)、`results/<版>-no-js.png`(JS を切ったとき)、`results/<版>-after-swap.png`(入れ替え後のカルーセル)。', '');
  writeFileSync('results/RESULTS.md', L.join('\n'));
  console.log('\n' + L.join('\n'));
}

run().catch((e) => {
  console.error(e);
  stop();
  process.exit(1);
});
