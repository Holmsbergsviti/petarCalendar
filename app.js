import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const lessonDateInput = document.getElementById("lessonDate");
const lessonTimeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const cancelBtn = document.getElementById("cancelLesson");
const deleteBtn = document.getElementById("deleteLesson");
const addLessonBtn = document.getElementById("addLessonBtn");
const coachContainer = document.getElementById("lessonCoach");
const calendarEl = document.getElementById("calendar");

let calendar;
let selectedStart = null;
let editingEvent = null;
let longPressTimer = null;
let longPressTriggered = false;

const coachColors = { "Vlad": "#3b82f6", "Ana": "#10b981", "Petar Boss": "#f59e0b" };

function formatOrdinal(n) {
  if (n > 3 && n < 21) return n + "th";
  switch (n % 10) { case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd"; default: return n + "th"; }
}

function isMobile() {
  return window.matchMedia("(pointer: coarse)").matches;
}

// Get selected coaches from checkboxes
function getSelectedCoaches() {
  return Array.from(coachContainer.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
}

// Open modal for adding/editing
function openLessonModal(start, event=null) {
  selectedStart = start || null;
  editingEvent = event;

  titleInput.value = event ? event.title.split(" (")[0] : "";
  lessonDateInput.valueAsDate = event ? event.start : (start || new Date());
  lessonTimeInput.value = event ? event.start.toTimeString().slice(0,5) : "09:00";

  // Populate checkboxes for group lessons
  const checkboxes = coachContainer.querySelectorAll("input[type=checkbox]");
  if(event){
    const coaches = Array.isArray(event.extendedProps.coach) ? event.extendedProps.coach : [event.extendedProps.coach];
    checkboxes.forEach(cb => cb.checked = coaches.includes(cb.value));
  } else {
    checkboxes.forEach(cb => cb.checked = false);
    coachContainer.querySelector("input[value='Vlad']").checked = true;
  }

  modal.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    selectable: true,
    nowIndicator: true,
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",
    slotDuration: "00:15:00",
    slotLabelInterval: "01:00",
    height: "auto",
    headerToolbar: { left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" },

    dayHeaderContent: arg => {
      const weekday = arg.date.toLocaleDateString("en-GB",{ weekday: "long" });
      const day = formatOrdinal(arg.date.getDate());
      return `${weekday} ${day}`;
    },

    dateClick: info => {
      if(!isMobile()) openLessonModal(info.date);
    },

    select: info => {
      if(isMobile()) openLessonModal(info.start);
      calendar.unselect();
    },

    eventClick: info => openLessonModal(null, info.event),

    eventDidMount: info => {
      const el = info.el;

      // Long press delete for mobile
      el.addEventListener("touchstart", () => {
        longPressTriggered = false;
        longPressTimer = setTimeout(async () => {
          longPressTriggered = true;
          const ok = confirm(`Delete lesson "${info.event.title}"?`);
          if (!ok) return;
          try {
            await deleteDoc(doc(db,"lessons",info.event.extendedProps.docId));
            info.event.remove();
            alert("🗑 Lesson deleted");
          } catch(e){ console.error(e); alert("❌ Failed to delete lesson"); }
        }, 600);
      });
      el.addEventListener("touchend", ()=> clearTimeout(longPressTimer));
    }

  });

  calendar.render();

  // Load lessons
  const snapshot = await getDocs(collection(db,"lessons"));
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const coaches = Array.isArray(d.coach) ? d.coach : [d.coach];
    const color = coaches.length === 1 ? coachColors[coaches[0]] : `linear-gradient(to right, ${coaches.map(c=>coachColors[c]||"#999").join(",")})`;
    calendar.addEvent({
      title: `${d.title} (${coaches.join(", ")})`,
      start: d.start,
      end: d.end,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { docId: docSnap.id, coach: coaches }
    });
  });

  // Floating add button
  addLessonBtn.onclick = () => openLessonModal(new Date());

  // Save add/edit
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coaches = getSelectedCoaches();
    if(!title){ alert("Enter lesson name"); return; }
    if(coaches.length === 0){ alert("Select at least one coach"); return; }

    const [y,m,d] = lessonDateInput.value.split("-").map(Number);
    const [h,min] = lessonTimeInput.value.split(":").map(Number);
    const start = new Date(y,m-1,d,h,min);
    const end = new Date(start.getTime() + 45*60000);

    const color = coaches.length === 1 ? coachColors[coaches[0]] : `linear-gradient(to right, ${coaches.map(c=>coachColors[c]||"#999").join(",")})`;

    if(editingEvent){
      try{
        await updateDoc(doc(db,"lessons",editingEvent.extendedProps.docId),{
          title,
          coach: coaches,
          start:start.toISOString(),
          end:end.toISOString()
        });
        editingEvent.setProp("title",`${title} (${coaches.join(", ")})`);
        editingEvent.setDates(start,end);
        editingEvent.setExtendedProp("coach",coaches);
        editingEvent.setProp("backgroundColor",color);
        editingEvent.setProp("borderColor",color);
        modal.classList.add("hidden");
        alert("✏️ Lesson updated");
        editingEvent = null;
        return;
      } catch(e){ console.error(e); alert("❌ Failed to update lesson"); return; }
    }

    // Add new lesson
    try{
      const docRef = await addDoc(collection(db,"lessons"),{
        title,
        coach: coaches,
        start:start.toISOString(),
        end:end.toISOString()
      });
      calendar.addEvent({
        title:`${title} (${coaches.join(", ")})`,
        start,
        end,
        backgroundColor: color,
        borderColor: color,
        extendedProps:{docId:docRef.id, coach:coaches}
      });
      modal.classList.add("hidden");
      alert("✅ Lesson added");
    } catch(e){ console.error(e); alert("❌ Failed to add lesson"); }
  };

  // Delete button inside modal
  deleteBtn.onclick = async () => {
    if(!editingEvent) return;
    const ok = confirm(`Delete lesson "${editingEvent.title}"?`);
    if(!ok) return;
    try{
      await deleteDoc(doc(db,"lessons",editingEvent.extendedProps.docId));
      editingEvent.remove();
      modal.classList.add("hidden");
      alert("🗑 Lesson deleted");
      editingEvent = null;
    } catch(e){ console.error(e); alert("❌ Failed to delete lesson"); }
  };

  cancelBtn.onclick = ()=> {
    modal.classList.add("hidden");
    editingEvent = null;
    selectedStart = null;
  };
});
