const EXAM_QUESTION_COUNT = 40;
const EXAM_DURATION_SECONDS = 60 * 60;
const STORAGE_KEY = "ekzameni-practice-state-v2";
const THEME_KEY = "ekzameni-theme";

const questionsRoot = document.querySelector("#questions");
const answeredCount = document.querySelector("#answeredCount");
const totalCount = document.querySelector("#totalCount");
const scoreText = document.querySelector("#scoreText");
const progressBar = document.querySelector("#progressBar");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultDetails = document.querySelector("#resultDetails");
const gradeBadge = document.querySelector("#gradeBadge");
const bankSelect = document.querySelector("#bankSelect");
const variantSelect = document.querySelector("#variantSelect");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const timerCard = document.querySelector("#timerCard");
const timerText = document.querySelector("#timerText");
const timerLabel = document.querySelector("#timerLabel");
const bankEyebrow = document.querySelector("#bankEyebrow");
const heroTitle = document.querySelector("#heroTitle");
const heroText = document.querySelector("#heroText");
const questionNavigator = document.querySelector("#questionNavigator");
const mapSummary = document.querySelector("#mapSummary");
const firstUnansweredButton = document.querySelector("#firstUnansweredButton");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmText = document.querySelector("#confirmText");
const confirmCancel = document.querySelector("#confirmCancel");
const confirmAccept = document.querySelector("#confirmAccept");
const menuButton = document.querySelector("#menuButton");
const startTestButton = document.querySelector("#startTestButton");
const setupScreen = document.querySelector("#setupScreen");
const testScreen = document.querySelector("#testScreen");
const statusStrip = document.querySelector(".status-strip");
const rulesDialog = document.querySelector("#rulesDialog");
const rulesCancel = document.querySelector("#rulesCancel");
const rulesAccept = document.querySelector("#rulesAccept");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const scrollTopBtn = document.querySelector("#scrollTopBtn");
const setupCount = document.querySelector("#setupCount");
const setupModeHint = document.querySelector("#setupModeHint");

const questionBanks = [
  {
    id: "pm04",
    title: "ПМ04 Web",
    label: "ПМ04 Web · 2 курс",
    description: "Банк с ключами ответов для самопроверки и оценки.",
    questions: Array.isArray(window.QUESTIONS) ? window.QUESTIONS : []
  },
  {
    id: "pm03",
    title: "ПМ03 Java",
    label: "ПМ03 Java · 2 курс",
    description: "Банк с ключами ответов для самопроверки и оценки.",
    questions: Array.isArray(window.PM03_QUESTIONS) ? window.PM03_QUESTIONS : []
  }
].filter((bank) => bank.questions.length > 0);

const state = {
  isStarted: false,
  bankId: questionBanks[0]?.id ?? "",
  mode: "random40",
  variant: "all",
  submitted: false,
  answers: new Map(),
  quiz: [],
  activeQuestionId: null,
  timeLeft: null,
  timerId: null
};

let pendingConfirm = null;

function getActiveBank() {
  return questionBanks.find((bank) => bank.id === state.bankId) ?? questionBanks[0];
}

function getQuestionById(id) {
  for (const bank of questionBanks) {
    const found = bank.questions.find((question) => question.id === id);
    if (found) return found;
  }
  return null;
}

function isActiveExam() {
  return state.isStarted && state.mode === "exam" && !state.submitted && state.quiz.length > 0;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getPool() {
  const bank = getActiveBank();
  if (!bank) return [];
  if (state.variant === "all") {
    return bank.questions;
  }
  return bank.questions.filter((question) => String(question.variant) === state.variant);
}

function getVisibleQuestionCount() {
  const poolLength = getPool().length;
  return state.mode === "all" ? poolLength : Math.min(EXAM_QUESTION_COUNT, poolLength);
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeIcon.textContent = theme === "dark" ? "☼" : "☾";
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
}

function savePracticeState() {
  if (state.mode === "exam") return;
  const payload = {
    isStarted: state.isStarted,
    bankId: state.bankId,
    mode: state.mode,
    variant: state.variant,
    submitted: state.submitted,
    activeQuestionId: state.activeQuestionId,
    quizIds: state.quiz.map((question) => question.id),
    answers: [...state.answers.entries()]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPracticeState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!questionBanks.some((bank) => bank.id === parsed.bankId)) return false;

    const quiz = Array.isArray(parsed.quizIds)
      ? parsed.quizIds.map(getQuestionById).filter(Boolean)
      : [];
    if (!quiz.length) return false;

    state.isStarted = Boolean(parsed.isStarted);
    state.bankId = parsed.bankId;
    state.mode = parsed.mode === "all" ? "all" : "random40";
    state.variant = parsed.variant ?? "all";
    state.submitted = Boolean(parsed.submitted);
    state.quiz = quiz;
    state.answers = new Map(Array.isArray(parsed.answers) ? parsed.answers : []);
    state.activeQuestionId = parsed.activeQuestionId ?? quiz[0]?.id ?? null;
    return true;
  } catch {
    return false;
  }
}

function clearPracticeState() {
  localStorage.removeItem(STORAGE_KEY);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startExamTimer() {
  stopTimer();
  state.timeLeft = EXAM_DURATION_SECONDS;
  renderTimer();
  state.timerId = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    renderTimer();
    if (state.timeLeft === 0) {
      submitQuiz(true);
    }
  }, 1000);
}

function renderTimer() {
  const active = isActiveExam();
  timerCard.classList.toggle("active", active);
  timerCard.classList.toggle("danger", active && state.timeLeft !== null && state.timeLeft <= 5 * 60);

  if (state.mode !== "exam") {
    timerText.textContent = "--:--";
    timerLabel.textContent = "без таймера";
    return;
  }

  const seconds = state.timeLeft ?? EXAM_DURATION_SECONDS;
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");
  timerText.textContent = `${minutesPart}:${secondsPart}`;
  timerLabel.textContent = state.submitted ? "завершено" : "осталось";
}

function askConfirm({ title, text, acceptLabel = "Подтвердить", danger = true }) {
  if (pendingConfirm) pendingConfirm(false);

  confirmTitle.textContent = title;
  confirmText.textContent = text;
  confirmAccept.textContent = acceptLabel;
  confirmAccept.classList.toggle("danger-button", danger);
  confirmAccept.classList.toggle("primary", !danger);
  confirmDialog.hidden = false;
  document.body.classList.add("modal-open");
  confirmCancel.focus();

  return new Promise((resolve) => {
    pendingConfirm = resolve;
  });
}

function closeConfirm(value) {
  if (!pendingConfirm) return;
  const resolve = pendingConfirm;
  pendingConfirm = null;
  confirmDialog.hidden = true;
  document.body.classList.remove("modal-open");
  resolve(value);
}

async function confirmExamExit(actionText) {
  if (!isActiveExam()) return true;
  const unanswered = state.quiz.length - state.answers.size;
  return askConfirm({
    title: "Экзамен еще идет",
    text: `${actionText} Неотвеченных вопросов: ${unanswered}.`,
    acceptLabel: "Продолжить"
  });
}

async function confirmExamSubmit() {
  if (!isActiveExam()) return true;
  const unanswered = state.quiz.length - state.answers.size;
  return askConfirm({
    title: "Сдать экзамен?",
    text: unanswered
      ? `Осталось ${unanswered} вопросов без ответа. После сдачи изменить ответы нельзя.`
      : "Все вопросы заполнены. После сдачи изменить ответы нельзя.",
    acceptLabel: "Сдать экзамен",
    danger: false
  });
}

function openRulesModal() {
  rulesDialog.hidden = false;
  document.body.classList.add("modal-open");
  rulesCancel.focus();

  return new Promise((resolve) => {
    const cleanup = () => {
      rulesCancel.removeEventListener("click", onCancel);
      rulesAccept.removeEventListener("click", onAccept);
      rulesDialog.removeEventListener("click", onBackdrop);
    };
    const close = (value) => {
      cleanup();
      rulesDialog.hidden = true;
      document.body.classList.remove("modal-open");
      resolve(value);
    };
    const onCancel = () => close(false);
    const onAccept = () => close(true);
    const onBackdrop = (event) => {
      if (event.target === rulesDialog) close(false);
    };

    rulesCancel.addEventListener("click", onCancel);
    rulesAccept.addEventListener("click", onAccept);
    rulesDialog.addEventListener("click", onBackdrop);
  });
}

function buildQuiz(keepOrder = true) {
  const pool = getPool();
  if (state.mode === "all") {
    state.quiz = keepOrder ? [...pool] : shuffle(pool);
  } else {
    state.quiz = shuffle(pool).slice(0, EXAM_QUESTION_COUNT);
  }

  state.answers.clear();
  state.submitted = false;
  state.timeLeft = null;
  state.activeQuestionId = state.quiz[0]?.id ?? null;

  if (state.mode === "exam" && state.quiz.length > 0) {
    startExamTimer();
  } else {
    stopTimer();
  }

  savePracticeState();
  render();
}

function fillBanks() {
  bankSelect.replaceChildren();
  questionBanks.forEach((bank) => {
    const option = document.createElement("option");
    option.value = bank.id;
    option.textContent = `${bank.title} (${bank.questions.length})`;
    bankSelect.append(option);
  });
  bankSelect.value = state.bankId;
}

function fillVariants() {
  const pool = getActiveBank()?.questions ?? [];
  const variants = [...new Set(pool.map((question) => question.variant))].sort((a, b) => a - b);

  variantSelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Все варианты";
  variantSelect.append(allOption);

  variants.forEach((variant) => {
    const option = document.createElement("option");
    option.value = String(variant);
    option.textContent = `Вариант ${variant}`;
    variantSelect.append(option);
  });
  variantSelect.value = state.variant;
}

function gradeByPercent(percent) {
  if (percent >= 95) return { letter: "A", numeric: "4,0", traditional: "Отлично" };
  if (percent >= 90) return { letter: "A-", numeric: "3,67", traditional: "Отлично" };
  if (percent >= 85) return { letter: "B+", numeric: "3,33", traditional: "Хорошо" };
  if (percent >= 80) return { letter: "B", numeric: "3,0", traditional: "Хорошо" };
  if (percent >= 75) return { letter: "B-", numeric: "2,67", traditional: "Хорошо" };
  if (percent >= 70) return { letter: "C+", numeric: "2,33", traditional: "Удовлетворительно" };
  if (percent >= 65) return { letter: "C", numeric: "2,0", traditional: "Удовлетворительно" };
  if (percent >= 60) return { letter: "C-", numeric: "1,67", traditional: "Удовлетворительно" };
  if (percent >= 55) return { letter: "D+", numeric: "1,33", traditional: "Удовлетворительно" };
  if (percent >= 50) return { letter: "D", numeric: "1,0", traditional: "Удовлетворительно" };
  if (percent >= 25) return { letter: "F+", numeric: "0,5", traditional: "Неудовлетворительно" };
  return { letter: "F", numeric: "0", traditional: "Неудовлетворительно" };
}

function getResults() {
  const total = state.quiz.length;
  const answered = state.answers.size;
  const gradable = state.quiz.filter((question) => question.answer);
  const correct = gradable.reduce((sum, question) => {
    return sum + (state.answers.get(question.id) === question.answer ? 1 : 0);
  }, 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const points = total === EXAM_QUESTION_COUNT ? correct * 2.5 : percent;

  return { total, answered, gradable: gradable.length, correct, percent, points };
}

function updateSummary() {
  const { total, answered, gradable, correct, percent, points } = getResults();
  answeredCount.textContent = String(answered);
  totalCount.textContent = String(total);
  mapSummary.textContent = `${answered} из ${total}`;
  firstUnansweredButton.disabled = state.submitted || answered === total;
  progressBar.style.width = total ? `${Math.round((answered / total) * 100)}%` : "0";

  if (!state.submitted) {
    scoreText.textContent = state.mode === "exam" ? "в экзамене" : "выбрано";
    resultPanel.hidden = true;
    return;
  }

  if (gradable !== total) {
    answeredCount.textContent = String(answered);
    scoreText.textContent = "ответов";
    resultTitle.textContent = "Ответы сохранены";
    resultDetails.textContent = `Для ${total - gradable} вопросов нет ключей ответов, поэтому оценка недоступна.`;
    gradeBadge.textContent = "без ключей";
    resultPanel.hidden = false;
    return;
  }

  const grade = gradeByPercent(percent);
  answeredCount.textContent = String(correct);
  scoreText.textContent = "правильно";
  resultTitle.textContent = `${correct} из ${total} · ${percent}%`;
  resultDetails.textContent = `Баллы: ${points}. Ошибок: ${total - correct}. Не отвечено: ${total - answered}. ${grade.traditional}.`;
  gradeBadge.textContent = `${grade.letter} · ${grade.numeric}`;
  resultPanel.hidden = false;
}

function optionClass(question, optionId) {
  if (!state.submitted) return "";
  const selected = state.answers.get(question.id);
  if (!question.answer) return optionId === selected ? "chosen" : "";
  if (optionId === question.answer) return selected ? "correct" : "missed";
  if (optionId === selected) return "wrong";
  return "";
}

function scrollToQuestion(questionId) {
  const question = state.quiz.find((item) => item.id === questionId);
  if (!question) return;

  state.activeQuestionId = question.id;
  savePracticeState();
  renderNavigator();
  document.getElementById(`question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function goToRelativeQuestion(questionId, step) {
  const index = state.quiz.findIndex((question) => question.id === questionId);
  const next = state.quiz[index + step];
  if (next) scrollToQuestion(next.id);
}

function goToFirstUnanswered() {
  const first = state.quiz.find((question) => !state.answers.has(question.id));
  if (first) scrollToQuestion(first.id);
}

function setAnswer(question, optionId) {
  if (state.submitted) return;
  state.answers.set(question.id, optionId);
  state.activeQuestionId = question.id;
  savePracticeState();
  updateSummary();
  renderNavigator();
}

function clearAnswer(question) {
  if (state.submitted) return;
  state.answers.delete(question.id);
  savePracticeState();
  render();
}

function renderQuestion(question, index) {
  const article = document.createElement("article");
  article.className = "question-card";
  article.id = `question-${question.id}`;

  const head = document.createElement("div");
  head.className = "question-head";

  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = `${index + 1}. ${question.text}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${getActiveBank()?.title ?? "Тест"} · Вариант ${question.variant} · №${question.number}`;
  head.append(title, badge);

  const options = document.createElement("div");
  options.className = "options";

  question.options.forEach((option) => {
    const label = document.createElement("label");
    label.className = `option ${optionClass(question, option.id)}`.trim();

    const input = document.createElement("input");
    input.type = "radio";
    input.name = question.id;
    input.value = option.id;
    input.checked = state.answers.get(question.id) === option.id;
    input.disabled = state.submitted;
    input.addEventListener("change", () => setAnswer(question, option.id));

    const key = document.createElement("span");
    key.className = "option-key";
    key.textContent = option.id;

    const text = document.createElement("span");
    text.className = "option-text";
    text.append(document.createTextNode(option.text));

    label.append(input, key, text);
    options.append(label);
  });

  article.append(head, options);

  if (state.submitted) {
    const note = document.createElement("p");
    note.className = question.answer ? "answer-note" : "answer-note muted-note";
    if (question.answer) {
      const correctOption = question.options.find((option) => option.id === question.answer);
      note.textContent = `Правильный ответ: ${question.answer}) ${correctOption?.text ?? ""}`;
    } else {
      note.textContent = "Ключ ответа для этого вопроса не задан.";
    }
    article.append(note);
  }

  const footer = document.createElement("div");
  footer.className = "question-footer";

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "secondary compact";
  previousButton.textContent = "Назад";
  previousButton.disabled = index === 0;
  previousButton.addEventListener("click", () => goToRelativeQuestion(question.id, -1));

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "ghost-button compact";
  clearButton.textContent = "Очистить ответ";
  clearButton.disabled = state.submitted || !state.answers.has(question.id);
  clearButton.addEventListener("click", () => clearAnswer(question));

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "secondary compact";
  nextButton.textContent = index === state.quiz.length - 1 ? "К началу" : "Дальше";
  nextButton.addEventListener("click", () => {
    if (index === state.quiz.length - 1) {
      scrollToQuestion(state.quiz[0]?.id);
    } else {
      goToRelativeQuestion(question.id, 1);
    }
  });

  footer.append(previousButton, clearButton, nextButton);
  article.append(footer);
  return article;
}

function renderNavigator() {
  questionNavigator.replaceChildren(
    ...state.quiz.map((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.className = "nav-dot";
      button.classList.toggle("answered", state.answers.has(question.id));
      button.classList.toggle("current", question.id === state.activeQuestionId);
      button.classList.toggle("submitted", state.submitted);
      button.setAttribute("aria-label", `Перейти к вопросу ${index + 1}`);
      button.addEventListener("click", () => scrollToQuestion(question.id));
      return button;
    })
  );
}

function renderSetupCopy() {
  const bank = getActiveBank();
  const total = getPool().length;
  const visible = getVisibleQuestionCount();
  const modeText = {
    all: "Все вопросы без таймера",
    random40: "40 случайных вопросов",
    exam: "Экзамен: 40 вопросов, 60 минут"
  }[state.mode];

  bankEyebrow.textContent = bank?.label ?? "Тест";
  heroTitle.textContent = state.mode === "exam" ? "Экзаменационный режим" : "Подготовка и экзамен в одном месте";
  heroText.textContent = `${bank?.description ?? ""} В текущей выборке ${total} вопросов.`;
  setupCount.textContent = `${visible} вопросов будет открыто`;
  setupModeHint.textContent = modeText;
  startTestButton.textContent = state.mode === "exam" ? "Начать экзамен" : "Начать тестирование";
}

function render() {
  fillVariants();
  bankSelect.value = state.bankId;
  variantSelect.value = state.variant;

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  if (!state.isStarted) {
    setupScreen.hidden = false;
    testScreen.hidden = true;
    statusStrip.hidden = true;
    renderSetupCopy();
    return;
  }

  setupScreen.hidden = true;
  testScreen.hidden = false;
  statusStrip.hidden = false;
  bankEyebrow.textContent = getActiveBank()?.label ?? "Тест";
  checkButton.textContent = state.mode === "exam" ? "Сдать экзамен" : "Проверить";
  questionsRoot.replaceChildren(...state.quiz.map(renderQuestion));
  renderTimer();
  updateSummary();
  renderNavigator();
}

function submitQuiz(auto = false) {
  if (state.submitted) return;
  state.submitted = true;
  stopTimer();
  savePracticeState();
  render();
  if (auto) {
    resultDetails.textContent = `${resultDetails.textContent} Время истекло.`;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    render();
  });
});

bankSelect.addEventListener("change", () => {
  state.bankId = bankSelect.value;
  state.variant = "all";
  render();
});

variantSelect.addEventListener("change", () => {
  state.variant = variantSelect.value;
  render();
});

startTestButton.addEventListener("click", async () => {
  if (state.mode === "exam") {
    const accepted = await openRulesModal();
    if (!accepted) return;
    clearPracticeState();
  }

  state.isStarted = true;
  buildQuiz(state.mode === "all");
});

menuButton.addEventListener("click", async () => {
  const confirmed = await confirmExamExit("Выход в меню завершит текущую попытку.");
  if (!confirmed) return;

  if (!state.submitted && state.answers.size > 0 && state.mode !== "exam") {
    const leave = await askConfirm({
      title: "Выйти в меню?",
      text: "Текущая попытка будет закрыта. Новый старт соберет вопросы заново.",
      acceptLabel: "Выйти",
      danger: false
    });
    if (!leave) return;
  }

  state.isStarted = false;
  stopTimer();
  state.timeLeft = null;
  if (state.mode === "exam") {
    state.answers.clear();
    state.submitted = false;
  }
  state.answers.clear();
  state.quiz = [];
  state.activeQuestionId = null;
  state.submitted = false;
  clearPracticeState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

resetButton.addEventListener("click", async () => {
  const confirmed = await confirmExamExit("Сброс удалит все текущие ответы.");
  if (!confirmed) return;

  state.answers.clear();
  state.submitted = false;
  state.activeQuestionId = state.quiz[0]?.id ?? null;
  if (state.mode === "exam" && state.quiz.length > 0) {
    startExamTimer();
  } else {
    stopTimer();
    state.timeLeft = null;
  }
  savePracticeState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

checkButton.addEventListener("click", async () => {
  const confirmed = await confirmExamSubmit();
  if (confirmed) submitQuiz(false);
});

firstUnansweredButton.addEventListener("click", goToFirstUnanswered);
themeToggle.addEventListener("click", toggleTheme);
scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

window.addEventListener("scroll", () => {
  scrollTopBtn.hidden = window.scrollY < 360;
});

confirmCancel.addEventListener("click", () => closeConfirm(false));
confirmAccept.addEventListener("click", () => closeConfirm(true));
confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) closeConfirm(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!confirmDialog.hidden) closeConfirm(false);
    return;
  }

  const target = event.target;
  const isInteractiveTarget = target instanceof Element && target.matches("select, input, button");
  if (!state.isStarted || state.submitted || isInteractiveTarget) return;
  const activeQuestion = state.quiz.find((question) => question.id === state.activeQuestionId) ?? state.quiz[0];
  if (!activeQuestion) return;

  const keyNumber = Number(event.key);
  if (keyNumber >= 1 && keyNumber <= activeQuestion.options.length) {
    event.preventDefault();
    const option = activeQuestion.options[keyNumber - 1];
    setAnswer(activeQuestion, option.id);
    render();
    goToRelativeQuestion(activeQuestion.id, 1);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    goToRelativeQuestion(activeQuestion.id, 1);
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    goToRelativeQuestion(activeQuestion.id, -1);
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!isActiveExam()) return;
  event.preventDefault();
  event.returnValue = "";
});

initTheme();
fillBanks();
loadPracticeState();
render();
