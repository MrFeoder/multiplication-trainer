(function () {
  'use strict';

  var MTM = window.MTM;

  function byId(id) {
    return document.getElementById(id);
  }

  var els = {
    screens: {
      settings: byId('screen-settings'),
      quiz: byId('screen-quiz'),
      results: byId('screen-results')
    },
    profile: byId('profile'),
    aFrom: byId('a-from'),
    aTo: byId('a-to'),
    bFrom: byId('b-from'),
    bTo: byId('b-to'),
    fmt: {
      direct: byId('fmt-direct'),
      missing: byId('fmt-missing'),
      reverse: byId('fmt-reverse'),
      division: byId('fmt-division')
    },
    answerType: byId('answer-type'),
    roundLength: byId('round-length'),
    settingsErrors: byId('settings-errors'),
    settingsWarnings: byId('settings-warnings'),
    startBtn: byId('start-btn'),
    qProgress: byId('q-progress'),
    qCorrect: byId('q-correct'),
    qWrong: byId('q-wrong'),
    qTime: byId('q-time'),
    questionCard: byId('question-card'),
    inputArea: byId('input-area'),
    answerInput: byId('answer-input'),
    answerInput2: byId('answer-input-2'),
    answerSep: byId('answer-sep'),
    answerSubmit: byId('answer-submit'),
    answerHint: byId('answer-hint'),
    choices: byId('choices'),
    quitBtn: byId('quit-btn'),
    resSummary: byId('res-summary'),
    resPercent: byId('res-percent'),
    resTime: byId('res-time'),
    resMistakes: byId('res-mistakes'),
    bestLine: byId('best-line'),
    againBtn: byId('again-btn'),
    settingsBtn: byId('settings-btn'),
    body: document.body
  };

  var SETTINGS_KEY = 'mtm.settings';
  var PROFILE_KEY = 'mtm.profile';
  var THEMES = ['theme-kid', 'theme-adult', 'theme-neutral'];
  var FEEDBACK_DELAY = 900;

  var settings = null;
  var round = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* приватный режим или переполнение — работаем без сохранения */
    }
  }

  function loadSettings() {
    var raw = null;
    var stored = storageGet(SETTINGS_KEY);
    if (stored) {
      try {
        raw = JSON.parse(stored);
      } catch (error) {
        raw = null;
      }
    }
    if (!raw || typeof raw !== 'object') raw = {};
    if (!raw.profile) raw.profile = storageGet(PROFILE_KEY) || 'kid';
    var normalized = MTM.normalizeSettings(raw);
    storageSet(SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function saveSettings() {
    storageSet(SETTINGS_KEY, JSON.stringify(settings));
  }

  function selectedFormats() {
    var out = [];
    var i;
    for (i = 0; i < MTM.FORMATS.length; i++) {
      var name = MTM.FORMATS[i];
      if (els.fmt[name] && els.fmt[name].checked) out.push(name);
    }
    return out;
  }

  function readRaw() {
    return {
      profile: els.profile.value,
      aFrom: String(els.aFrom.value).trim(),
      aTo: String(els.aTo.value).trim(),
      bFrom: String(els.bFrom.value).trim(),
      bTo: String(els.bTo.value).trim(),
      formats: selectedFormats(),
      answerType: els.answerType.value,
      roundLength: String(els.roundLength.value).trim()
    };
  }

  function readForm() {
    return MTM.normalizeSettings(readRaw());
  }

  function renderMessages() {
    var verdict = MTM.validateSettings(readRaw());
    els.settingsErrors.textContent = verdict.errors.join('; ');
    els.settingsWarnings.textContent = verdict.warnings.join('; ');
    els.startBtn.disabled = !verdict.ok;
    return verdict.ok;
  }

  function renderSettings() {
    var s = settings;
    var i;
    els.profile.value = s.profile;
    els.aFrom.value = s.aFrom;
    els.aTo.value = s.aTo;
    els.bFrom.value = s.bFrom;
    els.bTo.value = s.bTo;
    els.answerType.value = s.answerType;
    els.roundLength.value = s.roundLength;
    for (i = 0; i < MTM.FORMATS.length; i++) {
      var name = MTM.FORMATS[i];
      if (els.fmt[name]) els.fmt[name].checked = s.formats.indexOf(name) !== -1;
    }
  }

  function applyTheme(profile) {
    var theme = 'theme-' + (MTM.PROFILES[profile] ? profile : 'kid');
    var i;
    for (i = 0; i < THEMES.length; i++) els.body.classList.remove(THEMES[i]);
    els.body.classList.add(theme);
  }

  function showScreen(name) {
    els.screens.settings.classList.toggle('hidden', name !== 'settings');
    els.screens.quiz.classList.toggle('hidden', name !== 'quiz');
    els.screens.results.classList.toggle('hidden', name !== 'results');
  }

  function elapsedSeconds() {
    return Math.max(0, Math.floor((Date.now() - round.startedAt) / 1000));
  }

  function startTimer() {
    els.qTime.textContent = '00:00';
    return setInterval(function () {
      els.qTime.textContent = MTM.formatTime(elapsedSeconds());
    }, 1000);
  }

  function stopTimer() {
    if (round && round.timerId) {
      clearInterval(round.timerId);
      round.timerId = 0;
    }
  }

  function clearFeedback() {
    if (round && round.feedbackId) {
      clearTimeout(round.feedbackId);
      round.feedbackId = 0;
    }
  }

  function clearChildren(element) {
    element.innerHTML = '';
  }

  function startRound() {
    if (!renderMessages()) return;
    stopTimer();
    clearFeedback();
    var s = readForm();
    settings = s;
    saveSettings();

    round = {
      settings: s,
      pool: MTM.shuffle(MTM.buildPool(s)),
      usedKeys: [],
      lastKey: null,
      index: 0,
      correct: 0,
      wrong: 0,
      mistakes: [],
      startedAt: Date.now(),
      timerId: 0,
      feedbackId: 0,
      phase: 'idle',
      running: true,
      question: null
    };

    els.qCorrect.textContent = 'Верно: 0';
    els.qWrong.textContent = 'Ошибки: 0';
    els.answerHint.textContent = '';
    round.timerId = startTimer();
    showScreen('quiz');
    nextTurn();
  }

  function nextTurn() {
    if (!round || !round.running) return;
    if (round.index >= round.settings.roundLength) {
      finishRound();
      return;
    }

    round.index += 1;
    var next = MTM.nextQuestion(round.pool, round.usedKeys, round.lastKey);
    var key = MTM.questionKey(next.question);
    if (next.exhausted) {
      round.usedKeys = [key];
    } else {
      round.usedKeys.push(key);
    }
    round.lastKey = key;
    round.question = next.question;

    renderQuestion();
    round.phase = 'answering';
  }

  function renderQuestion() {
    var q = round.question;
    var useInput = round.settings.answerType === 'input';

    els.qProgress.textContent = 'Вопрос ' + round.index + ' из ' + round.settings.roundLength;
    els.questionCard.classList.remove('is-correct');
    els.questionCard.classList.remove('is-wrong');
    els.questionCard.textContent = q.prompt;
    els.answerHint.textContent = '';

    els.inputArea.classList.toggle('hidden', !useInput);
    els.choices.classList.toggle('hidden', useInput);

    if (useInput) {
      els.answerInput.value = '';
      els.answerInput.disabled = false;
      els.answerInput2.value = '';
      els.answerInput2.disabled = false;
      els.answerSubmit.disabled = false;
      els.answerInput2.classList.toggle('hidden', !q.pair);
      els.answerSep.classList.toggle('hidden', !q.pair);
      if (typeof els.answerInput.focus === 'function') els.answerInput.focus();
      return;
    }

    clearChildren(els.choices);
    var options = MTM.makeChoices(q);
    var i;
    for (i = 0; i < options.length; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = q.pair ? options[i].a + ' × ' + options[i].b : String(options[i]);
      button.addEventListener('click', function (option, element) {
        return function () {
          submitAnswer(option, element);
        };
      }(options[i], button));
      els.choices.appendChild(button);
    }
  }

  function setAnswerDisabled(disabled) {
    els.answerInput.disabled = disabled;
    els.answerInput2.disabled = disabled;
    els.answerSubmit.disabled = disabled;
    var buttons = els.choices.children;
    var i;
    for (i = 0; i < buttons.length; i++) buttons[i].disabled = disabled;
  }

  function markCorrectChoice() {
    var q = round.question;
    var target = q.pair ? q.answerText : String(q.answer);
    var buttons = els.choices.children;
    var i;
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent === target) buttons[i].classList.add('is-correct');
    }
  }

  function submitAnswer(given, element) {
    if (!round || !round.running || round.phase !== 'answering') return;

    var q = round.question;
    var isInput = round.settings.answerType === 'input';
    var value = given;
    var givenText;

    if (isInput) {
      if (value === undefined) {
        value = q.pair
          ? { a: els.answerInput.value, b: els.answerInput2.value }
          : els.answerInput.value;
      }
      if (q.pair) {
        var a = String(value.a === undefined || value.a === null ? '' : value.a).trim();
        var b = String(value.b === undefined || value.b === null ? '' : value.b).trim();
        if (a === '' || b === '') {
          els.answerHint.textContent = 'Введите оба числа';
          return;
        }
        value = { a: a, b: b };
        givenText = a + ' × ' + b;
      } else {
        var text = String(value === undefined || value === null ? '' : value).trim();
        if (text === '') {
          els.answerHint.textContent = 'Введите ответ';
          return;
        }
        value = text;
        givenText = text;
      }
    } else {
      givenText = q.pair ? value.a + ' × ' + value.b : String(value);
    }

    round.phase = 'feedback';
    var ok = MTM.checkAnswer(q, value);

    if (ok) {
      round.correct += 1;
      els.questionCard.classList.add('is-correct');
    } else {
      round.wrong += 1;
      round.mistakes.push({ prompt: q.prompt, given: givenText, answer: q.answerText });
      els.questionCard.classList.add('is-wrong');
      els.questionCard.textContent = q.prompt + ' — правильный ответ: ' + q.answerText;
      if (!isInput) markCorrectChoice();
    }

    if (!isInput && element && element.classList) {
      element.classList.add(ok ? 'is-correct' : 'is-wrong');
    }

    els.qCorrect.textContent = 'Верно: ' + round.correct;
    els.qWrong.textContent = 'Ошибки: ' + round.wrong;
    els.answerHint.textContent = ok ? '' : 'Правильный ответ: ' + q.answerText;
    setAnswerDisabled(true);

    var myRound = round;
    round.feedbackId = setTimeout(function () {
      if (round !== myRound) return;
      nextTurn();
    }, FEEDBACK_DELAY);
  }

  function finishRound() {
    stopTimer();
    clearFeedback();
    round.running = false;
    round.phase = 'done';

    var result = MTM.summarize({
      total: round.settings.roundLength,
      correct: round.correct,
      seconds: elapsedSeconds(),
      mistakes: round.mistakes
    });

    var key = MTM.bestKey(round.settings);
    var previous = null;
    var stored = storageGet(key);
    if (stored) {
      try {
        var parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' &&
            Number.isFinite(parsed.correct) && Number.isFinite(parsed.total) &&
            Number.isFinite(parsed.seconds)) {
          previous = parsed;
        }
      } catch (error) {
        previous = null;
      }
    }

    var best = previous;
    if (MTM.isBetter(result, previous)) {
      best = { correct: result.correct, total: result.total, seconds: result.seconds };
      storageSet(key, JSON.stringify(best));
    }

    els.resSummary.textContent = 'Верно ' + result.correct + ' из ' + result.total;
    els.resPercent.textContent = result.percent + '%';
    els.resTime.textContent = 'Время: ' + result.secondsText;

    clearChildren(els.resMistakes);
    var i;
    for (i = 0; i < result.mistakes.length; i++) {
      var mistake = result.mistakes[i];
      var item = document.createElement('li');
      item.textContent = mistake.prompt + ' — вы: ' + mistake.given + ', верно: ' + mistake.answer;
      els.resMistakes.appendChild(item);
    }

    els.bestLine.textContent = best
      ? 'Лучший результат: ' + best.correct + ' из ' + best.total + ', время ' + MTM.formatTime(best.seconds)
      : '';

    showScreen('results');
  }

  function quitRound() {
    stopTimer();
    clearFeedback();
    if (round) round.running = false;
    round = null;
    els.answerHint.textContent = '';
    setAnswerDisabled(false);
    showScreen('settings');
  }

  function onFieldChange() {
    var ok = renderMessages();
    if (ok) {
      settings = readForm();
      saveSettings();
    }
  }

  function onProfileChange() {
    var profile = MTM.PROFILES[els.profile.value] ? els.profile.value : 'kid';
    settings = MTM.applyProfile(readForm(), profile);
    storageSet(PROFILE_KEY, profile);
    applyTheme(profile);
    saveSettings();
    renderSettings();
    renderMessages();
  }

  function wireEvents() {
    var fields = [els.aFrom, els.aTo, els.bFrom, els.bTo, els.answerType, els.roundLength];
    var i;
    for (i = 0; i < MTM.FORMATS.length; i++) {
      if (els.fmt[MTM.FORMATS[i]]) fields.push(els.fmt[MTM.FORMATS[i]]);
    }
    for (i = 0; i < fields.length; i++) {
      fields[i].addEventListener('input', onFieldChange);
      fields[i].addEventListener('change', onFieldChange);
    }

    els.profile.addEventListener('change', onProfileChange);
    els.startBtn.addEventListener('click', startRound);
    els.quitBtn.addEventListener('click', quitRound);
    els.againBtn.addEventListener('click', startRound);
    els.settingsBtn.addEventListener('click', quitRound);

    els.answerSubmit.addEventListener('click', function () {
      submitAnswer();
    });

    var inputs = [els.answerInput, els.answerInput2];
    for (i = 0; i < inputs.length; i++) {
      (function (field) {
        field.addEventListener('input', function () {
          field.value = String(field.value).replace(/\D/g, '');
        });
        field.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitAnswer();
          }
        });
      })(inputs[i]);
    }
  }

  function init() {
    settings = loadSettings();
    els.profile.value = settings.profile;
    storageSet(PROFILE_KEY, settings.profile);
    applyTheme(settings.profile);
    renderSettings();
    renderMessages();
    showScreen('settings');
    wireEvents();
  }

  window.MTApp = {
    init: init,
    startRound: startRound,
    submitAnswer: submitAnswer,
    quitRound: quitRound,
    onFieldChange: onFieldChange,
    onProfileChange: onProfileChange,
    renderMessages: renderMessages,
    getState: function () {
      return { settings: settings, round: round };
    }
  };

  init();
})();
