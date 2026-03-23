const MAX_ROUNDS = 15;
const SCORE_CORRECT = 1;
const SCORE_WRONG = -1;
const TIMER_SECONDS = 20;
const LEADERBOARD_KEY = "fishQuizLeaderboardV2";
const PLAYER_NAME_KEY = "fishQuizPlayerNameV2";
const LEADERBOARD_LIMIT = 10;

const $ = (sel) => document.querySelector(sel);

const els = {
  loading: $("#loading"),
  quiz: $("#quiz"),
  score: $("#score"),
  round: $("#round"),
  streak: $("#streak"),
  timer: $("#timer"),
  progressBar: $("#progressBar"),
  fishImage: $("#fishImage"),
  optionButtons: Array.from(document.querySelectorAll(".option")),
  feedbackText: $("#feedbackText"),
  correctReveal: $("#correctReveal"),
  nextBtn: $("#nextBtn"),
  restartBtn: $("#restartBtn"),
  fishInfoBox: $("#fishInfoBox"),
  playerTag: $("#playerTag"),
  playerModal: $("#playerModal"),
  playerNameInput: $("#playerNameInput"),
  startQuizBtn: $("#startQuizBtn"),
  leaderboardList: $("#leaderboardList"),
  personalBest: $("#personalBest"),
  clearScoresBtn: $("#clearScoresBtn"),
};

function showLoading(show) {
  els.loading.classList.toggle("show", show);
  els.quiz.style.display = show ? "none" : "";
}

function setOptionButtonsDisabled(disabled) {
  els.optionButtons.forEach((b) => {
    b.disabled = disabled;
  });
}

function clearOptionButtonStyles() {
  els.optionButtons.forEach((b) => {
    b.classList.remove("correct", "wrong");
  });
}

function setFeedback({ text, correctRevealText, isFinal = false }) {
  els.feedbackText.textContent = text || "";
  if (correctRevealText) {
    els.correctReveal.hidden = false;
    els.correctReveal.textContent = correctRevealText;
  } else {
    els.correctReveal.hidden = true;
    els.correctReveal.textContent = "";
  }
  // Keep DOM structure stable; only control content/hidden state.
  els.nextBtn.disabled = isFinal;
}

function updateTimerDisplay(seconds) {
  els.timer.textContent = `${seconds} s`;
  els.timer.classList.toggle("low", seconds <= 3);
}

function updateProgressBar(round, totalRounds) {
  const doneRounds = Math.max(0, round - 1);
  const rawPercent = totalRounds > 0 ? (doneRounds / totalRounds) * 100 : 0;
  const percent = Math.max(0, Math.min(100, rawPercent));
  els.progressBar.style.width = `${percent}%`;
}

function getStreakMultiplier(streak) {
  if (streak < 2) return 1;
  return Math.min(3, 1 + Math.floor(streak / 2));
}

function getRankTitle(score, totalRounds) {
  const safeRounds = Math.max(1, totalRounds);
  const ratio = score / safeRounds;
  if (ratio >= 2.2) return "Legenda oceánu";
  if (ratio >= 1.6) return "Mistr rybář";
  if (ratio >= 1.0) return "Kapitán revíru";
  if (ratio >= 0.4) return "Zkušený plaváček";
  return "Rybníkový nováček";
}

function normalizePlayerName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 20);
}

function loadLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object");
  } catch {
    return [];
  }
}

function saveLeaderboard(rows) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rows));
}

function compareResults(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
  return String(b.playedAt).localeCompare(String(a.playedAt));
}

function renderLeaderboard() {
  const board = loadLeaderboard().sort(compareResults).slice(0, LEADERBOARD_LIMIT);
  els.leaderboardList.innerHTML = "";
  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Zatím žádné výsledky.";
    els.leaderboardList.appendChild(li);
  } else {
    board.forEach((row, idx) => {
      const li = document.createElement("li");
      const medal = idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : "";
      li.textContent = `${medal}${row.name} — ${row.score} b. (série ${row.bestStreak})`;
      if (state?.playerName && row.name === state.playerName) {
        li.classList.add("currentPlayerRow");
      }
      els.leaderboardList.appendChild(li);
    });
  }

  const playerName = state?.playerName || normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY));
  if (!playerName) {
    els.personalBest.textContent = "Tvůj nejlepší výsledek: -";
    return;
  }
  const personalBest = board
    .filter((x) => x.name === playerName)
    .sort(compareResults)[0];
  if (!personalBest) {
    els.personalBest.textContent = "Tvůj nejlepší výsledek: zatím žádný.";
    return;
  }
  els.personalBest.textContent = `Tvůj nejlepší výsledek: ${personalBest.score} b. (série ${personalBest.bestStreak})`;
}

function saveCurrentResult() {
  if (!state?.playerName) return;
  const board = loadLeaderboard();
  board.push({
    name: state.playerName,
    score: state.score,
    totalRounds: state.totalRounds,
    bestStreak: state.bestStreak,
    playedAt: new Date().toISOString(),
  });
  board.sort(compareResults);
  saveLeaderboard(board.slice(0, 100));
}

function setPlayerName(name) {
  const normalized = normalizePlayerName(name);
  if (!normalized) return false;
  state.playerName = normalized;
  localStorage.setItem(PLAYER_NAME_KEY, normalized);
  els.playerTag.textContent = `Hráč: ${normalized}`;
  return true;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Minimal CSV parser supporting quoted fields (no external deps).
function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // Skip empty lines
    if (row.length === 1 && row[0].trim() === "") return;
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        // Escaped quote: ""
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ",") {
      pushField();
      i++;
      continue;
    }

    if (c === "\n") {
      pushField();
      pushRow();
      i++;
      continue;
    }

    if (c === "\r") {
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // Flush last row
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}

async function loadFishData() {
  const res = await fetch("./data/fish.csv", { cache: "no-store" });
  if (!res.ok) throw new Error(`Nepodařilo se načíst fish.csv (${res.status})`);
  const text = await res.text();

  const rawRows = parseCsv(text);
  if (rawRows.length === 0) throw new Error("Soubor fish.csv je prázdný.");

  // Expect header: imageSrc,czechName
  const header = rawRows[0].map((h) => h.trim());
  const hasHeader =
    header.length >= 2 &&
    (header[0].toLowerCase().includes("image") ||
      header[0].toLowerCase().includes("pictures") ||
      header[0].toLowerCase().includes("src"));

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  const rows = [];
  for (const r of dataRows) {
    if (!r || r.length < 2) continue;
    const imageSrc = String(r[0] ?? "").trim();
    const czechName = String(r[1] ?? "").trim();
    const info = String(r[2] ?? "").trim();
    if (!imageSrc || !czechName) continue;
    rows.push({ imageSrc, czechName, info });
  }

  if (rows.length < 4) {
    throw new Error(
      `Je potřeba alespoň 4 řádky ryb (kvůli 4 možnostem odpovědi). Nalezeno: ${rows.length}.`
    );
  }

  // Build map of names -> rows (some species may have multiple pictures).
  const rowsByName = new Map();
  for (const row of rows) {
    if (!rowsByName.has(row.czechName)) rowsByName.set(row.czechName, []);
    rowsByName.get(row.czechName).push(row);
  }

  const names = Array.from(rowsByName.keys());
  if (names.length < 4) {
    throw new Error(
      `Je potřeba alespoň 4 různé názvy ryb. Nalezeno: ${names.length}.`
    );
  }

  return { rows, rowsByName, names };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUniqueRandom(arr, count, { exclude = new Set() } = {}) {
  const pool = arr.filter((x) => !exclude.has(x));
  if (pool.length < count) return null;
  const shuffled = shuffleInPlace(pool.slice());
  return shuffled.slice(0, count);
}

function renderQuestion({ roundIndex, totalRounds, correctRow, optionNames, correctName }) {
  els.round.textContent = `${roundIndex} / ${totalRounds}`;
  updateProgressBar(roundIndex, totalRounds);

  els.fishImage.alt = correctName;
  els.fishImage.src = correctRow.imageSrc;

  // If the image fails to load, still allow answering.
  els.fishImage.onerror = () => {
    els.fishImage.alt = `${correctName} (obrázek nenalezen)`;
  };

  const correctText = correctName;
  const correctIdx = optionNames.findIndex((x) => x === correctText);

  // Shuffle options visually, but preserve which one is correct.
  const optionModels = optionNames.map((text, idx) => ({
    text,
    isCorrect: idx === correctIdx,
  }));
  shuffleInPlace(optionModels);

  els.optionButtons.forEach((btn, i) => {
    btn.textContent = optionModels[i].text;
    btn.dataset.isCorrect = optionModels[i].isCorrect ? "1" : "0";
    btn.classList.remove("correct", "wrong");
  });

  els.nextBtn.disabled = true;
  els.restartBtn.hidden = true;
  els.correctReveal.hidden = true;
  els.feedbackText.textContent = "Vyber správný název ryby.";
  setOptionButtonsDisabled(false);
  state.answeredCurrentRound = false;

  // Clear feedback content from any previous question.
  els.correctReveal.textContent = "";

  // Clear fish info until the player answers.
  els.fishInfoBox.hidden = true;
  els.fishInfoBox.textContent = "";

  startQuestionTimer();
}

let state = null;

function stopQuestionTimer() {
  if (!state?.timerId) return;
  clearInterval(state.timerId);
  state.timerId = null;
}

function onTimeExpired() {
  if (!state || state.finished || state.answeredCurrentRound) return;
  state.answeredCurrentRound = true;
  stopQuestionTimer();
  setOptionButtonsDisabled(true);
  clearOptionButtonStyles();
  state.streak = 0;
  els.streak.textContent = "0";
  state.score += SCORE_WRONG;
  els.score.textContent = String(state.score);
  els.optionButtons.forEach((b) => {
    if (b.dataset.isCorrect === "1") b.classList.add("correct");
  });
  setFeedback({
    text: "Čas vypršel!",
    correctRevealText: `Správná odpověď: ${state.currentCorrectName}`,
    isFinal: false,
  });
  els.nextBtn.disabled = false;

  const infoText = state.currentInfo;
  if (infoText) {
    els.fishInfoBox.textContent = infoText;
    els.fishInfoBox.hidden = false;
  } else {
    els.fishInfoBox.textContent = "";
    els.fishInfoBox.hidden = true;
  }

  if (state.round >= state.totalRounds) {
    finishQuiz();
    return;
  }
}

function startQuestionTimer() {
  stopQuestionTimer();
  state.timeLeft = TIMER_SECONDS;
  updateTimerDisplay(state.timeLeft);
  state.timerId = setInterval(() => {
    if (!state || state.finished) {
      stopQuestionTimer();
      return;
    }
    state.timeLeft -= 1;
    updateTimerDisplay(Math.max(0, state.timeLeft));
    if (state.timeLeft <= 0) {
      onTimeExpired();
    }
  }, 1000);
}

function startNewQuiz(fishState) {
  // Enforce the "each concrete picture exactly once per game" rule.
  // Some datasets might contain duplicate `imageSrc` values across rows.
  const seenImages = new Set();
  const uniquePictureRows = [];
  for (const row of fishState.rows) {
    if (!row?.imageSrc) continue;
    if (seenImages.has(row.imageSrc)) continue;
    seenImages.add(row.imageSrc);
    uniquePictureRows.push(row);
  }

  if (uniquePictureRows.length < 1) {
    throw new Error("Pro spuštění kvízu je potřeba alespoň 1 obrázek ryby.");
  }

  // Create a per-game order of unique picture entries (no repeats within a game).
  const questionItems = shuffleInPlace(uniquePictureRows.slice()).slice(0, MAX_ROUNDS);

  state = {
    playerName: state?.playerName || normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY)) || "",
    fishState,
    round: 1,
    totalRounds: Math.min(MAX_ROUNDS, uniquePictureRows.length),
    score: 0,
    streak: 0,
    bestStreak: 0,
    timeLeft: TIMER_SECONDS,
    timerId: null,
    answeredCurrentRound: false,
    finished: false,
    currentCorrectName: null,
    currentInfo: null,
    questionItems,
  };

  if (state.totalRounds < 1) {
    throw new Error("Pro kvíz nejsou dostupné žádné obrázky ryb.");
  }

  els.score.textContent = String(state.score);
  els.streak.textContent = "0";
  els.playerTag.textContent = `Hráč: ${state.playerName || "-"}`;
  updateTimerDisplay(TIMER_SECONDS);
  updateProgressBar(1, state.totalRounds);
  els.restartBtn.hidden = true;

  renderCurrentRound();
}

function renderCurrentRound() {
  const totalRounds = state.totalRounds;
  const roundIndex = state.round;

  if (roundIndex > totalRounds) {
    finishQuiz();
    return;
  }

  const currentItem = state.questionItems[roundIndex - 1];
  if (!currentItem) {
    finishQuiz();
    return;
  }

  const { names } = state.fishState;

  // Correct picture comes from unique per-game order.
  const correctName = currentItem.czechName;
  const correctRow = currentItem;
  state.currentCorrectName = correctName;
  state.currentInfo = correctRow.info || "";

  // Wrong options: 3 distinct names different from correctName.
  const wrongNames = pickUniqueRandom(names, 3, { exclude: new Set([correctName]) });
  if (!wrongNames) {
    // Should be prevented by load validation, but keep a safe error.
    setFeedback({
      text: "V datech není dost různých druhů ryb pro vytvoření odpovědí.",
      correctRevealText: null,
      isFinal: true,
    });
    setOptionButtonsDisabled(true);
    els.nextBtn.disabled = true;
    els.restartBtn.hidden = false;
    return;
  }

  const optionNames = [correctName, ...wrongNames];

  renderQuestion({
    roundIndex,
    totalRounds,
    correctRow,
    optionNames,
    correctName,
  });
}

function handleOptionClick(e) {
  if (!state || state.finished || state.answeredCurrentRound) return;
  state.answeredCurrentRound = true;
  stopQuestionTimer();
  const btn = e.currentTarget;
  const isCorrect = btn.dataset.isCorrect === "1";

  const correctName = state.currentCorrectName;
  setOptionButtonsDisabled(true);
  clearOptionButtonStyles();

  // Mark chosen and correct options.
  els.optionButtons.forEach((b) => {
    if (b.dataset.isCorrect === "1") b.classList.add("correct");
    if (b === btn && !isCorrect) b.classList.add("wrong");
  });

  if (isCorrect) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    els.streak.textContent = String(state.streak);

    const multiplier = getStreakMultiplier(state.streak);
    const speedBonus = Math.max(0, state.timeLeft - 3);
    const earned = SCORE_CORRECT * multiplier + speedBonus;
    state.score += earned;
    els.score.textContent = String(state.score);
    setFeedback({
      text: `Správně! +${earned} bodů (kombo x${multiplier}, rychlost +${speedBonus})`,
      correctRevealText: null,
      isFinal: false,
    });
  } else {
    state.streak = 0;
    els.streak.textContent = "0";
    state.score += SCORE_WRONG;
    els.score.textContent = String(state.score);
    setFeedback({
      text: "Špatně.",
      correctRevealText: `Správná odpověď: ${correctName}`,
      isFinal: false,
    });
  }

  els.nextBtn.disabled = false;

  // Show fish info after the player answers.
  const infoText = state.currentInfo;
  if (infoText) {
    els.fishInfoBox.textContent = infoText;
    els.fishInfoBox.hidden = false;
  } else {
    els.fishInfoBox.textContent = "";
    els.fishInfoBox.hidden = true;
  }

  if (state.round >= state.totalRounds) {
    finishQuiz();
    return;
  }
}

function finishQuiz() {
  stopQuestionTimer();
  state.finished = true;
  els.nextBtn.disabled = true;
  els.restartBtn.hidden = false;
  updateProgressBar(state.totalRounds + 1, state.totalRounds);
  const rank = getRankTitle(state.score, state.totalRounds);

  setFeedback({
    text: `Hotovo! Konečné skóre: ${state.score}`,
    correctRevealText: `Tvoje hodnost: ${rank} | Nejdelší série: ${state.bestStreak}`,
    isFinal: true,
  });
  saveCurrentResult();
  renderLeaderboard();
}

function nextRound() {
  if (!state || state.finished) return;
  state.round += 1;
  els.correctReveal.hidden = true;
  renderCurrentRound();
}

function restartQuiz() {
  if (!state) return;
  stopQuestionTimer();
  startNewQuiz(state.fishState);
}

function wireEvents() {
  els.optionButtons.forEach((btn) => {
    btn.addEventListener("click", handleOptionClick);
  });
  els.nextBtn.addEventListener("click", nextRound);
  els.restartBtn.addEventListener("click", restartQuiz);
  els.startQuizBtn.addEventListener("click", () => {
    const ok = setPlayerName(els.playerNameInput.value);
    if (!ok) {
      els.playerNameInput.focus();
      return;
    }
    els.playerModal.hidden = true;
    restartQuiz();
  });
  els.playerNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.startQuizBtn.click();
    }
  });
  els.clearScoresBtn.addEventListener("click", () => {
    localStorage.removeItem(LEADERBOARD_KEY);
    renderLeaderboard();
  });
}

async function bootstrap() {
  wireEvents();
  showLoading(true);
  try {
    const fishState = await loadFishData();
    showLoading(false);
    startNewQuiz(fishState);
    const rememberedName = normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY));
    if (rememberedName) {
      setPlayerName(rememberedName);
      els.playerModal.hidden = true;
      restartQuiz();
    } else {
      els.playerModal.hidden = false;
      stopQuestionTimer();
      setOptionButtonsDisabled(true);
      els.playerNameInput.value = "";
      els.playerNameInput.focus();
    }
    renderLeaderboard();
  } catch (err) {
    stopQuestionTimer();
    showLoading(false);
    els.quiz.style.display = "";
    els.score.textContent = "0";
    els.round.textContent = `0 / ${MAX_ROUNDS}`;
    setOptionButtonsDisabled(true);
    els.optionButtons.forEach((b) => {
      b.textContent = "";
    });
    setFeedback({
      text: "Kvíz se nepodařilo spustit.",
      correctRevealText: err?.message ? String(err.message) : String(err),
      isFinal: true,
    });
    els.restartBtn.hidden = false;
    els.restartBtn.textContent = "Načíst znovu";
    els.restartBtn.onclick = () => location.reload();
  }
}

bootstrap();

