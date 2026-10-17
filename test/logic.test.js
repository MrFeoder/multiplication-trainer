const test = require('node:test');
const assert = require('node:assert/strict');
const MTM = require('../logic.js');

const ALL_FORMATS = ['direct', 'missing', 'reverse', 'division'];

const base = {
  profile: 'kid',
  aFrom: 2,
  aTo: 9,
  bFrom: 2,
  bTo: 9,
  formats: ALL_FORMATS.slice(),
  answerType: 'input',
  roundLength: 10
};

test('validateSettings: принимает корректные настройки', () => {
  const r = MTM.validateSettings(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('validateSettings: принимает числовые строки из полей формы', () => {
  const r = MTM.validateSettings({ ...base, aFrom: '2', aTo: '9', bFrom: '1', bTo: '12', roundLength: '7' });
  assert.equal(r.ok, true);
});

test('validateSettings: ловит пустое и нечисловое в каждом поле диапазона', () => {
  for (const field of ['aFrom', 'aTo', 'bFrom', 'bTo']) {
    for (const value of ['', '  ', 'ab', null, undefined, NaN]) {
      const r = MTM.validateSettings({ ...base, [field]: value });
      assert.equal(r.ok, false, `${field}=${String(value)}`);
      assert.ok(r.errors.length >= 1, `${field}=${String(value)}: ${r.errors}`);
    }
  }
});

test('validateSettings: ловит дробное, ноль, отрицательное и больше 100 в диапазонах', () => {
  for (const field of ['aFrom', 'aTo', 'bFrom', 'bTo']) {
    for (const value of ['1.5', 0, -5, 101, '999']) {
      const r = MTM.validateSettings({ ...base, [field]: value });
      assert.equal(r.ok, false, `${field}=${String(value)}`);
    }
  }
});

test('validateSettings: ловит «от» больше «до» в обоих диапазонах', () => {
  const r1 = MTM.validateSettings({ ...base, aFrom: 9, aTo: 2 });
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some(m => m.includes('A') && m.includes('больше')), JSON.stringify(r1.errors));

  const r2 = MTM.validateSettings({ ...base, bFrom: 9, bTo: 2 });
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some(m => m.includes('B') && m.includes('больше')), JSON.stringify(r2.errors));
});

test('validateSettings: диапазон из одного числа валиден (1..1 и 100..100)', () => {
  assert.equal(MTM.validateSettings({ ...base, aFrom: 1, aTo: 1, bFrom: 1, bTo: 1 }).ok, true);
  assert.equal(MTM.validateSettings({ ...base, aFrom: 100, aTo: 100, bFrom: 100, bTo: 100 }).ok, true);
});

test('validateSettings: пустой набор заданий — ошибка', () => {
  const r = MTM.validateSettings({ ...base, formats: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(m => m.includes('вид задания')), JSON.stringify(r.errors));
});

test('validateSettings: неизвестный вид задания — ошибка', () => {
  const r = MTM.validateSettings({ ...base, formats: ['direct', 'zzz'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(m => m.includes('вид задания')), JSON.stringify(r.errors));
});

test('validateSettings: formats не массив — ошибка', () => {
  assert.equal(MTM.validateSettings({ ...base, formats: 'direct' }).ok, false);
  assert.equal(MTM.validateSettings({ ...base, formats: null }).ok, false);
});

test('validateSettings: плохие answerType и roundLength', () => {
  assert.equal(MTM.validateSettings({ ...base, answerType: 'zzz' }).ok, false);
  assert.equal(MTM.validateSettings({ ...base, roundLength: 0 }).ok, false);
  assert.equal(MTM.validateSettings({ ...base, roundLength: 101 }).ok, false);
  assert.equal(MTM.validateSettings({ ...base, roundLength: 1.5 }).ok, false);
});

test('validateSettings: предупреждает про большие множители, но не блокирует', () => {
  const r = MTM.validateSettings({ ...base, aTo: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
  assert.equal(MTM.validateSettings({ ...base, aTo: 20, bTo: 20 }).warnings.length, 0);
  assert.equal(MTM.validateSettings({ ...base, bTo: 25 }).warnings.length, 1);
});

test('defaultsFor: диапазоны по умолчанию для профилей', () => {
  assert.deepEqual(MTM.defaultsFor('kid'), { ...base });
  assert.equal(MTM.defaultsFor('adult').aTo, 12);
  assert.equal(MTM.defaultsFor('adult').bTo, 12);
  assert.equal(MTM.defaultsFor('neutral').aTo, 10);
  assert.deepEqual(MTM.defaultsFor('неизвестный'), { ...base });
});

test('applyProfile: подставляет диапазоны профиля, прочие поля не трогает', () => {
  const s = MTM.applyProfile({ ...base, roundLength: 3, answerType: 'choice' }, 'adult');
  assert.equal(s.profile, 'adult');
  assert.equal(s.aFrom, 2);
  assert.equal(s.aTo, 12);
  assert.equal(s.bFrom, 2);
  assert.equal(s.bTo, 12);
  assert.equal(s.roundLength, 3);
  assert.equal(s.answerType, 'choice');
});

test('normalizeSettings: мусор заменяется умолчаниями, валидные поля остаются', () => {
  const s = MTM.normalizeSettings({
    profile: 'adult',
    aFrom: '7',
    aTo: 'мусор',
    bFrom: 3,
    bTo: 4,
    formats: ['direct', 'zzz'],
    answerType: 'choice',
    roundLength: 3.5
  });
  assert.equal(s.profile, 'adult');
  assert.equal(s.aFrom, 7);
  assert.equal(s.aTo, 12, 'плохое «до» заменено умолчанием профиля adult');
  assert.equal(s.bFrom, 3);
  assert.equal(s.bTo, 4);
  assert.deepEqual(s.formats, ['direct'], 'неизвестный вид задания отброшен');
  assert.equal(s.answerType, 'choice');
  assert.equal(s.roundLength, 10);
});

test('normalizeSettings: null и перевёрнутый диапазон дают умолчания', () => {
  const s = MTM.normalizeSettings(null);
  assert.deepEqual(s, { ...base });

  const reversed = MTM.normalizeSettings({ ...base, aFrom: 9, aTo: 2 });
  assert.equal(reversed.aFrom, 2);
  assert.equal(reversed.aTo, 9);
});

test('normalizeSettings: пустой formats становится полным набором', () => {
  assert.deepEqual(MTM.normalizeSettings({ formats: [] }).formats, ALL_FORMATS);
  assert.deepEqual(MTM.normalizeSettings({ formats: 'nope' }).formats, ALL_FORMATS);
});

function poolOf(formats, aFrom, aTo, bFrom, bTo) {
  return MTM.buildPool({ ...base, formats, aFrom, aTo, bFrom, bTo });
}

test('buildPool: прямой вопрос', () => {
  const pool = poolOf(['direct'], 7, 7, 8, 8);
  assert.equal(pool.length, 1);
  const q = pool[0];
  assert.equal(q.format, 'direct');
  assert.equal(q.a, 7);
  assert.equal(q.b, 8);
  assert.equal(q.product, 56);
  assert.equal(q.pair, false);
  assert.equal(q.variant, '');
  assert.equal(q.prompt, '7 × 8 = ?');
  assert.equal(q.answer, 56);
  assert.equal(q.answerText, '56');
});

test('buildPool: пропущенный множитель — оба варианта', () => {
  const pool = poolOf(['missing'], 7, 7, 8, 8);
  assert.equal(pool.length, 2);

  const askB = pool.find(q => q.variant === 'askB');
  assert.equal(askB.prompt, '7 × ? = 56');
  assert.equal(askB.answer, 8);
  assert.equal(askB.answerText, '8');

  const askA = pool.find(q => q.variant === 'askA');
  assert.equal(askA.prompt, '? × 8 = 56');
  assert.equal(askA.answer, 7);
  assert.equal(askA.answerText, '7');
});

test('buildPool: деление — оба варианта', () => {
  const pool = poolOf(['division'], 7, 7, 8, 8);
  assert.equal(pool.length, 2);

  const divA = pool.find(q => q.variant === 'divA');
  assert.equal(divA.prompt, '56 ÷ 7 = ?');
  assert.equal(divA.answer, 8);

  const divB = pool.find(q => q.variant === 'divB');
  assert.equal(divB.prompt, '56 ÷ 8 = ?');
  assert.equal(divB.answer, 7);
});

test('buildPool: обратный вопрос — пара', () => {
  const pool = poolOf(['reverse'], 7, 7, 8, 8);
  assert.equal(pool.length, 1);
  const q = pool[0];
  assert.equal(q.prompt, '56 = ? × ?');
  assert.equal(q.pair, true);
  assert.equal(q.answer, 56);
  assert.equal(q.answerText, '7 × 8');
});

test('buildPool: одна пара со всеми форматами даёт 6 вопросов', () => {
  const pool = poolOf(ALL_FORMATS, 7, 7, 8, 8);
  assert.equal(pool.length, 6);
  assert.equal(new Set(pool.map(MTM.questionKey)).size, 6);
});

test('buildPool: размер растёт как произведение диапазонов', () => {
  assert.equal(poolOf(['direct'], 2, 3, 5, 6).length, 4);
  assert.equal(poolOf(['direct', 'reverse'], 2, 3, 5, 6).length, 8);
});

test('buildPool: вырожденный диапазон 1..1 × 1..1 не падает', () => {
  const pool = poolOf(ALL_FORMATS, 1, 1, 1, 1);
  assert.equal(pool.length, 6);
  const direct = pool.find(q => q.format === 'direct');
  assert.equal(direct.prompt, '1 × 1 = ?');
  assert.equal(direct.answer, 1);
});

test('buildPool: перевёрнутый диапазон даёт пустой пул', () => {
  assert.deepEqual(poolOf(['direct'], 9, 2, 1, 9), []);
  assert.deepEqual(poolOf(['direct'], 1, 9, 9, 2), []);
});

test('questionKey: устойчив и различает варианты', () => {
  const pool = poolOf(ALL_FORMATS, 7, 7, 8, 8);
  for (const q of pool) assert.equal(MTM.questionKey(q), MTM.questionKey(q));
  assert.equal(new Set(pool.map(MTM.questionKey)).size, pool.length);
  const a = pool.find(q => q.variant === 'askA');
  const b = pool.find(q => q.variant === 'askB');
  assert.notEqual(MTM.questionKey(a), MTM.questionKey(b));
});

test('shuffle: новый массив с теми же элементами', () => {
  const src = [1, 2, 3, 4, 5];
  const out = MTM.shuffle(src);
  assert.notEqual(out, src);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
});

test('nextQuestion: не повторяет вопросы, пока пул не исчерпан', () => {
  const pool = poolOf(['direct'], 1, 3, 1, 1);
  let used = [];
  const seen = [];
  for (let i = 0; i < pool.length; i++) {
    const { question, exhausted } = MTM.nextQuestion(pool, used, used[used.length - 1]);
    used.push(MTM.questionKey(question));
    seen.push(MTM.questionKey(question));
    assert.equal(exhausted, false);
  }
  assert.equal(new Set(seen).size, pool.length);
});

test('nextQuestion: после исчерпания пула сообщает exhausted и не повторяет предыдущий', () => {
  const pool = poolOf(['direct'], 1, 2, 1, 1);
  const keys = pool.map(MTM.questionKey);
  const { question, exhausted } = MTM.nextQuestion(pool, keys.slice(), keys[keys.length - 1]);
  assert.equal(exhausted, true);
  assert.notEqual(MTM.questionKey(question), keys[keys.length - 1]);
});

test('nextQuestion: пул из одного вопроса не зацикливается', () => {
  const pool = poolOf(['direct'], 3, 3, 3, 3);
  const key = MTM.questionKey(pool[0]);
  for (let i = 0; i < 5; i++) {
    const { question } = MTM.nextQuestion(pool, [key], key);
    assert.equal(question.prompt, '3 × 3 = ?');
  }
});

test('nextQuestion: раунд длиннее пула выдаёт все вопросы пула', () => {
  const pool = poolOf(['direct'], 1, 3, 1, 1);
  let used = [];
  let lastKey = null;
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const { question, exhausted } = MTM.nextQuestion(pool, used, lastKey);
    const key = MTM.questionKey(question);
    if (exhausted) used = [key]; else used.push(key);
    lastKey = key;
    seen.add(key);
  }
  assert.equal(seen.size, pool.length);
});

test('makeChoices: прямой вопрос — 4 уникальных числа, ровно один верный', () => {
  const q = poolOf(['direct'], 7, 7, 8, 8)[0];
  const choices = MTM.makeChoices(q);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.every(c => Number.isInteger(c) && c > 0), `${choices}`);
  assert.equal(choices.filter(c => c === 56).length, 1);
});

test('makeChoices: пропущенный множитель и деление — ровно один верный', () => {
  for (const q of poolOf(['missing'], 7, 7, 8, 8).concat(poolOf(['division'], 7, 7, 8, 8))) {
    const choices = MTM.makeChoices(q);
    assert.equal(new Set(choices).size, 4, q.prompt);
    assert.ok(choices.every(c => Number.isInteger(c) && c > 0), `${q.prompt}: ${choices}`);
    assert.equal(choices.filter(c => c === q.answer).length, 1, `${q.prompt}: ${choices}`);
  }
});

test('makeChoices: числовые варианты всегда валидны (перебор a,b = 1..12)', () => {
  const pool = poolOf(['direct', 'missing', 'division'], 1, 12, 1, 12);
  assert.ok(pool.length > 400);
  for (const q of pool) {
    const choices = MTM.makeChoices(q);
    assert.equal(choices.length, 4, q.prompt);
    assert.equal(new Set(choices).size, 4, `${q.prompt}: ${choices}`);
    assert.ok(choices.every(c => Number.isInteger(c) && c > 0), `${q.prompt}: ${choices}`);
    assert.equal(choices.filter(c => c === q.answer).length, 1, `${q.prompt}: ${choices}`);
  }
});

test('makeChoices: обратный вопрос — 4 уникальные пары, ровно одна верная', () => {
  const q = poolOf(['reverse'], 7, 7, 8, 8)[0];
  const choices = MTM.makeChoices(q);
  assert.equal(choices.length, 4);
  assert.ok(choices.every(p => Number.isInteger(p.a) && Number.isInteger(p.b) && p.a > 0 && p.b > 0), JSON.stringify(choices));
  assert.equal(new Set(choices.map(p => p.a + 'x' + p.b)).size, 4);
  assert.equal(choices.filter(p => p.a * p.b === 56).length, 1, JSON.stringify(choices));
  assert.equal(choices.filter(p => p.a === 7 && p.b === 8).length, 1);
});

test('makeChoices: обратные варианты валидны на переборе (перебор a,b = 1..12)', () => {
  const pool = poolOf(['reverse'], 1, 12, 1, 12);
  for (const q of pool) {
    const choices = MTM.makeChoices(q);
    assert.equal(choices.length, 4, q.prompt);
    assert.equal(new Set(choices.map(p => p.a + 'x' + p.b)).size, 4, `${q.prompt}: ${JSON.stringify(choices)}`);
    assert.ok(choices.every(p => Number.isInteger(p.a) && Number.isInteger(p.b) && p.a > 0 && p.b > 0), `${q.prompt}: ${JSON.stringify(choices)}`);
    assert.equal(choices.filter(p => p.a * p.b === q.product).length, 1, `${q.prompt}: ${JSON.stringify(choices)}`);
  }
});

test('checkAnswer: числовое сравнение и мусор', () => {
  const q = poolOf(['direct'], 7, 7, 8, 8)[0];
  assert.equal(MTM.checkAnswer(q, '56'), true);
  assert.equal(MTM.checkAnswer(q, 56), true);
  assert.equal(MTM.checkAnswer(q, '07' === '0' ? '' : '56'), true);
  assert.equal(MTM.checkAnswer(q, '56.0'), false);
  assert.equal(MTM.checkAnswer(q, ''), false);
  assert.equal(MTM.checkAnswer(q, 'ab'), false);
  assert.equal(MTM.checkAnswer(q, null), false);
});

test('checkAnswer: ведущий ноль не мешает («07» равно 7)', () => {
  const q = poolOf(['missing'], 7, 7, 8, 8).find(x => x.variant === 'askA');
  assert.equal(MTM.checkAnswer(q, '07'), true);
  assert.equal(MTM.checkAnswer(q, 7), true);
  assert.equal(MTM.checkAnswer(q, '8'), false);
});

test('checkAnswer: обратный вопрос принимает любую верную пару', () => {
  const q = poolOf(['reverse'], 7, 7, 8, 8)[0];
  assert.equal(MTM.checkAnswer(q, { a: 7, b: 8 }), true);
  assert.equal(MTM.checkAnswer(q, { a: 8, b: 7 }), true, 'перевёрнутая пара тоже верна');
  assert.equal(MTM.checkAnswer(q, { a: '8', b: '7' }), true);
});

test('checkAnswer: обратный вопрос отвергает неверную пару и мусор', () => {
  const q = poolOf(['reverse'], 7, 7, 8, 8)[0];
  assert.equal(MTM.checkAnswer(q, { a: 6, b: 8 }), false);
  assert.equal(MTM.checkAnswer(q, { a: 0, b: 56 }), false);
  assert.equal(MTM.checkAnswer(q, { a: -1, b: -56 }), false);
  assert.equal(MTM.checkAnswer(q, { a: 7 }), false);
  assert.equal(MTM.checkAnswer(q, null), false);
  assert.equal(MTM.checkAnswer(q, '56'), false, 'число не является ответом обратного задания');
});

test('formatTime: границы', () => {
  assert.equal(MTM.formatTime(0), '00:00');
  assert.equal(MTM.formatTime(5), '00:05');
  assert.equal(MTM.formatTime(59), '00:59');
  assert.equal(MTM.formatTime(60), '01:00');
  assert.equal(MTM.formatTime(3600), '60:00');
});

test('summarize: проценты, время и разбор ошибок', () => {
  const r = MTM.summarize({
    total: 10,
    correct: 7,
    seconds: 65,
    mistakes: [{ prompt: '7 × 8 = ?', given: '54', answer: '56' }]
  });
  assert.equal(r.total, 10);
  assert.equal(r.correct, 7);
  assert.equal(r.percent, 70);
  assert.equal(r.secondsText, '01:05');
  assert.deepEqual(r.mistakes, [{ prompt: '7 × 8 = ?', given: '54', answer: '56' }]);
});

test('summarize: не падает при нуле вопросов и округляет процент', () => {
  assert.equal(MTM.summarize({ total: 0, correct: 0, seconds: 0, mistakes: [] }).percent, 0);
  assert.equal(MTM.summarize({ total: 3, correct: 2, seconds: 1, mistakes: [] }).percent, 67);
});

test('bestKey: зависит от типа ответа, набора заданий и диапазонов', () => {
  assert.equal(MTM.bestKey(base), 'mtm.best.input.direct+division+missing+reverse.2-9.2-9');
  assert.equal(
    MTM.bestKey({ ...base, answerType: 'choice', formats: ['reverse', 'direct'], aFrom: 1, aTo: 10, bFrom: 1, bTo: 12 }),
    'mtm.best.choice.direct+reverse.1-10.1-12'
  );
});

test('isBetter: больше верных лучше, при равенстве — быстрее', () => {
  assert.equal(MTM.isBetter({ correct: 5, seconds: 30 }, null), true);
  assert.equal(MTM.isBetter({ correct: 5, seconds: 30 }, undefined), true);
  assert.equal(MTM.isBetter({ correct: 6, seconds: 90 }, { correct: 5, seconds: 10 }), true);
  assert.equal(MTM.isBetter({ correct: 4, seconds: 5 }, { correct: 5, seconds: 10 }), false);
  assert.equal(MTM.isBetter({ correct: 5, seconds: 5 }, { correct: 5, seconds: 10 }), true);
  assert.equal(MTM.isBetter({ correct: 5, seconds: 10 }, { correct: 5, seconds: 10 }), false);
});
