document.addEventListener('DOMContentLoaded', () => {
  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('lessonModal');

  const titleInput = document.getElementById('lessonTitle');
  const coachInput = document.getElementById('lessonCoach');
  const startInput = document.getElementById('lessonStart');
  const endInput = document.getElementById('lessonEnd');

  const saveBtn = document.getElementById('saveLesson');
  const deleteBtn = document.getElementById('deleteLesson');
  const closeBtn = document.getElementById('closeModal');

  let activeEvent = null;

  function openModal(event = null, start = null, end = null) {
    modal.classList.remove('hidden');
    activeEvent = event;

    if (event) {
      titleInput.value = event.title;
      startInput.value = event.startStr.slice(0,16);
      endInput.value = event.endStr.slice(0,16);
      deleteBtn.style.display = 'block';

      [...coachInput.options].forEach(o => {
        o.selected = event.extendedProps.coaches?.includes(o.value);
      });
    } else {
      titleInput.value = '';
      startInput.value = start;
      endInput.value = end;
      deleteBtn.style.display = 'none';
      coachInput.selectedIndex = -1;
    }
  }

  function closeModal() {
    modal.classList.add('hidden');
    activeEvent = null;
  }

  function coachColor(coaches) {
    if (coaches.length > 1) return '#6a1b9a'; // group
    if (coaches[0] === 'Vlad') return '#1976d2';
    if (coaches[0] === 'Anna') return '#00897b';
    return '#f57c00';
  }

  function hallAvailabilityBackgrounds() {
    return [
      {
        daysOfWeek: [1,2,3,4,5],
        startTime: '09:00',
        endTime: '18:00',
        display: 'background',
        backgroundColor: '#e8f5e9'
      },
      {
        daysOfWeek: [2,4,5],
        startTime: '18:00',
        endTime: '22:00',
        display: 'background',
        backgroundColor: '#fff8e1'
      },
      {
        daysOfWeek: [1,3],
        startTime: '18:00',
        endTime: '22:00',
        display: 'background',
        backgroundColor: '#ffebee'
      }
    ];
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: '100%',
    nowIndicator: true,
    selectable: true,
    editable: true,
    longPressDelay: 500,

    slotMinTime: '09:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:15:00',
    slotLabelInterval: '01:00',
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      omitZeroMinute: true
    },

    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: ''
    },

    titleFormat: { weekday: 'long', day: 'numeric' },

    events: [
      ...hallAvailabilityBackgrounds()
    ],

    select(info) {
      openModal(null, info.startStr.slice(0,16), info.endStr.slice(0,16));
    },

    eventClick(info) {
      openModal(info.event);
    },

    eventLongPress(info) {
      if (confirm('Delete lesson?')) {
        info.event.remove();
      }
    }
  });

  calendar.render();

  saveBtn.onclick = () => {
    const coaches = [...coachInput.selectedOptions].map(o => o.value);
    const color = coachColor(coaches);

    if (activeEvent) {
      activeEvent.setProp('title', titleInput.value);
      activeEvent.setStart(startInput.value);
      activeEvent.setEnd(endInput.value);
      activeEvent.setExtendedProp('coaches', coaches);
      activeEvent.setProp('backgroundColor', color);
    } else {
      calendar.addEvent({
        title: titleInput.value,
        start: startInput.value,
        end: endInput.value,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { coaches }
      });
    }
    closeModal();
  };

  deleteBtn.onclick = () => {
    if (activeEvent) activeEvent.remove();
    closeModal();
  };

  closeBtn.onclick = closeModal;
});
