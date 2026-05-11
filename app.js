const questionsRoot = document.querySelector("#questions");
const answeredCount = document.querySelector("#answeredCount");
const totalCount = document.querySelector("#totalCount");
const scoreText = document.querySelector("#scoreText");
const progressBar = document.querySelector("#progressBar");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultDetails = document.querySelector("#resultDetails");
const variantSelect = document.querySelector("#variantSelect");
const checkButton = document.querySelector("#checkButton");
const resetButton = document.querySelector("#resetButton");
const shuffleButton = document.querySelector("#shuffleButton");
const modeButtons = [...document.querySelectorAll(".mode-button")];

const allQuestions = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
const state = {
  mode: "all",
  variant: "all",
  submitted: false,
  answers: new Map(),
  quiz: []
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getPool() {
  if (state.variant === "all") {
    return allQuestions;
  }
  return allQuestions.filter((question) => String(question.variant) === state.variant);
}

function buildQuiz(keepOrder = true) {
  const pool = getPool();
  state.quiz = state.mode === "random40" ? shuffle(pool).slice(0, 40) : keepOrder ? [...pool] : shuffle(pool);
  state.answers.clear();
  state.submitted = false;
  render();
}

function fillVariants() {
  const variants = [...new Set(allQuestions.map((question) => question.variant))].sort((a, b) => a - b);
  variants.forEach((variant) => {
    const option = document.createElement("option");
    option.value = String(variant);
    option.textContent = `Вариант ${variant}`;
    variantSelect.append(option);
  });
}

function updateSummary() {
  const answered = state.answers.size;
  const total = state.quiz.length;
  answeredCount.textContent = String(answered);
  totalCount.textContent = String(total);
  progressBar.style.width = total ? `${Math.round((answered / total) * 100)}%` : "0";

  if (!state.submitted) {
    scoreText.textContent = "выбрано";
    resultPanel.hidden = true;
    return;
  }

  const correct = state.quiz.reduce((sum, question) => {
    return sum + (state.answers.get(question.id) === question.answer ? 1 : 0);
  }, 0);
  answeredCount.textContent = String(correct);
  scoreText.textContent = "правильно";
  resultTitle.textContent = `${correct} из ${total}`;
  resultDetails.textContent = `Ошибок: ${total - correct}. Не отвечено: ${total - answered}.`;
  resultPanel.hidden = false;
}

function optionClass(question, optionId) {
  if (!state.submitted) {
    return "";
  }
  const selected = state.answers.get(question.id);
  if (optionId === question.answer) {
    return selected ? "correct" : "missed";
  }
  if (optionId === selected) {
    return "wrong";
  }
  return "";
}

function renderQuestion(question, index) {
  const article = document.createElement("article");
  article.className = "question-card";

  const head = document.createElement("div");
  head.className = "question-head";

  const title = document.createElement("h2");
  title.className = "question-title";
  title.textContent = `${index + 1}. ${question.text}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `Вариант ${question.variant} · №${question.number}`;

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
    input.addEventListener("change", () => {
      state.answers.set(question.id, option.id);
      updateSummary();
    });

    const text = document.createElement("span");
    text.innerHTML = `<span class="option-letter">${option.id})</span> `;
    text.append(document.createTextNode(option.text));

    label.append(input, text);
    options.append(label);
  });

  article.append(head, options);

  if (state.submitted) {
    const note = document.createElement("p");
    const correctOption = question.options.find((option) => option.id === question.answer);
    note.className = "answer-note";
    note.textContent = `Правильный ответ: ${question.answer}) ${correctOption?.text ?? ""}`;
    article.append(note);
  }

  return article;
}

function render() {
  questionsRoot.replaceChildren(...state.quiz.map(renderQuestion));
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  updateSummary();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    buildQuiz();
  });
});

variantSelect.addEventListener("change", () => {
  state.variant = variantSelect.value;
  buildQuiz();
});

shuffleButton.addEventListener("click", () => {
  buildQuiz(false);
});

resetButton.addEventListener("click", () => {
  state.answers.clear();
  state.submitted = false;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

checkButton.addEventListener("click", () => {
  state.submitted = true;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

fillVariants();
buildQuiz();
