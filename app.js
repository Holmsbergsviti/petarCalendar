import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const lessonDateInput = document.getElementById("lessonDate");
const lessonTimeInput = document.getElementById("lessonTime");
const saveBtn = document.getElementById("saveLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addLessonBtn = document.getElementById("addLessonBtn");
const coachSelect = document.getElementById("lessonCoach");
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

// Open modal for adding/editing a lesson
function openLessonModal(start) {
  selectedStart = start || null;
  editingEvent = null;

  titleInput.value = "";
  lessonDateInput.valueAsDate = start || new Date();
  lessonTimeInput.value = start ? start.toTimeString().slice(0, 5) : "09:00";
  coachSelect.value = "Vlad";

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

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridDay,timeGridWeek"
    },

    dayHeaderContent: arg => {
      const weekday = arg.date.toLocaleDateString("en-GB", { weekday: "long" });
      const day = formatOrdinal(arg.date.getDate());
      return `${weekday} ${day}`;
    },

    // SELECT / ADD LESSON
    select: info => {
      if (isMobile()) {
        // mobile: open modal when selecting a slot
        selectedStart = info.start;
        openLessonModal(info.start);
        calendar.unselect();
      }
    },

    eventDidMount: info => {
      const el = info.el;

      // --- LONG PRESS DELETE (mobile)
      el.addEventListener("touchstart", () => {
        longPressTriggered = false;
        longPressTimer = setTimeout(async () => {
          longPressTriggered = true;
          const ok = confirm(`Delete lesson "${info.event.title}"?`);
          if (!ok) return;
          try {
            await deleteDoc(doc(db, "lessons", info.event.extendedProps.docId));
            info.event.remove();
            alert("🗑 Lesson deleted");
          } catch (e) {
            console.error(e);
            alert("❌ Failed to delete lesson");
          }
        }, 600);
      });

      el.addEventListener("touchend", () => clearTimeout(longPressTimer));

      // --- TAP / CLICK EDIT
      el.addEventListener("click", () => {
        if (longPressTriggered) return;

        editingEvent = info.event;
        selectedStart = null;

        const title = info.event.title.split(" (")[0];
        titleInput.value = title;
        lessonDateInput.valueAsDate = info.event.start;
        lessonTimeInput.value = info.event.start.toTimeString().slice(0, 5);
        coachSelect.value = info.event.extendedProps.coach;

        modal.classList.remove("hidden");
      });
    }
  });

  calendar.render();

  // --- Load lessons from Firestore
  const snapshot = await getDocs(collection(db, "lessons"));
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const color = coachColors[d.coach] || "#999";

    calendar.addEvent({
      title: `${d.title} (${d.coach})`,
      start: d.start,
      end: d.end,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { docId: docSnap.id, coach: d.coach }
    });
  });

  // --- Floating Add Button (mobile)
  addLessonBtn.onclick = () => openLessonModal(new Date());

  // --- SAVE ADD / EDIT
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coach = coachSelect.value;

    if (!title) { alert("Enter lesson name"); return; }

    const [y, m, d] = lessonDateInput.value.split("-").map(Number);
    const [h, min] = lessonTimeInput.value.split(":").map(Number);
    const start = new Date(y, m - 1, d, h, min);
    const end = new Date(start.getTime() + 45 * 60000); // 45 min lesson
    const color = coachColors[coach];

    // EDIT
    if (editingEvent) {
      try {
        await updateDoc(doc(db, "lessons", editingEvent.extendedProps.docId), {
          title,
          coach,
          start: start.toISOString(),
          end: end.toISOString()
        });
        editingEvent.setProp("title", `${title} (${coach})`);
        editingEvent.setDates(start, end);
        editingEvent.setExtendedProp("coach", coach);
        editingEvent.setProp("backgroundColor", color);
        editingEvent.setProp("borderColor", color);
        modal.classList.add("hidden");
        alert("✏️ Lesson updated");
        editingEvent = null;
        return;
      } catch (e) {
        console.error(e);
        alert("❌ Failed to update lesson");
        return;
      }
    }

    // ADD
    try {
      const docRef = await addDoc(collection(db, "lessons"), {
        title,
        coach,
        start: start.toISOString(),
        end: end.toISOString()
      });
      calendar.addEvent({
        title: `${title} (${coach})`,
        start,
        end,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { docId: docRef.id, coach }
      });
      modal.classList.add("hidden");
      alert("✅ Lesson added");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to add lesson");
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    editingEvent = null;
    selectedStart = null;
  };

  // --- DELETE (PC Delete Key)
  document.addEventListener("keydown", async e => {
    if (e.key === "Delete" && editingEvent) {
      const ok = confirm(`Delete "${editingEvent.title}"?`);
      if (!ok) return;
      try {
        await deleteDoc(doc(db, "lessons", editingEvent.extendedProps.docId));
        editingEvent.remove();
        editingEvent = null;
        modal.classList.add("hidden");
        alert("🗑 Lesson deleted");
      } catch (err) {
        console.error(err);
        alert("❌ Failed to delete lesson");
      }
    }
  });

});
