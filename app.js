import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
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

let calendar;
let selectedEvent = null;
let selectedStart = null;

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };

// -------- Hall Availability --------
function getHallBackgroundEvents(start, end) {
  const events = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
    const d = new Date(ts);
    const day = d.getDay();

    if (day === 0 || day === 6) continue;

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
  calendar.getEvents().forEach(ev => {
    if (ev.extendedProps && ev.extendedProps.isHall) ev.remove();
  });
  const hallEvents = getHallBackgroundEvents(calendar.view.activeStart, calendar.view.activeEnd);
  hallEvents.forEach(ev => calendar.addEvent(ev));
}

// -------- Helpers --------
function formatOrdinal(n){
  if(n>3 && n<21) return n+"th";
  switch(n%10){case 1: return n+"st"; case 2: return n+"nd"; case 3: return n+"rd"; default: return n+"th";}
}

function getEventColor(coachList) {
  if (Array.isArray(coachList)) {
    const colors = coachList.map(c => coachColors[c] || "#999");
    return `linear-gradient(90deg, ${colors.join(", ")})`;
  } else {
    return coachColors[coachList] || "#999";
  }
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
        modal.classList.remove("hidden");
      }
      calendar.unselect();
    },

    eventClick: info => {
      selectedEvent = info.event;
      const titleParts = selectedEvent.title.match(/^(.*) \((.*)\)$/);
      titleInput.value = titleParts ? titleParts[1] : selectedEvent.title;
      lessonDateInput.valueAsDate = new Date(selectedEvent.start);
      lessonTimeInput.value = selectedEvent.start.toTimeString().slice(0,5);
      const coachVal = titleParts ? titleParts[2].split(", ") : ["Vlad"];
      coachSelect.value = coachVal.length === 1 ? coachVal[0] : "Vlad"; // default single selection for now
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
      }, 800);
      info.jsEvent.addEventListener("touchend", ()=>clearTimeout(timer));
    }
  });

  calendar.render();
  renderHallAvailability();
  calendar.on('datesSet', () => renderHallAvailability());

  // Load lessons
  const snapshot = await getDocs(collection(db,"lessons"));
  snapshot.forEach(docSnap=>{
    const d = docSnap.data();
    calendar.addEvent({
      title: Array.isArray(d.coach) ? `${d.title} (${d.coach.join(", ")})` : `${d.title} (${d.coach})`,
      start:d.start,
      end:d.end,
      backgroundColor: getEventColor(d.coach),
      borderColor: getEventColor(d.coach),
      extendedProps:{docId:docSnap.id, coach:d.coach}
    });
  });

  // Mobile floating add button
  addLessonBtn.onclick = () => {
    const now = new Date();
    lessonDateInput.valueAsDate = now;
    lessonTimeInput.value = "09:00";
    titleInput.value = "";
    selectedStart = null;
    selectedEvent = null;
    modal.classList.remove("hidden");
  };

  // Save lesson
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    let coach = coachSelect.value;
    if (!title) { alert("Enter lesson name"); return; }

    // For editing
    if(selectedEvent){
      const start = new Date(lessonDateInput.value);
      const [h,m] = lessonTimeInput.value.split(":").map(Number);
      start.setHours(h,m);
      const end = new Date(start.getTime() + 45*60000);

      try {
        const lessonId = selectedEvent.extendedProps.docId;
        if(lessonId) await updateDoc(doc(db,"lessons",lessonId), {title, coach, start:start.toISOString(), end:end.toISOString()});
        selectedEvent.setProp("title", Array.isArray(coach) ? `${title} (${coach.join(", ")})` : `${title} (${coach})`);
        selectedEvent.setStart(start);
        selectedEvent.setEnd(end);
        selectedEvent.setProp("backgroundColor", getEventColor(coach));
        selectedEvent.setProp("borderColor", getEventColor(coach));
        selectedEvent.setExtendedProp("coach", coach);
        alert("✅ Lesson updated");
      } catch(e){ console.error(e); alert("❌ Failed to update"); }
      modal.classList.add("hidden");
      selectedEvent = null;
      return;
    }

    // Adding new
    let start;
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
        title: Array.isArray(coach) ? `${title} (${coach.join(", ")})` : `${title} (${coach})`,
        start,
        end,
        backgroundColor: getEventColor(coach),
        borderColor: getEventColor(coach),
        extendedProps:{docId:docRef.id, coach}
      });
      alert("✅ Lesson added");
      modal.classList.add("hidden");
      selectedStart = null;
    } catch(e){ console.error(e); alert("❌ Failed to add lesson"); }
  };

  // Cancel modal
  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    selectedEvent = null;
    selectedStart = null;
  };

});