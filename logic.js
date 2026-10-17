(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MTM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FORMATS = ['direct', 'missing', 'reverse', 'division'];
  var ANSWER_TYPES = ['input', 'choice'];
  var PROFILES = {
    kid: { aFrom: 2, aTo: 9, bFrom: 2, bTo: 9 },
    adult: { aFrom: 2, aTo: 12, bFrom: 2, bTo: 12 },
    neutral: { aFrom: 2, aTo: 10, bFrom: 2, bTo: 10 }
  };
  var MAX_FACTOR = 100;
  var LARGE_FACTOR = 20;

  function toInt(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : NaN;
    }
    var s = String(value).trim();
    if (!/^\d+$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  function isIntIn(value, min, max) {
    var n = toInt(value);
    return Number.isInteger(n) && n >= min && n <= max;
  }

  function hasProfile(profile) {
    return Object.prototype.hasOwnProperty.call(PROFILES, profile);
  }

  function profileRange(profile) {
    var p = hasProfile(profile) ? profile : 'kid';
    return PROFILES[p];
  }

  function allFormats() {
    return FORMATS.slice();
  }

  function defaultsFor(profile) {
    var p = hasProfile(profile) ? profile : 'kid';
    var range = PROFILES[p];
    return {
      profile: p,
      aFrom: range.aFrom,
      aTo: range.aTo,
      bFrom: range.bFrom,
      bTo: range.bTo,
      formats: allFormats(),
      answerType: 'input',
      roundLength: 10
    };
  }

  function applyProfile(settings, profile) {
    var p = hasProfile(profile) ? profile : 'kid';
    var src = settings && typeof settings === 'object' ? settings : {};
    var range = PROFILES[p];
    return Object.assign({}, defaultsFor(p), src, {
      profile: p,
      aFrom: range.aFrom,
      aTo: range.aTo,
      bFrom: range.bFrom,
      bTo: range.bTo
    });
  }

  function parseFormats(formats) {
    if (!Array.isArray(formats)) return { isArray: false, unknown: false, list: [] };
    var out = [];
    var unknown = false;
    for (var i = 0; i < formats.length; i++) {
      if (FORMATS.indexOf(formats[i]) === -1) {
        unknown = true;
        continue;
      }
      if (out.indexOf(formats[i]) === -1) out.push(formats[i]);
    }
    return { isArray: true, unknown: unknown, list: out };
  }

  function validateSettings(settings) {
    var s = settings && typeof settings === 'object' ? settings : {};
    var errors = [];
    var warnings = [];

    function range(pair, fromKey, toKey) {
      var from = toInt(s[fromKey]);
      var to = toInt(s[toKey]);
      var fromOk = isIntIn(s[fromKey], 1, MAX_FACTOR);
      var toOk = isIntIn(s[toKey], 1, MAX_FACTOR);
      if (!fromOk) errors.push(pair + ': «от» — целое число от 1 до 100');
      if (!toOk) errors.push(pair + ': «до» — целое число от 1 до 100');
      if (fromOk && toOk && from > to) errors.push(pair + ': «от» не может быть больше «до»');
      return { to: to, toOk: toOk };
    }

    var a = range('A', 'aFrom', 'aTo');
    var b = range('B', 'bFrom', 'bTo');

    var formats = parseFormats(s.formats);
    if (!formats.isArray || formats.list.length === 0) {
      errors.push('Выберите хотя бы один вид задания');
    } else if (formats.unknown) {
      errors.push('Неизвестный вид задания');
    }

    if (ANSWER_TYPES.indexOf(s.answerType) === -1) errors.push('Неизвестный тип ответа');
    if (!isIntIn(s.roundLength, 1, MAX_FACTOR)) {
      errors.push('«Вопросов в раунде» — целое число от 1 до 100');
    }

    if (errors.length === 0 && ((a.toOk && a.to > LARGE_FACTOR) || (b.toOk && b.to > LARGE_FACTOR))) {
      warnings.push('Множители больше 20: произведения будут большими');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function normalizeSettings(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var def = defaultsFor(hasProfile(r.profile) ? r.profile : 'kid');

    var s = {
      profile: def.profile,
      aFrom: isIntIn(r.aFrom, 1, MAX_FACTOR) ? toInt(r.aFrom) : def.aFrom,
      aTo: isIntIn(r.aTo, 1, MAX_FACTOR) ? toInt(r.aTo) : def.aTo,
      bFrom: isIntIn(r.bFrom, 1, MAX_FACTOR) ? toInt(r.bFrom) : def.bFrom,
      bTo: isIntIn(r.bTo, 1, MAX_FACTOR) ? toInt(r.bTo) : def.bTo,
      formats: def.formats,
      answerType: ANSWER_TYPES.indexOf(r.answerType) !== -1 ? r.answerType : def.answerType,
      roundLength: isIntIn(r.roundLength, 1, MAX_FACTOR) ? toInt(r.roundLength) : def.roundLength
    };

    var formats = parseFormats(r.formats);
    if (formats.isArray && formats.list.length > 0) s.formats = formats.list;

    if (s.aFrom > s.aTo) {
      s.aFrom = def.aFrom;
      s.aTo = def.aTo;
    }
    if (s.bFrom > s.bTo) {
      s.bFrom = def.bFrom;
      s.bTo = def.bTo;
    }

    return s;
  }

  function questionKey(question) {
    var q = question && typeof question === 'object' ? question : {};
    return q.format + ':' + q.a + 'x' + q.b + ':' + (q.variant || '-');
  }

  function shuffle(array) {
    var out = Array.isArray(array) ? array.slice() : [];
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function makeQuestion(format, a, b, variant) {
    var product = a * b;
    var q = {
      format: format,
      a: a,
      b: b,
      product: product,
      variant: variant || '',
      pair: false,
      prompt: '',
      answer: product,
      answerText: String(product)
    };

    if (format === 'direct') {
      q.prompt = a + ' × ' + b + ' = ?';
    } else if (format === 'missing') {
      if (variant === 'askB') {
        q.prompt = a + ' × ? = ' + product;
        q.answer = b;
        q.answerText = String(b);
      } else {
        q.prompt = '? × ' + b + ' = ' + product;
        q.answer = a;
        q.answerText = String(a);
      }
    } else if (format === 'division') {
      if (variant === 'divA') {
        q.prompt = product + ' ÷ ' + a + ' = ?';
        q.answer = b;
        q.answerText = String(b);
      } else {
        q.prompt = product + ' ÷ ' + b + ' = ?';
        q.answer = a;
        q.answerText = String(a);
      }
    } else if (format === 'reverse') {
      q.prompt = product + ' = ? × ?';
      q.answer = product;
      q.answerText = a + ' × ' + b;
      q.pair = true;
    }

    return q;
  }

  function buildPool(settings) {
    var s = settings && typeof settings === 'object' ? settings : {};
    var aFrom = toInt(s.aFrom);
    var aTo = toInt(s.aTo);
    var bFrom = toInt(s.bFrom);
    var bTo = toInt(s.bTo);
    if (!Number.isInteger(aFrom) || !Number.isInteger(aTo)) return [];
    if (!Number.isInteger(bFrom) || !Number.isInteger(bTo)) return [];
    if (aFrom > aTo || bFrom > bTo) return [];

    var formats = parseFormats(s.formats);
    var list = formats.isArray ? formats.list : [];
    var pool = [];

    for (var fi = 0; fi < list.length; fi++) {
      var fmt = list[fi];
      for (var a = aFrom; a <= aTo; a++) {
        for (var b = bFrom; b <= bTo; b++) {
          if (fmt === 'direct') {
            pool.push(makeQuestion('direct', a, b, ''));
          } else if (fmt === 'missing') {
            pool.push(makeQuestion('missing', a, b, 'askB'));
            pool.push(makeQuestion('missing', a, b, 'askA'));
          } else if (fmt === 'division') {
            pool.push(makeQuestion('division', a, b, 'divA'));
            pool.push(makeQuestion('division', a, b, 'divB'));
          } else if (fmt === 'reverse') {
            pool.push(makeQuestion('reverse', a, b, ''));
          }
        }
      }
    }

    return pool;
  }

  function nextQuestion(pool, usedKeys, lastKey) {
    var used = Array.isArray(usedKeys) ? usedKeys : [];
    var available = pool.filter(function (q) {
      var key = questionKey(q);
      return used.indexOf(key) === -1 && key !== lastKey;
    });
    if (available.length > 0) {
      return {
        question: available[Math.floor(Math.random() * available.length)],
        exhausted: false
      };
    }
    var fallback = pool.filter(function (q) {
      return questionKey(q) !== lastKey || pool.length === 1;
    });
    if (fallback.length === 0) fallback = pool;
    return {
      question: fallback[Math.floor(Math.random() * fallback.length)],
      exhausted: true
    };
  }

  return {
    FORMATS: FORMATS,
    ANSWER_TYPES: ANSWER_TYPES,
    PROFILES: PROFILES,
    toInt: toInt,
    defaultsFor: defaultsFor,
    applyProfile: applyProfile,
    validateSettings: validateSettings,
    normalizeSettings: normalizeSettings,
    questionKey: questionKey,
    shuffle: shuffle,
    buildPool: buildPool,
    nextQuestion: nextQuestion
  };
});
