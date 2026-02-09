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
let selectedEvent = null; // for editing
let selectedStart = null;

const coachColors = {
  "Vlad": "#3b82f6",
  "Ana": "#10b981",
  "Petar Boss": "#f59e0b"
};

document.addEventListener("DOMContentLoaded", async () => {

<<<<<<< HEAD
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
=======
  for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
    const d = new Date(ts);
    const day = d.getDay(); // 0=Sun, 1=Mon ... 5=Fri

    if (day === 0 || day === 6) continue; // skip weekends

    const year = d.getFullYear();
    const month = d.getMonth();
    const date = d.getDate();

    const after6Start = new Date(year, month, date, 18, 0);
    const after6End = new Date(year, month, date, 22, 0);

    if ([1, 3].includes(day)) {
      events.push({
        start: after6Start,
        end: after6End,
        display: "background",
        allDay: false,
        color: "rgba(220,38,38,0.2)",
        extendedProps: { isHall: true }
      });
    }

    if ([2, 4, 5].includes(day)) {
      events.push({
        start: after6Start,
        end: after6End,
        display: "background",
        allDay: false,
        color: "rgba(245,158,11,0.2)",
        extendedProps: { isHall: true }
      });
    }
  }

  return events;
}

function renderHallAvailability() {
  // Remove old hall events
  calendar.getEvents().forEach(ev => {
    if (ev.extendedProps && ev.extendedProps.isHall) ev.remove();
  });
  // Add new hall events
  const hallEvents = getHallBackgroundEvents(calendar.view.activeStart, calendar.view.activeEnd);
  hallEvents.forEach(ev => {
    calendar.addEvent(ev);
  });
}

// -------- Format Ordinals --------
function formatOrdinal(n){
  if(n>3 && n<21) return n+"th";
  switch(n%10){case 1: return n+"st"; case 2: return n+"nd"; case 3: return n+"rd"; default: return n+"th";}
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
      if(window.innerWidth > 500){ // desktop
        selectedStart = info.start;
        selectedEvent = null;
        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0,5);
        modal.classList.remove("hidden");
      }
>>>>>>> parent of e799190 (Coloring the availiable halls)
      calendar.unselect();
    },

    eventClick: info => {
<<<<<<< HEAD
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
=======
      selectedEvent = info.event;
      titleInput.value = selectedEvent.title.split(" (")[0];
      lessonDateInput.valueAsDate = new Date(selectedEvent.start);
      lessonTimeInput.value = selectedEvent.start.toTimeString().slice(0,5);
      coachSelect.value = selectedEvent.extendedProps.coach || "Vlad";
      modal.classList.remove("hidden");
    },

    eventTouchStart: info => {
      let timer = setTimeout(async ()=>{
        if(confirm(`Delete lesson "${info.event.title}"?`)){
          const lessonId = info.event.extendedProps.docId;
          if(lessonId) await deleteDoc(doc(db,"lessons",lessonId));
          info.event.remove();
          alert("🗑 Lesson deleted");
        }
      }, 800); // long press
      info.jsEvent.addEventListener("touchend", ()=>clearTimeout(timer));
>>>>>>> parent of e799190 (Coloring the availiable halls)
    }
  });

  calendar.render();
<<<<<<< HEAD
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
=======

  // Render hall backgrounds
  renderHallAvailability();

  // Update hall events when week changes
  calendar.on('datesSet', () => renderHallAvailability());
>>>>>>> parent of e799190 (Coloring the availiable halls)

    calendar.addEvent({
<<<<<<< HEAD
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
=======
      title:`${d.title} (${d.coach})`,
      start:d.start,
      end:d.end,
      backgroundColor:coachColors[d.coach]||"#999",
      borderColor:coachColors[d.coach]||"#999",
      extendedProps:{docId:docSnap.id, coach:d.coach}
>>>>>>> parent of e799190 (Coloring the availiable halls)
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

<<<<<<< HEAD
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
=======
  // Save lesson
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coach = coachSelect.value;
    if (!title) { alert("Enter lesson name"); return; }

    let start;
    if(selectedEvent){
      // Editing
      start = new Date(lessonDateInput.value);
      const [h,m] = lessonTimeInput.value.split(":").map(Number);
      start.setHours(h,m);
      const end = new Date(start.getTime() + 45*60000);

      try {
        const lessonId = selectedEvent.extendedProps.docId;
        if(lessonId) await updateDoc(doc(db,"lessons",lessonId), {title, coach, start:start.toISOString(), end:end.toISOString()});
        selectedEvent.setProp("title", `${title} (${coach})`);
        selectedEvent.setStart(start);
        selectedEvent.setEnd(end);
        selectedEvent.setProp("backgroundColor", coachColors[coach]);
        selectedEvent.setProp("borderColor", coachColors[coach]);
        selectedEvent.setExtendedProp("coach", coach);
        alert("✅ Lesson updated");
      } catch(e){ console.error(e); alert("❌ Failed to update"); }
      modal.classList.add("hidden");
      selectedEvent = null;
      return;
    }

    // Adding new lesson
    if(selectedStart){
      start = selectedStart;
    } else {
      const dateParts = lessonDateInput.value.split("-");
      const [year, month, day] = dateParts.map(Number);
      const [hour, minute] = lessonTimeInput.value.split(":").map(Number);
      start = new Date(year, month-1, day, hour, minute);
    }
    const end = new Date(start.getTime() + 45*60000);

    try {
      const docRef = await addDoc(collection(db,"lessons"), {title, coach, start:start.toISOString(), end:end.toISOString()});
      calendar.addEvent({
        title:`${title} (${coach})`,
        start,
        end,
        backgroundColor:coachColors[coach],
        borderColor:coachColors[coach],
        extendedProps:{docId:docRef.id, coach}
      });
      alert("✅ Lesson added");
      modal.classList.add("hidden");
      selectedStart = null;
    } catch(e){ console.error(e); alert("❌ Failed to add lesson"); }
  };

  // Cancel modal
  cancelBtn.onclick = ()=> {
    modal.classList.add("hidden");
    selectedEvent = null;
    selectedStart = null;
  };

});
>>>>>>> parent of e799190 (Coloring the availiable halls)
