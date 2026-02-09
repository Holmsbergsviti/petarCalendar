import {
  collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc
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
let selectedEvent = null;
let selectedStart = null;

const coachColors = {
  "Vlad": "#3b82f6",
  "Ana": "#10b981",
  "Petar Boss": "#f59e0b"
};

document.addEventListener("DOMContentLoaded", async () => {

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    selectable: true,
    nowIndicator: true,
    slotDuration: "00:15:00",
    slotLabelInterval: "01:00",
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",
    height: "auto",

    select: info => {
      openModal(null, info.start);
      calendar.unselect();
    },

    eventClick: info => {
      openModal(info.event);
    },

    eventDidMount: info => {
      const coaches = info.event.extendedProps.coaches;
      if (Array.isArray(coaches) && coaches.length > 1) {
        const colors = coaches.map(c => coachColors[c] || "#999");
        info.el.style.background =
          `linear-gradient(45deg, ${colors.join(",")})`;
        info.el.style.border = "none";
      }
    }
  });

  calendar.render();
  addHallAvailability();
  await loadLessons();
});

/* ---------- MODAL ---------- */

function openModal(event = null, start = null) {
  modal.classList.remove("hidden");
  deleteBtn.classList.toggle("hidden", !event);

  selectedEvent = event;
  selectedStart = start;

  if (event) {
    titleInput.value = event.title;
    const startDate = event.start;
    dateInput.valueAsDate = startDate;
    timeInput.value = startDate.toTimeString().slice(0,5);

    Array.from(coachSelect.options).forEach(o =>
      o.selected = event.extendedProps.coaches.includes(o.value)
    );
  } else {
    titleInput.value = "";
    dateInput.valueAsDate = start || new Date();
    timeInput.value = "09:00";
    Array.from(coachSelect.options).forEach(o => o.selected = false);
  }
}

cancelBtn.onclick = () => modal.classList.add("hidden");

/* ---------- SAVE ---------- */

saveBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const coaches = Array.from(coachSelect.selectedOptions).map(o => o.value);
  if (!title || coaches.length === 0) return alert("Fill all fields");

  const [h,m] = timeInput.value.split(":");
  const start = new Date(dateInput.value);
  start.setHours(h,m,0,0);
  const end = new Date(start.getTime() + 45*60000);

  if (selectedEvent) {
    await updateDoc(doc(db,"lessons",selectedEvent.extendedProps.docId), {
      title, coaches, start:start.toISOString(), end:end.toISOString()
    });

    selectedEvent.setProp("title", title);
    selectedEvent.setExtendedProp("coaches", coaches);
    selectedEvent.setStart(start);
    selectedEvent.setEnd(end);
  } else {
    const ref = await addDoc(collection(db,"lessons"), {
      title, coaches,
      start:start.toISOString(), end:end.toISOString()
    });

    calendar.addEvent({
      title,
      start,
      end,
      backgroundColor: coachColors[coaches[0]],
      extendedProps: { coaches, docId: ref.id }
    });
  }

  modal.classList.add("hidden");
};

/* ---------- DELETE ---------- */

deleteBtn.onclick = async () => {
  if (!selectedEvent) return;
  await deleteDoc(doc(db,"lessons",selectedEvent.extendedProps.docId));
  selectedEvent.remove();
  modal.classList.add("hidden");
};

/* ---------- LOAD ---------- */

async function loadLessons() {
  const snap = await getDocs(collection(db,"lessons"));
  snap.forEach(d => {
    const data = d.data();
    calendar.addEvent({
      title: data.title,
      start: data.start,
      end: data.end,
      backgroundColor: coachColors[data.coaches[0]],
      extendedProps: { coaches: data.coaches, docId: d.id }
    });
  });
}

/* ---------- HALL AVAILABILITY ---------- */

function addHallAvailability() {
  const colors = {
    both: "rgba(168,230,207,0.35)",
    small: "rgba(255,249,168,0.35)",
    taken: "rgba(200,200,200,0.35)"
  };

  const base = calendar.getDate();
  base.setDate(base.getDate() - base.getDay() + 1);

  const add = (d,s,e,c)=>{
    const start = new Date(base); start.setDate(start.getDate()+d); start.setHours(s,0,0,0);
    const end = new Date(base); end.setDate(end.getDate()+d); end.setHours(e,0,0,0);
    calendar.addEvent({ start,end,display:"background",backgroundColor:c });
  };

  // Mon
  add(0,9,18,colors.both); add(0,18,22,colors.taken);
  // Tue
  add(1,9,18,colors.both); add(1,18,22,colors.small);
  // Wed
  add(2,9,18,colors.both); add(2,18,22,colors.taken);
  // Thu
  add(3,9,18,colors.both); add(3,18,22,colors.small);
  // Fri
  add(4,9,18,colors.both); add(4,18,22,colors.small);
}
