// ============================================================
//  smart-todo / js / app.js
//  Author: Ayushi  —  Enhanced v3
//  Added: Streak system, plant animations, mood messages
// ============================================================

// ---- Storage helpers ----

function loadTasks() {
  try {
    const raw = localStorage.getItem("ayushi_tasks");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem("ayushi_tasks", JSON.stringify(tasks));
}

function loadPref(key, fallback) {
  return localStorage.getItem(key) ?? fallback;
}

function savePref(key, val) {
  localStorage.setItem(key, val);
}

// ---- App state ----

let tasks           = loadTasks();
let selectedPriority = "high";
let activeFilter    = "all";
let activeMood      = "all";      // all | lazy | productive | overwhelmed
let highlightedId   = null;       // task highlighted by random picker

const priorityOrder = { high: 0, medium: 1, low: 2 };

// ---- DOM refs ----

const taskInput       = document.getElementById("taskInput");
const addTaskBtn      = document.getElementById("addTaskBtn");
const taskList        = document.getElementById("taskList");
const emptyState      = document.getElementById("emptyState");
const progressSection = document.getElementById("progressSection");
const progressFill    = document.getElementById("progressFill");
const progressLabel   = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");
const taskCountBadge  = document.getElementById("taskCountBadge");
const clearDoneBtn    = document.getElementById("clearDoneBtn");
const toastEl         = document.getElementById("toast");

// new elements
const themeToggle     = document.getElementById("themeToggle");
const themeIcon       = document.getElementById("themeIcon");
const randomBtn       = document.getElementById("randomBtn");
const spotlightOverlay= document.getElementById("spotlightOverlay");
const spotlightTask   = document.getElementById("spotlightTask");
const spotlightMeta   = document.getElementById("spotlightMeta");
const spotlightClose  = document.getElementById("spotlightClose");
const streakBadge     = document.getElementById("streakBadge");
const streakCount     = document.getElementById("streakCount");

// plant refs
const plantEmoji      = document.getElementById("plantEmoji");
const plantLabel      = document.getElementById("plantLabel");
const plantSub        = document.getElementById("plantSub");
const plantMoodMsg    = document.getElementById("plantMoodMsg");
const plantXpFill     = document.getElementById("plantXpFill");
const plantCard       = document.getElementById("plantCard");

// ===============================================================
//  DARK MODE
// ===============================================================

const htmlEl = document.documentElement;

function applyTheme(theme) {
  htmlEl.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

// Load saved theme or default to light
applyTheme(loadPref("ayushi_theme", "light"));

themeToggle.addEventListener("click", () => {
  const current = htmlEl.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  applyTheme(next);
  savePref("ayushi_theme", next);
  showToast(next === "dark" ? "Dark mode on 🌙" : "Light mode on ☀️");
});

// ===============================================================
//  STREAK SYSTEM
// ===============================================================

// Streak data stored as: { count: N, lastDate: "YYYY-MM-DD" }
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadStreak() {
  try {
    const raw = localStorage.getItem("ayushi_streak");
    return raw ? JSON.parse(raw) : { count: 0, lastDate: "" };
  } catch (e) {
    return { count: 0, lastDate: "" };
  }
}

function saveStreak(data) {
  localStorage.setItem("ayushi_streak", JSON.stringify(data));
}

function checkAndUpdateStreak() {
  const today     = todayStr();
  const streak    = loadStreak();
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const hasCompletedToday = tasks.some(t => {
    if (!t.done || !t.completedAt) return false;
    return new Date(t.completedAt).toISOString().slice(0, 10) === today;
  });

  if (!hasCompletedToday) {
    // Nothing completed today — don't change count, but check if streak is broken
    if (streak.lastDate && streak.lastDate < yesterday) {
      streak.count = 0;
      saveStreak(streak);
    }
  } else if (streak.lastDate !== today) {
    // First completion of today
    if (streak.lastDate === yesterday) {
      streak.count += 1;  // continued streak
    } else {
      streak.count = 1;   // new streak started (gap > 1 day)
    }
    streak.lastDate = today;
    saveStreak(streak);
  }

  renderStreakBadge(streak.count);
}

function renderStreakBadge(count) {
  streakCount.textContent = count;
  if (count === 0) {
    streakBadge.classList.add("no-streak");
    streakBadge.title = "No streak yet — complete a task today!";
  } else {
    streakBadge.classList.remove("no-streak");
    streakBadge.title = `${count}-day streak — keep it up!`;
  }
}

// Each stage: [minPercent, emoji, label, sub]
const plantStages = [
  [0,   "🌱", "Just getting started",   "Complete tasks to grow your plant!"],
  [15,  "🪴", "Sprouting",              "You're making progress, keep going!"],
  [35,  "🌿", "Growing nicely",         "Look at you go — the plant agrees!"],
  [55,  "🌳", "Branching out",          "Over halfway! Your tree is proud."],
  [75,  "🌸", "In full bloom",          "Almost there, beautiful work!"],
  [95,  "🌟", "Legendary Productivity", "100% done? You're unstoppable!"],
];

// Dynamic feedback messages keyed by progress range
function getMoodMessage(pct) {
  if (pct === 0)       return "Let's get started 💪";
  if (pct < 30)        return "You've got this 🙌";
  if (pct < 55)        return "You're doing great 🔥";
  if (pct < 80)        return "Almost there 👀";
  if (pct < 100)       return "So close, don't stop! ⚡";
  return "All done — legend! 🏆";
}

let lastCompletedCount = 0;   // track direction for animations
let glowTimer = null;

function triggerPlantAnim(type) {
  // type: 'pop' | 'droop' | 'glow'
  plantEmoji.classList.remove("pop", "droop");
  void plantEmoji.offsetWidth;
  if (type === "pop" || type === "droop") {
    plantEmoji.classList.add(type);
  }
  if (type === "pop" || type === "glow") {
    plantCard.classList.remove("glow-pulse");
    void plantCard.offsetWidth;
    plantCard.classList.add("glow-pulse");
    clearTimeout(glowTimer);
    // clean up class after animation finishes (2 cycles × 1.4s)
    glowTimer = setTimeout(() => plantCard.classList.remove("glow-pulse"), 3000);
  }
}

function updatePlant(animHint) {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  let stage = plantStages[0];
  for (const s of plantStages) {
    if (pct >= s[0]) stage = s;
  }

  const oldEmoji = plantEmoji.textContent;
  plantEmoji.textContent  = stage[1];
  plantLabel.textContent  = stage[2];
  plantSub.textContent    = stage[3];
  plantMoodMsg.textContent = getMoodMessage(pct);
  plantXpFill.style.width  = pct + "%";

  // Decide animation
  if (animHint === "complete") {
    triggerPlantAnim(oldEmoji !== stage[1] ? "pop" : "glow");
  } else if (animHint === "delete") {
    triggerPlantAnim("droop");
  } else if (oldEmoji !== stage[1]) {
    triggerPlantAnim("pop");
  }

  lastCompletedCount = done;
}

// ===============================================================
//  TOAST
// ===============================================================

let toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

// ===============================================================
//  CORE TASK HELPERS
// ===============================================================

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatTime(ts) {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const day = d.getDate();
  const mon = d.toLocaleString("default", { month: "short" });
  return `${mon} ${day}, ${hh}:${mm}`;
}

// ===============================================================
//  ADD / DELETE / TOGGLE
// ===============================================================

function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    taskInput.style.outline = "2px solid var(--high)";
    setTimeout(() => (taskInput.style.outline = "none"), 900);
    return;
  }

  const newTask = {
    id:        makeId(),
    text,
    priority:  selectedPriority,
    done:      false,
    createdAt: Date.now(),
  };

  tasks.push(newTask);
  saveTasks(tasks);
  taskInput.value = "";
  taskInput.focus();

  // Reset filter if new task wouldn't show under current filter
  if (activeFilter !== "all" && activeFilter !== selectedPriority) {
    setFilter("all");
  } else {
    render();
  }

  showToast("Task added ✓");
}

function deleteTask(id) {
  if (highlightedId === id) highlightedId = null;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  render("delete");
  showToast("Task removed");
}

function toggleDone(id) {
  const task  = tasks.find(t => t.id === id);
  const going = task && !task.done;  // true = marking as done

  tasks = tasks.map(t => {
    if (t.id !== id) return t;
    return {
      ...t,
      done:        !t.done,
      completedAt: !t.done ? Date.now() : null,
    };
  });

  saveTasks(tasks);
  checkAndUpdateStreak();
  render(going ? "complete" : null);
}

function clearDone() {
  const count = tasks.filter(t => t.done).length;
  if (count === 0) { showToast("No completed tasks to clear"); return; }
  tasks = tasks.filter(t => !t.done);
  saveTasks(tasks);
  render();
  showToast(`Cleared ${count} completed task${count > 1 ? "s" : ""}`);
}

// ===============================================================
//  SORTING
// ===============================================================

function sortedTasks(list) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.createdAt - a.createdAt;
  });
}

// ===============================================================
//  FILTERS  (priority filter + mood filter combined)
// ===============================================================

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  render();
}

function setMood(mood) {
  activeMood = mood;
  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mood === mood);
  });
  render();

  const labels = {
    all:         "Showing everything",
    lazy:        "😴 Lazy mode — only low-priority tasks",
    productive:  "⚡ Productive mode — high-priority first",
    overwhelmed: "😰 Overwhelmed mode — just a few tasks",
  };
  showToast(labels[mood]);
}

// Returns tasks after applying both priority filter and mood filter
function getVisibleTasks() {
  let pool = tasks;

  // Priority filter first
  if (activeFilter === "done") {
    pool = pool.filter(t => t.done);
  } else if (activeFilter !== "all") {
    pool = pool.filter(t => t.priority === activeFilter);
  }

  // Then mood filter (only applies to pending tasks)
  if (activeMood === "lazy") {
    pool = pool.filter(t => t.done || t.priority === "low");
  } else if (activeMood === "productive") {
    // Sort so high-priority pending tasks are first (sortedTasks handles this)
    // No filtering, just a visual note; already sorted by priority
  } else if (activeMood === "overwhelmed") {
    // Show at most 3 pending tasks (plus done ones if filter allows)
    const pending = pool.filter(t => !t.done).slice(0, 3);
    const done    = pool.filter(t => t.done);
    pool = [...pending, ...done];
  }

  return sortedTasks(pool);
}

// ===============================================================
//  RANDOM TASK PICKER
// ===============================================================

function pickRandomTask() {
  const pending = tasks.filter(t => !t.done);
  if (pending.length === 0) {
    showToast("No pending tasks left! 🎉");
    return;
  }

  const picked = pending[Math.floor(Math.random() * pending.length)];

  // Show spotlight overlay
  spotlightTask.textContent = picked.text;
  spotlightMeta.textContent =
    `Priority: ${picked.priority.charAt(0).toUpperCase() + picked.priority.slice(1)}  ·  Added ${formatTime(picked.createdAt)}`;

  // Update border colour based on priority
  spotlightTask.style.borderLeftColor =
    picked.priority === "high"   ? "var(--high)"   :
    picked.priority === "medium" ? "var(--medium)"  : "var(--low)";

  spotlightOverlay.classList.add("open");

  // Store the id so we can highlight the item in the list
  highlightedId = picked.id;
}

function closeSpotlight() {
  spotlightOverlay.classList.remove("open");
  render(); // re-render so highlight shows on the task card
}

randomBtn.addEventListener("click", pickRandomTask);
spotlightClose.addEventListener("click", closeSpotlight);

// Close on backdrop click
spotlightOverlay.addEventListener("click", (e) => {
  if (e.target === spotlightOverlay) closeSpotlight();
});

// ===============================================================
//  BUILD TASK ELEMENT
// ===============================================================

function createTaskEl(task) {
  const li = document.createElement("li");
  li.className = `task-item${task.done ? " done" : ""}${task.id === highlightedId ? " spotlight-highlight" : ""}`;
  li.dataset.priority = task.priority;
  li.dataset.id = task.id;

  // Checkbox
  const checkbox = document.createElement("div");
  checkbox.className = `task-checkbox${task.done ? " checked" : ""}`;
  checkbox.title = task.done ? "Mark incomplete" : "Mark complete";
  checkbox.addEventListener("click", () => toggleDone(task.id));

  // Text
  const textWrap  = document.createElement("div");
  textWrap.className = "task-text-wrapper";

  const textEl = document.createElement("span");
  textEl.className = "task-text";
  textEl.textContent = task.text;

  const meta   = document.createElement("div");
  meta.className = "task-meta";

  const tag    = document.createElement("span");
  tag.className = `priority-tag tag-${task.priority}`;
  tag.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  const timeEl = document.createElement("span");
  timeEl.className = "task-time";
  timeEl.textContent = formatTime(task.createdAt);

  meta.appendChild(tag);
  meta.appendChild(timeEl);
  textWrap.appendChild(textEl);
  textWrap.appendChild(meta);

  // Delete
  const delBtn = document.createElement("button");
  delBtn.className = "delete-btn";
  delBtn.title = "Delete task";
  delBtn.innerHTML = "&#10005;";
  delBtn.addEventListener("click", () => deleteTask(task.id));

  li.appendChild(checkbox);
  li.appendChild(textWrap);
  li.appendChild(delBtn);

  return li;
}

// ===============================================================
//  PROGRESS + BADGE
// ===============================================================

function updateProgress() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;

  if (total === 0) {
    progressSection.classList.remove("visible");
    return;
  }

  const pct = Math.round((done / total) * 100);
  progressSection.classList.add("visible");
  progressLabel.textContent   = `${done} of ${total} done`;
  progressPercent.textContent = `${pct}%`;
  progressFill.style.width    = `${pct}%`;
}

function updateBadge() {
  const n = tasks.length;
  taskCountBadge.textContent = `${n} task${n !== 1 ? "s" : ""}`;
}

// ===============================================================
//  MAIN RENDER
// ===============================================================

function render(animHint) {
  const visible = getVisibleTasks();

  taskList.innerHTML = "";

  if (visible.length === 0) {
    emptyState.classList.add("visible");
  } else {
    emptyState.classList.remove("visible");
    visible.forEach(t => taskList.appendChild(createTaskEl(t)));
  }

  updateProgress();
  updateBadge();
  updatePlant(animHint);
}

// ===============================================================
//  EVENT WIRING
// ===============================================================

// Priority buttons
document.querySelectorAll(".priority-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".priority-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPriority = btn.dataset.priority;
  });
});

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

// Mood buttons
document.querySelectorAll(".mood-btn").forEach(btn => {
  btn.addEventListener("click", () => setMood(btn.dataset.mood));
});

// Add task
addTaskBtn.addEventListener("click", addTask);

taskInput.addEventListener("keydown", e => {
  if (e.key === "Enter") addTask();
});

// Clear done
clearDoneBtn.addEventListener("click", clearDone);

// ===============================================================
//  INIT
// ===============================================================

checkAndUpdateStreak();
render();
