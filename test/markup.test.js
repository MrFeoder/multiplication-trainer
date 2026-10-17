const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

const ids = [
  'screen-settings', 'screen-quiz', 'screen-results',
  'profile',
  'a-from', 'a-to', 'b-from', 'b-to',
  'fmt-direct', 'fmt-missing', 'fmt-reverse', 'fmt-division',
  'answer-type', 'round-length',
  'settings-errors', 'settings-warnings', 'start-btn',
  'q-progress', 'q-correct', 'q-wrong', 'q-time', 'question-card',
  'answer-input', 'answer-input-2', 'answer-sep', 'answer-submit', 'choices', 'answer-hint', 'quit-btn',
  'res-summary', 'res-percent', 'res-time', 'res-mistakes', 'best-line', 'again-btn', 'settings-btn'
];

test('index.html содержит все id, на которые опирается app.js', () => {
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `нет id="${id}"`);
});

test('все четыре вида заданий заданы галочками по умолчанию включёнными', () => {
  for (const id of ['fmt-direct', 'fmt-missing', 'fmt-reverse', 'fmt-division']) {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
    assert.ok(tag.includes('type="checkbox"'), `${id} должен быть checkbox`);
    assert.ok(tag.includes('checked'), `${id} должен быть отмечен по умолчанию`);
  }
});

test('index.html содержит все id, которые запрашивает app.js через byId', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const re = /byId\('([^']+)'\)/g;
  const missing = [];
  let match = re.exec(appSource);
  while (match) {
    if (!html.includes(`id="${match[1]}"`)) missing.push(match[1]);
    match = re.exec(appSource);
  }
  assert.deepEqual(missing, [], `app.js запрашивает id, которых нет в разметке: ${missing.join(', ')}`);
});

test('index.html подключает скрипты в правильном порядке без ES-модулей', () => {
  assert.ok(html.indexOf('styles.css') < html.indexOf('logic.js'));
  assert.ok(html.indexOf('logic.js') < html.indexOf('app.js'));
  assert.ok(!html.includes('type="module"'));
});

test('index.html не тянет внешние ресурсы (гиперссылки не считаются)', () => {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const withoutHyperlinks = withoutComments.replace(/<a\b[^>]*>/gi, '');
  assert.ok(!/https?:\/\//.test(withoutHyperlinks), 'найден внешний ресурс');
});

test('index.html содержит кнопку-донат со ссылкой на dalink.to', () => {
  const tag = html.match(/<a\b[^>]*class="donate-btn"[^>]*>/i);
  assert.ok(tag, 'нет ссылки с классом donate-btn');
  assert.ok(tag[0].includes('href="https://dalink.to/mr_feoder"'), `ссылка ведёт не туда: ${tag[0]}`);
  assert.ok(tag[0].includes('target="_blank"'), 'ссылка должна открываться в новой вкладке');
  assert.ok(tag[0].includes('rel="noopener"'), 'нужен rel="noopener"');
});

test('styles.css оформляет кнопку-донат оранжевой по центру высоты', () => {
  assert.ok(css.includes('.donate-btn'), 'нет класса .donate-btn');
  const block = css.slice(css.indexOf('.donate-btn'));
  assert.ok(block.includes('position: fixed'), 'кнопка должна быть закреплена');
  assert.ok(/#ff7a00/i.test(block), 'кнопка должна быть оранжевой');
  assert.ok(block.includes('top: 50%'), 'кнопка должна стоять в середине страницы по высоте');
  assert.ok(!block.includes('writing-mode'), 'текст не должен быть повёрнут набок');
});

test('кнопка-донат читается сверху вниз: DONAT FOR COOKIE', () => {
  const tag = html.match(/<a\b[^>]*class="donate-btn"[^>]*>([\s\S]*?)<\/a>/i);
  assert.ok(tag, 'нет ссылки с классом donate-btn');
  const words = tag[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').trim().split(/\s+/);
  assert.deepEqual(words, ['DONAT', 'FOR', 'COOKIE'], `на кнопке: ${tag[1]}`);
});

test('styles.css содержит темы профилей и адаптив', () => {
  for (const theme of ['theme-kid', 'theme-adult', 'theme-neutral']) {
    assert.ok(css.includes(theme), `нет темы ${theme}`);
  }
  assert.ok(css.includes('@media'), 'нет @media для адаптива');
});

test('styles.css содержит служебные классы экранов и обратной связи', () => {
  for (const cls of ['.hidden', '.is-correct', '.is-wrong', '.choices']) {
    assert.ok(css.includes(cls), `нет класса ${cls}`);
  }
});
