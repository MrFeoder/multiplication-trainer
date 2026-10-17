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

test('index.html подключает скрипты в правильном порядке без ES-модулей', () => {
  assert.ok(html.indexOf('styles.css') < html.indexOf('logic.js'));
  assert.ok(html.indexOf('logic.js') < html.indexOf('app.js'));
  assert.ok(!html.includes('type="module"'));
});

test('index.html не тянет внешние ресурсы', () => {
  assert.ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'найден внешний ресурс');
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
