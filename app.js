import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const coachSelect = document.getElementById("lessonCoach");
const lessonDateInput = document.getElementById("lessonDate");
const lessonTimeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addLessonBtn = document.getElementById("addLessonBtn");
const calendarEl = document.getElementById("calendar");
const deleteBtn = document.getElementById("deleteLesson");
const lessonTypeSelect = document.getElementById("lessonType");
const repeatWeeklyCheckbox = document.getElementById("repeatWeekly");
const repeatEndDateInput = document.getElementById("repeatEndDate");
const repeatEndDateLabel = document.getElementById("repeatEndDateLabel");
const bulkEditOptions = document.getElementById("bulkEditOptions");
const editAllFutureBtn = document.getElementById("editAllFutureBtn");
const statsPanel = document.getElementById("statsPanel");
const toggleStatsBtn = document.getElementById("toggleStatsBtn");
const closeStatsBtn = document.getElementById("closeStatsBtn");
const statsContent = document.getElementById("statsContent");
const statsPeriod = document.getElementById("statsPeriod");
const coachFilter = document.getElementById("coachFilter");
const typeFilter = document.getElementById("typeFilter");
const timeConflictWarning = document.getElementById("timeConflictWarning");
const conflictMessage = document.getElementById("conflictMessage");
const coachLegend = document.getElementById("coachLegend");

let calendar;
let selectedEvent = null;
let selectedStart = null;
let editingAllFuture = false;

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };
const groupColor = "#8b5cf6";

const hallSchedule = [
  { day: 1, from: "10:30", to: "11:30", status: "small-only" },
  { day: 1, from: "18:00", to: "22:00", status: "none" },

  { day: 2, from: "11:00", to: "12:00", status: "small-only" },
  { day: 2, from: "18:00", to: "22:00", status: "small-only" },

  { day: 3, from: "18:00", to: "22:00", status: "big-only" },

  { day: 4, from: "11:00", to: "12:00", status: "small-only" },
  { day: 4, from: "18:00", to: "22:00", status: "small-only" },

  { day: 5, from: "10:30", to: "11:30", status: "small-only" },
  { day: 5, from: "18:00", to: "20:00", status: "small-only" },

  { day: 6, from: "09:00", to: "12:00", status: "small-only" },
  { day: 6, from: "18:00", to: "20:00", status: "small-only" },

  { day: 0, from: "18:00", to: "22:00", status: "small-only" } //sunday
];

function getEventColor(coachList, lessonType = "class") {
  if (lessonType === "group") return groupColor;

  if (Array.isArray(coachList)) {
    return coachColors[coachList[0]] || "#999";
  }
  return coachColors[coachList] || "#999";
}

function applyEventColors(info) {
  const coach = info.event.extendedProps.coach;
  const lessonType = info.event.extendedProps.lessonType || "class";

  if (lessonType === "group") {
    info.el.style.backgroundImage = "";
    info.el.style.backgroundColor = groupColor;
    info.el.style.border = "none";
    return;
  }

  if (Array.isArray(coach) && coach.length > 1) {
    const colors = coach.map(c => coachColors[c] || "#999");

    info.el.style.backgroundColor = "transparent";
    info.el.style.backgroundImage =
      `linear-gradient(90deg, ${colors.join(", ")})`;
    info.el.style.border = "none";
  } else {
    info.el.style.backgroundImage = "";
    info.el.style.backgroundColor = getEventColor(coach, lessonType);
  }
}

function getHallBackgroundEvents(start, end) {
  const events = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
    const d = new Date(ts);
    const day = d.getDay();

    const year = d.getFullYear();
    const month = d.getMonth();
    const date = d.getDate();

    // get rules for this weekday
    const rules = hallSchedule.filter(r => r.day === day);

    for (const r of rules) {
      const fromM = timeToMinutes(r.from);
      const toM = timeToMinutes(r.to);

      const startTime = new Date(year, month, date, Math.floor(fromM / 60), fromM % 60);
      const endTime = new Date(year, month, date, Math.floor(toM / 60), toM % 60);

      const bg = statusToColor(r.status);
      if (!bg) continue;

      events.push({
        start: startTime,
        end: endTime,
        display: "background",
        allDay: false,
        backgroundColor: bg,
        extendedProps: { isHall: true, status: r.status }
      });
    }
  }

  return events;
}

function renderHallAvailability() {
  calendar.getEvents().forEach(ev => {
    if (ev.extendedProps && ev.extendedProps.isHall) ev.remove();
  });
  const hallEvents = getHallBackgroundEvents(calendar.view.activeStart, calendar.view.activeEnd);
  hallEvents.forEach(ev => calendar.addEvent(ev));
}

// -------- Helpers --------
async function materializePastRepeats(parentId, baseStartISO, baseEndISO, title, coach, lessonType) {
  const baseStart = new Date(baseStartISO);
  const baseEnd = new Date(baseEndISO);
  const durationMins = Math.round((baseEnd - baseStart) / 60000);

  const todayWeekStart = weekStartMonday(new Date());
  const baseWeekStart = weekStartMonday(baseStart);

  // how many full weeks have passed BEFORE this week
  const weeksPassed = Math.floor((todayWeekStart - baseWeekStart) / (7 * 24 * 60 * 60 * 1000));
  if (weeksPassed <= 0) return;

  for (let w = 0; w < weeksPassed; w++) {
    const occStart = addDays(baseStart, w * 7);
    const occEnd = addMinutes(occStart, durationMins);

    // Dedup check: does this occurrence already exist?
    const qy = query(
      collection(db, "lessons"),
      where("parentId", "==", parentId),
      where("occStart", "==", occStart.toISOString()),
      limit(1)
    );
    const existing = await getDocs(qy);
    if (!existing.empty) continue;

    await addDoc(collection(db, "lessons"), {
      title,
      coach,
      lessonType,
      start: occStart.toISOString(),
      end: occEnd.toISOString(),
      repeatWeekly: false,
      parentId,
      occStart: occStart.toISOString()
    });
  }
}

function weekStartMonday(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date, mins) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function statusToColor(status) {
  if (status === "none") return "rgba(202, 33, 33, 0.25)";        // both taken (grey)
  if (status === "small-only") return "rgba(255,210,80,0.25)";   // only small free (yellow)
  if (status === "big-only") return "rgba(120,180,255,0.25)";    // only big free (blue)
  return null; // both free (no color)
}

function formatOrdinal(n){
  if(n>3 && n<21) return n+"th";
  switch(n%10){
    case 1: return n+"st";
    case 2: return n+"nd";
    case 3: return n+"rd";
    default: return n+"th";
  }
}


function getSelectedCoaches() {
  return Array.from(coachSelect.selectedOptions).map(o => o.value);
}

// -------- Validation & Conflict Detection --------
function checkTimeConflicts(start, end, excludeEventId = null) {
  const conflicts = [];
  calendar.getEvents().forEach(ev => {
    if (excludeEventId && ev.extendedProps.docId === excludeEventId) return;
    if (ev.extendedProps.isHall) return; // skip hall availability events
    
    const evStart = new Date(ev.start);
    const evEnd = new Date(ev.end);
    
    // Check if times overlap
    if (start < evEnd && end > evStart) {
      conflicts.push(ev);
    }
  });
  return conflicts;
}

function checkHallAvailability(start, end) {
  const dayOfWeek = start.getDay();
  const startMins = start.getHours() * 60 + start.getMinutes();
  const endMins = end.getHours() * 60 + end.getMinutes();
  
  const dayRules = hallSchedule.filter(r => r.day === dayOfWeek);
  
  for (const rule of dayRules) {
    const ruleFromMins = timeToMinutes(rule.from);
    const ruleToMins = timeToMinutes(rule.to);
    
    // Check if requested time is within any available slot
    if (startMins >= ruleFromMins && endMins <= ruleToMins) {
      return { available: true, status: rule.status };
    }
  }
  
  return { available: false, status: null };
}

function showTimeConflictWarning(conflicts, hallConflict) {
  if (conflicts.length === 0 && !hallConflict) {
    timeConflictWarning.style.display = "none";
    return;
  }
  
  let message = "";
  if (hallConflict) {
    message += "Hall not available at this time.\n";
  }
  if (conflicts.length > 0) {
    message += `${conflicts.length} lesson(s) overlap with this time.`;
  }
  
  conflictMessage.textContent = message;
  timeConflictWarning.style.display = "block";
}

// -------- Statistics --------
async function calculateStatistics(period) {
  const snapshot = await getDocs(collection(db, "lessons"));
  const now = new Date();
  const stats = {
    total: 0,
    byCoach: {},
    byType: {},
    byCoachType: {}
  };
  
  let startDate, endDate;
  
  if (period === "week") {
    startDate = weekStartMonday(now);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    startDate = new Date(0);
    endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }
  
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const lessonStart = new Date(d.start);
    
    // For repeating lessons, count occurrences in period
    if (d.repeatWeekly) {
      const baseWeekStart = weekStartMonday(lessonStart);
      const rangeWeekStart = weekStartMonday(startDate);
      const weeksInRange = Math.floor((endDate - rangeWeekStart) / (7 * 24 * 60 * 60 * 1000));
      
      for (let w = 0; w <= weeksInRange; w++) {
        const occStart = addDays(lessonStart, w * 7);
        if (occStart >= startDate && occStart < endDate) {
          const coaches = Array.isArray(d.coach) ? d.coach : [d.coach];
          const type = d.lessonType || "class";
          
          stats.total++;
          coaches.forEach(coach => {
            stats.byCoach[coach] = (stats.byCoach[coach] || 0) + 1;
            const key = `${coach}-${type}`;
            stats.byCoachType[key] = (stats.byCoachType[key] || 0) + 1;
          });
          stats.byType[type] = (stats.byType[type] || 0) + 1;
        }
      }
    } else if (lessonStart >= startDate && lessonStart < endDate) {
      const coaches = Array.isArray(d.coach) ? d.coach : [d.coach];
      const type = d.lessonType || "class";
      
      stats.total++;
      coaches.forEach(coach => {
        stats.byCoach[coach] = (stats.byCoach[coach] || 0) + 1;
        const key = `${coach}-${type}`;
        stats.byCoachType[key] = (stats.byCoachType[key] || 0) + 1;
      });
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }
  });
  
  return stats;
}

function renderStatistics(stats, period) {
  let html = `<h3>${period === "week" ? "📅 This Week" : period === "month" ? "📅 This Month" : "📊 Total"}</h3>`;
  html += `<div style="background:#f0f0f0; padding:10px; border-radius:6px; margin-bottom:15px;">`;
  html += `<p style="margin:0; font-size:16px; font-weight:bold;">Total Lessons: <span style="color:#3b82f6;">${stats.total}</span></p>`;
  html += `</div>`;
  
  html += `<h4>By Coach:</h4>`;
  html += `<ul style="margin:0; padding-left:20px;">`;
  Object.entries(stats.byCoach).forEach(([coach, count]) => {
    const color = coachColors[coach] || "#999";
    html += `<li style="margin-bottom:5px;"><span style="display:inline-block; width:12px; height:12px; background:${color}; border-radius:2px; margin-right:6px;"></span>${coach}: <strong>${count}</strong></li>`;
  });
  html += `</ul>`;
  
  html += `<h4>By Type:</h4>`;
  html += `<ul style="margin:0; padding-left:20px;">`;
  Object.entries(stats.byType).forEach(([type, count]) => {
    const icon = type === "class" ? "👥" : "🎭";
    html += `<li style="margin-bottom:5px;">${icon} ${type.charAt(0).toUpperCase() + type.slice(1)}: <strong>${count}</strong></li>`;
  });
  html += `</ul>`;
  
  statsContent.innerHTML = html;
}

// -------- Initialize Calendar --------
document.addEventListener("DOMContentLoaded", async ()=>{

  calendar = new FullCalendar.Calendar(calendarEl,{
    initialView:"timeGridWeek",
    firstDay:1,
    selectable:true,
    selectMirror:true,
    nowIndicator:true,
    headerToolbar:{left:"prev,next today",center:"title",right:"timeGridDay,timeGridWeek"},
    slotMinTime:"09:00:00",
    slotMaxTime:"22:00:00",
    slotDuration:"00:15:00",
    slotLabelInterval:"01:00:00",
    height:'auto',
    contentHeight:'auto',

    dayHeaderContent: arg => {
      const weekday = arg.date.toLocaleDateString("en-GB",{ weekday: "long" });
      const day = formatOrdinal(arg.date.getDate());
      return `${weekday} ${day}`;
    },

    select: info => {
      if(window.innerWidth > 500){    
        selectedStart = info.start;
        selectedEvent = null;
        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0,5);
        repeatWeeklyCheckbox.checked = false;
        repeatEndDateInput.value = "";
        repeatEndDateLabel.style.display = "none";
        bulkEditOptions.style.display = "none";
        editingAllFuture = false;
        modal.classList.remove("hidden");
        deleteBtn.classList.add("hidden");
      }
      calendar.unselect();
    },

    eventDidMount: info => {
      applyEventColors(info);
    },

    eventClick: info => {
      selectedEvent = info.event;
      const titleParts = selectedEvent.title.match(/^(.*) \((.*)\)$/);
      titleInput.value = titleParts ? titleParts[1] : selectedEvent.title;
      lessonDateInput.valueAsDate = new Date(selectedEvent.start);
      lessonTimeInput.value = selectedEvent.start.toTimeString().slice(0,5);
      repeatWeeklyCheckbox.checked = !!selectedEvent.extendedProps.repeatWeekly;
      
      // Set repeat end date if exists
      if (selectedEvent.extendedProps.repeatEndDate) {
        repeatEndDateInput.valueAsDate = new Date(selectedEvent.extendedProps.repeatEndDate);
      } else {
        repeatEndDateInput.value = "";
      }
      
      // Show bulk edit options if this is a repeating event
      if (selectedEvent.extendedProps.repeatWeekly) {
        bulkEditOptions.style.display = "block";
      } else {
        bulkEditOptions.style.display = "none";
      }
      
      repeatEndDateLabel.style.display = repeatWeeklyCheckbox.checked ? "block" : "none";
      
      const coachVal = titleParts ? titleParts[2].split(", ") : ["Vlad"];
      lessonTypeSelect.value = selectedEvent.extendedProps.lessonType || "class";
      
      const coaches = selectedEvent.extendedProps.coach;
      if (Array.isArray(coaches)) {
        Array.from(coachSelect.options).forEach(opt => {
          opt.selected = coaches.includes(opt.value);
        });
      } else {
        Array.from(coachSelect.options).forEach(opt => {
          opt.selected = opt.value === coaches;
        });
      }
      
      modal.classList.remove("hidden");
      deleteBtn.classList.remove("hidden");
    },

    eventTouchStart: info => {
      let timer = setTimeout(async ()=>{
        if(confirm(`Delete lesson "${info.event.title}"?`)){
          const lessonId = info.event.extendedProps.docId;
          if(lessonId) await deleteDoc(doc(db,"lessons",lessonId));
          info.event.remove();
          alert("🗑 Lesson deleted");
        }
      }, 800);
      info.jsEvent.addEventListener("touchend", ()=>clearTimeout(timer));
    }
  });

  calendar.addEventSource(async (fetchInfo, successCallback, failureCallback) => {
    try {
      // Load all cancel exceptions (small app, so ok to load all)
      const exSnap = await getDocs(collection(db, "repeat_exceptions"));
      const cancelled = new Set();
      exSnap.forEach(ex => {
        const x = ex.data();
        if (x.type === "cancel") {
          cancelled.add(`${x.parentId}__${x.occStart}`);
        }
      });

      const snapshot = await getDocs(collection(db, "lessons"));
      const events = [];

      const rangeStart = fetchInfo.start;
      const rangeEnd = fetchInfo.end;
      const viewWeekStart = weekStartMonday(rangeStart);
      const todayWeekStart = weekStartMonday(new Date());
      
      const selectedCoachFilter = coachFilter.value;
      const selectedTypeFilter = typeFilter.value;

      snapshot.forEach(docSnap => {
        const d = docSnap.data();

        const title = d.title;
        const coach = d.coach;
        const lessonType = d.lessonType || "class";
        const repeatWeekly = !!d.repeatWeekly;
        const repeatEndDate = d.repeatEndDate ? new Date(d.repeatEndDate) : null;

        // Apply filters
        if (selectedCoachFilter) {
          const coachList = Array.isArray(coach) ? coach : [coach];
          if (!coachList.includes(selectedCoachFilter)) return;
        }
        if (selectedTypeFilter && lessonType !== selectedTypeFilter) return;

        const baseStart = new Date(d.start);
        const baseEnd = new Date(d.end);

        const durationMins = Math.round((baseEnd - baseStart) / 60000);

        // Helper to build one event object
        const pushEvent = (startDate) => {
          const key = `${docSnap.id}__${startDate.toISOString()}`;
          if (cancelled.has(key)) return;
          const endDate = addMinutes(startDate, durationMins);

          // only include if inside visible range
          if (endDate <= rangeStart || startDate >= rangeEnd) return;

          events.push({
            title: Array.isArray(coach) ? `${title} (${coach.join(", ")})` : `${title} (${coach})`,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            backgroundColor: getEventColor(coach, lessonType),
            borderColor: getEventColor(coach, lessonType),
            extendedProps: {
              docId: docSnap.id,
              coach,
              lessonType,
              repeatWeekly,
              occStart: startDate.toISOString(),
              repeatEndDate: repeatEndDate ? repeatEndDate.toISOString() : null
            }
          });
        };

        if (!repeatWeekly) {
          // normal one-time lesson
          pushEvent(baseStart);
          return;
        }

        // repeating weekly: generate ONLY for the visible week(s)
        const baseWeekStart = weekStartMonday(baseStart);
        const rawOffset = Math.round((viewWeekStart - baseWeekStart) / (7 * 24 * 60 * 60 * 1000));
        const minOffset = Math.round((todayWeekStart - baseWeekStart) / (7 * 24 * 60 * 60 * 1000));
        let weeksOffset = Math.max(rawOffset, minOffset); // never generate in the past

        // Generate occurrences
        while (true) {
          const occStart = addDays(baseStart, weeksOffset * 7);
          
          // Check if we're past the repeat end date
          if (repeatEndDate && occStart > repeatEndDate) break;
          
          // Check if we're past the visible range
          if (occStart >= rangeEnd) break;
          
          pushEvent(occStart);
          weeksOffset++;
        }
      });

      successCallback(events);
    } catch (e) {
      console.error(e);
      failureCallback(e);
    }
  });

  calendar.render();
  renderHallAvailability();
  calendar.on('datesSet', () => {
    renderHallAvailability();
    calendar.refetchEvents();
  });

  // Mobile floating add button
  addLessonBtn.onclick = () => {
    const now = new Date();
    lessonDateInput.valueAsDate = now;
    lessonTimeInput.value = "09:00";
    titleInput.value = "";
    selectedStart = null;
    selectedEvent = null;
    repeatWeeklyCheckbox.checked = false;
    modal.classList.remove("hidden");
    deleteBtn.classList.add("hidden");
  };

  deleteBtn.onclick = async () => {
    if (!selectedEvent) return;

    const isRepeating = !!selectedEvent.extendedProps.repeatWeekly;
    const parentId = selectedEvent.extendedProps.docId;
    const occStart = selectedEvent.extendedProps.occStart;

    // If it is a repeating occurrence -> cancel ONLY THIS WEEK
    if (isRepeating && parentId && occStart) {
      if (!confirm("Cancel this lesson for this week only? (Future weeks stay)")) return;

      try {
        await addDoc(collection(db, "repeat_exceptions"), {
          parentId,
          occStart,
          type: "cancel"
        });

        modal.classList.add("hidden");
        selectedEvent = null;
        calendar.refetchEvents();
        alert("🗓️ Cancelled for this week only");
      } catch (e) {
        console.error(e);
        alert("❌ Failed to cancel");
      }
      return;
    }

    // Normal (non-repeating) lesson -> delete permanently
    if (!confirm(`Delete lesson "${selectedEvent.title}"?`)) return;

    try {
      const lessonId = selectedEvent.extendedProps.docId;
      if (lessonId) await deleteDoc(doc(db, "lessons", lessonId));

      modal.classList.add("hidden");
      selectedEvent = null;
      calendar.refetchEvents();
      alert("🗑 Lesson deleted");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to delete lesson");
    }
  };

  // Save lesson
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coach = getSelectedCoaches();
    const lessonType = lessonTypeSelect.value;
    const repeatWeekly = repeatWeeklyCheckbox.checked;
    const repeatEndDate = repeatWeekly && repeatEndDateInput.value ? new Date(repeatEndDateInput.value) : null;

    if (!title) { alert("Enter lesson name"); return; }
    if (!coach.length) { alert("Select at least one coach"); return; }

    // Build start date
    let start;
    if (selectedEvent) {
      start = new Date(lessonDateInput.value);
      const [h, m] = lessonTimeInput.value.split(":").map(Number);
      start.setHours(h, m, 0, 0);
    } else if (selectedStart) {
      start = selectedStart;
    } else {
      const [year, month, day] = lessonDateInput.value.split("-").map(Number);
      const [hour, minute] = lessonTimeInput.value.split(":").map(Number);
      start = new Date(year, month - 1, day, hour, minute);
    }

    const duration = lessonType === "group" ? 60 : 45;
    const end = new Date(start.getTime() + duration * 60000);

    // Validate time slots
    const conflicts = checkTimeConflicts(start, end, selectedEvent ? selectedEvent.extendedProps.docId : null);
    const hallAvail = checkHallAvailability(start, end);
    
    showTimeConflictWarning(conflicts, !hallAvail.available);

    if (!hallAvail.available) {
      alert("⚠️ Hall is not available at this time. Please choose a different time slot.");
      return;
    }

    // EDIT existing
    if (selectedEvent) {
      try {
        const lessonId = selectedEvent.extendedProps.docId;
        const wasRepeating = !!selectedEvent.extendedProps.repeatWeekly;

        if (wasRepeating && !repeatWeekly) {
          // You are turning repeating OFF now → keep history
          await materializePastRepeats(
            lessonId,
            selectedEvent.start.toISOString(),
            selectedEvent.end.toISOString(),
            title, coach, lessonType
          );
        }

        const updateData = {
          title,
          coach,
          lessonType,
          repeatWeekly,
          start: start.toISOString(),
          end: end.toISOString(),
          occStart: start.toISOString()
        };
        
        if (repeatEndDate) {
          updateData.repeatEndDate = repeatEndDate.toISOString();
        }

        if (editingAllFuture && wasRepeating && repeatWeekly) {
          // Update all future occurrences
          const snapshot = await getDocs(query(
            collection(db, "lessons"),
            where("parentId", "==", lessonId)
          ));
          
          for (const docSnap of snapshot.docs) {
            const d = docSnap.data();
            const occDate = new Date(d.occStart);
            const selectedDate = new Date(lessonDateInput.value);
            
            if (occDate >= selectedDate) {
              await updateDoc(doc(db, "lessons", docSnap.id), updateData);
            }
          }
        } else {
          await updateDoc(doc(db, "lessons", lessonId), updateData);
        }

        alert("✅ Lesson updated");
        modal.classList.add("hidden");
        selectedEvent = null;
        selectedStart = null;
        editingAllFuture = false;

        calendar.refetchEvents();
      } catch (e) {
        console.error(e);
        alert("❌ Failed to update");
      }
      return;
    }

    // ADD new
    try {
      const newData = {
        title,
        coach,
        lessonType,
        repeatWeekly,
        start: start.toISOString(),
        end: end.toISOString(),
        occStart: start.toISOString()
      };
      
      if (repeatEndDate) {
        newData.repeatEndDate = repeatEndDate.toISOString();
      }

      await addDoc(collection(db, "lessons"), newData);

      alert("✅ Lesson added");
      modal.classList.add("hidden");
      selectedStart = null;

      calendar.refetchEvents();
    } catch (e) {
      console.error(e);
      alert("❌ Failed to add lesson");
    }
  };

  // Cancel modal
  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    selectedEvent = null;
    selectedStart = null;
    editingAllFuture = false;
  };

  // Repeat weekly checkbox
  repeatWeeklyCheckbox.onchange = () => {
    repeatEndDateLabel.style.display = repeatWeeklyCheckbox.checked ? "block" : "none";
  };

  // Bulk edit button
  editAllFutureBtn.onclick = () => {
    editingAllFuture = !editingAllFuture;
    editAllFutureBtn.style.background = editingAllFuture ? "#7c3aed" : "#9333ea";
    editAllFutureBtn.textContent = editingAllFuture ? "✅ Edit All Future" : "Edit All Future";
  };

  // Statistics
  toggleStatsBtn.onclick = async () => {
    statsPanel.classList.remove("hidden");
    const period = statsPeriod.value;
    const stats = await calculateStatistics(period);
    renderStatistics(stats, period);
  };

  closeStatsBtn.onclick = () => {
    statsPanel.classList.add("hidden");
  };

  statsPeriod.onchange = async () => {
    const period = statsPeriod.value;
    const stats = await calculateStatistics(period);
    renderStatistics(stats, period);
  };

  // Filter changes
  coachFilter.onchange = () => {
    calendar.refetchEvents();
  };

  typeFilter.onchange = () => {
    calendar.refetchEvents();
  };

  // Render coach legend
  function renderCoachLegend() {
    coachLegend.innerHTML = "";
    Object.entries(coachColors).forEach(([coach, color]) => {
      const item = document.createElement("div");
      item.className = "coach-legend-item";
      item.innerHTML = `<div class="coach-color-box" style="background:${color};"></div>${coach}`;
      coachLegend.appendChild(item);
    });
  }
  renderCoachLegend();

});