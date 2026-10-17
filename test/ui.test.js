// UI-тесты app.js на минимальном DOM-стабе без внешних зависимостей.
// Стаб поддерживает ровно те возможности, которые использует app.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MTM = require('../logic.js');

function elementsFromMarkup() {
  const map = {};
  const re = /<([a-zA-Z0-9]+)\b([^>]*)>/g;
  let match = re.exec(html);
  while (match) {
    const attrs = match[2];
    const idMatch = /\bid="([^"]+)"/.exec(attrs);
    if (idMatch) {
      map[idMatch[1]] = { tag: match[1].toLowerCase(), checked: /\bchecked\b/.test(attrs) };
    }
    match = re.exec(html);
  }
  return map;
}

function createElement(tagName) {
  const classes = [];
  const attributes = {};
  const listeners = {};
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    id: '',
    children: [],
    parentNode: null,
    textContent: '',
    value: '',
    disabled: false,
    checked: false,
    type: '',
    classList: {
      add: function (name) { if (classes.indexOf(name) === -1) classes.push(name); },
      remove: function (name) { const i = classes.indexOf(name); if (i !== -1) classes.splice(i, 1); },
      contains: function (name) { return classes.indexOf(name) !== -1; },
      toggle: function (name, force) {
        const has = classes.indexOf(name) !== -1;
        const want = force === undefined ? !has : !!force;
        if (want) element.classList.add(name); else element.classList.remove(name);
        return want;
      },
      toString: function () { return classes.join(' '); }
    },
    get className() { return classes.join(' '); },
    setAttribute: function (name, value) { attributes[name] = String(value); },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    appendChild: function (child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    removeChild: function (child) {
      const i = element.children.indexOf(child);
      if (i !== -1) element.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    get firstChild() { return element.children.length ? element.children[0] : null; },
    set innerHTML(value) { element.children.length = 0; element._innerHTML = value; },
    get innerHTML() { return element._innerHTML || ''; },
    focus: function () {},
    addEventListener: function (type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    click: function () {
      (listeners.click || []).forEach(function (handler) { handler({ type: 'click' }); });
    },
    dispatch: function (type, event) {
      (listeners[type] || []).forEach(function (handler) { handler(event || { type: type }); });
    }
  };
  return element;
}

function createApp(options) {
  const opts = options || {};
  const registry = {};
  const meta = elementsFromMarkup();
  Object.keys(meta).forEach(function (id) {
    const el = createElement(meta[id].tag);
    el.id = id;
    el.checked = meta[id].checked;
    registry[id] = el;
  });

  const body = createElement('body');
  body.classList.add('theme-kid');

  const timeouts = [];
  const intervals = [];
  let timeoutsRan = 0;

  const store = {};
  const localStorage = {
    getItem: function (key) {
      if (opts.localStorageThrows) throw new Error('localStorage недоступен');
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem: function (key, value) {
      if (opts.localStorageThrows) throw new Error('localStorage недоступен');
      store[key] = String(value);
    }
  };
  if (opts.seed) {
    Object.keys(opts.seed).forEach(function (key) { store[key] = opts.seed[key]; });
  }

  const documentStub = {
    body: body,
    getElementById: function (id) { return registry[id] || null; },
    createElement: createElement
  };

  const windowStub = {
    MTM: MTM,
    localStorage: localStorage,
    document: documentStub
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorage,
    MTM: MTM,
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    parseInt: parseInt,
    isNaN: isNaN,
    setInterval: function (fn, delay) { intervals.push({ fn: fn, delay: delay, cleared: false }); return intervals.length; },
    clearInterval: function (id) { const t = intervals[id - 1]; if (t) t.cleared = true; },
    setTimeout: function (fn, delay) { timeouts.push({ fn: fn, delay: delay, cleared: false }); return timeouts.length; },
    clearTimeout: function (id) { const t = timeouts[id - 1]; if (t) t.cleared = true; }
  };

  vm.createContext(sandbox);
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });

  return {
    dom: registry,
    body: body,
    store: store,
    timers: timeouts,
    app: windowStub.MTApp,
    fire: function (id, type, event) { registry[id].dispatch(type, event); },
    click: function (id) { registry[id].click(); },
    setChecked: function (id, value) { registry[id].checked = value; registry[id].dispatch('change', { type: 'change' }); },
    runTimers: function () {
      while (timeoutsRan < timeouts.length) {
        const timer = timeouts[timeoutsRan];
        timeoutsRan += 1;
        if (!timer.cleared) timer.fn();
      }
    }
  };
}

function currentQuestion(app) {
  return app.app.getState().round.question;
}

function answerCorrect(app) {
  const q = currentQuestion(app);
  if (q.pair) {
    app.dom['answer-input'].value = String(q.a);
    app.dom['answer-input-2'].value = String(q.b);
    app.app.submitAnswer();
  } else {
    app.dom['answer-input'].value = String(q.answer);
    app.app.submitAnswer();
  }
}

function answerWrong(app) {
  const q = currentQuestion(app);
  if (q.pair) {
    app.dom['answer-input'].value = String(q.a + 1);
    app.dom['answer-input-2'].value = String(q.b);
    app.app.submitAnswer();
  } else {
    app.dom['answer-input'].value = String(q.answer + 1);
    app.app.submitAnswer();
  }
}

function onlyFormats(app, keep) {
  for (const id of ['fmt-direct', 'fmt-missing', 'fmt-reverse', 'fmt-division']) {
    const name = id.replace('fmt-', '');
    app.setChecked(id, keep.indexOf(name) !== -1);
  }
}

function setRanges(app, aFrom, aTo, bFrom, bTo) {
  app.dom['a-from'].value = aFrom;
  app.dom['a-to'].value = aTo;
  app.dom['b-from'].value = bFrom;
  app.dom['b-to'].value = bTo;
  app.fire('a-from', 'change');
}

test('стартовое состояние: настройки видны, квиз и итоги скрыты, кнопка активна', () => {
  const app = createApp();
  assert.equal(app.dom['screen-settings'].classList.contains('hidden'), false);
  assert.equal(app.dom['screen-quiz'].classList.contains('hidden'), true);
  assert.equal(app.dom['screen-results'].classList.contains('hidden'), true);
  assert.equal(app.dom['start-btn'].disabled, false);
  assert.equal(app.dom['a-from'].value, 2);
  assert.equal(app.dom['a-to'].value, 9);
  assert.equal(app.dom['b-from'].value, 2);
  assert.equal(app.dom['b-to'].value, 9);
  assert.equal(app.store['mtm.settings'] !== undefined, true);
  assert.equal(app.store['mtm.profile'], 'kid', 'профиль записывается сразу при первом запуске');
});

test('ошибки настроек блокируют «Начать», предупреждение — нет', () => {
  const app = createApp();

  app.dom['a-from'].value = '';
  app.app.onFieldChange();
  assert.ok(app.dom['settings-errors'].textContent.includes('A'), app.dom['settings-errors'].textContent);
  assert.equal(app.dom['start-btn'].disabled, true);

  app.dom['a-from'].value = 9;
  app.dom['a-to'].value = 2;
  app.app.onFieldChange();
  assert.ok(app.dom['settings-errors'].textContent.includes('больше'), app.dom['settings-errors'].textContent);
  assert.equal(app.dom['start-btn'].disabled, true);

  setRanges(app, 2, 25, 2, 9);
  assert.ok(app.dom['settings-warnings'].textContent.length > 0);
  assert.equal(app.dom['start-btn'].disabled, false);
});

test('ни одной галочки — ошибка и блокировка «Начать»', () => {
  const app = createApp();
  onlyFormats(app, []);
  assert.ok(app.dom['settings-errors'].textContent.includes('вид задания'), app.dom['settings-errors'].textContent);
  assert.equal(app.dom['start-btn'].disabled, true);

  app.setChecked('fmt-direct', true);
  assert.equal(app.dom['start-btn'].disabled, false);
});

test('режим «вписать»: верный и неверный ответы считаются один раз', () => {
  const app = createApp();
  app.app.startRound();
  assert.equal(app.dom['screen-quiz'].classList.contains('hidden'), false);
  assert.equal(app.app.getState().round.phase, 'answering');

  const q = currentQuestion(app);
  app.dom['answer-input'].value = String(q.answer);
  app.app.submitAnswer();
  assert.equal(app.app.getState().round.correct, 1);
  assert.equal(app.dom['question-card'].classList.contains('is-correct'), true);
  assert.equal(app.dom['q-correct'].textContent, 'Верно: 1');

  app.app.submitAnswer();
  assert.equal(app.app.getState().round.correct, 1, 'повторный ответ в фазе feedback не засчитывается');

  app.runTimers();
  answerWrong(app);
  assert.equal(app.app.getState().round.wrong, 1);
  assert.equal(app.dom['question-card'].classList.contains('is-wrong'), true);
  assert.equal(app.app.getState().round.mistakes.length, 1);
});

test('пустой ответ: подсказка и отсутствие засчитанной ошибки', () => {
  const app = createApp();
  app.app.startRound();
  app.dom['answer-input'].value = '';
  app.app.submitAnswer();
  assert.equal(app.dom['answer-hint'].textContent, 'Введите ответ');
  assert.equal(app.app.getState().round.phase, 'answering');
  assert.equal(app.app.getState().round.wrong, 0);
});

test('обратное задание вводом: два поля, перевёрнутая пара верна', () => {
  const app = createApp();
  onlyFormats(app, ['reverse']);
  setRanges(app, 7, 7, 8, 8);
  app.app.startRound();

  const q = currentQuestion(app);
  assert.equal(q.pair, true);
  assert.equal(app.dom['answer-input-2'].classList.contains('hidden'), false);
  assert.equal(app.dom['answer-sep'].classList.contains('hidden'), false);

  app.dom['answer-input'].value = String(q.b);
  app.dom['answer-input-2'].value = String(q.a);
  app.app.submitAnswer();
  assert.equal(app.app.getState().round.correct, 1, 'перевёрнутая пара 8 × 7 верна для 56');

  app.runTimers();
  app.dom['answer-input'].value = String(q.a + 1);
  app.dom['answer-input-2'].value = String(q.b);
  app.app.submitAnswer();
  assert.equal(app.app.getState().round.wrong, 1);
  assert.equal(app.app.getState().round.mistakes[0].answer, q.answerText);
});

test('обратное задание вводом: пустое второе поле — подсказка без ошибки', () => {
  const app = createApp();
  onlyFormats(app, ['reverse']);
  setRanges(app, 7, 7, 8, 8);
  app.app.startRound();

  const q = currentQuestion(app);
  app.dom['answer-input'].value = String(q.a);
  app.dom['answer-input-2'].value = '';
  app.app.submitAnswer();
  assert.equal(app.app.getState().round.wrong, 0);
  assert.equal(app.app.getState().round.phase, 'answering');
  assert.ok(app.dom['answer-hint'].textContent.length > 0);
});

test('нечисловое поле скрывается для обычных заданий и показывается для обратных', () => {
  const app = createApp();
  onlyFormats(app, ['direct']);
  setRanges(app, 3, 3, 4, 4);
  app.app.startRound();
  assert.equal(app.dom['answer-input-2'].classList.contains('hidden'), true);
  assert.equal(app.dom['answer-sep'].classList.contains('hidden'), true);
});

test('режим «выбрать»: 4 кнопки, верная отмечается', () => {
  const app = createApp();
  app.dom['answer-type'].value = 'choice';
  app.fire('answer-type', 'change');
  onlyFormats(app, ['direct']);
  app.app.startRound();

  assert.equal(app.dom.choices.children.length, 4);
  assert.equal(app.dom['input-area'].classList.contains('hidden'), true);

  const q = currentQuestion(app);
  const buttons = app.dom.choices.children;
  const correctButton = buttons.filter(b => b.textContent === String(q.answer))[0];
  assert.ok(correctButton, 'верный вариант присутствует');

  correctButton.click();
  assert.equal(app.app.getState().round.correct, 1);
  assert.equal(correctButton.classList.contains('is-correct'), true);
  assert.equal(app.dom['question-card'].classList.contains('is-correct'), true);
});

test('режим «выбрать»: неверный вариант подсвечивает и правильную кнопку', () => {
  const app = createApp();
  app.dom['answer-type'].value = 'choice';
  app.fire('answer-type', 'change');
  onlyFormats(app, ['direct']);
  app.app.startRound();

  const q = currentQuestion(app);
  const buttons = app.dom.choices.children;
  const wrongButton = buttons.filter(b => b.textContent !== String(q.answer))[0];
  wrongButton.click();

  assert.equal(app.app.getState().round.wrong, 1);
  assert.equal(wrongButton.classList.contains('is-wrong'), true);
  const correctButton = buttons.filter(b => b.textContent === String(q.answer))[0];
  assert.equal(correctButton.classList.contains('is-correct'), true);
});

test('обратное задание выбором: 4 пары, верная пара отмечается', () => {
  const app = createApp();
  app.dom['answer-type'].value = 'choice';
  app.fire('answer-type', 'change');
  onlyFormats(app, ['reverse']);
  setRanges(app, 7, 7, 8, 8);
  app.app.startRound();

  const q = currentQuestion(app);
  assert.equal(app.dom.choices.children.length, 4);
  const buttons = app.dom.choices.children;
  assert.ok(buttons.every(b => b.textContent.includes('×')), 'варианты — пары');

  const correctButton = buttons.filter(b => b.textContent === q.answerText)[0];
  assert.ok(correctButton, `нет пары ${q.answerText} среди ${buttons.map(b => b.textContent)}`);
  correctButton.click();
  assert.equal(app.app.getState().round.correct, 1);
  assert.equal(correctButton.classList.contains('is-correct'), true);
});

test('раунд доходит до итогов и сохраняет лучший результат', () => {
  const app = createApp();
  app.dom['round-length'].value = 3;
  setRanges(app, 1, 1, 1, 1);
  app.app.startRound();

  for (let i = 0; i < 3; i++) {
    answerCorrect(app);
    app.runTimers();
  }

  assert.equal(app.dom['screen-results'].classList.contains('hidden'), false);
  assert.equal(app.dom['res-summary'].textContent, 'Верно 3 из 3');
  assert.equal(app.dom['res-percent'].textContent, '100%');
  assert.ok(app.dom['best-line'].textContent.includes('Лучший результат'), app.dom['best-line'].textContent);
  assert.ok(app.store['mtm.best.input.direct+division+missing+reverse.1-1.1-1'], 'лучший результат сохранён');
});

test('мусор в localStorage: приложение работает на умолчаниях', () => {
  const app = createApp({ seed: { 'mtm.settings': '{{{{' } });
  assert.equal(app.dom['a-from'].value, 2);
  assert.equal(app.dom['a-to'].value, 9);
  assert.equal(app.dom['start-btn'].disabled, false);
  assert.deepEqual(app.app.getState().settings.formats, ['direct', 'missing', 'reverse', 'division']);
});

test('недоступный localStorage: приложение работает без исключений', () => {
  const app = createApp({ localStorageThrows: true });
  assert.equal(app.dom['a-from'].value, 2);
  app.app.startRound();
  assert.equal(app.app.getState().round.phase, 'answering');
  answerCorrect(app);
  assert.equal(app.app.getState().round.correct, 1);
});

test('диапазон 1..1: вопросы повторяются, раунд завершается', () => {
  const app = createApp();
  app.dom['round-length'].value = 2;
  setRanges(app, 1, 1, 1, 1);
  app.app.startRound();

  for (let i = 0; i < 2; i++) {
    assert.equal(currentQuestion(app).a, 1);
    answerCorrect(app);
    app.runTimers();
  }

  assert.equal(app.dom['screen-results'].classList.contains('hidden'), false);
  assert.equal(app.dom['res-summary'].textContent, 'Верно 2 из 2');
});

test('смена профиля меняет тему и диапазоны', () => {
  const app = createApp();
  app.dom.profile.value = 'adult';
  app.app.onProfileChange();
  assert.equal(app.app.getState().settings.profile, 'adult');
  assert.equal(app.body.classList.contains('theme-adult'), true);
  assert.equal(app.body.classList.contains('theme-kid'), false);
  assert.equal(app.dom['a-to'].value, 12);
  assert.equal(app.dom['b-to'].value, 12);
  assert.equal(app.store['mtm.profile'], 'adult');
});

test('Enter в поле ответа подтверждает ответ', () => {
  const app = createApp();
  app.app.startRound();
  const q = currentQuestion(app);
  app.dom['answer-input'].value = String(q.answer);
  let prevented = false;
  app.fire('answer-input', 'keydown', { key: 'Enter', preventDefault: function () { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.app.getState().round.correct, 1);
});

test('в поля ответа не пускаются нецифровые символы', () => {
  const app = createApp();
  app.app.startRound();
  app.dom['answer-input'].value = '1a2b3';
  app.fire('answer-input', 'input', { type: 'input' });
  assert.equal(app.dom['answer-input'].value, '123');

  app.dom['answer-input-2'].value = '7x8';
  app.fire('answer-input-2', 'input', { type: 'input' });
  assert.equal(app.dom['answer-input-2'].value, '78');
});

test('быстрый «Прервать» + «Начать» не пропускает первый вопрос нового раунда', () => {
  const app = createApp();
  app.dom['round-length'].value = 3;
  setRanges(app, 1, 1, 1, 1);
  app.app.startRound();

  answerCorrect(app);
  app.click('quit-btn');
  app.app.startRound();
  app.runTimers();

  assert.equal(app.app.getState().round.index, 1, 'зависший таймер прошлого раунда не должен перескакивать первый вопрос');
  assert.equal(app.app.getState().round.phase, 'answering');
});

test('кнопка «Прервать» возвращает в настройки и не пишет лучший результат', () => {
  const app = createApp();
  app.app.startRound();
  app.click('quit-btn');
  assert.equal(app.dom['screen-settings'].classList.contains('hidden'), false);
  assert.equal(app.app.getState().round, null);
  assert.equal(Object.keys(app.store).some(k => k.indexOf('mtm.best.') === 0), false);
});
