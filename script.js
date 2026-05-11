/**
 * UGC NET Philosophy Mock Test — Optimized script.js
 * ==================================================
 * Production-safe vanilla JS version for deployment.
 * Optimized for:
 * - Vercel
 * - Netlify
 * - GitHub Pages
 * - Mobile browsers
 * - Large JSON question banks
 */

'use strict';

/* ─────────────────────────────────────────────
   1. CONSTANTS
───────────────────────────────────────────── */
const CONFIG = {
  EXAM_DURATION_SECONDS: 3 * 60 * 60,
  MARKS_PER_QUESTION: 2,
  NEGATIVE_MARKING: 0,
  PASS_PERCENTAGE: 40,
  STORAGE_KEY: 'ugcnet_mock_progress_v2',
  QUESTIONS_PATH: './questions.json'
};

const STATUS = Object.freeze({
  NOT_VISITED: 'not-visited',
  NOT_ANSWERED: 'not-answered',
  ANSWERED: 'answered',
  MARKED: 'marked',
  MARKED_ANS: 'marked-answered',
});

/* ─────────────────────────────────────────────
   2. GLOBAL STATE
───────────────────────────────────────────── */
const state = {
  questions: [],
  userAnswers: {},
  questionStatus: {},
  currentIndex: 0,
  timerSeconds: CONFIG.EXAM_DURATION_SECONDS,
  timerInterval: null,
  examStarted: false,
  examFinished: false,
  activePaperFilter: 1,
  darkMode: false,
  soundAlerted: false,
};

/* ─────────────────────────────────────────────
   3. DOM HELPERS
───────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

function safeElement(id) {
  const el = $(id);

  if (!el) {
    console.warn(`Missing element: #${id}`);
  }

  return el;
}

function setText(id, text = '') {
  const el = safeElement(id);
  if (el) el.textContent = text;
}

function setHTML(id, html = '') {
  const el = safeElement(id);
  if (el) el.innerHTML = html;
}

function showPage(pageId) {
  const pages = [
    'page-home',
    'page-instructions',
    'page-exam',
    'page-result'
  ];

  pages.forEach(id => {
    const el = $(id);

    if (el) {
      el.classList.toggle('active-page', id === pageId);
    }
  });
}

/* ─────────────────────────────────────────────
   4. INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initializeApp();
  } catch (error) {
    console.error('Initialization failed:', error);
    alert('Application failed to load.');
  }
});

async function initializeApp() {
  showPage('page-home');

  bindHomeEvents();
  bindInstructionEvents();
  bindExamEvents();
  bindResultEvents();
  bindExtras();

  await loadQuestions();

  restoreProgress();
}

/* ─────────────────────────────────────────────
   5. LOAD QUESTIONS
───────────────────────────────────────────── */
async function loadQuestions() {
  try {
    const response = await fetch(CONFIG.QUESTIONS_PATH, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load questions.json (${response.status})`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('questions.json must be an array');
    }

    state.questions = data;

    initializeQuestionStatuses();

    console.log(
      `Loaded ${state.questions.length} questions successfully`
    );

  } catch (error) {
    console.error('Question loading error:', error);

    alert(
      'Unable to load questions.\n\n' +
      'Check:\n' +
      '- questions.json exists\n' +
      '- JSON syntax is valid\n' +
      '- fetch path is correct'
    );
  }
}

function initializeQuestionStatuses() {
  state.questions.forEach((_, index) => {
    if (!(index in state.questionStatus)) {
      state.questionStatus[index] = STATUS.NOT_VISITED;
    }
  });
}

/* ─────────────────────────────────────────────
   6. HOME EVENTS
───────────────────────────────────────────── */
function bindHomeEvents() {
  const btn = $('btn-goto-instructions');

  if (!btn) return;

  btn.addEventListener('click', () => {
    showPage('page-instructions');
  });
}

/* ─────────────────────────────────────────────
   7. INSTRUCTION EVENTS
───────────────────────────────────────────── */
function bindInstructionEvents() {
  const checkbox = $('agree-checkbox');
  const startBtn = $('btn-start-test');

  if (!checkbox || !startBtn) return;

  checkbox.addEventListener('change', () => {
    startBtn.disabled = !checkbox.checked;
  });

  startBtn.addEventListener('click', startExam);
}

/* ─────────────────────────────────────────────
   8. START EXAM
───────────────────────────────────────────── */
function startExam() {
  if (!state.questions.length) {
    alert('Questions not loaded.');
    return;
  }

  state.examStarted = true;

  showPage('page-exam');

  renderQuestion();

  startTimer();

  saveProgress();
}

/* ─────────────────────────────────────────────
   9. TIMER
───────────────────────────────────────────── */
function startTimer() {
  updateTimerDisplay();

  clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    state.timerSeconds--;

    updateTimerDisplay();

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      submitExam();
    }

    saveProgress();

  }, 1000);
}

function updateTimerDisplay() {
  const hours = Math.floor(state.timerSeconds / 3600);
  const minutes = Math.floor((state.timerSeconds % 3600) / 60);
  const seconds = state.timerSeconds % 60;

  const formatted =
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}`;

  setText('timer-display', formatted);
}

/* ─────────────────────────────────────────────
   10. RENDER QUESTION
───────────────────────────────────────────── */
function renderQuestion() {
  const question = state.questions[state.currentIndex];

  if (!question) return;

  setText(
    'question-number',
    `Question ${state.currentIndex + 1}`
  );

  setText(
    'subject-label',
    question.topic || 'Philosophy'
  );

  setHTML(
    'question-text',
    question.question || 'Question unavailable'
  );

  renderOptions(question);

  updatePalette();
}

function renderOptions(question) {
  const container = $('options-container');

  if (!container) return;

  container.innerHTML = '';

  question.options.forEach((option, index) => {
    const wrapper = document.createElement('label');

    wrapper.className = 'option-item';

    const checked =
      state.userAnswers[state.currentIndex] === index;

    wrapper.innerHTML = `
      <input
        type="radio"
        name="question-option"
        value="${index}"
        ${checked ? 'checked' : ''}
      >
      <span>${option}</span>
    `;

    wrapper.addEventListener('change', () => {
      state.userAnswers[state.currentIndex] = index;

      state.questionStatus[state.currentIndex] =
        STATUS.ANSWERED;

      saveProgress();
      updatePalette();
    });

    container.appendChild(wrapper);
  });
}

/* ─────────────────────────────────────────────
   11. EXAM EVENTS
───────────────────────────────────────────── */
function bindExamEvents() {

  $('btn-next')?.addEventListener('click', nextQuestion);

  $('btn-prev')?.addEventListener('click', previousQuestion);

  $('btn-clear')?.addEventListener('click', clearResponse);

  $('btn-submit')?.addEventListener('click', submitExam);
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
    saveProgress();
  }
}

function previousQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
    saveProgress();
  }
}

function clearResponse() {
  delete state.userAnswers[state.currentIndex];

  state.questionStatus[state.currentIndex] =
    STATUS.NOT_ANSWERED;

  renderQuestion();

  saveProgress();
}

/* ─────────────────────────────────────────────
   12. QUESTION PALETTE
───────────────────────────────────────────── */
function updatePalette() {
  const container = $('palette-container');

  if (!container) return;

  container.innerHTML = '';

  state.questions.forEach((_, index) => {
    const btn = document.createElement('button');

    btn.className =
      `palette-btn ${state.questionStatus[index]}`;

    btn.textContent = index + 1;

    btn.addEventListener('click', () => {
      state.currentIndex = index;
      renderQuestion();
    });

    container.appendChild(btn);
  });
}

/* ─────────────────────────────────────────────
   13. SUBMIT EXAM
───────────────────────────────────────────── */
function submitExam() {

  const confirmed = confirm(
    'Are you sure you want to submit the exam?'
  );

  if (!confirmed) return;

  clearInterval(state.timerInterval);

  state.examFinished = true;

  calculateResults();

  localStorage.removeItem(CONFIG.STORAGE_KEY);

  showPage('page-result');
}

/* ─────────────────────────────────────────────
   14. RESULT CALCULATION
───────────────────────────────────────────── */
function calculateResults() {

  let correct = 0;
  let wrong = 0;
  let attempted = 0;

  state.questions.forEach((q, index) => {

    const userAnswer = state.userAnswers[index];

    if (userAnswer === undefined) return;

    attempted++;

    if (userAnswer === q.answer) {
      correct++;
    } else {
      wrong++;
    }
  });

  const totalScore =
    (correct * CONFIG.MARKS_PER_QUESTION) -
    (wrong * CONFIG.NEGATIVE_MARKING);

  const maxScore =
    state.questions.length *
    CONFIG.MARKS_PER_QUESTION;

  const percentage =
    ((totalScore / maxScore) * 100).toFixed(2);

  setText('result-score', totalScore);
  setText('result-correct', correct);
  setText('result-wrong', wrong);
  setText('result-attempted', attempted);

  setText(
    'result-unattempted',
    state.questions.length - attempted
  );

  setText(
    'result-percentage',
    `${percentage}%`
  );

  setText(
    'result-status',
    percentage >= CONFIG.PASS_PERCENTAGE
      ? 'PASS'
      : 'FAIL'
  );
}

/* ─────────────────────────────────────────────
   15. RESULT EVENTS
───────────────────────────────────────────── */
function bindResultEvents() {

  $('btn-restart')?.addEventListener('click', () => {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    location.reload();
  });
}

/* ─────────────────────────────────────────────
   16. LOCAL STORAGE
───────────────────────────────────────────── */
function saveProgress() {

  try {

    localStorage.setItem(
      CONFIG.STORAGE_KEY,
      JSON.stringify({
        userAnswers: state.userAnswers,
        questionStatus: state.questionStatus,
        currentIndex: state.currentIndex,
        timerSeconds: state.timerSeconds,
      })
    );

  } catch (error) {

    console.warn(
      'Unable to save progress:',
      error
    );
  }
}

function restoreProgress() {

  try {

    const saved =
      localStorage.getItem(CONFIG.STORAGE_KEY);

    if (!saved) return;

    const data = JSON.parse(saved);

    state.userAnswers =
      data.userAnswers || {};

    state.questionStatus =
      data.questionStatus || {};

    state.currentIndex =
      data.currentIndex || 0;

    state.timerSeconds =
      data.timerSeconds ||
      CONFIG.EXAM_DURATION_SECONDS;

  } catch (error) {

    console.warn(
      'Unable to restore progress:',
      error
    );
  }
}

/* ─────────────────────────────────────────────
   17. EXTRAS
───────────────────────────────────────────── */
function bindExtras() {

  $('btn-dark-mode')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');

    state.darkMode =
      !state.darkMode;
  });

  $('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {

  if (!document.fullscreenElement) {

    document.documentElement.requestFullscreen?.();

  } else {

    document.exitFullscreen?.();
  }
}

/* ─────────────────────────────────────────────
   END
───────────────────────────────────────────── */
