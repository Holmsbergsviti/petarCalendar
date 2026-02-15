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
const deleteBtn = document.getElementById("deleteLesson");
const lessonTypeSelect = document.getElementById("lessonType");


let calendar;
let selectedEvent = null;
let selectedStart = null;

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };
const groupColor = "#8b5cf6";

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

// -------- Helpers --------
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
        modal.classList.remove("hidden");
        deleteBtn.classList.add("hidden");
      }
      calendar.unselect();
    },

    eventDidMount: info => {
      applyEventColors(info);
    },

    slotLaneClassNames: function(arg) {

      const date = arg.date;
      const day = date.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
      const hour = date.getHours();

      // MONDAY (1) & WEDNESDAY (3)
      if (day === 1 || day === 3) {
        if (hour < 18) return ["hall-both"];
        return ["hall-none"];
      }

      // TUESDAY (2), THURSDAY (4), FRIDAY (5)
      if (day === 2 || day === 4 || day === 5) {
        if (hour < 18) return ["hall-both"];
        return ["hall-small-only"];
      }

      return [];
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
      backgroundColor: getEventColor(d.coach, d.lessonType),
      borderColor: getEventColor(d.coach, d.lessonType),
      extendedProps:{
        docId:docSnap.id,
        coach:d.coach,
        lessonType:d.lessonType || "class"
      }
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
    let coach = getSelectedCoaches();
    const lessonType = lessonTypeSelect.value;
    if (!title) { alert("Enter lesson name"); return; }

    // For editing
    if(selectedEvent){
      const start = new Date(lessonDateInput.value);
      const [h,m] = lessonTimeInput.value.split(":").map(Number);
      start.setHours(h,m);
      const duration = lessonType === "group" ? 60 : 45;
      const end = new Date(start.getTime() + duration * 60000);


      try {
        const lessonId = selectedEvent.extendedProps.docId;
        if(lessonId) {
          await updateDoc(doc(db,"lessons",lessonId), {
            title,
            coach,
            lessonType,
            start:start.toISOString(),
            end:end.toISOString()
          });
        }
        selectedEvent.setProp("title", Array.isArray(coach) ? `${title} (${coach.join(", ")})` : `${title} (${coach})`);
        selectedEvent.setStart(start);
        selectedEvent.setEnd(end);
        selectedEvent.setProp("backgroundColor", getEventColor(coach, lessonType));
        selectedEvent.setProp("borderColor", getEventColor(coach, lessonType));
        selectedEvent.setExtendedProp("coach", coach);
        selectedEvent.setExtendedProp("lessonType", lessonType);
        selectedEvent.remove();
        calendar.addEvent({
          title: selectedEvent.title,
          start,
          end,
          backgroundColor: getEventColor(coach, lessonType),
          borderColor: getEventColor(coach, lessonType),
          extendedProps:{
            docId: lessonId,
            coach,
            lessonType
          }
        });

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
    const duration = lessonType === "group" ? 60 : 45;
    const end = new Date(start.getTime() + duration*60000);


    try {
      const docRef = await addDoc(collection(db,"lessons"), {
        title,
        coach,
        lessonType,
        start:start.toISOString(),
        end:end.toISOString()
      });

      calendar.addEvent({
        title: Array.isArray(coach)
          ? `${title} (${coach.join(", ")})`
          : `${title} (${coach})`,
        start,
        end,
        backgroundColor: getEventColor(coach, lessonType),
        borderColor: getEventColor(coach, lessonType),
        extendedProps:{
          docId: docRef.id,
          coach,
          lessonType
        }
      });

      alert("✅ Lesson added");
      modal.classList.add("hidden");
      selectedStart = null;

    } catch(e){
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