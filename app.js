import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const modalTitle = document.getElementById("modalTitle");
const titleInput = document.getElementById("lessonTitle");
const lessonDateInput = document.getElementById("lessonDate");
const lessonTimeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const deleteBtn = document.getElementById("deleteLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addLessonBtn = document.getElementById("addLessonBtn");
const calendarEl = document.getElementById("calendar");

const coachCheckboxes = [...document.querySelectorAll(".checkboxes input")];

const coachColors = {
  "Vlad": "#3b82f6",
  "Ana": "#10b981",
  "Petar Boss": "#f59e0b"
};

let calendar;
let selectedStart = null;
let editingEvent = null;

document.addEventListener("DOMContentLoaded", async () => {

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    selectable: true,
    nowIndicator: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridDay,timeGridWeek"
    },
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",
    slotDuration: "00:15:00",
    height: "auto",

    select: info => {
      if (window.innerWidth > 500) {
        openAddModal(info.start);
      }
      calendar.unselect();
    },

    eventClick: info => openEditModal(info.event)
  });

  calendar.render();

  // Load lessons
  const snapshot = await getDocs(collection(db, "lessons"));
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    calendar.addEvent({
      title: `${d.title} (${d.coaches.join(", ")})`,
      start: d.start,
      end: d.end,
      backgroundColor: d.coaches.length === 1 ? coachColors[d.coaches[0]] : "#8b5cf6",
      extendedProps: { docId: docSnap.id, coaches: d.coaches }
    });
  });

  addLessonBtn.onclick = () => openAddModal();

  saveBtn.onclick = saveLesson;
  deleteBtn.onclick = deleteLesson;
  cancelBtn.onclick = closeModal;
});

function openAddModal(start = null) {
  modalTitle.textContent = "Add lesson";
  deleteBtn.classList.add("hidden");
  editingEvent = null;
  selectedStart = start;
  titleInput.value = "";
  coachCheckboxes.forEach(c => c.checked = false);
  modal.classList.remove("hidden");
}

function openEditModal(event) {
  modalTitle.textContent = "Edit lesson";
  deleteBtn.classList.remove("hidden");
  editingEvent = event;

  titleInput.value = event.title.split(" (")[0];
  lessonDateInput.valueAsDate = event.start;
  lessonTimeInput.value = event.start.toTimeString().slice(0, 5);

  coachCheckboxes.forEach(c =>
    c.checked = event.extendedProps.coaches.includes(c.value)
  );

  modal.classList.remove("hidden");
}

async function saveLesson() {
  const title = titleInput.value.trim();
  const coaches = coachCheckboxes.filter(c => c.checked).map(c => c.value);

  if (!title || coaches.length === 0) {
    alert("Fill title and select coaches");
    return;
  }

  const date = lessonDateInput.valueAsDate || new Date();
  const [h, m] = lessonTimeInput.value.split(":").map(Number);
  date.setHours(h, m);

  const end = new Date(date.getTime() + 45 * 60000);
  const color = coaches.length === 1 ? coachColors[coaches[0]] : "#8b5cf6";

  if (editingEvent) {
    await updateDoc(doc(db, "lessons", editingEvent.extendedProps.docId), {
      title, coaches, start: date.toISOString(), end: end.toISOString()
    });

    editingEvent.setProp("title", `${title} (${coaches.join(", ")})`);
    editingEvent.setStart(date);
    editingEvent.setEnd(end);
    editingEvent.setProp("backgroundColor", color);
  } else {
    const docRef = await addDoc(collection(db, "lessons"), {
      title, coaches, start: date.toISOString(), end: end.toISOString()
    });

    calendar.addEvent({
      title: `${title} (${coaches.join(", ")})`,
      start: date,
      end,
      backgroundColor: color,
      extendedProps: { docId: docRef.id, coaches }
    });
  }

  closeModal();
}

async function deleteLesson() {
  if (!editingEvent) return;
  await deleteDoc(doc(db, "lessons", editingEvent.extendedProps.docId));
  editingEvent.remove();
  closeModal();
}

function closeModal() {
  modal.classList.add("hidden");
  editingEvent = null;
}
