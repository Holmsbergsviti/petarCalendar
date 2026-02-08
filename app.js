import {
  collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const coachSelect = document.getElementById("lessonCoach");
const dateInput = document.getElementById("lessonDate");
const timeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const deleteBtn = document.getElementById("deleteLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addBtn = document.getElementById("addLessonBtn");
const calendarEl = document.getElementById("calendar");

let calendar;
let editingEvent = null;

const coachColors = {
  Vlad: "#3b82f6",
  Ana: "#10b981",
  "Petar Boss": "#f59e0b"
};

/* ---------------- COLOR LOGIC ---------------- */

function computeGradient(coaches){
  if (!coaches || coaches.length === 0) return "#999";
  if (coaches.length === 1) return coachColors[coaches[0]] || "#999";
  return `linear-gradient(135deg, ${coaches.map(c => coachColors[c]).join(",")})`;
}

/* ---------------- HALL AVAILABILITY (BACKGROUND ONLY) ---------------- */

function getHallBackgroundEvents(start, end) {
  const events = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
    const d = new Date(ts);
    const day = d.getDay(); // 0=Sun, 1=Mon ... 5=Fri

    if (day === 0 || day === 6) continue; // skip weekends

    const year = d.getFullYear();
    const month = d.getMonth();
    const date = d.getDate();

    // After 18:00 to 22:00
    const after6Start = new Date(year, month, date, 18, 0);
    const after6End = new Date(year, month, date, 22, 0);

    // Light red for Mon/Wed after 6 PM
    if ([1, 3].includes(day)) {
      events.push({
        start: after6Start,
        end: after6End,
        display: "background",
        allDay: false,
        backgroundColor: "rgba(220, 38, 38, 0.15)"
      });
    }

    // Light yellow for Tue/Thu/Fri after 6 PM
    if ([2, 4, 5].includes(day)) {
      events.push({
        start: after6Start,
        end: after6End,
        display: "background",
        allDay: false,
        backgroundColor: "rgba(245, 158, 11, 0.15)"
      });
    }
  }

  return events;
}

/* ---------------- CALENDAR INIT ---------------- */

document.addEventListener("DOMContentLoaded", async () => {

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    selectable: true,
    nowIndicator: true,

    slotDuration: "00:15:00",
    slotLabelInterval: "01:00:00",
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",

    height: "auto",

    select: info => openModal(info.start),
    eventClick: info => openModal(null, info.event),

    eventDidMount: info => {
      const coaches = info.event.extendedProps.coaches || [];
      info.el.style.background = computeGradient(coaches);
      info.el.style.border = "none";
    },

    // 🔹 inject hall availability when week changes
    datesSet: info => {
      calendar.getEvents()
        .filter(e => e.display === "background")
        .forEach(e => e.remove());

      getHallBackgroundEvents(info.start, info.end)
        .forEach(e => calendar.addEvent(e));
    }
  });

  calendar.render();

  // Load lessons
  const snap = await getDocs(collection(db, "lessons"));
  snap.forEach(d => {
    const data = d.data();
    calendar.addEvent({
      id: d.id,
      title: data.title,
      start: data.start,
      end: data.end,
      extendedProps: { coaches: data.coaches }
    });
  });
});

/* ---------------- MODAL LOGIC ---------------- */

function openModal(start, event = null){
  editingEvent = event;
  deleteBtn.classList.toggle("hidden", !event);

  if(event){
    titleInput.value = event.title;
    dateInput.valueAsDate = new Date(event.start);
    timeInput.value = event.start.toTimeString().slice(0,5);
    [...coachSelect.options].forEach(o =>
      o.selected = event.extendedProps.coaches.includes(o.value)
    );
  } else {
    titleInput.value = "";
    dateInput.valueAsDate = start;
    timeInput.value = start.toTimeString().slice(0,5);
    coachSelect.selectedIndex = -1;
  }

  modal.classList.remove("hidden");
}

/* ---------------- SAVE / EDIT ---------------- */

saveBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const coaches = [...coachSelect.selectedOptions].map(o => o.value);
  if (!title || coaches.length === 0) return alert("Fill all fields");

  const start = new Date(`${dateInput.value}T${timeInput.value}`);
  const end = new Date(start.getTime() + 45 * 60000);

  if (editingEvent) {
    await updateDoc(doc(db,"lessons", editingEvent.id), {
      title, coaches, start: start.toISOString(), end: end.toISOString()
    });

    editingEvent.setProp("title", title);
    editingEvent.setStart(start);
    editingEvent.setEnd(end);
    editingEvent.setExtendedProp("coaches", coaches);
  } else {
    const ref = await addDoc(collection(db,"lessons"), {
      title, coaches, start: start.toISOString(), end: end.toISOString()
    });

    calendar.addEvent({
      id: ref.id,
      title, start, end,
      extendedProps: { coaches }
    });
  }

  modal.classList.add("hidden");
  editingEvent = null;
};

/* ---------------- DELETE ---------------- */

deleteBtn.onclick = async () => {
  await deleteDoc(doc(db,"lessons", editingEvent.id));
  editingEvent.remove();
  modal.classList.add("hidden");
  editingEvent = null;
};

/* ---------------- CANCEL ---------------- */

cancelBtn.onclick = () => {
  modal.classList.add("hidden");
  editingEvent = null;
};

/* ---------------- MOBILE ADD BUTTON ---------------- */

addBtn.onclick = () => openModal(new Date());
