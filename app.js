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
let selectedStart = null;
let selectedEvent = null; // for editing
let longPressTimeout = null;

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };

function formatOrdinal(n){
  if(n>3 && n<21) return n+"th";
  switch(n%10){case 1: return n+"st"; case 2: return n+"nd"; case 3: return n+"rd"; default: return n+"th";}
}

// Get color for multiple coaches
function getEventColor(coaches){
  if(Array.isArray(coaches)){
    if(coaches.length===1) return coachColors[coaches[0]] || "#999";
    // gradient for multiple coaches
    return `linear-gradient(45deg, ${coaches.map(c=>coachColors[c]||"#999").join(", ")})`;
  }else{
    return coachColors[coaches] || "#999";
  }
}

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
      if(window.innerWidth > 500){ // PC select
        selectedStart = info.start;
        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0,5);
        selectedEvent = null;
        modal.classList.remove("hidden");
      }
      calendar.unselect();
    },

    eventClick: info => {
      selectedEvent = info.event;
      
      // Parse title and coach(es)
      const titleParts = selectedEvent.title.match(/^(.*) \((.*)\)$/);
      titleInput.value = titleParts ? titleParts[1] : selectedEvent.title;
      lessonDateInput.valueAsDate = new Date(selectedEvent.start);
      lessonTimeInput.value = selectedEvent.start.toTimeString().slice(0,5);

      const coachVal = titleParts ? titleParts[2].split(", ") : ["Vlad"];
      Array.from(coachSelect.options).forEach(opt => opt.selected = coachVal.includes(opt.value));

      // Add temporary delete button if not exists
      if(!document.getElementById("deleteLesson")){
        const delBtn = document.createElement("button");
        delBtn.id = "deleteLesson";
        delBtn.textContent = "Delete";
        delBtn.classList.add("secondary");
        delBtn.onclick = async () => {
          if(confirm(`Delete lesson "${selectedEvent.title}"?`)){
            try{
              const lessonId = selectedEvent.extendedProps.docId;
              if(lessonId) await deleteDoc(doc(db,"lessons",lessonId));
              selectedEvent.remove();
              alert("🗑 Lesson deleted");
              modal.classList.add("hidden");
              selectedEvent = null;
            }catch(e){ console.error(e); alert("❌ Failed to delete"); }
          }
        };
        document.querySelector(".modal-buttons").appendChild(delBtn);
      }

      modal.classList.remove("hidden");
    },

    eventTouchStart: info => {
      // mobile long press for delete
      longPressTimeout = setTimeout(async () => {
        const ok = confirm(`Delete lesson "${info.event.title}"?`);
        if(!ok) return;
        try{
          const lessonId = info.event.extendedProps.docId;
          if(lessonId) await deleteDoc(doc(db,"lessons",lessonId));
          info.event.remove();
          alert("🗑 Lesson deleted");
        }catch(e){ console.error(e); alert("❌ Failed to delete"); }
      }, 700);
    },

    eventTouchEnd: () => { clearTimeout(longPressTimeout); }
  });

  calendar.render();

  // LOAD LESSONS FROM FIRESTORE
  const snapshot = await getDocs(collection(db,"lessons"));
  snapshot.forEach(docSnap=>{
    const d = docSnap.data();
    const coaches = Array.isArray(d.coach) ? d.coach : [d.coach];
    calendar.addEvent({
      title:`${d.title} (${coaches.join(", ")})`,
      start:d.start,
      end:d.end,
      backgroundColor:getEventColor(coaches),
      borderColor:getEventColor(coaches),
      extendedProps:{docId:docSnap.id}
    });
  });

  // Floating button for mobile
  addLessonBtn.onclick = () => {
    const now = new Date();
    lessonDateInput.valueAsDate = now;
    lessonTimeInput.value = "09:00";
    titleInput.value = "";
    selectedStart = null; // mobile manual
    selectedEvent = null;
    modal.classList.remove("hidden");
  };

  // SAVE LESSON (add or edit)
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const selectedCoaches = Array.from(coachSelect.selectedOptions).map(o=>o.value);
    if(!title){ alert("Enter lesson name"); return; }
    if(selectedCoaches.length===0){ alert("Select at least one coach"); return; }

    let start;
    if(selectedStart){ start = selectedStart; }
    else {
      const dateParts = lessonDateInput.value.split("-");
      const [year, month, day] = dateParts.map(Number);
      const [hour, minute] = lessonTimeInput.value.split(":").map(Number);
      start = new Date(year, month-1, day, hour, minute);
    }
    const end = new Date(start.getTime() + 45*60000);

    try{
      if(selectedEvent){ // EDIT
        const lessonId = selectedEvent.extendedProps.docId;
        if(lessonId) await updateDoc(doc(db,"lessons",lessonId), {
          title, coach:selectedCoaches, start:start.toISOString(), end:end.toISOString()
        });
        selectedEvent.setProp("title", `${title} (${selectedCoaches.join(", ")})`);
        selectedEvent.setStart(start);
        selectedEvent.setEnd(end);
        selectedEvent.setProp("backgroundColor", getEventColor(selectedCoaches));
        selectedEvent.setProp("borderColor", getEventColor(selectedCoaches));
        alert("✅ Lesson updated");
      } else { // ADD
        const docRef = await addDoc(collection(db,"lessons"), {
          title, coach:selectedCoaches, start:start.toISOString(), end:end.toISOString()
        });
        calendar.addEvent({
          title:`${title} (${selectedCoaches.join(", ")})`,
          start, end,
          backgroundColor:getEventColor(selectedCoaches),
          borderColor:getEventColor(selectedCoaches),
          extendedProps:{docId:docRef.id}
        });
        alert("✅ Lesson added");
      }
      modal.classList.add("hidden");
      selectedStart = null;
      selectedEvent = null;
    }catch(e){ console.error(e); alert("❌ Failed to save lesson"); }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    selectedEvent = null;
  };

});
