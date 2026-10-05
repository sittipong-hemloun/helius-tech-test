import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = process.argv[2] ? resolve(process.argv[2]) : resolve(here, 'employee-console-learn.pdf');

const { chromium } = createRequire(resolve(repo, 'tests/e2e/package.json'))('@playwright/test');

const ORDER = [
  'README', '01-big-picture', '02-nestjs', '03-database-prisma', '04-openapi', '05-docker',
  '06-key-concepts', '07-testing', '08-docs-guide', '09-qa-prep', 'glossary',
];
const EXPECTED_DIAGRAMS = 17;

const chapters = ORDER.map((name) => {
  let md = readFileSync(resolve(here, `${name}.md`), 'utf8');
  if (name === 'README') {
    md = md.replace(/## วิธีดูภาพในคู่มือ\n[\s\S]*?(?=\n## )/, '');
    md = md.replace(/- ลิงก์ไปไฟล์โค้ดกดเปิดได้ เช่น .*\n/, '- ชื่อไฟล์โค้ดแสดงเป็น path จาก root ของ repo เช่น `apps/api/src/employees/employees.controller.ts`\n');
  }
  return { name, md };
});
const totalDiagrams = chapters.reduce((n, c) => n + (c.md.match(/^```mermaid$/gm) ?? []).length, 0);
if (totalDiagrams !== EXPECTED_DIAGRAMS) throw new Error(`expected ${EXPECTED_DIAGRAMS} mermaid blocks, found ${totalDiagrams}`);

const sha = execSync('git rev-parse --short HEAD', { cwd: repo, encoding: 'utf8' }).trim();
const css = readFileSync(resolve(here, 'style.css'), 'utf8');

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=block" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked@15/lib/marked.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>${css}</style></head>
<body>
<section class="cover">
  <div class="cover-kicker">Employee Console</div>
  <h1 class="cover-title">คู่มือเรียนรู้ฉบับมือใหม่</h1>
  <p class="cover-sub">NestJS · Prisma · OpenAPI · Docker · การทดสอบ · เตรียมตอบคำถาม</p>
  <table class="cover-meta">
    <tr><th>ที่มา</th><td><code>docs/learn/</code> (${chapters.length} ไฟล์)</td></tr>
    <tr><th>Commit</th><td><code>${sha}</code></td></tr>
    <tr><th>สร้างเมื่อ</th><td>5 ตุลาคม 2026</td></tr>
  </table>
  <p class="cover-note">ฉบับ PDF แปลงจาก Markdown — ถ้าเนื้อหาไม่ตรงกับไฟล์ใน repo ให้ยึดไฟล์ใน repo</p>
</section>
<main id="book"></main>
<script id="chapters" type="application/json">${JSON.stringify(chapters).replace(/</g, '\\u003c')}</script>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 120_000 });
  const result = await page.evaluate(async (expected) => {
    const FONT = '"IBM Plex Sans Thai"';
    const chapters = JSON.parse(document.getElementById('chapters').textContent);
    const book = document.getElementById('book');

    const TITLES = {
      README: 'คำนำ',
      '01-big-picture': 'บทที่ 1',
      '02-nestjs': 'บทที่ 2',
      '03-database-prisma': 'บทที่ 3',
      '04-openapi': 'บทที่ 4',
      '05-docker': 'บทที่ 5',
      '06-key-concepts': 'บทที่ 6',
      '07-testing': 'บทที่ 7',
      '08-docs-guide': 'บทที่ 8',
      '09-qa-prep': 'บทที่ 9',
      glossary: 'ภาคผนวก',
    };

    chapters.forEach((ch, idx) => {
      const sec = document.createElement('section');
      sec.className = 'chapter';
      sec.id = `ch-${ch.name}`;

      const raw = marked.parse(ch.md);
      sec.innerHTML = raw;

      // 1. Chapter title wrapping
      const h1 = sec.querySelector('h1');
      if (h1) {
        const header = document.createElement('header');
        header.className = 'chapter-header';
        h1.before(header);
        const label = document.createElement('div');
        label.className = 'chapter-label';
        label.textContent = TITLES[ch.name] ?? `บทที่ ${idx}`;
        header.append(label, h1);
      }

      // Rewrite relative file links to plain text paths
      for (const a of sec.querySelectorAll('a')) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('http://') || href.startsWith('https://')) continue;
        const target = decodeURI(href.replace(/#.*$/, ''));
        let path = '';
        if (target.startsWith('../../')) path = target.replace('../../', '');
        else if (target.startsWith('../')) path = `docs/${target.replace('../', '')}`;
        else if (target.endsWith('.md')) path = `docs/learn/${target}`;
        else continue;
        const span = document.createElement('span');
        span.className = 'ref';
        span.append(...a.childNodes);
        if (span.textContent.trim() !== path) {
          const p = document.createElement('span');
          p.className = 'ref-path';
          p.textContent = `(${path})`;
          span.append(' ', p);
        }
        a.replaceWith(span);
      }

      // Convert mermaid pre>code blocks to div.mermaid
      for (const code of sec.querySelectorAll('pre > code.language-mermaid')) {
        const fig = document.createElement('div');
        fig.className = 'mermaid';
        fig.textContent = code.textContent;
        code.parentElement.replaceWith(fig);
      }

      // 2. Mark short tables (<= 14 rows) to avoid breaking inside
      for (const table of sec.querySelectorAll('table')) {
        const rowCount = table.querySelectorAll('tr').length;
        if (rowCount <= 14) {
          table.classList.add('table-keep');
        }
      }

      // 3. Chapter 8: Group each document entry into a .doc-entry card
      if (ch.name === '08-docs-guide') {
        const h2s = [...sec.querySelectorAll('h2')];
        for (const h2 of h2s) {
          const card = document.createElement('article');
          card.className = 'doc-entry';
          h2.before(card);
          card.append(h2);
          while (card.nextElementSibling && !['H2', 'H1'].includes(card.nextElementSibling.tagName)) {
            card.append(card.nextElementSibling);
          }
        }
      }

      // 4. Chapter 9: Group each Q&A question into a .qa-entry card
      if (ch.name === '09-qa-prep') {
        const h3s = [...sec.querySelectorAll('h3')];
        for (const h3 of h3s) {
          const card = document.createElement('article');
          card.className = 'qa-entry';
          h3.before(card);
          card.append(h3);
          while (card.nextElementSibling && !['H3', 'H2', 'H1'].includes(card.nextElementSibling.tagName)) {
            card.append(card.nextElementSibling);
          }
        }
      }

      // 5. Keep Headings together with their diagrams
      for (const heading of [...sec.querySelectorAll('h2, h3, h4')]) {
        if (heading.parentElement.classList.contains('doc-entry') ||
            heading.parentElement.classList.contains('qa-entry')) continue;
        const next = heading.nextElementSibling;
        if (!next) continue;

        if (next.classList.contains('mermaid')) {
          const wrap = document.createElement('div');
          wrap.className = 'figure-block';
          heading.before(wrap);
          wrap.append(heading, next);
        } else if (next.tagName === 'P' && next.textContent.length < 250 && next.nextElementSibling?.classList.contains('mermaid')) {
          const diagram = next.nextElementSibling;
          const wrap = document.createElement('div');
          wrap.className = 'figure-block';
          heading.before(wrap);
          wrap.append(heading, next, diagram);
        }
      }

      // 6. Keep Headings together with short code blocks or tables
      for (const heading of [...sec.querySelectorAll('h2, h3, h4')]) {
        if (heading.parentElement.classList.contains('figure-block') ||
            heading.parentElement.classList.contains('keep-together') ||
            heading.parentElement.classList.contains('doc-entry') ||
            heading.parentElement.classList.contains('qa-entry')) continue;
        const next = heading.nextElementSibling;
        if (!next) continue;

        if (next.tagName === 'PRE' || next.classList.contains('table-keep')) {
          const wrap = document.createElement('div');
          wrap.className = 'keep-together';
          heading.before(wrap);
          wrap.append(heading, next);
        } else if (['P', 'OL', 'UL'].includes(next.tagName) && next.textContent.length < 250) {
          const afterNext = next.nextElementSibling;
          if (afterNext && (afterNext.tagName === 'PRE' || afterNext.classList.contains('table-keep'))) {
            const wrap = document.createElement('div');
            wrap.className = 'keep-together';
            heading.before(wrap);
            wrap.append(heading, next, afterNext);
          }
        }
      }

      // 7. Group command snippets
      for (const p of [...sec.querySelectorAll('p')]) {
        if (p.parentElement.classList.contains('keep-together') ||
            p.parentElement.classList.contains('doc-entry') ||
            p.parentElement.classList.contains('qa-entry') ||
            p.parentElement.classList.contains('figure-block')) continue;
        const next = p.nextElementSibling;
        if (next && next.tagName === 'PRE' && p.textContent.length < 120) {
          const wrap = document.createElement('div');
          wrap.className = 'command-unit';
          p.before(wrap);
          wrap.append(p, next);
        }
      }

      // 8. Prevent orphan chapter conclusion ("ต่อไป: บท X")
      for (const p of [...sec.querySelectorAll('p')]) {
        if (/^ต่อไป:\s*\[?บท/i.test(p.textContent.trim())) {
          p.classList.add('chapter-nav');
          const prev = p.previousElementSibling;
          if (prev && !prev.classList.contains('chapter-nav') &&
              !prev.classList.contains('chapter-outro')) {
            const wrap = document.createElement('div');
            wrap.className = 'chapter-outro keep-together';
            p.before(wrap);
            wrap.append(prev, p);
          }
        }
      }

      // 9. For any remaining headings: bind to next element with .heading-lead
      for (const heading of [...sec.querySelectorAll('h2, h3, h4')]) {
        if (heading.parentElement.classList.contains('figure-block') ||
            heading.parentElement.classList.contains('keep-together') ||
            heading.parentElement.classList.contains('doc-entry') ||
            heading.parentElement.classList.contains('qa-entry') ||
            heading.parentElement.classList.contains('command-unit') ||
            heading.parentElement.classList.contains('chapter-outro') ||
            heading.parentElement.classList.contains('heading-lead')) continue;
        const next = heading.nextElementSibling;
        if (next && ['P', 'UL', 'OL', 'BLOCKQUOTE'].includes(next.tagName)) {
          const lead = document.createElement('div');
          lead.className = 'heading-lead';
          heading.before(lead);
          lead.append(heading, next);
        }
      }

      book.append(sec);
    });

    const FONT_PX = 14;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: `${FONT}, sans-serif`,
      themeVariables: { fontFamily: `${FONT}, sans-serif`, fontSize: `${FONT_PX}px` },
      flowchart: { useMaxWidth: true, htmlLabels: true, nodeSpacing: 22, rankSpacing: 22 },
      sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 14, width: 105, boxMargin: 5, messageMargin: 16, wrap: true },
      er: { useMaxWidth: true },
    });
    const figs = [...document.querySelectorAll('.mermaid')];
    for (const fig of figs) fig.dataset.src = fig.textContent;
    await mermaid.run({ nodes: figs });

    const BOX_W = 646, BOX_H = 740;
    const scaleOf = (svg) => {
      const vb = svg.viewBox.baseVal;
      return Math.min(1, BOX_W / vb.width, BOX_H / vb.height);
    };
    const variants = (src) => {
      const flow = /^(\s*(?:flowchart|graph)\s+)(LR|RL|TB|TD|BT)\b/;
      const m = src.match(flow);
      const compact = '%%{init: {"flowchart": {"nodeSpacing": 16, "rankSpacing": 18}}}%%\n';
      if (m) {
        const other = src.replace(flow, `$1${/LR|RL/.test(m[2]) ? 'TB' : 'LR'}`);
        return [other, compact + src, compact + other];
      }
      if (/^\s*erDiagram\b/.test(src)) return ['LR', 'TB'].map((d) => src.replace(/^(\s*erDiagram\b)/, `$1\n    direction ${d}`));
      return [];
    };
    const report = [];
    let n = 0;
    for (const fig of figs) {
      let current = fig;
      let scale = scaleOf(fig.querySelector('svg'));
      const chapter = fig.closest('.chapter').id;
      let variant = 'as written';
      if (scale < 0.8) {
        for (const [k, alt] of variants(fig.dataset.src).entries()) {
          let svg;
          try { ({ svg } = await mermaid.render(`alt-${n}-${k}`, alt)); } catch { continue; }
          const probe = document.createElement('div');
          probe.className = 'mermaid';
          probe.innerHTML = svg;
          current.after(probe);
          const altScale = scaleOf(probe.querySelector('svg'));
          if (altScale > scale * 1.15) { current.remove(); current = probe; scale = altScale; variant = `alt ${k}`; }
          else probe.remove();
        }
      }
      report.push({ chapter, i: n++, textPt: +(FONT_PX * scale * 0.75).toFixed(1), variant });
    }

    const svgs = [...document.querySelectorAll('.mermaid svg')];
    const errors = svgs.filter((s) => s.getAttribute('aria-roledescription') === 'error' || /Syntax error/.test(s.textContent));
    if (svgs.length !== expected || errors.length) throw new Error(`diagrams: ${svgs.length}/${expected}, errors: ${errors.length}`);
    return { diagrams: svgs.length, chapters: chapters.length, report };
  }, EXPECTED_DIAGRAMS);

  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    outline: true,
    tagged: true,
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-size:8px;width:100%;margin:0 16mm;display:flex;justify-content:space-between;color:#6b7280;font-family:Thonburi,-apple-system,sans-serif;"><span>Employee Console — คู่มือเรียนรู้ฉบับมือใหม่</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  console.log(JSON.stringify({ out, ...result }));
} finally {
  await browser.close();
}
