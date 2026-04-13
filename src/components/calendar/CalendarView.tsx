import { useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { getCategoryColor } from '@/lib/utils';
import type { EventClickArg } from '@fullcalendar/core';

export function CalendarView() {
  const { dreams, fetchDreams } = useDreamStore();
  const { openEditor } = useUIStore();

  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  const events = useMemo(() => {
    return dreams.map((dream) => {
      // Get primary tag color or default
      const primaryTag = dream.tags[0];
      const color = primaryTag ? getCategoryColor(primaryTag.category) : '#de0615';

      return {
        id: dream.id,
        title: dream.title,
        start: dream.dream_date,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          dream,
        },
      };
    });
  }, [dreams]);

  const handleEventClick = (info: EventClickArg) => {
    openEditor(info.event.id);
  };

  const handleDateClick = () => {
    openEditor();
  };

  return (
    <div className="h-[calc(100vh-8rem)]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek',
        }}
        events={events}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        height="100%"
        eventDisplay="block"
        dayMaxEvents={3}
        moreLinkClick="popover"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
      />
    </div>
  );
}
