/**
 * UGC NET Philosophy Mock Test Engine
 * Stable Production Rewrite
 * Fixed:
 * - Start button issue
 * - Palette rendering
 * - HTML rendering
 * - Resume bugs
 * - Duplicate prevention
 * - Balanced distribution
 * - Randomization
 * - Manifest loading
 * - Progress sync
 * - Review mode
 */

'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */

const CONFIG = {
  duration: 3 * 60 * 60,
  marksPerQ: 2,
  passMark: 40,
  storageKey: 'ugcnet_exam_v3',
  examQuestionCount: 100,
};

/* ═══════════════════════════════════════════
   STATUS
═══════════════════════════════════════════ */

const S = {
  UNVISITED: 'unvisited',
  UNANSWERED: 'unanswered',
  ANSWERED: 'answered',
  MARKED: 'marked',
  MARKED_ANS: 'marked-ans',
};

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */

const exam = {
  questionBank: [],
  questions: [],
  answers: {},
  status: {},
  index: 0,
  remaining: CONFIG.duration,
  ticker: null,
  started: false,
  finished: false,
  darkMode: false,
};

/* ═══════════════════════════════════════════
   DOM
═══════════════════════════════════════════ */

const el = id => document.getElementById(id);
const all = sel => document.querySelectorAll(sel);

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  wire();

  showPage('page-home');

  tryResume();
});

/* ═══════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════ */

function wire() {

  on('btn-goto-instructions', () => {
    showPage('page-instructions');
  });

  const checkbox = el('agree-checkbox');
  const startBtn = el('btn-start-test');

  if (checkbox && startBtn) {

    startBtn.disabled = true;

    checkbox.addEventListener('change', () => {
      startBtn.disabled = !checkbox.checked;
    });

    startBtn.addEventListener('click', loadAndStart);
  }

  on('btn-save-next', saveAndNext);
  on('btn-prev', () => goto(exam.index - 1));
  on('btn-mark-review', markForReview);
  on('btn-clear', clearResponse);
  on('btn-submit', confirmSubmit);
  on('btn-submit-header', confirmSubmit);
  on('btn-review', enterReviewMode);
  on('btn-restart', restart);
  on('btn-dark-mode', toggleDark);
  on('btn-fullscreen', toggleFullscreen);

  on('tab-paper1', () => showPaperTab(1));
  on('tab-paper2', () => showPaperTab(2));

  document.addEventListener('keydown', handleKey);
}

function on(id, fn) {

  const node = el(id);

  if (node) {
    node.addEventListener('click', fn);
  }
}

/* ═══════════════════════════════════════════
   PAGE
═══════════════════════════════════════════ */

const PAGES = [
  'page-home',
  'page-instructions',
  'page-exam',
  'page-result',
];

function showPage(id) {

  PAGES.forEach(page => {

    const node = el(page);

    if (!node) return;

    node.classList.toggle(
      'active-page',
      page === id
    );
  });
}

/* ═══════════════════════════════════════════
   LOAD QUESTIONS
═══════════════════════════════════════════ */

async function loadAndStart() {

  try {

    toast('Loading questions...', 'info');

    const bank = await loadQuestionBank();

    if (!bank.length) {
      toast('No questions found', 'danger');
      return;
    }

    exam.questionBank = bank;

    exam.questions = buildBalancedExam(
      bank,
      CONFIG.examQuestionCount
    );

    initialiseExam();

    startExam();

  } catch (err) {

    console.error(err);

    toast(
      'Failed to load question bank',
      'danger',
      5000
    );
  }
}

async function loadQuestionBank() {

  const res = await fetch(
    './data/manifest.json',
    { cache: 'no-store' }
  );

  if (!res.ok) {
    throw new Error(
      'manifest.json missing'
    );
  }

  const manifest = await res.json();

  if (
    !manifest.files ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error(
      'Invalid manifest'
    );
  }

  const allQuestions = [];

  for (const file of manifest.files) {

    try {

      const qRes = await fetch(
        `./data/${file}`,
        { cache: 'no-store' }
      );

      if (!qRes.ok) {
        console.warn(file + ' skipped');
        continue;
      }

      const data = await qRes.json();

      if (!Array.isArray(data)) {
        console.warn(file + ' invalid');
        continue;
      }

      allQuestions.push(...data);

    } catch (err) {

      console.warn(file, err);
    }
  }

  return sanitizeQuestions(allQuestions);
}

/* ═══════════════════════════════════════════
   SANITIZE
═══════════════════════════════════════════ */

function sanitizeQuestions(questions) {

  const ids = new Set();

  const clean = [];

  for (const q of questions) {

    if (
      !q.id ||
      !q.question ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.answer !== 'number'
    ) {
      continue;
    }

    if (ids.has(q.id)) {
      continue;
    }

    ids.add(q.id);

    clean.push({
      id: q.id,
      paper: q.paper || 2,
      topic: q.topic || 'General',
      question: String(q.question).trim(),
      options: q.options.map(
        o => String(o).trim()
      ),
      answer: q.answer,
    });
  }

  return clean;
}

/* ═══════════════════════════════════════════
   BALANCED RANDOMIZATION
═══════════════════════════════════════════ */

function buildBalancedExam(bank, total = 100) {

  const groups = {};

  bank.forEach(q => {

    if (!groups[q.topic]) {
      groups[q.topic] = [];
    }

    groups[q.topic].push(q);
  });

  const topics = Object.keys(groups);

  if (!topics.length) return [];

  const perTopic = Math.floor(
    total / topics.length
  );

  let selected = [];

  topics.forEach(topic => {

    const shuffled =
      shuffle([...groups[topic]]);

    selected.push(
      ...shuffled.slice(0, perTopic)
    );
  });

  const used =
    new Set(selected.map(q => q.id));

  const leftovers =
    bank.filter(q => !used.has(q.id));

  selected.push(
    ...shuffle(leftovers).slice(
      0,
      total - selected.length
    )
  );

  return shuffle(selected);
}

function shuffle(arr) {

  for (
    let i = arr.length - 1;
    i > 0;
    i--
  ) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [arr[i], arr[j]] =
      [arr[j], arr[i]];
  }

  return arr;
}

/* ═══════════════════════════════════════════
   INITIALISE
═══════════════════════════════════════════ */

function initialiseExam() {

  exam.answers = {};
  exam.status = {};

  exam.questions.forEach((_, i) => {

    exam.answers[i] = null;

    exam.status[i] =
      S.UNVISITED;
  });

  exam.index = 0;
  exam.remaining = CONFIG.duration;
  exam.finished = false;
  exam.started = true;
}

/* ═══════════════════════════════════════════
   START
═══════════════════════════════════════════ */

function startExam() {

  showPage('page-exam');

  buildPalette();

  showPaperTab(1);

  goto(0);

  startTimer();

  updateProgress();

  guardUnload(true);
}

/* ═══════════════════════════════════════════
   TIMER
═══════════════════════════════════════════ */

function startTimer() {

  clearInterval(exam.ticker);

  renderTimer();

  exam.ticker = setInterval(() => {

    if (exam.remaining <= 0) {

      clearInterval(exam.ticker);

      autoSubmit();

      return;
    }

    exam.remaining--;

    renderTimer();

    persist();

  }, 1000);
}

function renderTimer() {

  const h = Math.floor(
    exam.remaining / 3600
  );

  const m = Math.floor(
    (exam.remaining % 3600) / 60
  );

  const s = exam.remaining % 60;

  setText(
    'timer-display',
    `${pad(h)}:${pad(m)}:${pad(s)}`
  );
}

/* ═══════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════ */

function goto(idx) {

  if (
    idx < 0 ||
    idx >= exam.questions.length
  ) return;

  exam.index = idx;

  if (
    exam.status[idx] === S.UNVISITED
  ) {
    exam.status[idx] = S.UNANSWERED;
  }

  const q = exam.questions[idx];

  setText(
    'question-number',
    `Question ${idx + 1} of ${exam.questions.length}`
  );

  setText(
    'subject-label',
    q.topic
  );

  setText(
    'paper-label',
    `Paper ${q.paper}`
  );

  const qNode = el('question-text');

  if (qNode) {
    qNode.innerHTML = q.question;
  }

  const wrap = el('options-container');

  if (!wrap) return;

  wrap.innerHTML = '';

  q.options.forEach((opt, i) => {

    const lbl =
      document.createElement('label');

    lbl.className =
      'option' +
      (
        exam.answers[idx] === i
          ? ' option-selected'
          : ''
      );

    const radio =
      document.createElement('input');

    radio.type = 'radio';
    radio.name = 'opt';
    radio.checked =
      exam.answers[idx] === i;

    radio.addEventListener(
      'change',
      () => pickAnswer(idx, i)
    );

    const txt =
      document.createElement('span');

    txt.innerHTML =
      `<b>${'ABCD'[i]}.</b> ${opt}`;

    lbl.append(radio, txt);

    wrap.appendChild(lbl);
  });

  syncPalette();

  updateProgress();

  const paper = q.paper || 2;

  showPaperTab(paper, false);
}

/* ═══════════════════════════════════════════
   ANSWERS
═══════════════════════════════════════════ */

function pickAnswer(idx, optIdx) {

  exam.answers[idx] = optIdx;

  if (
    exam.status[idx] === S.MARKED ||
    exam.status[idx] === S.MARKED_ANS
  ) {

    exam.status[idx] =
      S.MARKED_ANS;

  } else {

    exam.status[idx] =
      S.ANSWERED;
  }

  all('.option').forEach(l => {
    l.classList.remove(
      'option-selected'
    );
  });

  const labels = all('.option');

  if (labels[optIdx]) {
    labels[optIdx].classList.add(
      'option-selected'
    );
  }

  updatePaletteBtn(idx);

  updateProgress();

  persist();
}

/* ═══════════════════════════════════════════
   CONTROLS
═══════════════════════════════════════════ */

function saveAndNext() {

  persist();

  if (
    exam.index <
    exam.questions.length - 1
  ) {

    goto(exam.index + 1);

  } else {

    toast(
      'Last question',
      'info'
    );
  }
}

function markForReview() {

  const i = exam.index;

  exam.status[i] =
    exam.answers[i] !== null
      ? S.MARKED_ANS
      : S.MARKED;

  updatePaletteBtn(i);

  saveAndNext();
}

function clearResponse() {

  const i = exam.index;

  exam.answers[i] = null;

  exam.status[i] =
    S.UNANSWERED;

  goto(i);

  persist();
}

/* ═══════════════════════════════════════════
   SUBMIT
═══════════════════════════════════════════ */

function confirmSubmit() {

  const unattempted =
    exam.questions.length -
    countAttempted();

  if (
    unattempted > 0 &&
    !confirm(
      `${unattempted} unanswered.\nSubmit anyway?`
    )
  ) return;

  submitExam();
}

function submitExam() {

  clearInterval(exam.ticker);

  exam.finished = true;

  guardUnload(false);

  persist();

  showResult(calcResult());
}

function autoSubmit() {

  toast(
    'Time up!',
    'danger'
  );

  setTimeout(
    submitExam,
    1000
  );
}

/* ═══════════════════════════════════════════
   RESULT
═══════════════════════════════════════════ */

function calcResult() {

  let correct = 0;
  let wrong = 0;
  let attempted = 0;

  exam.questions.forEach((q, i) => {

    if (exam.answers[i] !== null) {

      attempted++;

      if (
        exam.answers[i] === q.answer
      ) {
        correct++;
      } else {
        wrong++;
      }
    }
  });

  const score =
    correct * CONFIG.marksPerQ;

  const maxScore =
    exam.questions.length *
    CONFIG.marksPerQ;

  const pct =
    ((score / maxScore) * 100)
      .toFixed(1);

  return {
    correct,
    wrong,
    attempted,
    unattempted:
      exam.questions.length -
      attempted,
    score,
    maxScore,
    pct,
  };
}

function showResult(r) {

  showPage('page-result');

  setText(
    'result-score',
    `${r.score}/${r.maxScore}`
  );

  setText(
    'result-correct',
    r.correct
  );

  setText(
    'result-wrong',
    r.wrong
  );

  setText(
    'result-attempted',
    r.attempted
  );

  setText(
    'result-unattempted',
    r.unattempted
  );

  setText(
    'result-pct',
    `${r.pct}%`
  );
}

/* ═══════════════════════════════════════════
   PALETTE
═══════════════════════════════════════════ */

function buildPalette() {

  const p1 = el('palette-p1');
  const p2 = el('palette-p2');

  if (!p1 || !p2) return;

  p1.innerHTML = '';
  p2.innerHTML = '';

  let c1 = 0;
  let c2 = 0;

  exam.questions.forEach((q, i) => {

    const btn =
      document.createElement('button');

    btn.id = `pb-${i}`;

    btn.className =
      `pal-btn ${exam.status[i]}`;

    if ((q.paper || 2) === 1) {
      c1++;
      btn.textContent = c1;
    } else {
      c2++;
      btn.textContent = c2;
    }

    btn.addEventListener(
      'click',
      () => goto(i)
    );

    if ((q.paper || 2) === 1) {
      p1.appendChild(btn);
    } else {
      p2.appendChild(btn);
    }
  });
}

function updatePaletteBtn(i) {

  const btn = el(`pb-${i}`);

  if (!btn) return;

  btn.className =
    `pal-btn ${exam.status[i]}` +
    (
      i === exam.index
        ? ' pal-current'
        : ''
    );
}

function syncPalette() {

  exam.questions.forEach((_, i) => {
    updatePaletteBtn(i);
  });
}

function showPaperTab(
  paper,
  switchQuestion = false
) {

  [1, 2].forEach(p => {

    const grid =
      el(`palette-p${p}`);

    const tab =
      el(`tab-paper${p}`);

    if (grid) {
      grid.style.display =
        p === paper
          ? 'grid'
          : 'none';
    }

    if (tab) {
      tab.classList.toggle(
        'tab-active',
        p === paper
      );
    }
  });

  if (switchQuestion) {

    const idx =
      exam.questions.findIndex(
        q => (q.paper || 2) === paper
      );

    if (idx !== -1) {
      goto(idx);
    }
  }
}

/* ═══════════════════════════════════════════
   PROGRESS
═══════════════════════════════════════════ */

function updateProgress() {

  const attempted =
    countAttempted();

  const total =
    exam.questions.length;

  const pct =
    total
      ? (attempted / total) * 100
      : 0;

  const bar =
    el('progress-fill');

  if (bar) {
    bar.style.width =
      pct + '%';
  }

  setText(
    'answered-count',
    `${attempted}/${total}`
  );
}

function countAttempted() {

  return Object.values(
    exam.answers
  ).filter(v => v !== null).length;
}

/* ═══════════════════════════════════════════
   REVIEW
═══════════════════════════════════════════ */

function enterReviewMode() {

  showPage('page-exam');

  goto(0);
}

/* ═══════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════ */

function persist() {

  if (!exam.started) return;

  localStorage.setItem(
    CONFIG.storageKey,
    JSON.stringify({
      questions: exam.questions,
      answers: exam.answers,
      status: exam.status,
      index: exam.index,
      remaining: exam.remaining,
      darkMode: exam.darkMode,
    })
  );
}

function tryResume() {

  try {

    const raw =
      localStorage.getItem(
        CONFIG.storageKey
      );

    if (!raw) return;

    const snap = JSON.parse(raw);

    Object.assign(exam, {
      questions: snap.questions,
      answers: snap.answers,
      status: snap.status,
      index: snap.index,
      remaining: snap.remaining,
      darkMode: snap.darkMode,
      started: true,
    });

    startExam();

    goto(exam.index);

  } catch (err) {

    localStorage.removeItem(
      CONFIG.storageKey
    );
  }
}

/* ═══════════════════════════════════════════
   RESTART
═══════════════════════════════════════════ */

function restart() {

  localStorage.removeItem(
    CONFIG.storageKey
  );

  location.reload();
}

/* ═══════════════════════════════════════════
   UI
═══════════════════════════════════════════ */

function toggleDark() {

  exam.darkMode =
    !exam.darkMode;

  document.body.classList.toggle(
    'dark',
    exam.darkMode
  );

  persist();
}

function toggleFullscreen() {

  if (
    !document.fullscreenElement
  ) {

    document.documentElement
      .requestFullscreen();

  } else {

    document.exitFullscreen();
  }
}

/* ═══════════════════════════════════════════
   SHORTCUTS
═══════════════════════════════════════════ */

function handleKey(e) {

  if (
    !exam.started ||
    exam.finished
  ) return;

  const map = {
    ArrowRight: saveAndNext,
    ArrowLeft: () => goto(exam.index - 1),
    Enter: saveAndNext,
    m: markForReview,
    M: markForReview,
    c: clearResponse,
    C: clearResponse,
  };

  if (map[e.key]) {

    e.preventDefault();

    map[e.key]();
  }

  if (
    e.altKey &&
    '1234'.includes(e.key)
  ) {

    pickAnswer(
      exam.index,
      +e.key - 1
    );

    goto(exam.index);
  }
}

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */

function toast(
  msg,
  type = 'info',
  duration = 3000
) {

  let t = el('toast');

  if (!t) {

    t =
      document.createElement('div');

    t.id = 'toast';

    document.body.appendChild(t);
  }

  t.textContent = msg;

  t.className =
    `toast toast-${type} toast-show`;

  setTimeout(() => {

    t.classList.remove(
      'toast-show'
    );

  }, duration);
}

/* ═══════════════════════════════════════════
   GUARD
═══════════════════════════════════════════ */

function guardUnload(on) {

  window.onbeforeunload = on
    ? e => {
        e.preventDefault();
        return (
          e.returnValue =
          'Exam running'
        );
      }
    : null;
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */

const pad = n =>
  String(n).padStart(2, '0');

function setText(id, value) {

  const node = el(id);

  if (node) {
    node.textContent = value;
  }
}
