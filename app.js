import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ---------------- Firebase ---------------- */

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------- DOM ---------------- */

const modal = document.getElementById("lessonModal");
const titleInput = document.getElementById("lessonTitle");
const lessonDateInput = document.getElementById("lessonDate");
const lessonTimeInput = document.getElementById("lessonTime");
const coachSelect = document.getElementById("coachSelect");
const lessonTypeSelect = document.getElementById("lessonType");
const saveBtn = document.getElementById("saveLesson");
const deleteBtn = document.getElementById("deleteLesson");
const cancelBtn = document.getElementById("cancelLesson");
const addLessonBtn = document.getElementById("addLessonBtn");

let selectedEvent = null;

/* ---------------- Colors ---------------- */

const coachColors = {
  Vlad: "#3b82f6",
  Anna: "#ec4899",
  Kate: "#10b981"
};

const groupColor = "#8b5cf6";

function getEventColor(coach, type) {
  if (type === "group") return groupColor;
  if (Array.isArray(coach)) return coachColors[coach[0]] || "#999";
  return coachColors[coach] || "#999";
}

function applyEventColors(info) {
  const coach = info.event.extendedProps.coach;
  const type = info.event.extendedProps.lessonType;

  if (type === "group") {
    info.el.style.backgroundColor = groupColor;
    info.el.style.backgroundImage = "";
    return;
  }

  if (Array.isArray(coach) && coach.length > 1) {
    const colors = coach.map(c => coachColors[c] || "#999");
    info.el.style.backgroundColor = "transparent";
    info.el.style.backgroundImage =
      `linear-gradient(90deg, ${colors.join(", ")})`;
  } else {
    info.el.style.backgroundImage = "";
    info.el.style.backgroundColor = getEventColor(coach, type);
  }
}

/* ---------------- Calendar ---------------- */

const calendar = new FullCalendar.Calendar(
  document.getElementById("calendar"),
  {
    initialView: "timeGridWeek",
    firstDay: 1,
    slotDuration: "00:15:00",
    slotMinTime: "09:00:00",
    slotMaxTime: "22:00:00",
    selectable: true,
    editable: false,

    select: info => {
      selectedEvent = null;
      lessonDateInput.value = info.startStr.slice(0,10);
      lessonTimeInput.value = info.startStr.slice(11,16);
      modal.classList.remove("hidden");
      deleteBtn.classList.add("hidden");
    },

    eventClick: info => {
      selectedEvent = info.event;

      titleInput.value = selectedEvent.title;
      lessonDateInput.valueAsDate = new Date(selectedEvent.start);
      lessonTimeInput.value =
        selectedEvent.start.toTimeString().slice(0,5);

      const coachVal = selectedEvent.extendedProps.coach;
      for (let opt of coachSelect.options) {
        opt.selected = coachVal.includes(opt.value);
      }

      lessonTypeSelect.value =
        selectedEvent.extendedProps.lessonType;

      modal.classList.remove("hidden");
      deleteBtn.classList.remove("hidden");
    },

    eventDidMount: applyEventColors,

    events: async function(fetchInfo, successCallback) {
      const snapshot = await getDocs(collection(db,"lessons"));
      const events = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: d.title,
          start: d.start,
          end: d.end,
          extendedProps: {
            coach: d.coach,
            lessonType: d.lessonType || "class"
          }
        };
      });
      successCallback(events);
    }
  }
);

calendar.render();

/* ---------------- Save ---------------- */

saveBtn.onclick = async () => {

  const title = titleInput.value;
  const date = lessonDateInput.value;
  const time = lessonTimeInput.value;
  const type = lessonTypeSelect.value;

  const coach = Array.from(coachSelect.selectedOptions)
    .map(o => o.value);

  const start = new Date(`${date}T${time}`);
  const duration = type === "group" ? 60 : 45;
  const end = new Date(start.getTime() + duration*60000);

  if (selectedEvent) {

    await updateDoc(doc(db,"lessons",selectedEvent.id),{
      title,
      coach,
      lessonType: type,
      start: start.toISOString(),
      end: end.toISOString()
    });

    selectedEvent.setProp("title", title);
    selectedEvent.setStart(start);
    selectedEvent.setEnd(end);
    selectedEvent.setExtendedProp("coach", coach);
    selectedEvent.setExtendedProp("lessonType", type);

    applyEventColors({event:selectedEvent, el:selectedEvent.el});

  } else {

    const docRef = await addDoc(collection(db,"lessons"),{
      title,
      coach,
      lessonType: type,
      start: start.toISOString(),
      end: end.toISOString()
    });

    calendar.addEvent({
      id: docRef.id,
      title,
      start,
      end,
      extendedProps:{
        coach,
        lessonType:type
      }
    });
  }

  modal.classList.add("hidden");
};

/* ---------------- Delete ---------------- */

deleteBtn.onclick = async () => {
  if (!selectedEvent) return;

  await deleteDoc(doc(db,"lessons",selectedEvent.id));
  selectedEvent.remove();
  modal.classList.add("hidden");
};

/* ---------------- Cancel ---------------- */

cancelBtn.onclick = () => {
  modal.classList.add("hidden");
};

/* ---------------- Mobile Long Press ---------------- */

let pressTimer;

document.addEventListener("touchstart", e => {
  if (e.target.closest(".fc-event")) {
    const eventEl = e.target.closest(".fc-event");
    const eventId = eventEl.getAttribute("data-event-id");
    const eventObj = calendar.getEventById(eventId);

    pressTimer = setTimeout(async () => {
      if (confirm("Delete this lesson?")) {
        await deleteDoc(doc(db,"lessons",eventObj.id));
        eventObj.remove();
      }
    }, 800);
  }
});

document.addEventListener("touchend", () => {
  clearTimeout(pressTimer);
});
