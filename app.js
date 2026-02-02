import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const coachSelect = document.getElementById("lessonCoach");
const saveBtn = document.getElementById("saveLesson");
const cancelBtn = document.getElementById("cancelLesson");
const calendarEl = document.getElementById("calendar");

let selectedStart = null;
let calendar;

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
    height: 'auto',
    contentHeight: 'auto',

    // make mobile taps work reliably
    selectLongPressDelay: 200,
    selectMinDistance: 0,

    dayHeaderContent: arg => {
      const weekday = arg.date.toLocaleDateString("en-GB",{ weekday: "long" });
      const day = formatOrdinal(arg.date.getDate());
      return `${weekday} ${day}`;
    },

    select: info => {
      calendar.unselect();
      selectedStart = info.start;
      titleInput.value = "";
      modal.classList.remove("hidden");
    },

    eventClick: info => handleDelete(info.event),
    eventTouchStart: info => handleDelete(info.event)
  });

  calendar.render();

  // LOAD LESSONS
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

  // SAVE LESSON
  saveBtn.onclick = async ()=>{
    const title = titleInput.value.trim();
    const coach = coachSelect.value;
    if(!title){alert("Please enter lesson name"); return;}
    const start = selectedStart;
    const end = new Date(start.getTime()+45*60000);

    try{
      const docRef = await addDoc(collection(db,"lessons"),{title,coach,start:start.toISOString(),end:end.toISOString()});
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
    }catch(e){console.error(e); alert("❌ Failed to add lesson");}
  };

  cancelBtn.onclick = ()=>{
    modal.classList.add("hidden");
  };

  async function handleDelete(event){
    const ok = confirm(`Delete lesson "${event.title}"?`);
    if(!ok) return;
    try{
      const lessonId = event.extendedProps.docId;
      await deleteDoc(doc(db,"lessons",lessonId));
      event.remove();
      alert("🗑 Lesson deleted");
    }catch(e){console.error(e); alert("❌ Failed to delete lesson");}
  }
});
