# Тренажёр таблицы умножения — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> (native, inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** Отдельный статический сайт-тренажёр таблицы умножения со настраиваемыми
диапазонами множителей, набором видов заданий и двумя способами ответа.

**Architecture:** Чистые HTML+CSS+JS без сборки. `logic.js` — UMD-модуль с чистыми
функциями (пул, варианты, проверка, итоги); `app.js` — только DOM, экраны и
`localStorage`. Тесты — `node --test` на встроенном раннере.

**Tech Stack:** Ванильный JS (ES5-совместимый синтаксис как в прошлом проекте), CSS,
Node `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-17-multiplication-trainer-design.md`

## Global Constraints

- Без сборки, без npm, без внешних зависимостей и CDN. Только локальные файлы.
- Часть `<script src>` — классические теги (не ES-модули), порядок: `styles.css`,
  `logic.js`, `app.js`. Страница обязана работать по `file://`.
- `logic.js` — UMD: в браузере `globalThis.MTM`, в Node `module.exports`.
- Тесты запускаются ровно так: `node --test` (без пути-каталога — на этой платформе
  `node --test test/` не работает).
- Ключи `localStorage` начинаются с `mtm.` (`mtm.settings`, `mtm.profile`, `mtm.best.*`).
- Весь текст интерфейса — на русском.
- Числа из полей ввода разбираются строго: только цифры (`toInt`).
- Диапазоны множителей — целые `1..100`. По умолчанию школьник `2..9 × 2..9`.
- Существующие репозитории `MrFeoder/math-trainer` и `MrFeoder/besplatniy-sait` не трогать.

## Review Focus

1. Перевёрнутый или вырожденный диапазон (`от > до`, `1..1`) — `validateSettings`
   блокирует, `buildPool` не падает и отдаёт корректный (возможно пустой) пул.
2. Обратное задание — перевёрнутая пара `8 × 7` считается верной для `56 = ? × ?`,
   неверная пара (`6 × 8`) — нет.
3. `makeChoices` всегда даёт 4 уникальных варианта и ровно один верный, даже для
   вырожденных вопросов (`1 × 1`, обратное `56`), без нулей и дубликатов.
4. Битый или недоступный `localStorage` — приложение работает на умолчаниях, консоль чистая.
5. Зависший таймер обратной связи после «Прервать»/«Начать» не пропускает первый вопрос
   нового раунда.

---

### Task 1: `logic.js` — настройки

**Files:**
- Create: `logic.js`
- Create: `test/logic.test.js`

**Interfaces:**
- Produces: `MTM.FORMATS = ['direct','missing','reverse','division']`,
  `MTM.ANSWER_TYPES = ['input','choice']`,
  `MTM.PROFILES = { kid:{aFrom:2,aTo:9,bFrom:2,bTo:9}, adult:{aFrom:2,aTo:12,bFrom:2,bTo:12}, neutral:{aFrom:2,aTo:10,bFrom:2,bTo:10} }`,
  `MTM.toInt(value) -> number|NaN`,
  `MTM.defaultsFor(profile) -> Settings`,
  `MTM.applyProfile(settings, profile) -> Settings`,
  `MTM.validateSettings(settings) -> { ok, errors, warnings }`,
  `MTM.normalizeSettings(raw) -> Settings`.
- Settings shape: `{ profile, aFrom, aTo, bFrom, bTo, formats, answerType, roundLength }`.

- [ ] **Step 1: Write failing tests** in `test/logic.test.js` for: корректные настройки
  (`ok:true`); числовые строки из формы; пустое/нечисловое/дробное/0/-5/>100 и
  «от > до» по каждому диапазону; пустой `formats` → ошибка; плохие `answerType`,
  `roundLength`; предупреждение при `aTo > 20` (не блокирует); `defaultsFor`,
  `applyProfile` (диапазоны профиля, прочие поля не тронуты), `normalizeSettings`
  (мусор → умолчания, валидные поля сохранены).
- [ ] **Step 2: Run** `node --test` — падает (`Cannot find module '../logic.js'`).
- [ ] **Step 3: Implement** `logic.js` с UMD-обёрткой, `toInt`, `defaultsFor`,
  `applyProfile`, `validateSettings`, `normalizeSettings`. `toInt` принимает только
  `/^\d+$/` после `trim`.
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: логика настроек тренажёра умножения`.

### Task 2: `logic.js` — пул вопросов

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: `Settings` из Task 1.
- Produces: `MTM.questionKey(q) -> string` (`format:a x b:variant`),
  `MTM.shuffle(array) -> array`, `MTM.buildPool(settings) -> Question[]`,
  `MTM.nextQuestion(pool, usedKeys, lastKey) -> { question, exhausted }`.
- Question shape: `{ format, a, b, product, variant, pair, prompt, answer, answerText }`.
  `variant` ∈ `'' | 'askB' | 'askA' | 'divA' | 'divB'`. Прямой — `a × b = ?`; пропущенный —
  `a × ? = product` (askB, ответ `b`) и `? × b = product` (askA, ответ `a`); деление —
  `product ÷ a = ?` (divA, ответ `b`) и `product ÷ b = ?` (divB, ответ `a`); обратный —
  `product = ? × ?` (pair `true`, ответ `product`, `answerText = a + ' × ' + b`).

- [ ] **Step 1: Write failing tests**: `buildPool` для прямой пары `7,8` (prompt,
  answer, answerText, variant); для `missing` — оба варианта; для `division` — оба
  варианта; для `reverse` — `pair:true`; подсчёт размера пула для набора форматов
  (одна пара: 1 + 2 + 1 + 2 = 6 вопросов при всех форматах); перевёрнутый диапазон → `[]`;
  `1..1 × 1..1` не падает; `questionKey` уникален и различает варианты;
  `shuffle` — новый массив; `nextQuestion` не повторяет подряд и переиспользует пул.
- [ ] **Step 2: Run** `node --test` — падает.
- [ ] **Step 3: Implement** эти функции. `buildPool(settings)` берёт `aFrom..aTo`,
  `bFrom..bTo`, только выбранные `formats`; при `aFrom > aTo` или `bFrom > bTo` → `[]`.
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: генерация пула вопросов таблицы умножения`.

### Task 3: `logic.js` — варианты ответа и проверка

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: `Question` из Task 2.
- Produces: `MTM.makeChoices(question, count = 4) -> (number[] | {a,b}[])`,
  `MTM.checkAnswer(question, given) -> boolean`. Для обратного `given` — `{ a, b }`:
  верно, если оба целые ≥ 1 и `a*b === product`.

- [ ] **Step 1: Write failing tests**: для прямого/пропущенного/деления — 4 уникальных
  положительных числа, ровно одно равно `answer`; перебор по диапазону `a,b = 1..12`
  и всем форматам без дубликатов; для обратного — 4 уникальные пары, ровно одна с
  произведением `product`; `checkAnswer`: `'07'` == `7`; `'49.0'`/`''`/`'ab'`/`null` →
  `false`; обратный — `{a:8,b:7}` → `true` (перевёрнутая), `{a:6,b:8}` → `false`,
  `{a:0,b:56}`/`{a:7}`/`null` → `false`.
- [ ] **Step 2: Run** `node --test` — падает.
- [ ] **Step 3: Implement** `makeChoices` (числовые дистракторы: `product±a`, `±b`, `±1`,
  `(a±1)·b`, `a·(b±1)`; для пропущенного/деления — соседние числа и второй множитель;
  обратный — соседние пары с другим произведением; добивка соседними значениями, пока
  не наберётся `count`) и `checkAnswer`.
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: варианты ответа и проверка`.

### Task 4: `logic.js` — итоги и ключи

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Produces: `MTM.formatTime(seconds) -> "мм:сс"`, `MTM.summarize(round) -> Result`,
  `MTM.bestKey(settings) -> string`, `MTM.isBetter(a, b) -> boolean`.
  `bestKey` = `mtm.best.<answerType>.<formats sorted joined '+'>.<aFrom>-<aTo>.<bFrom>-<bTo>`.

- [ ] **Step 1: Write failing tests**: `formatTime` границы (`0`, `5`, `59`, `60`, `3600`);
  `summarize` — проценты, время, `mistakes` проходят как есть, деление на ноль безопасно,
  округление; `bestKey` для разных типов ответа/наборов форматов/диапазонов; `isBetter`
  (больше верных лучше, при равенстве быстрее, `null`/`undefined` → `true`, равные → `false`).
- [ ] **Step 2: Run** `node --test` — падает.
- [ ] **Step 3: Implement** эти четыре функции.
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: итоги раунда и ключ лучшего результата`.

### Task 5: Разметка и оформление

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `test/markup.test.js`

**Interfaces:**
- Produces id, на которые опирается Task 6: `profile`, `a-from`, `a-to`, `b-from`,
  `b-to`, `fmt-direct`, `fmt-missing`, `fmt-reverse`, `fmt-division`, `answer-type`,
  `round-length`, `settings-errors`, `settings-warnings`, `start-btn`,
  `screen-settings`, `screen-quiz`, `screen-results`, `q-progress`, `q-correct`,
  `q-wrong`, `q-time`, `question-card`, `answer-input`, `answer-input-2`, `answer-sep`,
  `answer-submit`, `choices`, `answer-hint`, `quit-btn`, `res-summary`, `res-percent`,
  `res-time`, `res-mistakes`, `best-line`, `again-btn`, `settings-btn`.

- [ ] **Step 1: Write `test/markup.test.js`**: все id присутствуют; `styles.css` раньше
  `logic.js` раньше `app.js`; нет `type="module"`; темы `theme-kid/adult/neutral` в
  CSS; есть `@media`; в HTML нет `http(s)://`.
- [ ] **Step 2: Run** `node --test` — падает (нет `index.html`).
- [ ] **Step 3: Create** `index.html` (три секции-экрана, четыре галочки форматов,
  два диапазона, поле второго ответа скрыто по умолчанию) и `styles.css` (темы
  профилей kid/adult/neutral, адаптив, классы `.hidden`, `.is-correct`, `.is-wrong`,
  `.choices`).
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: разметка и оформление страницы`.

### Task 6: `app.js` — логика экранов

**Files:**
- Create: `app.js`
- Create: `test/ui.test.js`

**Interfaces:**
- Consumes: `MTM` (Tasks 1-4), id из Task 5.
- Produces: `window.MTApp` с `init, startRound, submitAnswer, quitRound,
  onFieldChange, onProfileChange, renderMessages, getState()`; `getState()` →
  `{ settings, round }`. Ключи: `mtm.settings`, `mtm.profile`. Пауза обратной связи 900 мс.

- [ ] **Step 1: Write `test/ui.test.js`** на минимальном DOM-стабе (как в прошлом
  проекте): стартовое состояние (настройки видны, кнопка активна, `mtm.settings` и
  `mtm.profile` записаны); ошибки/предупреждения; режим «вписать» (верный/неверный/
  повторный ответ); пустой ответ; обратный ввод — два поля, перевёрнутая пара верна;
  режим «выбрать» — 4 кнопки, верная и неверная подсветки; обратный выбор — пары;
  раунд до итогов и лучший результат; битый и недоступный `localStorage`; диапазон
  `1..1`; смена профиля (тема + диапазоны); Enter; отбрасывание нецифр; «Прервать» без
  записи лучшего результата; зависший таймер не пропускает первый вопрос.
- [ ] **Step 2: Run** `node --test` — падает.
- [ ] **Step 3: Implement** `app.js` (экраны, рендер вопроса, оба режима ответа,
  таймер, обратная связь, итоги, `localStorage` с try/catch, `window.MTApp`).
- [ ] **Step 4: Run** `node --test` — проходит.
- [ ] **Step 5: Commit** `feat: логика экранов, оба типа ответа и итоги`.

### Task 7: README, `.nojekyll`, публикация

**Files:**
- Create: `README.md`
- Create: `.nojekyll`

- [ ] **Step 1: Create** `README.md` (что это, живой адрес, `node --test`, как
  опубликовать) и пустой `.nojekyll`.
- [ ] **Step 2: Run** `node --test` — всё зелёное.
- [ ] **Step 3: Commit** `docs: README и .nojekyll`.
- [ ] **Step 4: Publish**: `gh repo create MrFeoder/multiplication-trainer --public
  --source . --push`; включить Pages (`main`, `/ (root)`); дождаться статуса `built`;
  проверить, что живой адрес отвечает 200 и содержит «Таблица умножения».
- [ ] **Step 5: Verify** `MrFeoder/besplatniy-sait` не изменён (дата последнего push).

---

## Self-Review

- **Spec coverage:** §5.1→Task 5/6, §5.2→Task 6, §5.3→Task 6, §7.1-5→Task 1,
  §7.6-9→Task 2, §7.10-11→Task 3, §7.12-15→Task 4, §8→Tasks 1-3 (тесты) + 6 (UI),
  §9→тесты в каждом, §10-11→Task 7. Пробелов нет.
- **Step scan:** каждый шаг — одно действие с проверяемым результатом; тела функций не
  переписаны, даны сигнатуры и значения из spec.
- **Type consistency:** имена `aFrom/aTo/bFrom/bTo`, `formats`, `answerType`,
  `roundLength`, `variant`, `pair`, `answerText`, `product` сквозные для всех задач.
- **Review Focus:** пункты 1-2 → Task 2/3 и UI в Task 6; пункт 3 → Task 3; пункт 4 →
  Task 6 (битый/недоступный `localStorage`); пункт 5 → Task 6 (зависший таймер).
