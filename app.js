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

function computeGradient(coaches){
  if (!coaches || coaches.length === 0) return "#999";
  if (coaches.length === 1) return coachColors[coaches[0]] || "#999";
  return `linear-gradient(135deg, ${coaches.map(c => coachColors[c]).join(",")})`;
}

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
    }
  });

  calendar.render();

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

saveBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const coaches = [...coachSelect.selectedOptions].map(o => o.value);
  if(!title || coaches.length === 0) return alert("Fill all fields");

  const start = new Date(`${dateInput.value}T${timeInput.value}`);
  const end = new Date(start.getTime() + 45 * 60000);

  if(editingEvent){
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

deleteBtn.onclick = async () => {
  await deleteDoc(doc(db,"lessons", editingEvent.id));
  editingEvent.remove();
  modal.classList.add("hidden");
  editingEvent = null;
};

cancelBtn.onclick = () => {
  modal.classList.add("hidden");
  editingEvent = null;
};

addBtn.onclick = () => openModal(new Date());
