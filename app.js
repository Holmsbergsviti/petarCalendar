import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
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

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };

function formatOrdinal(n){
  if(n>3 && n<21) return n+"th";
  switch(n%10){case 1: return n+"st"; case 2: return n+"nd"; case 3: return n+"rd"; default: return n+"th";}
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

    // PC desktop select
    select: info => {
      if(window.innerWidth > 500){ // desktop
        selectedStart = info.start;
        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0,5);
        modal.classList.remove("hidden");
      }
      calendar.unselect();
    },

    // click event to delete
    eventClick: info => handleDelete(info.event),
    eventTouchStart: info => handleDelete(info.event)
  });

  calendar.render();

  // LOAD LESSONS FROM FIRESTORE
  const snapshot = await getDocs(collection(db,"lessons"));
  snapshot.forEach(docSnap=>{
    const d = docSnap.data();
    calendar.addEvent({
      title:`${d.title} (${d.coach})`,
      start:d.start,
      end:d.end,
      backgroundColor:coachColors[d.coach]||"#999",
      borderColor:coachColors[d.coach]||"#999",
      extendedProps:{docId:docSnap.id}
    });
  });

  // Floating button for mobile
  addLessonBtn.onclick = () => {
    const now = new Date();
    lessonDateInput.valueAsDate = now;
    lessonTimeInput.value = "09:00";
    titleInput.value = "";
    modal.classList.remove("hidden");
    selectedStart = null; // mobile uses manual inputs
  };

  // SAVE LESSON
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coach = coachSelect.value;
    if (!title) { alert("Enter lesson name"); return; }

    let start;
    if(selectedStart){
      start = selectedStart; // desktop: use clicked slot
    } else {
      // mobile: get from inputs
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
        extendedProps:{docId:docRef.id}
      });
      modal.classList.add("hidden");
      alert("✅ Lesson added");
      selectedStart = null; // reset
    } catch(e){ console.error(e); alert("❌ Failed to add lesson"); }
  };

  cancelBtn.onclick = ()=> modal.classList.add("hidden");

  async function handleDelete(event){
    const ok = confirm(`Delete lesson "${event.title}"?`);
    if(!ok) return;
    try{
      const lessonId = event.extendedProps.docId;
      await deleteDoc(doc(db,"lessons",lessonId));
      event.remove();
      alert("🗑 Lesson deleted");
    } catch(e){ console.error(e); alert("❌ Failed to delete lesson"); }
  }

});
