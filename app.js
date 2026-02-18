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

let calendar;
let selectedEvent = null;
let selectedStart = null;

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
      const coachVal = titleParts ? titleParts[2].split(", ") : ["Vlad"];
      coachSelect.value = coachVal.length === 1 ? coachVal[0] : "Vlad"; // default single selection for now
      modal.classList.remove("hidden");
      deleteBtn.classList.remove("hidden");
      lessonTypeSelect.value = selectedEvent.extendedProps.lessonType || "class";
      // 🔽 ADD THIS BLOCK
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
      const snapshot = await getDocs(collection(db, "lessons"));
      const events = [];

      const rangeStart = fetchInfo.start;
      const rangeEnd = fetchInfo.end;
      const viewWeekStart = weekStartMonday(rangeStart);
      const todayWeekStart = weekStartMonday(new Date());

      snapshot.forEach(docSnap => {
        const d = docSnap.data();

        const title = d.title;
        const coach = d.coach;
        const lessonType = d.lessonType || "class";
        const repeatWeekly = !!d.repeatWeekly;

        const baseStart = new Date(d.start);
        const baseEnd = new Date(d.end);

        const durationMins = Math.round((baseEnd - baseStart) / 60000);

        // Helper to build one event object
        const pushEvent = (startDate) => {
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
              repeatWeekly
            }
          });
        };

        if (!repeatWeekly) {
          // normal one-time lesson
          pushEvent(baseStart);
          return;
        }

        // repeating weekly: generate ONLY for the visible week(s)
        // We align the occurrence week to the calendar’s view week.
        const baseWeekStart = weekStartMonday(baseStart);
        const rawOffset = Math.round((viewWeekStart - baseWeekStart) / (7 * 24 * 60 * 60 * 1000));
        const minOffset = Math.round((todayWeekStart - baseWeekStart) / (7 * 24 * 60 * 60 * 1000));
        const weeksOffset = Math.max(rawOffset, minOffset); // never generate in the past


        // occurrence start = baseStart shifted by N weeks
        const occStart = addDays(baseStart, weeksOffset * 7);
        pushEvent(occStart);

        // If the view spans > 1 week (rare), generate the next one too
        const occStartNext = addDays(occStart, 7);
        pushEvent(occStartNext);
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

    if (!confirm(`Delete lesson "${selectedEvent.title}"?`)) return;

    try {
      const lessonId = selectedEvent.extendedProps.docId;
      if (lessonId) {
        await deleteDoc(doc(db, "lessons", lessonId));
      }

      selectedEvent.remove();
      modal.classList.add("hidden");
      selectedEvent = null;

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

    if (!title) { alert("Enter lesson name"); return; }

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

    // EDIT existing
    
    if (selectedEvent) {
      try {
        const lessonId = selectedEvent.extendedProps.docId;
        const wasRepeating = !!selectedEvent.extendedProps.repeatWeekly;

        if (wasRepeating && !repeatWeekly) {
          // You are turning repeating OFF now → keep history
          await materializePastRepeats(
            selectedEvent.extendedProps.docId,     // parentId
            selectedEvent.start.toISOString(),     // baseStart
            selectedEvent.end.toISOString(),       // baseEnd
            title, coach, lessonType               // lesson data
          );
        }

        await updateDoc(doc(db, "lessons", lessonId), {
          title,
          coach,
          lessonType,
          repeatWeekly,
          start: start.toISOString(),
          end: end.toISOString()
        });

        alert("✅ Lesson updated");
        modal.classList.add("hidden");
        selectedEvent = null;
        selectedStart = null;

        calendar.refetchEvents(); // <-- redraw based on Firestore + repeating
      } catch (e) {
        console.error(e);
        alert("❌ Failed to update");
      }
      return;
    }

    // ADD new
    try {
      await addDoc(collection(db, "lessons"), {
        title,
        coach,
        lessonType,
        repeatWeekly,
        start: start.toISOString(),
        end: end.toISOString()
      });

      alert("✅ Lesson added");
      modal.classList.add("hidden");
      selectedStart = null;

      calendar.refetchEvents(); // <-- redraw based on Firestore + repeating
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
  };

});