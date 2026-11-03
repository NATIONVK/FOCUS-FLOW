import { createIcons, LayoutDashboard, Timer, ChartNoAxesCombined, BookOpen, ListChecks, Settings2, SunMoon, Clock3, CheckCheck, Target, Flame, Zap, ArrowUpRight, Sparkles, BrainCircuit, RotateCcw, Play, SkipForward, ShieldCheck, Coffee, Repeat2, Plus, X, Download, Upload, Trash2 } from 'lucide';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const KEY = 'focus-flow-data-v1';

const defaults = {
  settings: {
    theme: 'dark',
    language: 'en',
    dailyGoal: 120,
    focus: 25,
    shortBreak: 5,
    longBreak: 15
  },
  subjects: [
    { id: 'statistics', name: 'Statistics', color: '#8b7cff' },
    { id: 'math', name: 'Mathematics', color: '#55a6ff' },
    { id: 'probability', name: 'Probability', color: '#36c9a0' },
    { id: 'calculus', name: 'Calculus', color: '#ffad66' },
    { id: 'python', name: 'Python Programming', color: '#ed7ba8' },
    { id: 'data', name: 'Data Analysis', color: '#5bc5ce' },
    { id: 'english', name: 'English', color: '#a58cff' },
    { id: 'other', name: 'Other', color: '#9aa0ad' }
  ],
  sessions: [],
  tasks: [],
  notes: [],
  presets: []
};

let data = structuredClone(defaults);
let mode = 'pomodoro';
let phase = 'focus';
let running = false;
let endAt = null;
let remaining = 1500;
let ticker = null;
let editSubjectId = null;

const circumference = 2 * Math.PI * 132;
const isNative = Capacitor.isNativePlatform();

async function loadData() {
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: KEY });
      if (value) {
        data = { ...structuredClone(defaults), ...JSON.parse(value) };
      }
    } else {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        data = { ...structuredClone(defaults), ...JSON.parse(raw) };
      }
    }
  } catch (e) {
    console.warn('Could not load saved data', e);
    toast('Saved data could not be loaded.');
  }

  applyTheme(data.settings.theme);
  populateSubjects();
  setTimerDuration();
  renderAll();
  fillSettings();
}

async function saveData() {
  const value = JSON.stringify(data);

  try {
    if (isNative) {
      await Preferences.set({ key: KEY, value });
    } else {
      localStorage.setItem(KEY, value);
    }
  } catch (e) {
    console.error(e);
    toast('Could not save data. Check device storage.');
  }
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toast._t);

  toast._t = setTimeout(() => {
    el.classList.remove('show');
  }, 2400);
}

function fmt(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return h
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function mins(seconds) {
  const m = Math.round(seconds / 60);
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : `${m}m`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodaySessions() {
  return data.sessions.filter(
    s => s.date === todayKey() && s.status === 'completed'
  );
}

function sum(sessions) {
  return sessions.reduce((a, s) => a + s.duration, 0);
}

function subjectById(id) {
  return data.subjects.find(s => s.id === id) || {
    name: 'Other',
    color: '#9aa0ad'
  };
}

function applyTheme(theme) {
  let value = theme;

  if (theme === 'system') {
    value = matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  document.documentElement.dataset.theme = value;

  $('#theme-select') &&
    ($('#theme-select').value = theme);
}

function fillSettings() {
  const s = data.settings;

  $('#theme-select').value = s.theme;
  $('#language-select').value = s.language;
  $('#daily-goal').value = s.dailyGoal;
  $('#focus-duration').value = s.focus;
  $('#short-break').value = s.shortBreak;
  $('#long-break').value = s.longBreak;
}

function populateSubjects() {
  const select = $('#timer-subject');

  if (!select) return;

  const old = select.value;

  select.innerHTML = data.subjects.map(s =>
    `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
  ).join('');

  if (data.subjects.some(s => s.id === old)) {
    select.value = old;
  }
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function setTimerDuration() {
  if (mode === 'stopwatch') {
    remaining = 0;
  } else if (mode === 'custom') {
    remaining = remaining || 2700;
  } else {
    remaining = (
      phase === 'focus'
        ? data.settings.focus
        : phase === 'short'
          ? data.settings.shortBreak
          : data.settings.longBreak
    ) * 60;
  }

  renderTimer();
}

function renderTimer() {
  $('#timer-display').textContent = fmt(
    mode === 'stopwatch' ? stopwatchElapsed() : remaining
  );

  $('#timer-status').textContent =
    mode === 'stopwatch'
      ? 'STOPWATCH'
      : phase === 'focus'
        ? 'READY TO FOCUS'
        : phase === 'short'
          ? 'SHORT BREAK'
          : 'LONG BREAK';

  $('#timer-subtitle').textContent =
    mode === 'stopwatch'
      ? 'Track your study time'
      : phase === 'focus'
        ? 'One step at a time'
        : 'Take a moment to recharge';

  const total = mode === 'stopwatch'
    ? 1
    : (
        phase === 'focus'
          ? data.settings.focus
          : phase === 'short'
            ? data.settings.shortBreak
            : data.settings.longBreak
      ) * 60;

  const progress = mode === 'stopwatch'
    ? 0
    : Math.max(0, Math.min(1, remaining / total));

  $('#ring-progress').style.strokeDasharray = circumference;
  $('#ring-progress').style.strokeDashoffset =
    circumference * (1 - progress);

  $('#start-label').textContent = running ? 'Pause' : 'Start focus';

  $('#play-icon').setAttribute(
    'data-lucide',
    running ? 'pause' : 'play'
  );

  icons();
}

let stopwatchStartedAt = 0;
let stopwatchAccumulated = 0;

function stopwatchElapsed() {
  return stopwatchAccumulated + (
    running
      ? Math.max(0, Math.floor((Date.now() - stopwatchStartedAt) / 1000))
      : 0
  );
}

function startTimer() {
  if (running) {
    pauseTimer();
    return;
  }

  if (mode === 'stopwatch') {
    stopwatchStartedAt = Date.now();
  } else {
    endAt = Date.now() + remaining * 1000;
  }

  running = true;
  renderTimer();

  ticker = setInterval(tick, 250);

  toast(
    mode === 'stopwatch'
      ? 'Stopwatch started'
      : 'Focus session started'
  );
}

function pauseTimer() {
  if (!running) return;

  if (mode === 'stopwatch') {
    stopwatchAccumulated = stopwatchElapsed();
  } else {
    remaining = Math.max(
      0,
      Math.ceil((endAt - Date.now()) / 1000)
    );
  }

  running = false;
  endAt = null;

  clearInterval(ticker);
  ticker = null;

  renderTimer();
  toast('Timer paused');
}

async function tick() {
  if (mode === 'stopwatch') {
    renderTimer();
    return;
  }

  remaining = Math.max(
    0,
    Math.ceil((endAt - Date.now()) / 1000)
  );

  renderTimer();

  if (remaining <= 0) {
    await completePhase();
  }
}

async function completePhase() {
  clearInterval(ticker);
  ticker = null;

  running = false;
  endAt = null;

  if (phase === 'focus') {
    const duration = data.settings.focus * 60;

    data.sessions.unshift({
      id: crypto.randomUUID(),
      date: todayKey(),
      startedAt: new Date(Date.now() - duration * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      duration,
      subjectId: $('#timer-subject').value,
      status: 'completed',
      mode: 'pomodoro'
    });

    await saveData();

    await notify(
      'Focus session complete',
      'Great work! Time for a short break.'
    );

    phase = 'short';
  } else {
    await notify(
      'Break finished',
      'Ready for another focused session?'
    );

    phase = 'focus';
  }

  if (isNative) {
    try {
      await Haptics.impact({
        style: ImpactStyle.Heavy
      });
    } catch {}
  }

  setTimerDuration();
  renderAll();

  toast(
    phase === 'short'
      ? 'Focus complete — take a break!'
      : 'Break complete — back to focus!'
  );
}

async function notify(title, body) {
  if (isNative) {
    try {
      let p = await LocalNotifications.checkPermissions();

      if (p.display !== 'granted') {
        p = await LocalNotifications.requestPermissions();
      }

      if (p.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483000),
            title,
            body,
            schedule: {
              at: new Date(Date.now() + 500)
            },
            sound: 'default'
          }]
        });
      }
    } catch (e) {
      console.warn('Notification unavailable', e);
    }
  }
}

function resetTimer() {
  pauseTimer();

  if (mode === 'stopwatch') {
    stopwatchAccumulated = 0;
    stopwatchStartedAt = 0;
  } else {
    phase = 'focus';
    setTimerDuration();
  }

  renderTimer();
}

function skipTimer() {
  pauseTimer();

  if (mode === 'pomodoro') {
    phase = phase === 'focus' ? 'short' : 'focus';
    setTimerDuration();
    toast('Session skipped');
  } else {
    resetTimer();
  }
}

function changeMode(next) {
  if (running) pauseTimer();

  mode = next;
  phase = 'focus';

  $('#timer-modes').querySelectorAll('button').forEach(b => {
    b.classList.toggle('selected', b.dataset.mode === mode);
  });

  $('#custom-options').style.display =
    mode === 'custom' ? 'block' : 'none';

  stopwatchAccumulated = 0;
  stopwatchStartedAt = 0;

  setTimerDuration();
}

function navigate(page) {
  $$('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  $$('[data-page]').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });

  const titles = {
    home: 'Good evening, learner',
    timer: 'Your focus space',
    analytics: 'Your progress, measured',
    subjects: 'Learn with intention',
    tasks: 'Plan your next step',
    settings: 'Make it yours'
  };

  $('#page-title').innerHTML =
    `${titles[page] || 'FOCUS FLOW'} <span>✦</span>`;

  if (page === 'analytics') renderAnalytics();
  if (page === 'subjects') renderSubjects();
  if (page === 'tasks') renderTasks();
  if (page === 'home') renderHome();
  if (page === 'timer') renderTimer();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function renderChart(target, sessions) {
  const now = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const key = todayKey(d);

    days.push({
      key,
      label: d.toLocaleDateString(undefined, {
        weekday: 'short'
      }),
      seconds: sum(sessions.filter(s => s.date === key))
    });
  }

  const max = Math.max(
    3600,
    ...days.map(d => d.seconds)
  );

  $(target).innerHTML = days.map(d =>
    `<div class="chart-col">
      <div class="chart-bar-wrap">
        <div class="chart-bar"
          title="${mins(d.seconds)}"
          style="height:${Math.max(3, d.seconds / max * 100)}%">
        </div>
      </div>
      <span>${d.label}</span>
    </div>`
  ).join('');
}

function renderHome() {
  const today = getTodaySessions();
  const total = sum(today);
  const goal = data.settings.dailyGoal * 60;
  const pct = Math.min(100, Math.round(total / goal * 100));

  $('#today-time').textContent = mins(total);
  $('#today-sessions').textContent = today.length;
  $('#goal-percent').textContent = `${pct}%`;
  $('#goal-progress').style.width = `${pct}%`;

  $('#streak-count').textContent = `${calculateStreak()} days`;

  $('#time-comparison').textContent =
    total >= goal
      ? 'Daily goal achieved!'
      : 'Keep building your momentum';

  $('#date-chip').textContent = new Date().toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );

  renderChart(
    '#weekly-chart',
    data.sessions.filter(s => s.status === 'completed')
  );

  const bySubject = data.subjects
    .map(s => ({
      ...s,
      seconds: sum(today.filter(x => x.subjectId === s.id))
    }))
    .filter(s => s.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  $('#home-subjects').innerHTML = bySubject.length
    ? bySubject.map(s =>
        `<div>
          <div class="subject-line-head">
            <span>${escapeHtml(s.name)}</span>
            <span>${mins(s.seconds)}</span>
          </div>
          <div class="subject-track">
            <span style="width:${total ? s.seconds / total * 100 : 0}%;background:${s.color}"></span>
          </div>
        </div>`
      ).join('')
    : '<div class="empty-state">Your subject activity will appear here.</div>';

  const recent = data.sessions.slice(0, 4);

  $('#recent-sessions').innerHTML = recent.length
    ? recent.map(sessionRow).join('')
    : '<div class="empty-state">No sessions yet. Start your first focus session!</div>';
}

function calculateStreak() {
  const dates = new Set(
    data.sessions
      .filter(s => s.status === 'completed')
      .map(s => s.date)
  );

  let d = new Date();
  let streak = 0;

  if (!dates.has(todayKey())) {
    d.setDate(d.getDate() - 1);
  }

  while (dates.has(todayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

function sessionRow(s) {
  const sub = subjectById(s.subjectId);

  return `<div class="session-row">
    <span class="subject-dot" style="background:${sub.color}"></span>
    <div class="session-main">
      <b>${escapeHtml(sub.name)}</b>
      <small>${new Date(s.startedAt).toLocaleString()}</small>
    </div>
    <span class="session-duration">${mins(s.duration)}</span>
  </div>`;
}

function renderAnalytics() {
  const completed = data.sessions.filter(
    s => s.status === 'completed'
  );

  const total = sum(completed);
  const days = new Set(completed.map(s => s.date));

  $('#all-time').textContent = mins(total);
  $('#all-sessions').textContent = completed.length;

  $('#daily-average').textContent = mins(
    days.size ? total / days.size : 0
  );

  const perDay = {};

  completed.forEach(s => {
    perDay[s.date] = (perDay[s.date] || 0) + s.duration;
  });

  const best = Object.entries(perDay)
    .sort((a, b) => b[1] - a[1])[0];

  $('#best-day').textContent = best
    ? mins(best[1])
    : '—';

  renderChart('#analytics-chart', completed);

  $('#session-history').innerHTML = completed.length
    ? completed.slice(0, 100).map(sessionRow).join('')
    : '<div class="empty-state">Completed study sessions will appear here.</div>';
}

function renderSubjects() {
  $('#subject-grid').innerHTML = data.subjects.map(s => {
    const sessions = data.sessions.filter(
      x => x.subjectId === s.id && x.status === 'completed'
    );

    return `<article class="subject-card">
      <div class="subject-card-head">
        <span class="subject-dot" style="background:${s.color}"></span>
        <b>${escapeHtml(s.name)}</b>
      </div>
      <p>Total study time</p>
      <strong>${mins(sum(sessions))}</strong>
      <p>${sessions.length} completed sessions</p>
      <div class="subject-card-actions">
        <button class="outline-btn" data-edit-subject="${s.id}">Edit</button>
        <button class="outline-btn" data-delete-subject="${s.id}">Delete</button>
      </div>
    </article>`;
  }).join('');

  $$('[data-edit-subject]').forEach(b => {
    b.addEventListener('click', () => {
      openSubject(b.dataset.editSubject);
    });
  });

  $$('[data-delete-subject]').forEach(b => {
    b.addEventListener('click', () => {
      deleteSubject(b.dataset.deleteSubject);
    });
  });
}

function renderTasks() {
  $('#task-list').innerHTML = data.tasks.length
    ? data.tasks.map(t =>
        `<div class="task-item ${t.done ? 'done' : ''}">
          <input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''}>
          <span>${escapeHtml(t.text)}</span>
          <button data-remove-task="${t.id}" aria-label="Delete task">
            <i data-lucide="x"></i>
          </button>
        </div>`
      ).join('')
    : '<div class="empty-state">Your study checklist is clear.</div>';

  $$('[data-task]').forEach(el => {
    el.addEventListener('change', () => {
      const t = data.tasks.find(x => x.id === el.dataset.task);

      if (t) t.done = el.checked;

      saveData();
      renderTasks();
    });
  });

  $$('[data-remove-task]').forEach(el => {
    el.addEventListener('click', () => {
      data.tasks = data.tasks.filter(
        t => t.id !== el.dataset.removeTask
      );

      saveData();
      renderTasks();
    });
  });

  renderNotes();
  icons();
}

function renderNotes() {
  $('#notes-list').innerHTML = data.notes
    .slice(0, 10)
    .map(n =>
      `<div class="note-card">
        ${escapeHtml(n.text)}
        <div style="color:var(--muted);font-size:8px;margin-top:7px">
          ${new Date(n.createdAt).toLocaleString()}
        </div>
      </div>`
    ).join('');
}

function renderAll() {
  renderHome();
  renderAnalytics();
  renderSubjects();
  renderTasks();
  renderTimer();
  icons();
}

function icons() {
  createIcons({
    icons: {
      LayoutDashboard,
      Timer,
      ChartNoAxesCombined,
      BookOpen,
      ListChecks,
      Settings2,
      SunMoon,
      Clock3,
      CheckCheck,
      Target,
      Flame,
      Zap,
      ArrowUpRight,
      Sparkles,
      BrainCircuit,
      RotateCcw,
      Play,
      SkipForward,
      ShieldCheck,
      Coffee,
      Repeat2,
      Plus,
      X,
      Download,
      Upload,
      Trash2
    }
  });
}

function openSubject(id = null) {
  editSubjectId = id;

  const s = id ? subjectById(id) : null;

  $('#subject-dialog-title').textContent =
    id ? 'Edit subject' : 'Add subject';

  $('#subject-name').value = s?.name || '';
  $('#subject-color').value = s?.color || '#8b7cff';

  $('#subject-dialog').showModal();
}

function deleteSubject(id) {
  if (data.sessions.some(s => s.subjectId === id)) {
    toast('This subject has study history and cannot be deleted.');
    return;
  }

  if (!confirm('Delete this subject?')) return;

  data.subjects = data.subjects.filter(s => s.id !== id);

  saveData();
  populateSubjects();
  renderSubjects();
}

function saveSubject(e) {
  e.preventDefault();

  const name = $('#subject-name').value.trim();

  if (!name) return;

  if (editSubjectId) {
    const s = data.subjects.find(x => x.id === editSubjectId);
    s.name = name;
    s.color = $('#subject-color').value;
  } else {
    data.subjects.push({
      id: crypto.randomUUID(),
      name,
      color: $('#subject-color').value
    });
  }

  saveData();
  populateSubjects();
  renderSubjects();

  $('#subject-dialog').close();
  toast('Subject saved');
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}

function exportCSV() {
  const rows = [
    ['Date', 'Subject', 'Start', 'End', 'Duration seconds', 'Status', 'Mode'],
    ...data.sessions.map(s => [
      s.date,
      subjectById(s.subjectId).name,
      s.startedAt,
      s.endedAt,
      s.duration,
      s.status,
      s.mode
    ])
  ];

  downloadFile(
    'focus-flow-study-history.csv',
    rows.map(r =>
      r.map(v =>
        `"${String(v ?? '').replace(/"/g, '""')}"`
      ).join(',')
    ).join('\n'),
    'text/csv'
  );
}

function restoreBackup(file) {
  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);

      if (
        !parsed.settings ||
        !Array.isArray(parsed.sessions) ||
        !Array.isArray(parsed.subjects)
      ) {
        throw new Error('Invalid backup');
      }

      data = {
        ...structuredClone(defaults),
        ...parsed
      };

      await saveData();
      loadData();

      toast('Backup restored successfully');
    } catch {
      toast('Invalid backup file');
    }
  };

  reader.readAsText(file);
}

function bind() {
  $$('[data-page]').forEach(b => {
    b.addEventListener('click', () => navigate(b.dataset.page));
  });

  $$('[data-go]').forEach(b => {
    b.addEventListener('click', () => navigate(b.dataset.go));
  });

  $('#theme-toggle').addEventListener('click', () => {
    data.settings.theme =
      document.documentElement.dataset.theme === 'dark'
        ? 'light'
        : 'dark';

    applyTheme(data.settings.theme);
    saveData();
  });

  $('#timer-modes').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) changeMode(b.dataset.mode);
  });

  $('#start-timer').addEventListener('click', startTimer);
  $('#reset-timer').addEventListener('click', resetTimer);
  $('#skip-timer').addEventListener('click', skipTimer);

  $('#apply-custom').addEventListener('click', () => {
    const h = Math.max(
      0,
      Math.min(23, Number($('#custom-hours').value) || 0)
    );

    const m = Math.max(
      0,
      Math.min(59, Number($('#custom-minutes').value) || 0)
    );

    const sec = (h * 60 + m) * 60;

    if (!sec) {
      toast('Choose a duration greater than zero');
      return;
    }

    pauseTimer();
    remaining = sec;
    renderTimer();

    toast('Custom duration applied');
  });

  $('#add-subject').addEventListener('click', () => openSubject());

  $('#subject-form').addEventListener('submit', saveSubject);

  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();

    const text = $('#task-input').value.trim();

    if (!text) return;

    data.tasks.unshift({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: new Date().toISOString()
    });

    $('#task-input').value = '';

    saveData();
    renderTasks();
  });

  $('#save-note').addEventListener('click', () => {
    const text = $('#note-input').value.trim();

    if (!text) return;

    data.notes.unshift({
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString()
    });

    $('#note-input').value = '';

    saveData();
    renderNotes();

    toast('Note saved');
  });

  $('#save-settings').addEventListener('click', () => {
    data.settings.theme = $('#theme-select').value;
    data.settings.language = $('#language-select').value;

    data.settings.dailyGoal = Math.max(
      15,
      Number($('#daily-goal').value) || 120
    );

    data.settings.focus = Math.max(
      1,
      Number($('#focus-duration').value) || 25
    );

    data.settings.shortBreak = Math.max(
      1,
      Number($('#short-break').value) || 5
    );

    data.settings.longBreak = Math.max(
      1,
      Number($('#long-break').value) || 15
    );

    applyTheme(data.settings.theme);

    if (!running && mode === 'pomodoro') {
      setTimerDuration();
    }

    saveData();
    renderAll();

    toast('Settings saved');
  });

  $('#theme-select').addEventListener('change', e => {
    applyTheme(e.target.value);
  });

  $('#export-csv').addEventListener('click', exportCSV);

  $('#backup-data').addEventListener('click', () => {
    downloadFile(
      'focus-flow-backup.json',
      JSON.stringify(data, null, 2),
      'application/json'
    );
  });

  $('#restore-data').addEventListener('change', e => {
    if (e.target.files[0]) {
      restoreBackup(e.target.files[0]);
    }

    e.target.value = '';
  });

  $('#clear-data').addEventListener('click', async () => {
    if (!confirm('This will permanently delete all local study data. Continue?')) {
      return;
    }

    pauseTimer();

    data = structuredClone(defaults);

    await saveData();
    loadData();

    toast('All data has been reset');
  });
}

async function initNative() {
  if (!isNative) return;

  try {
    await LocalNotifications.requestPermissions();
  } catch {}

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && running && mode !== 'stopwatch') {
      remaining = Math.max(
        0,
        Math.ceil((endAt - Date.now()) / 1000)
      );

      if (remaining <= 0) {
        completePhase();
      } else {
        renderTimer();
      }
    }
  });

  App.addListener('pause', async () => {
    if (running && mode !== 'stopwatch') {
      remaining = Math.max(
        0,
        Math.ceil((endAt - Date.now()) / 1000)
      );

      await saveData();
    }
  });
}

$('#today-label').textContent = new Date().toLocaleDateString(
  undefined,
  {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }
).toUpperCase();

bind();
loadData().then(initNative);
icons();
