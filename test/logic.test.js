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
