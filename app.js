import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } 
from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const modalTitle = document.getElementById("modalTitle");
const titleInput = document.getElementById("lessonTitle");
const coachSelect = document.getElementById("lessonCoach");
const dateInput = document.getElementById("lessonDate");
const timeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const deleteBtn = document.getElementById("deleteLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addBtn = document.getElementById("addLessonBtn");

let calendar;
let editingEvent = null;

const colors = {
  Vlad: "#3b82f6",
  Ana: "#10b981",
  "Petar Boss": "#f59e0b",
  GROUP: "#8b5cf6"
};

document.addEventListener("DOMContentLoaded", async () => {
  calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
    initialView: "timeGridWeek",
    firstDay: 1,
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",
    slotDuration: "00:15:00",
    slotLabelInterval: "01:00:00",
    height: "auto",
    selectable: true,

    select: info => {
      if (window.innerWidth > 500) openAdd(info.start);
      calendar.unselect();
    },

    eventClick: info => openEdit(info.event)
  });

  calendar.render();

  const snap = await getDocs(collection(db,"lessons"));
  snap.forEach(d => renderLesson(d.id, d.data()));
});

/* ---------- MODAL ACTIONS ---------- */

addBtn.onclick = () => openAdd(new Date());

cancelBtn.onclick = () => modal.classList.add("hidden");

saveBtn.onclick = async () => {
  const title = titleInput.value.trim();
  const coaches = [...coachSelect.selectedOptions].map(o=>o.value);
  if (!title || coaches.length===0) return alert("Fill all fields");

  const [y,m,d] = dateInput.value.split("-").map(Number);
  const [h,min] = timeInput.value.split(":").map(Number);
  const start = new Date(y,m-1,d,h,min);
  const end = new Date(start.getTime()+45*60000);

  const isGroup = coaches.length>1;
  const color = isGroup ? colors.GROUP : colors[coaches[0]];

  if (editingEvent) {
    await updateDoc(doc(db,"lessons",editingEvent.extendedProps.id), {
      title, coaches, start:start.toISOString(), end:end.toISOString()
    });

    editingEvent.setProp("title",`${title} (${coaches.join(", ")})`);
    editingEvent.setStart(start);
    editingEvent.setEnd(end);
    editingEvent.setProp("backgroundColor",color);
  } else {
    const ref = await addDoc(collection(db,"lessons"), {
      title, coaches, start:start.toISOString(), end:end.toISOString()
    });
    renderLesson(ref.id,{title,coaches,start:start.toISOString(),end:end.toISOString()});
  }

  modal.classList.add("hidden");
};

deleteBtn.onclick = async () => {
  if (!editingEvent) return;
  await deleteDoc(doc(db,"lessons",editingEvent.extendedProps.id));
  editingEvent.remove();
  modal.classList.add("hidden");
};

/* ---------- HELPERS ---------- */

function openAdd(date){
  editingEvent = null;
  modalTitle.textContent = "Add Lesson";
  deleteBtn.classList.add("hidden");
  fillForm("",[],date);
  modal.classList.remove("hidden");
}

function openEdit(event){
  editingEvent = event;
  modalTitle.textContent = "Edit Lesson";
  deleteBtn.classList.remove("hidden");

  const [title,coachStr] = event.title.split(" (");
  const coaches = coachStr.replace(")","").split(", ");
  fillForm(title,coaches,event.start);
  modal.classList.remove("hidden");
}

function fillForm(title,coaches,date){
  titleInput.value = title;
  [...coachSelect.options].forEach(o=>o.selected = coaches.includes(o.value));
  dateInput.valueAsDate = date;
  timeInput.value = date.toTimeString().slice(0,5);
}

function renderLesson(id,d){
  const isGroup = d.coaches.length>1;
  const color = isGroup ? colors.GROUP : colors[d.coaches[0]];
  calendar.addEvent({
    title:`${d.title} (${d.coaches.join(", ")})`,
    start:d.start,
    end:d.end,
    backgroundColor:color,
    borderColor:color,
    extendedProps:{ id }
  });
}
