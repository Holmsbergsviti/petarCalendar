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
const calendarEl = document.getElementById("calendar");

let calendar;
let selectedStart = null;
let editingEvent = null;
let longPressTimer = null;
let longPressTriggered = false;

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

function getSelectedCoaches() {
  return [...document.querySelectorAll("#lessonCoaches input")]
    .filter(c => c.checked)
    .map(c => c.value);
}

function setSelectedCoaches(coaches) {
  document.querySelectorAll("#lessonCoaches input").forEach(c => {
    c.checked = coaches.includes(c.value);
  });
}

function getEventColor(coaches) {
  return coaches.length === 1
    ? coachColors[coaches[0]]
    : "#8b5cf6";
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

    // ADD FROM CALENDAR (PC)
    select: info => {
      if (window.innerWidth > 500) {
        selectedStart = info.start;
        editingEvent = null;

        titleInput.value = "";
        lessonDateInput.valueAsDate = info.start;
        lessonTimeInput.value = info.start.toTimeString().slice(0, 5);
        setSelectedCoaches([]);

        modal.classList.remove("hidden");
      }
      calendar.unselect();
    },

    // EVENTS (EDIT / LONG PRESS DELETE)
    eventDidMount: info => {
      const el = info.el;

      // LONG PRESS (MOBILE DELETE)
      el.addEventListener("touchstart", () => {
        longPressTriggered = false;

        longPressTimer = setTimeout(async () => {
          longPressTriggered = true;

          const ok = confirm(`Delete "${info.event.title}"?`);
          if (!ok) return;

          try {
            await deleteDoc(
              doc(db, "lessons", info.event.extendedProps.docId)
            );
            info.event.remove();
            alert("🗑 Lesson deleted");
          } catch (e) {
            console.error(e);
            alert("❌ Failed to delete lesson");
          }
        }, 600);
      });

      el.addEventListener("touchend", () => {
        clearTimeout(longPressTimer);
      });

      // TAP / CLICK = EDIT
      el.addEventListener("click", () => {
        if (longPressTriggered) return;

        editingEvent = info.event;
        selectedStart = null;

        const title = info.event.title.split(" (")[0];
        const coaches = info.event.extendedProps.coaches;

        titleInput.value = title;
        lessonDateInput.valueAsDate = info.event.start;
        lessonTimeInput.value = info.event.start.toTimeString().slice(0, 5);
        setSelectedCoaches(coaches);

        modal.classList.remove("hidden");
      });
    }
  });

  calendar.render();

  // LOAD FROM FIRESTORE
  const snapshot = await getDocs(collection(db, "lessons"));
  snapshot.forEach(docSnap => {
    const d = docSnap.data();
    const coaches = d.coaches || [d.coach];
    const color = getEventColor(coaches);

    calendar.addEvent({
      title: `${d.title} (${coaches.join(", ")})`,
      start: d.start,
      end: d.end,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        docId: docSnap.id,
        coaches
      }
    });
  });

  // MOBILE ADD BUTTON
  addLessonBtn.onclick = () => {
    editingEvent = null;
    selectedStart = null;

    titleInput.value = "";
    lessonDateInput.valueAsDate = new Date();
    lessonTimeInput.value = "09:00";
    setSelectedCoaches([]);

    modal.classList.remove("hidden");
  };

  // SAVE (ADD / EDIT)
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const coaches = getSelectedCoaches();

    if (!title || coaches.length === 0) {
      alert("Enter lesson name and select coach");
      return;
    }

    const [y, m, d] = lessonDateInput.value.split("-").map(Number);
    const [h, min] = lessonTimeInput.value.split(":").map(Number);
    const start = new Date(y, m - 1, d, h, min);
    const end = new Date(start.getTime() + 45 * 60000);

    const color = getEventColor(coaches);

    // EDIT
    if (editingEvent) {
      try {
        await updateDoc(
          doc(db, "lessons", editingEvent.extendedProps.docId),
          {
            title,
            coaches,
            start: start.toISOString(),
            end: end.toISOString()
          }
        );

        editingEvent.setProp("title", `${title} (${coaches.join(", ")})`);
        editingEvent.setDates(start, end);
        editingEvent.setExtendedProp("coaches", coaches);
        editingEvent.setProp("backgroundColor", color);
        editingEvent.setProp("borderColor", color);

        editingEvent = null;
        modal.classList.add("hidden");
        alert("✏️ Lesson updated");
      } catch (e) {
        console.error(e);
        alert("❌ Failed to update lesson");
      }
      return;
    }

    // ADD
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
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          docId: docRef.id,
          coaches
        }
      });

      modal.classList.add("hidden");
      selectedStart = null;
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

  // DELETE (PC)
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
