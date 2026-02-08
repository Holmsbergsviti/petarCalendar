import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
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
const calendarEl = document.getElementById("calendar");

let calendar;
let selectedStart = null;
let editingEvent = null;

const coachColors = {
  "Vlad": "#3b82f6",
  "Ana": "#10b981",
  "Petar Boss": "#f59e0b"
};

function formatOrdinal(n) {
  if (n > 3 && n < 21) return n + "th";
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

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
    slotLabelInterval: "01:00",
    height: "auto",

    dayHeaderContent: arg => {
      const weekday = arg.date.toLocaleDateString("en-GB", { weekday: "long" });
      const day = formatOrdinal(arg.date.getDate());
      return `${weekday} ${day}`;
    },

    select: info => {
      if (window.innerWidth > 500) {
        selectedStart = info.start;
        editingEvent = null;
        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0, 5);
        modal.classList.remove("hidden");
      }
      calendar.unselect();
    },

    eventClick: info => {
      editingEvent = info.event;
      selectedStart = null;
      titleInput.value = info.event.title.split(" (")[0];
      modal.classList.remove("hidden");
    }
  });

  calendar.render();

  // Load lessons from Firestore
  const snapshot = await getDocs(collection(db, "lessons"));
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const coaches = d.coaches || [d.coach];

    calendar.addEvent({
      title: `${d.title} (${coaches.join(", ")})`,
      start: d.start,
      end: d.end,
      backgroundColor:
        coaches.length === 1 ? coachColors[coaches[0]] : "#8b5cf6",
      borderColor:
        coaches.length === 1 ? coachColors[coaches[0]] : "#8b5cf6",
      extendedProps: { docId: docSnap.id }
    });
  });

  // Floating button (mobile add)
  addLessonBtn.onclick = () => {
    editingEvent = null;
    selectedStart = null;
    titleInput.value = "";
    lessonDateInput.valueAsDate = new Date();
    lessonTimeInput.value = "09:00";
    modal.classList.remove("hidden");
  };

  // SAVE
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();

    const coaches = [...document.querySelectorAll("#lessonCoaches input")]
      .filter(c => c.checked)
      .map(c => c.value);

    if (!title || coaches.length === 0) {
      alert("Enter lesson name and select coach");
      return;
    }

    let start;

    if (editingEvent) {
      start = new Date(editingEvent.start);
    } else if (selectedStart) {
      start = selectedStart;
    } else {
      const [y, m, d] = lessonDateInput.value.split("-").map(Number);
      const [h, min] = lessonTimeInput.value.split(":").map(Number);
      start = new Date(y, m - 1, d, h, min);
    }

    const end = new Date(start.getTime() + 45 * 60000);

    if (editingEvent) {
      editingEvent.setProp("title", `${title} (${coaches.join(", ")})`);
      editingEvent.setDates(start, end);
      editingEvent = null;
      modal.classList.add("hidden");
      alert("✏️ Lesson updated");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "lessons"), {
        title,
        coaches,
        start: start.toISOString(),
        end: end.toISOString()
      });

      calendar.addEvent({
        title: `${title} (${coaches.join(", ")})`,
        start,
        end,
        backgroundColor:
          coaches.length === 1 ? coachColors[coaches[0]] : "#8b5cf6",
        borderColor:
          coaches.length === 1 ? coachColors[coaches[0]] : "#8b5cf6",
        extendedProps: { docId: docRef.id }
      });

      modal.classList.add("hidden");
      selectedStart = null;
      alert("✅ Lesson added");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to save lesson");
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    editingEvent = null;
    selectedStart = null;
  };

  // DELETE
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
        alert("❌ Failed to delete");
      }
    }
  });

});
