import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const coachSelect = document.getElementById("lessonCoach");
const saveBtn = document.getElementById("saveLesson");
const cancelBtn = document.getElementById("cancelLesson");

let selectedStart = null;

document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    selectable: true,

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridDay,timeGridWeek"
    },

    slotMinTime: "08:00:00",
    slotMaxTime: "23:00:00",

    select(info) {
      selectedStart = info.start;
      titleInput.value = "";
      modal.classList.remove("hidden");
    }
  });

  calendar.render();

  // Load existing lessons
  const snapshot = await getDocs(collection(db, "lessons"));
  snapshot.forEach(doc => {
    const d = doc.data();
    calendar.addEvent({
      title: `${d.title} (${d.coach})`,
      start: d.start,
      end: d.end
    });
  });

  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coach = coachSelect.value;

    if (!title) {
      alert("Please enter lesson name");
      return;
    }

    const start = selectedStart;
    const end = new Date(start.getTime() + 45 * 60000); // ⏱ 45 minutes

    try {
      await addDoc(collection(db, "lessons"), {
        title,
        coach,
        start: start.toISOString(),
        end: end.toISOString()
      });

      calendar.addEvent({
        title: `${title} (${coach})`,
        start,
        end
      });

      alert("✅ Lesson added");
      modal.classList.add("hidden");
    } catch (e) {
      console.error(e);
      alert("❌ Error adding lesson");
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
  };
});
