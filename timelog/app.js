const DATABASE_NAME = "viikkokello";
const DATABASE_VERSION = 2;
const TASK_STORE = "tasks";
const SETTINGS_STORE = "settings";
const PROFILE_STORE = "profiles";
const METADATA_STORE = "metadata";
const PROFILE_COLORS = ["#dcebe2", "#dce7f5", "#f2e4d1", "#f2dddd", "#e7dff2", "#d9eceb"];
const DEFAULT_PROFILE = { id: "work", name: "Työ", color: PROFILE_COLORS[0] };
const DEFAULT_SETTINGS = { id: DEFAULT_PROFILE.id, start: "09:00", end: "17:00", breakMinutes: 30 };
const HOUR_HEIGHT = 64;

const elements = {
  addProfileButton: document.querySelector("#add-profile-button"),
  activeTask: document.querySelector("#active-task"),
  activeTaskDuration: document.querySelector("#active-task-duration"),
  activeTaskName: document.querySelector("#active-task-name"),
  activeTaskTime: document.querySelector("#active-task-time"),
  breakButton: document.querySelector("#break-button"),
  calendar: document.querySelector("#week-grid"),
  currentWeekButton: document.querySelector("#current-week"),
  dailyBreak: document.querySelector("#daily-break"),
  dayDialog: document.querySelector("#day-dialog"),
  dayDialogSummary: document.querySelector("#day-dialog-summary"),
  dayDialogTitle: document.querySelector("#day-dialog-title"),
  dayStats: document.querySelector("#day-stats"),
  dayTimeline: document.querySelector("#day-timeline"),
  error: document.querySelector("#error-message"),
  profileCancelButton: document.querySelector("#cancel-profile-button"),
  profileDialog: document.querySelector("#profile-dialog"),
  profileError: document.querySelector("#profile-error"),
  profileForm: document.querySelector("#profile-form"),
  profileName: document.querySelector("#profile-name"),
  profileColor: document.querySelector("#profile-color"),
  profileSelect: document.querySelector("#profile-select"),
  nextWeekButton: document.querySelector("#next-week"),
  notice: document.querySelector("#notice"),
  previousWeekButton: document.querySelector("#previous-week"),
  settingsForm: document.querySelector("#settings-form"),
  taskForm: document.querySelector("#task-form"),
  taskName: document.querySelector("#task-name"),
  trackerDate: document.querySelector("#tracker-date"),
  trackerHint: document.querySelector("#tracker-hint"),
  weeklyRemaining: document.querySelector("#weekly-remaining"),
  weeklyTarget: document.querySelector("#weekly-target"),
  weeklyTotal: document.querySelector("#weekly-total"),
  weekRange: document.querySelector("#week-range"),
  weekReadonly: document.querySelector("#week-readonly"),
  workEnd: document.querySelector("#work-end"),
  workStart: document.querySelector("#work-start"),
  stopTaskButton: document.querySelector("#stop-task-button"),
  topbar: document.querySelector(".topbar"),
};

let database;
let tasks = [];
let profiles = [];
let settingsRecords = [];
let activeProfileId = DEFAULT_PROFILE.id;
let settings = { ...DEFAULT_SETTINGS };
let selectedWeek = startOfWeek(new Date());
let openDay = null;
let noticeTimer;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TASK_STORE)) {
        db.createObjectStore(TASK_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "id" });
      }

      if (event.oldVersion < 2) {
        const transaction = event.target.transaction;
        const profileStore = transaction.objectStore(PROFILE_STORE);
        const taskStore = transaction.objectStore(TASK_STORE);
        const settingsStore = transaction.objectStore(SETTINGS_STORE);

        profileStore.put(DEFAULT_PROFILE);
        transaction.objectStore(METADATA_STORE).put({ id: "active-profile", profileId: DEFAULT_PROFILE.id });

        const taskCursor = taskStore.openCursor();
        taskCursor.addEventListener("success", () => {
          const cursor = taskCursor.result;
          if (!cursor) return;
          const task = cursor.value;
          if (!task.profileId) {
            task.profileId = DEFAULT_PROFILE.id;
            cursor.update(task);
          }
          cursor.continue();
        });

        const legacySettings = settingsStore.get("work-hours");
        legacySettings.addEventListener("success", () => {
          const workSettings = { ...DEFAULT_SETTINGS, ...(legacySettings.result ?? {}), id: DEFAULT_PROFILE.id };
          settingsStore.put(workSettings);
          if (legacySettings.result && legacySettings.result.id !== DEFAULT_PROFILE.id) {
            settingsStore.delete(legacySettings.result.id);
          }
        });
      }
    });

    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Tietokantaa ei voitu avata.")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Tietokanta on toisen välilehden käytössä. Sulje muut sovelluksen välilehdet ja lataa sivu uudelleen.")), { once: true });
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("Tietokantapyyntö epäonnistui.")), { once: true });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Tietokantatapahtuma keskeytyi.")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Tietokantatapahtuma epäonnistui.")), { once: true });
  });
}

async function loadData() {
  const transaction = database.transaction([TASK_STORE, SETTINGS_STORE, PROFILE_STORE, METADATA_STORE], "readonly");
  const done = transactionDone(transaction);
  const taskRequest = requestResult(transaction.objectStore(TASK_STORE).getAll());
  const settingsRequest = requestResult(transaction.objectStore(SETTINGS_STORE).getAll());
  const profilesRequest = requestResult(transaction.objectStore(PROFILE_STORE).getAll());
  const activeProfileRequest = requestResult(transaction.objectStore(METADATA_STORE).get("active-profile"));
  const [storedTasks, storedSettings, storedProfiles, storedActiveProfile] = await Promise.all([
    taskRequest,
    settingsRequest,
    profilesRequest,
    activeProfileRequest,
  ]);
  await done;
  tasks = storedTasks;
  settingsRecords = storedSettings;
  profiles = storedProfiles;

  const profilesInDisplayOrder = [...profiles].sort((first, second) => {
    if (first.id === DEFAULT_PROFILE.id) return -1;
    if (second.id === DEFAULT_PROFILE.id) return 1;
    return first.name.localeCompare(second.name, "fi");
  });
  const profileUpdates = new Map();
  profilesInDisplayOrder.forEach((profile, index) => {
    if (!isValidProfileColor(profile.color)) {
      const color = profile.id === DEFAULT_PROFILE.id
        ? DEFAULT_PROFILE.color
        : PROFILE_COLORS[index % PROFILE_COLORS.length];
      profileUpdates.set(profile.id, { ...profile, color });
    }
  });
  if (profileUpdates.size) {
    await saveProfiles([...profileUpdates.values()]);
    profiles = profiles.map((profile) => profileUpdates.get(profile.id) ?? profile);
  }

  const fallbackProfile = profiles.find((profile) => profile.id === DEFAULT_PROFILE.id);
  if (!fallbackProfile) throw new Error("Työ-profiilia ei löytynyt tietokannasta.");
  activeProfileId = profiles.some((profile) => profile.id === storedActiveProfile?.profileId)
    ? storedActiveProfile.profileId
    : fallbackProfile.id;
  settings = settingsRecords.find((record) => record.id === activeProfileId);
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS, id: activeProfileId };
    await saveSettings(settings);
    settingsRecords.push(settings);
  }
}

async function saveTask(task) {
  const transaction = database.transaction(TASK_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(TASK_STORE).put(task);
  await done;
}

async function saveSettings(nextSettings) {
  const transaction = database.transaction(SETTINGS_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(SETTINGS_STORE).put(nextSettings);
  await done;
}

async function saveProfiles(nextProfiles) {
  const transaction = database.transaction(PROFILE_STORE, "readwrite");
  const done = transactionDone(transaction);
  const profileStore = transaction.objectStore(PROFILE_STORE);
  for (const profile of nextProfiles) profileStore.put(profile);
  await done;
}

function isValidProfileColor(color) {
  return /^#[\da-f]{6}$/i.test(color);
}

function renderProfileOptions() {
  const options = [...profiles].sort((first, second) => {
    if (first.id === DEFAULT_PROFILE.id) return -1;
    if (second.id === DEFAULT_PROFILE.id) return 1;
    return first.name.localeCompare(second.name, "fi");
  }).map((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    return option;
  });
  elements.profileSelect.replaceChildren(...options);
  elements.profileSelect.value = activeProfileId;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  if (!activeProfile) throw new Error("Valittua profiilia ei löytynyt.");
  elements.profileColor.value = activeProfile.color;
  elements.topbar.style.setProperty("--profile-header-color", activeProfile.color);
}

function hasRunningTask() {
  return tasks.some((task) => task.end === null);
}

async function activateProfile(profileId) {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("Valittua profiilia ei löytynyt.");
  if (hasRunningTask()) {
    throw new Error("Lopeta käynnissä oleva tehtävä ennen profiilin vaihtamista.");
  }
  const nextSettings = settingsRecords.find((record) => record.id === profileId);
  if (!nextSettings) throw new Error("Profiilin työaika-asetuksia ei löytynyt.");

  const transaction = database.transaction(METADATA_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(METADATA_STORE).put({ id: "active-profile", profileId });
  await done;

  activeProfileId = profileId;
  settings = nextSettings;
  renderProfileOptions();
  setWorkHourInputs();
  render();
  showNotice(`Profiili vaihdettu: ${profile.name}.`);
}

async function createProfile(name) {
  const profile = {
    id: crypto.randomUUID(),
    name,
    color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
  };
  const profileSettings = { ...DEFAULT_SETTINGS, id: profile.id };
  const transaction = database.transaction([PROFILE_STORE, SETTINGS_STORE, METADATA_STORE], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(PROFILE_STORE).put(profile);
  transaction.objectStore(SETTINGS_STORE).put(profileSettings);
  transaction.objectStore(METADATA_STORE).put({ id: "active-profile", profileId: profile.id });
  await done;

  profiles.push(profile);
  settingsRecords.push(profileSettings);
  activeProfileId = profile.id;
  settings = profileSettings;
  renderProfileOptions();
  setWorkHourInputs();
  render();
  showNotice(`Profiili "${name}" luotu.`);
}

function startOfWeek(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

function addDays(date, amount) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(first, second) {
  return dateKey(first) === dateKey(second);
}

function isSelectedWeekCurrent() {
  return dateKey(selectedWeek) === dateKey(startOfWeek(new Date()));
}

function activeProfileTasks() {
  return tasks.filter((task) => task.profileId === activeProfileId);
}

function currentTask() {
  return activeProfileTasks().find((task) => task.end === null) ?? null;
}

function activeBreak(task) {
  return task?.breaks.find((rest) => rest.end === null) ?? null;
}

function parseTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dailyWorkTargetMinutes() {
  return parseTime(settings.end) - parseTime(settings.start) - settings.breakMinutes;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("fi-FI", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function formatDate(date, options = { day: "numeric", month: "numeric" }) {
  return new Intl.DateTimeFormat("fi-FI", options).format(date);
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return `${hours} h ${String(remainder).padStart(2, "0")} min`;
}

function elapsedMinutes(start, end) {
  return Math.max(0, (end - start) / 60_000);
}

function overlapMinutes(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB)) / 60_000;
}

function taskNetMinutes(task, start, end, now) {
  const taskEnd = task.end ?? now;
  const taskStart = Math.max(task.start, start);
  const clippedEnd = Math.min(taskEnd, end);
  if (clippedEnd <= taskStart) return 0;

  const total = elapsedMinutes(taskStart, clippedEnd);
  const breaks = task.breaks.reduce((sum, rest) => {
    const breakEnd = rest.end ?? now;
    return sum + overlapMinutes(taskStart, clippedEnd, rest.start, breakEnd);
  }, 0);
  return Math.max(0, total - breaks);
}

function showNotice(message, isError = false) {
  window.clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("is-error", isError);
  if (message && !isError) {
    noticeTimer = window.setTimeout(() => {
      elements.notice.textContent = "";
      elements.notice.classList.remove("is-error");
    }, 5000);
  }
}

function showFatalError(error) {
  elements.error.textContent = `Sovelluksen tietoja ei voitu ladata: ${error.message}`;
  elements.error.hidden = false;
  for (const control of document.querySelectorAll("button, input, select, summary")) {
    control.setAttribute("aria-disabled", "true");
    if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) control.disabled = true;
  }
}

function reportActionError(error) {
  showNotice(`Toiminto epäonnistui: ${error.message}`, true);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    reportActionError(error);
  }
}

function setWorkHourInputs() {
  elements.workStart.value = settings.start;
  elements.workEnd.value = settings.end;
  elements.dailyBreak.value = settings.breakMinutes;
}

function renderTracker(now = Date.now()) {
  const task = currentTask();
  const isWorkday = new Date(now).getDay() >= 1 && new Date(now).getDay() <= 5;
  const canTrack = isSelectedWeekCurrent() && isWorkday;
  const rest = activeBreak(task);

  elements.trackerDate.textContent = new Intl.DateTimeFormat("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(now));
  elements.taskForm.hidden = Boolean(task) || !canTrack;
  elements.activeTask.hidden = !task;
  elements.taskForm.querySelector("button").disabled = !canTrack || Boolean(task);

  if (!task) {
    elements.trackerHint.textContent = canTrack
      ? "Aloita tehtävä, kun olet valmis."
      : isWorkday
        ? "Voit aloittaa uuden tehtävän tämän viikon näkymässä."
        : "Työajanseuranta on käytettävissä maanantaista perjantaihin.";
    return;
  }

  elements.trackerHint.textContent = rest ? "Tauko on käynnissä." : "Tehtävä on käynnissä.";
  elements.activeTaskName.textContent = task.name;
  elements.activeTaskTime.textContent = `Alkoi ${formatTime(task.start)}`;
  const total = taskNetMinutes(task, task.start, now, now);
  elements.activeTaskDuration.textContent = formatDuration(total);
  elements.breakButton.textContent = rest ? "Lopeta tauko" : "Aloita tauko";
  elements.breakButton.classList.toggle("is-active", Boolean(rest));
  elements.breakButton.setAttribute("aria-pressed", String(Boolean(rest)));
  elements.breakButton.disabled = !isSelectedWeekCurrent();
  elements.stopTaskButton.disabled = !isSelectedWeekCurrent();
}

function renderWeekLabel() {
  const friday = addDays(selectedWeek, 4);
  const sameMonth = selectedWeek.getMonth() === friday.getMonth();
  const sameYear = selectedWeek.getFullYear() === friday.getFullYear();
  let label;
  if (sameYear && sameMonth) {
    label = `${selectedWeek.getDate()}.–${friday.getDate()}. ${new Intl.DateTimeFormat("fi-FI", { month: "long", year: "numeric" }).format(friday)}`;
  } else {
    label = `${formatDate(selectedWeek)}.–${formatDate(friday)}.${sameYear ? ` ${friday.getFullYear()}` : ` ${selectedWeek.getFullYear()}–${friday.getFullYear()}`}`;
  }
  elements.weekRange.textContent = label;
  elements.weekReadonly.hidden = isSelectedWeekCurrent();
}

function getWeekBounds() {
  return {
    start: new Date(selectedWeek.getFullYear(), selectedWeek.getMonth(), selectedWeek.getDate()).getTime(),
    end: new Date(selectedWeek.getFullYear(), selectedWeek.getMonth(), selectedWeek.getDate() + 7).getTime(),
  };
}

function getDayWorkMinutes(dayStart, dayEnd, now) {
  return activeProfileTasks().reduce((sum, task) => sum + taskNetMinutes(task, dayStart, dayEnd, now), 0);
}

function eventRangeForDay(task, day, now) {
  const nextDay = addDays(day, 1);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate()).getTime();
  const taskEnd = task.end ?? now;
  const start = Math.max(task.start, dayStart);
  const end = Math.min(taskEnd, dayEnd);
  if (end <= start) return null;
  return { start, end, dayStart, dayEnd };
}

function wallMinute(timestamp) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function getVisibleHours(days, now) {
  let first = Math.floor(parseTime(settings.start) / 60);
  let last = Math.ceil(parseTime(settings.end) / 60);

  for (const task of activeProfileTasks()) {
    for (const day of days) {
      const range = eventRangeForDay(task, day, now);
      if (!range) continue;
      first = Math.min(first, Math.floor(wallMinute(range.start) / 60));
      const endMinute = range.end === range.dayEnd ? 24 * 60 : wallMinute(range.end);
      last = Math.max(last, Math.ceil(endMinute / 60));
    }
  }

  return { first: Math.max(0, first), last: Math.min(24, Math.max(first + 1, last)) };
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addTaskBlock(track, task, day, range, timelineStart, now) {
  const top = (wallMinute(range.start) - timelineStart) * HOUR_HEIGHT / 60;
  const endMinute = range.end === range.dayEnd ? 24 * 60 : wallMinute(range.end);
  const height = Math.max(26, (endMinute - wallMinute(range.start)) * HOUR_HEIGHT / 60);
  const block = createElement("article", "event-block");
  const running = task.end === null && range.end === now;
  block.classList.toggle("is-running", running);
  block.style.insetBlockStart = `${top}px`;
  block.style.blockSize = `${height}px`;
  block.setAttribute("aria-label", `${task.name}, ${formatTime(range.start)}–${running ? "käynnissä" : formatTime(range.end)}`);

  const name = createElement("span", "event-name", task.name);
  const time = createElement("span", "event-time", `${formatTime(range.start)}–${running && range.end === now ? "nyt" : formatTime(range.end)}`);
  block.append(name, time);

  for (const rest of task.breaks) {
    const breakEnd = rest.end ?? now;
    const start = Math.max(rest.start, range.start);
    const end = Math.min(breakEnd, range.end);
    if (end <= start) continue;
    const breakStartMinute = wallMinute(start);
    const breakEndMinute = end === range.dayEnd ? 24 * 60 : wallMinute(end);
    const marker = createElement("span", "break-marker", breakEnd - start >= 20 * 60_000 ? "Tauko" : "");
    marker.style.insetBlockStart = `${(breakStartMinute - wallMinute(range.start)) * HOUR_HEIGHT / 60}px`;
    marker.style.blockSize = `${Math.max(5, (breakEndMinute - breakStartMinute) * HOUR_HEIGHT / 60)}px`;
    marker.setAttribute("aria-label", `Tauko ${formatTime(start)}–${rest.end === null && end === now ? "käynnissä" : formatTime(end)}`);
    block.append(marker);
  }

  track.append(block);
}

function renderCalendar(now = Date.now()) {
  const days = Array.from({ length: 5 }, (_, index) => addDays(selectedWeek, index));
  const { first, last } = getVisibleHours(days, now);
  const hourCount = last - first;
  elements.calendar.style.setProperty("--hour-count", hourCount);
  elements.calendar.replaceChildren();

  const corner = createElement("span", "calendar-corner");
  corner.setAttribute("aria-hidden", "true");
  elements.calendar.append(corner);

  days.forEach((day, index) => {
    const heading = createElement("div", "day-heading");
    const today = isSameDay(day, new Date(now));
    heading.classList.toggle("is-today", today);
    heading.style.gridColumn = String(index + 2);
    heading.style.gridRow = "1";
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    const dayTotal = formatDuration(getDayWorkMinutes(dayStart, dayEnd, now));
    const detailsRow = createElement("div", "day-details-row");
    const total = createElement("span", "day-total", dayTotal);
    total.setAttribute("aria-label", `Työaikaa ${dayTotal}`);
    const detailsButton = createElement("button", "day-details-button", "Tiedot");
    detailsButton.type = "button";
    detailsButton.dataset.dayIndex = String(index);
    detailsButton.setAttribute("aria-label", `Näytä tarkemmat tiedot: ${new Intl.DateTimeFormat("fi-FI", { weekday: "long", day: "numeric", month: "long" }).format(day)}`);
    detailsRow.append(total, detailsButton);
    heading.append(
      createElement("span", "", new Intl.DateTimeFormat("fi-FI", { weekday: "short" }).format(day)),
      createElement("strong", "", formatDate(day)),
      detailsRow,
    );
    elements.calendar.append(heading);
  });

  for (let hour = first; hour < last; hour += 1) {
    const label = createElement("time", "time-label", `${String(hour).padStart(2, "0")}:00`);
    label.style.gridRow = String(hour - first + 2);
    label.dateTime = `${String(hour).padStart(2, "0")}:00`;
    elements.calendar.append(label);
  }

  days.forEach((day, index) => {
    const track = createElement("div", "day-track");
    track.style.gridColumn = String(index + 2);
    track.style.gridRow = `2 / span ${hourCount}`;
    track.classList.toggle("is-today", isSameDay(day, new Date(now)));
    track.setAttribute("role", "group");
    track.setAttribute("aria-label", new Intl.DateTimeFormat("fi-FI", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(day));

    const dayTasks = activeProfileTasks()
      .filter((task) => eventRangeForDay(task, day, now))
      .sort((firstTask, secondTask) => firstTask.start - secondTask.start);
    for (const task of dayTasks) {
      const range = eventRangeForDay(task, day, now);
      addTaskBlock(track, task, day, range, first * 60, now);
    }

    const dateNow = new Date(now);
    const currentMinute = wallMinute(now);
    if (isSameDay(day, dateNow) && currentMinute >= first * 60 && currentMinute <= last * 60) {
      const line = createElement("span", "now-line");
      line.style.insetBlockStart = `${(currentMinute - first * 60) * HOUR_HEIGHT / 60}px`;
      line.setAttribute("aria-hidden", "true");
      track.append(line);
    }

    if (dayTasks.length === 0 && !isSameDay(day, dateNow)) {
      const empty = createElement("span", "empty-day", "Ei tehtäviä");
      track.append(empty);
    }
    elements.calendar.append(track);
  });
}

function addDayStat(label, value, detail, primary = false) {
  const card = createElement("article", "day-stat");
  card.classList.toggle("is-primary", primary);
  card.append(
    createElement("span", "day-stat-label", label),
    createElement("strong", "day-stat-value", value),
    createElement("span", "day-stat-detail", detail),
  );
  elements.dayStats.append(card);
}

function renderDayTimeline(day, dayTasks, now) {
  const timeline = createElement("ol", "day-event-list");
  timeline.setAttribute("aria-label", `Tehtävät järjestyksessä: ${new Intl.DateTimeFormat("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(day)}`);

  if (dayTasks.length === 0) {
    timeline.append(createElement("li", "day-timeline-empty", "Ei tehtäviä tai taukoja tälle päivälle."));
    elements.dayTimeline.replaceChildren(timeline);
    return;
  }

  dayTasks.forEach(({ task, range }, index) => {
    const item = createElement("li", "day-event-item");
    const number = createElement("span", "day-event-number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");

    const card = createElement("article", "day-event-card");
    const header = createElement("div", "day-event-header");
    const name = createElement("h3", "day-event-name", task.name);
    const net = createElement("strong", "day-event-net", formatDuration(taskNetMinutes(task, range.start, range.end, now)));
    const running = task.end === null && range.end === now;
    const time = createElement("p", "day-event-time", `${formatTime(range.start)}–${running ? "käynnissä" : formatTime(range.end)} · tehtävään kirjattu ${formatDuration(elapsedMinutes(range.start, range.end))}`);
    header.append(name, net);
    card.append(header, time);

    const breakRows = task.breaks
      .map((rest) => {
        const start = Math.max(rest.start, range.start);
        const end = Math.min(rest.end ?? now, range.end);
        if (end <= start) return null;
        const isRunning = rest.end === null && end === now;
        const row = createElement("li", "day-event-break");
        row.append(
          createElement("span", "", `Tauko · ${formatTime(start)}–${isRunning ? "käynnissä" : formatTime(end)}`),
          createElement("strong", "", formatDuration(elapsedMinutes(start, end))),
        );
        return { row, start };
      })
      .filter((entry) => entry)
      .sort((firstBreak, secondBreak) => firstBreak.start - secondBreak.start);

    if (breakRows.length > 0) {
      const breaks = createElement("ul", "day-event-breaks");
      breaks.append(...breakRows.map(({ row }) => row));
      card.append(breaks);
    }

    item.append(number, card);
    timeline.append(item);
  });

  elements.dayTimeline.replaceChildren(timeline);
}

function renderDayDetails(day, now = Date.now()) {
  const timelineScroll = elements.dayTimeline.parentElement;
  const previousScrollTop = timelineScroll.scrollTop;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const nextDay = addDays(day, 1);
  const dayEnd = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate()).getTime();
  const dayTasks = activeProfileTasks()
    .map((task) => ({ task, range: eventRangeForDay(task, day, now) }))
    .filter((entry) => entry.range)
    .sort((firstEntry, secondEntry) => firstEntry.range.start - secondEntry.range.start);

  const grossMinutes = dayTasks.reduce((sum, { range }) => sum + elapsedMinutes(range.start, range.end), 0);
  const netMinutes = dayTasks.reduce((sum, { task }) => sum + taskNetMinutes(task, dayStart, dayEnd, now), 0);
  const breakMinutes = Math.max(0, grossMinutes - netMinutes);
  const breakCount = dayTasks.reduce((sum, { task, range }) => sum + task.breaks.filter((rest) => (
    Math.min(rest.end ?? now, range.end) > Math.max(rest.start, range.start)
  )).length, 0);
  const dailyTarget = dailyWorkTargetMinutes();
  const targetDifference = dailyTarget - netMinutes;
  let targetDetail = "Päivän tavoite täynnä";
  if (targetDifference > 0) targetDetail = `${formatDuration(targetDifference)} jäljellä tavoitteesta`;
  if (targetDifference < 0) targetDetail = `${formatDuration(-targetDifference)} yli tavoitteen`;

  elements.dayDialogTitle.textContent = new Intl.DateTimeFormat("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day);
  if (dayTasks.length === 0) {
    elements.dayDialogSummary.textContent = "Ei kirjattuja tehtäviä tai taukoja.";
  } else {
    const firstStart = dayTasks[0].range.start;
    const lastEnd = dayTasks.reduce((latest, entry) => Math.max(latest, entry.range.end), firstStart);
    const hasRunningTask = dayTasks.some(({ task, range }) => task.end === null && range.end === now);
    elements.dayDialogSummary.textContent = `${dayTasks.length} ${dayTasks.length === 1 ? "tehtävä" : "tehtävää"} · ${breakCount} ${breakCount === 1 ? "tauko" : "taukoa"} · päivä ${formatTime(firstStart)}–${hasRunningTask ? "käynnissä" : formatTime(lastEnd)}`;
  }

  elements.dayStats.replaceChildren();
  addDayStat("Nettotyöaika", formatDuration(netMinutes), "Tauot vähennetty", true);
  addDayStat("Tehtäviin kirjattu", formatDuration(grossMinutes), `${dayTasks.length} tehtävää`);
  addDayStat("Tauot", formatDuration(breakMinutes), `${breakCount} taukomerkintää`);
  addDayStat("Päivän tavoite", formatDuration(dailyTarget), targetDetail);

  renderDayTimeline(day, dayTasks, now);
  timelineScroll.scrollTop = previousScrollTop;
}

function renderSummary(now = Date.now()) {
  const { start, end } = getWeekBounds();
  const weeklyMinutes = activeProfileTasks().reduce((sum, task) => sum + taskNetMinutes(task, start, end, now), 0);
  const dailyTarget = dailyWorkTargetMinutes();
  const targetMinutes = dailyTarget * 5;
  elements.weeklyTotal.textContent = formatDuration(weeklyMinutes);
  elements.weeklyTarget.textContent = formatDuration(targetMinutes);
  elements.weeklyRemaining.textContent = formatDuration(Math.max(0, targetMinutes - weeklyMinutes));
}

function render() {
  const now = Date.now();
  renderWeekLabel();
  renderTracker(now);
  renderSummary(now);
  renderCalendar(now);
}

function validateWorkHours(start, end, breakMinutes) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    throw new Error("Anna työajan alkamis- ja päättymisaika.");
  }
  if (parseTime(start) >= parseTime(end)) {
    throw new Error("Työpäivän päättymisajan on oltava alkamisajan jälkeen.");
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    throw new Error("Anna taukoajaksi kokonainen minuuttimäärä, joka on vähintään nolla.");
  }
  if (breakMinutes > parseTime(end) - parseTime(start)) {
    throw new Error("Päivittäinen taukoaika ei voi olla pidempi kuin työpäivä.");
  }
}

function ensureCurrentWeekAction() {
  if (!isSelectedWeekCurrent()) {
    throw new Error("Ajanottoa voi käyttää vain tämän viikon näkymässä.");
  }
  const day = new Date();
  if (day.getDay() === 0 || day.getDay() === 6) {
    throw new Error("Työajanseuranta on käytettävissä maanantaista perjantaihin.");
  }
}

function ensureClockHasNotMovedBack(start) {
  if (Date.now() < start) {
    throw new Error("Laitteen kellonaika on ennen tapahtuman alkua. Tarkista laitteen kellonaika ja yritä uudelleen.");
  }
}

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    ensureCurrentWeekAction();
    const name = elements.taskName.value.trim();
    if (!name) {
      elements.taskName.focus();
      throw new Error("Kirjoita tehtävän nimi ennen ajanoton aloittamista.");
    }
    if (hasRunningTask()) throw new Error("Lopeta käynnissä oleva tehtävä ennen uuden aloittamista.");
    const task = {
      id: crypto.randomUUID(),
      profileId: activeProfileId,
      name,
      start: Date.now(),
      end: null,
      breaks: [],
    };
    await saveTask(task);
    tasks.push(task);
    elements.taskName.value = "";
    showNotice(`Tehtävä ”${name}” alkoi ${formatTime(task.start)}.`);
    render();
  });
});

elements.stopTaskButton.addEventListener("click", () => {
  runAction(async () => {
    ensureCurrentWeekAction();
    const task = currentTask();
    if (!task) throw new Error("Käynnissä olevaa tehtävää ei löytynyt.");
    const end = Date.now();
    ensureClockHasNotMovedBack(task.start);
    const rest = activeBreak(task);
    if (rest) {
      ensureClockHasNotMovedBack(rest.start);
      rest.end = end;
    }
    task.end = end;
    await saveTask(task);
    showNotice(`Tehtävä ”${task.name}” päättyi ${formatTime(end)}.`);
    render();
  });
});

elements.breakButton.addEventListener("click", () => {
  runAction(async () => {
    ensureCurrentWeekAction();
    const task = currentTask();
    if (!task) throw new Error("Aloita tehtävä ennen tauon kirjaamista.");
    const rest = activeBreak(task);
    const now = Date.now();
    if (rest) {
      ensureClockHasNotMovedBack(rest.start);
      rest.end = now;
      showNotice(`Tauko päättyi ${formatTime(now)}.`);
    } else {
      ensureClockHasNotMovedBack(task.start);
      task.breaks.push({ start: now, end: null });
      showNotice(`Tauko alkoi ${formatTime(now)}.`);
    }
    await saveTask(task);
    render();
  });
});

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    const start = elements.workStart.value;
    const end = elements.workEnd.value;
    const breakMinutes = Number(elements.dailyBreak.value);
    validateWorkHours(start, end, breakMinutes);
    const nextSettings = { id: activeProfileId, start, end, breakMinutes };
    await saveSettings(nextSettings);
    settings = nextSettings;
    const settingsIndex = settingsRecords.findIndex((record) => record.id === activeProfileId);
    if (settingsIndex === -1) settingsRecords.push(nextSettings);
    else settingsRecords[settingsIndex] = nextSettings;
    showNotice(`Työaika-asetukset tallennettu: ${start}–${end}, taukoaikaa ${breakMinutes} min/päivä.`);
    render();
  });
});

elements.profileSelect.addEventListener("change", () => {
  const requestedProfileId = elements.profileSelect.value;
  runAction(async () => {
    try {
      await activateProfile(requestedProfileId);
    } catch (error) {
      elements.profileSelect.value = activeProfileId;
      throw error;
    }
  });
});

elements.profileColor.addEventListener("change", () => {
  const profileIndex = profiles.findIndex((profile) => profile.id === activeProfileId);
  const profile = profiles[profileIndex];
  if (!profile) {
    renderProfileOptions();
    return;
  }

  const color = elements.profileColor.value;
  runAction(async () => {
    if (!isValidProfileColor(color)) {
      elements.profileColor.value = profile.color;
      throw new Error("Valitse profiilille kelvollinen väri.");
    }
    const updatedProfile = { ...profile, color };
    try {
      await saveProfiles([updatedProfile]);
    } catch (error) {
      elements.profileColor.value = profile.color;
      throw error;
    }
    profiles[profileIndex] = updatedProfile;
    renderProfileOptions();
    showNotice(`Headerin väri päivitetty profiilille "${profile.name}".`);
  });
});

elements.addProfileButton.addEventListener("click", () => {
  if (hasRunningTask()) {
    showNotice("Lopeta käynnissä oleva tehtävä ennen uuden profiilin luomista.", true);
    return;
  }
  elements.profileName.value = "";
  elements.profileError.textContent = "";
  elements.profileError.hidden = true;
  elements.profileName.removeAttribute("aria-invalid");
  elements.profileDialog.showModal();
});

elements.profileName.addEventListener("input", () => {
  elements.profileError.textContent = "";
  elements.profileError.hidden = true;
  elements.profileName.removeAttribute("aria-invalid");
});

elements.profileCancelButton.addEventListener("click", () => {
  elements.profileDialog.close();
});

elements.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.profileName.value.trim();
  if (!name) {
    elements.profileError.textContent = "Anna profiilille nimi.";
    elements.profileError.hidden = false;
    elements.profileName.setAttribute("aria-invalid", "true");
    elements.profileName.focus();
    return;
  }
  const normalizedName = name.toLocaleLowerCase("fi-FI");
  if (profiles.some((profile) => profile.name.toLocaleLowerCase("fi-FI") === normalizedName)) {
    elements.profileError.textContent = "Tämän niminen profiili on jo olemassa.";
    elements.profileError.hidden = false;
    elements.profileName.setAttribute("aria-invalid", "true");
    elements.profileName.focus();
    return;
  }

  runAction(async () => {
    try {
      await createProfile(name);
      elements.profileDialog.close();
    } catch (error) {
      elements.profileError.textContent = `Profiilia ei voitu luoda: ${error.message}`;
      elements.profileError.hidden = false;
      elements.profileName.setAttribute("aria-invalid", "true");
      elements.profileName.focus();
    }
  });
});

elements.previousWeekButton.addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, -7);
  render();
});

elements.nextWeekButton.addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, 7);
  render();
});

elements.currentWeekButton.addEventListener("click", () => {
  selectedWeek = startOfWeek(new Date());
  render();
});

elements.calendar.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest("button[data-day-index]");
  if (!trigger) return;

  runAction(async () => {
    openDay = addDays(selectedWeek, Number(trigger.dataset.dayIndex));
    renderDayDetails(openDay);
    elements.dayTimeline.parentElement.scrollTop = 0;
    elements.dayDialog.showModal();
  });
});

elements.dayDialog.addEventListener("close", () => {
  openDay = null;
});

async function initialize() {
  try {
    if (!("indexedDB" in window)) throw new Error("Selain ei tue paikallista tietokantaa.");
    database = await openDatabase();
    database.addEventListener("versionchange", () => database.close());
    await loadData();
    validateWorkHours(settings.start, settings.end, settings.breakMinutes);
    renderProfileOptions();
    setWorkHourInputs();
    render();
    window.setInterval(() => {
      renderTracker();
      renderSummary();
      renderCalendar();
      if (openDay) renderDayDetails(openDay);
    }, 30_000);
  } catch (error) {
    showFatalError(error);
  }
}

initialize();
