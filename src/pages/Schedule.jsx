import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, Edit, Trash2, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';
import axios from 'axios';

import { format, addMonths, subMonths, isSameDay, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isPast, isBefore, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import styles from './../styles/Schedule.module.css';

// Zod schema for deadline form validation
const deadlineFormSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional().nullable(),
  due_date: z.string().min(1, 'Дата дедлайна обязательна').refine(val => {
      const date = parseISO(val);
      return isValid(date);
  }, { message: 'Неверный формат даты' }),
  scope: z.enum(['myself', 'groups']),
  groups: z.array(z.number()).optional(),
  priority: z.enum(['high', 'medium', 'low']),
}).refine(data => {
  if (data.scope === 'groups' && (!data.groups || data.groups.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Выберите хотя бы одну группу для дедлайна группы',
  path: ['groups'],
});


const Schedule = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [deadlines, setDeadlines] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const form = useForm({
    resolver: zodResolver(deadlineFormSchema),
    defaultValues: {
      title: '',
      description: null,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      scope: 'myself',
      groups: [],
      priority: 'medium',
    },
  });

  const watchedScope = form.watch('scope');
  const watchedGroups = form.watch('groups');


  // Fetch list of groups
  const fetchGroups = useCallback(async () => {
    try {
      const response = await axios.get('/api/groups');
      if (response.data && Array.isArray(response.data)) {
        setGroups(response.data.map(g => ({ ...g, id: Number(g.id) })));
      } else {
        console.error('Error fetching groups: Invalid data format', response.data);
        setGroups([]);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
    }
  }, []);

  // Fetch deadlines
  const fetchScheduleItems = useCallback(async (filterParams = {}) => {
    if (!user) {
      setDeadlines([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
        const response = await axios.get('/api/schedule', { params: filterParams });

        if (response.data && Array.isArray(response.data)) {
           const formattedDeadlines = response.data.map(item => {
               // --- ИСПРАВЛЕНИЕ: Читаем дату из item.due_date вместо item.end_date ---
               // Backend log shows the date is in item.due_date
               // Assuming item.due_date is already an ISO string or null
               const dueDateValue = item.due_date || null;
               // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

               // --- УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---
               // console.log("DEBUG_FRONTEND_SCHEDULE: Raw item:", item);
               // console.log("DEBUG_FRONTEND_SCHEDULE: Raw item.end_date:", item.end_date, typeof item.end_date);
               // console.log("DEBUG_FRONTEND_SCHEDULE: Formatted due_date value:", dueDateValue, typeof dueDateValue);
               // --- КОНЕЦ УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---

               // Handle item.groups (array of IDs) or item.group_id (single ID) from backend
               const itemGroups = Array.isArray(item.group_ids) ? item.group_ids.map(String) : (item.group_id ? [String(item.group_id)] : []);

               // Determine scope based on backend data (user_id indicates personal, presence of group_ids/group_id indicates group)
                 const itemScope = item.user_id && (!itemGroups || itemGroups.length === 0) ? 'myself' : 'groups';


               return ({
                   id: item.id,
                   title: item.title,
                   description: item.description || null,
                   due_date: dueDateValue, // Frontend uses due_date (ISO string or null)
                   groups: itemGroups,
                   priority: item.priority || 'medium',
                   created_by: item.created_by,
                   created_at: item.created_at, // Assuming created_at is also ISO string or null
                   user_id: item.user_id,
                   scope: itemScope,
               });
           });
           setDeadlines(formattedDeadlines);
        } else {
            console.error('Error fetching schedule items: Invalid data format', response.data);
            setDeadlines([]);
        }
    } catch (error) {
      console.error('Error fetching schedule items:', error);
      setDeadlines([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load groups on mount
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Load deadlines based on filters
  useEffect(() => {
      let filterParams = {};
      if (activeTab === 'calendar') {
          filterParams = {
              month: currentMonth.getMonth() + 1,
              year: currentMonth.getFullYear()
          };
      } else if (activeTab === 'deadlines') {
          filterParams = {
              year: new Date().getFullYear()
          };
      }

      fetchScheduleItems(filterParams);
  }, [user, activeTab, currentMonth, fetchScheduleItems]);

  // Reset form on create dialog open
  useEffect(() => {
    if (showCreateDialog) {
      form.reset({
        title: '',
        description: null,
        due_date: format(new Date(), 'yyyy-MM-dd'),
        scope: 'myself',
        groups: [],
        priority: 'medium',
      });
      form.clearErrors();
    }
  }, [showCreateDialog, form]);

  // Populate form on edit dialog open
  useEffect(() => {
    if (showEditDialog && selectedDeadline) {
      const dueDateISO = selectedDeadline.due_date;
      let formattedDueDate = '';

      if (dueDateISO && typeof dueDateISO === 'string') {
         const parsedDate = parseISO(dueDateISO);
         if (isValid(parsedDate)) {
             formattedDueDate = format(parsedDate, 'yyyy-MM-dd');
         }
      }

      form.reset({
        title: selectedDeadline.title,
        description: selectedDeadline.description || null,
        due_date: formattedDueDate,
        groups: Array.isArray(selectedDeadline.groups) ? selectedDeadline.groups.map(Number) : [],
        priority: selectedDeadline.priority || 'medium',
        scope: selectedDeadline.scope || 'myself',
      });
      form.clearErrors();
    }
  }, [showEditDialog, selectedDeadline, form]);


  // Get CSS class for priority
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return styles.eventHigh;
      case 'medium': return styles.eventMedium;
      case 'low': return styles.eventLow;
      default: return '';
    }
  };

   // Get CSS class for background priority
   const getPriorityBgClass = (priority) => {
     switch (priority) {
       case 'high': return styles.high;
       case 'medium': return styles.medium;
       case 'low': return styles.low;
       default: return '';
     }
   };

  // Get localized priority text
  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  // Navigate calendar month
  const goToPreviousMonth = () => {
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };

  // Get days for calendar grid
  const getDaysForCalendar = () => {
       const firstDayMonth = startOfMonth(currentMonth);
       const lastDayMonth = endOfMonth(currentMonth);

       const startDayGrid = startOfWeek(firstDayMonth, { weekStartsOn: 1 });
       const endDayGrid = endOfWeek(lastDayMonth, { weekStartsOn: 1 });

       const days = eachDayOfInterval({ start: startDayGrid, end: endDayGrid });

       return days;
  };

  // Get deadlines for a specific day
  const getEventsForDay = (day) => {
    if (!day || !isValid(day)) return [];

    return deadlines.filter(deadline => {
      // --- УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---
      // console.log("DEBUG_FRONTEND_SCHEDULE: Checking deadline.due_date in getEventsForDay:", deadline.due_date, typeof deadline.due_date);
      // --- КОНЕЦ УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---

      // Check if due_date exists and is a string before parsing
      if (!deadline.due_date || typeof deadline.due_date !== 'string') {
           return false;
      }
      const deadlineDate = parseISO(deadline.due_date); // Parse the ISO string

      // --- УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---
      // console.log("DEBUG_FRONTEND_SCHEDULE: Parsed date:", deadlineDate, " isValid:", isValid(deadlineDate));
      // --- КОНЕЦ УБРАНЫ ОТЛАДОЧНЫЕ ЛОГИ ---

      // Check if the parsed date is a valid Date object and is the same day
      return isValid(deadlineDate) && isSameDay(deadlineDate, day);
    }).sort((a, b) => {
        // Sort by priority
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b].priority;
    });
  };

  // Handle form submission
  const onSubmit = form.handleSubmit(async (data) => {
    setIsLoading(true);

    try {
      const formattedDate = data.due_date ? `${data.due_date}T23:59:59+00:00` : null;

      let response;
      let payload = {
          title: data.title,
          description: data.description || null,
          end_date: formattedDate,
          priority: data.priority,
      };

      payload.scope = data.scope;

      if (data.scope === 'groups') {
          payload.groups = data.groups;
          payload.group_id = null; // Explicitly null
          payload.user_id = null; // Explicitly null
      } else { // scope === 'myself'
           payload.groups = []; // Explicitly empty array
           payload.group_id = null; // Explicitly null
           payload.user_id = user?.id; // Set user ID for personal
      }

      if (showEditDialog && selectedDeadline) {
        // Edit existing deadline
        response = await axios.put(`/api/schedule/${selectedDeadline.id}`, payload);

        if (response.status === 200 && response.data) {
             const updatedItem = response.data;
             setDeadlines(prev =>
               prev.map(d =>
                 d.id === updatedItem.id
                   ? {
                       ...d,
                       ...updatedItem,
                       due_date: updatedItem.end_date || updatedItem.due_date || null, // Check both end_date and due_date from backend response
                       groups: Array.isArray(updatedItem.groups) ? updatedItem.groups.map(String) : (updatedItem.group_id ? [String(updatedItem.group_id)] : []),
                       priority: updatedItem.priority || 'medium',
                       description: updatedItem.description || null,
                       scope: updatedItem.user_id && (!Array.isArray(updatedItem.groups) || updatedItem.groups.length === 0) && !updatedItem.group_id ? 'myself' : 'groups', // Re-determine scope robustly
                    }
                   : d
               )
             );
             alert('Дедлайн успешно обновлен!');

             setShowEditDialog(false);
             setSelectedDeadline(null);
        } else {
            console.error('Backend update failed or returned unexpected data:', response);
            throw new Error(`Ошибка сервера при обновлении: ${response.status}`);
        }


      } else {
         // Create new deadline
         // console.log("DEBUG: Payload being sent:", payload); // Keep this log for debugging POST 400 if needed
         response = await axios.post('/api/schedule', payload);

         if (response.status === 201 && Array.isArray(response.data)) {
           const createdItems = response.data.map(item => ({
               ...item,
               due_date: item.end_date || item.due_date || null, // Check both end_date and due_date from backend response
               groups: Array.isArray(item.groups) ? item.groups.map(String) : (item.group_id ? [String(item.group_id)] : []),
               priority: item.priority || 'medium',
               description: item.description || null,
               scope: item.user_id && (!Array.isArray(item.groups) || item.groups.length === 0) && !item.group_id ? 'myself' : 'groups', // Re-determine scope robustly
           }));
           setDeadlines(prev => [...prev, ...createdItems]);

            alert('Дедлайн успешно создан!');

           setShowCreateDialog(false);
        } else {
            console.error('Backend create failed or returned unexpected data:', response);
            throw new Error(`Ошибка сервера при создании: Неожиданный формат ответа.`);
        }
      }

    } catch (error) {
      console.error('Error saving deadline:', error);
       const errorMessage = error.response?.data?.message || error.message || 'Произошла ошибка при сохранении дедлайна.';
       alert(`Ошибка: ${errorMessage}`);
    } finally {
       setIsLoading(false);
    }
  });


  // Handle deleting a deadline
  const handleDeleteDeadline = async () => {
    if (!selectedDeadline) return;

    setIsLoading(true);

    try {
      const response = await axios.delete(`/api/schedule/${selectedDeadline.id}`);

      if (response.status === 200 || response.status === 204) {
         setDeadlines(prev => prev.filter(d => d.id !== selectedDeadline.id));

          alert('Дедлайн успешно удален!');
      } else {
         console.error('Backend delete failed or returned unexpected data:', response);
         throw new Error(`Ошибка сервера: ${response.status}`);
      }

    } catch (error) {
      console.error('Error deleting deadline:', error);
       const errorMessage = error.response?.data?.message || error.message || 'Произошла ошибка при удалении дедлайна.';
       alert(`Ошибка: ${errorMessage}`);
    } finally {
      setShowDeleteDialog(false);
      setSelectedDeadline(null);
      setIsLoading(false);
    }
  };

  // Handle tab change (defined within the component scope)
  const handleTabChange = useCallback((tabValue) => {
    setActiveTab(tabValue);
  }, []); // useCallback memoizes the function

  // --- Component Rendering ---

  return (
    <SidebarLayout>
      <div className={styles.scheduleContainer}>
        {/* Page Header with Title and Create Button */}
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Расписание и Дедлайны</h2>
            <p className={styles.pageDescription}>Управление расписанием и отслеживание важных дат и дедлайнов</p>
          </div>
           {/* Create button visible to Admin and Curator, or allow all for personal */}
          {user && (user?.role === 'admin' || user?.role === 'curator' || user?.role === 'student' || user?.role === 'parent') && (
             <button type="button" className={styles.button} onClick={() => setShowCreateDialog(true)} disabled={isLoading}>
               <Plus style={{width: '1em', height: '1em', marginRight: '8px'}} />
               Создать дедлайн
             </button>
          )}
        </div>

        {/* Tabs (Calendar/List) */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            {/* Calendar Tab */}
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'calendar' ? styles.active : ''}`}
              onClick={() => handleTabChange('calendar')}
               disabled={isLoading}
            >
              Календарь
            </button>
            {/* Deadlines List Tab */}
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'deadlines' ? styles.active : ''}`}
              onClick={() => handleTabChange('deadlines')}
               disabled={isLoading}
            >
              Список дедлайнов
            </button>
          </div>

          {/* Tab Content based on activeTab */}
          {/* Calendar Tab Content */}
          {activeTab === 'calendar' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                {/* Calendar Header with Month/Year and Navigation */}
                <div className={styles.cardHeader}>
                  <div className={styles.calendarHeader}>
                    {/* Format month and year using russian locale */}
                    <h3 className={styles.cardTitle}>{format(currentMonth, 'LLLL', { locale: ru })} {format(currentMonth, 'yyyy')}</h3>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button type="button" className={styles.buttonIcon} onClick={goToPreviousMonth} disabled={isLoading}>
                        <ChevronLeft />
                      </button>
                      <button type="button" className={styles.buttonIcon} onClick={goToNextMonth} disabled={isLoading}>
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Calendar Grid */}
                <div className={styles.cardContent}>
                  {/* Weekday headers */}
                  <div className={styles.calendarWeekdays}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>

                  {/* Days of the month grid */}
                  <div className={styles.calendarGrid}>
                    {getDaysForCalendar().map((day, index) => {
                      const events = day ? getEventsForDay(day) : [];
                      const dayClass = day ? (isToday(day) ? 'today' : '') : 'empty';
                      const isPastDay = day && isBefore(day, new Date());
                       const isDayInCurrentMonth = day && day.getMonth() === currentMonth.getMonth();


                      return (
                        <div
                          key={index}
                          className={`${styles.calendarDay} ${styles[dayClass]} ${isPastDay ? styles.pastDay : ''} ${isDayInCurrentMonth ? '' : styles.outsideMonthDay}`}
                           onClick={() => day && setShowCreateDialog(true)}
                        >
                          {day && (
                            <>
                              {/* Day number */}
                              <div className={styles.calendarDayNumber}>{day.getDate()}</div>

                              {/* Events for the day */}
                              <div className={styles.calendarDayEvents}>
                                {events.slice(0, 2).map((event) => (
                                  <div
                                    key={event.id}
                                    className={`${styles.calendarEvent} ${getPriorityClass(event.priority)}`}
                                    // Tooltip with event details
                                    title={`${event.title} (${getPriorityText(event.priority)})${event.groups && event.groups.length > 0 ? ' - Группы: ' + event.groups.map(groupId => { const g = groups.find(g => String(g.id) === String(groupId)); return g ? g.name : groupId; }).join(', ') : (event.user_id ? ' - Личный дедлайн' : '')}`}
                                     onClick={(e) => { e.stopPropagation(); setSelectedDeadline(event); setShowEditDialog(true); }}
                                  >
                                    {event.title}
                                  </div>
                                ))}

                                {events.length > 2 && (
                                  <div className={styles.moreEventsText}>
                                    +{events.length - 2} ещё
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deadlines List Tab Content */}
          {activeTab === 'deadlines' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Все дедлайны</h3>
                  <p className={styles.cardDescription}>Просмотр и управление дедлайнами</p>
                </div>
                <div className={styles.cardContent}>
                  {/* Loading state */}
                  {isLoading ? (
                    <div className={styles.loadingText}>
                      <Loader2 className={styles.loaderIcon} />
                      <p>Загрузка дедлайнов...</p>
                    </div>
                   // Empty state
                  ) : deadlines.length === 0 ? (
                    <div className={styles.emptyStateText}>
                      <p>
                        Нет дедлайнов для отображения.
                         {user && (user?.role === 'admin' || user?.role === 'curator') && (
                             <> Создайте новый дедлайн, нажав кнопку "Создать дедлайн".</>
                         )}
                           {user && !(user?.role === 'admin' || user?.role === 'curator') && (
                             <> Возможно, у вас нет назначенных дедлайнов или личных дедлайнов за текущий год.</>
                           )}
                      </p>
                    </div>
                   // List of deadlines
                  ) : (
                    <div className={styles.deadlinesList}>
                       {/* TODO: Add sorting and/or filtering for the list */}
                      {deadlines.map((deadline) => (
                        <div key={deadline.id} className={styles.deadlineItem}>
                          {/* Priority color indicator */}
                          <div className={`${styles.deadlineIconContainer} ${getPriorityBgClass(deadline.priority)}`}>
                            <Clock />
                          </div>
                          <div className={styles.deadlineContent}>
                            <div className={styles.deadlineHeader}>
                              <h3 className={styles.deadlineTitle}>{deadline.title}</h3>
                              {/* Burning deadline icon */}
                              {deadline.due_date && typeof deadline.due_date === 'string' && isValid(parseISO(deadline.due_date)) && isBefore(new Date(), parseISO(deadline.due_date)) && isBefore(new Date(), addDays(parseISO(deadline.due_date), 3)) && (
                                  <AlertTriangle className={styles.burningDeadlineIcon} title="Дедлайн приближается!" />
                              )}
                              <div className={styles.deadlineMeta}>
                                {/* Priority Badge */}
                                <span className={`${styles.priorityBadge} ${getPriorityClass(deadline.priority)}`}>
                                  {getPriorityText(deadline.priority)} приоритет
                                </span>
                                 {/* Deadline Date Badge */}
                                <span className={styles.dateBadge}>
                                  <CalendarIcon style={{width: '0.9em', height: '0.9em', marginRight: '4px'}} />
                                  {/* Safely format date after checking if it's a valid string and parsable */}
                                  {deadline.due_date && typeof deadline.due_date === 'string' && isValid(parseISO(deadline.due_date)) ? format(parseISO(deadline.due_date), 'dd.MM.yyyy') : 'Дата неизвестна'}
                                </span>
                              </div>
                            </div>
                            {/* Description */}
                            {deadline.description && (
                              <p className={styles.deadlineDescription}>
                                {deadline.description}
                              </p>
                            )}
                             {/* Display Groups or "Личный дедлайн" tag */}
                             {/* Check if it has associated groups (based on frontend's groups array derived from backend data) */}
                             {(deadline.groups && deadline.groups.length > 0) ? (
                                 <div className={styles.deadlineGroups}>
                                   <span>Группы:</span>
                                   {/* Display group names from the fetched groups list based on deadline group IDs */}
                                    {deadline.groups.map((groupId) => {
                                        // Find the group by its ID (group list has number IDs, deadline.groups has string IDs)
                                        const group = groups.find(g => String(g.id) === String(groupId));
                                        return group ? (
                                            <span key={group.id} className={styles.groupTag}>{group.name}</span>
                                        ) : (
                                            // Fallback: display the group ID if group name not found
                                            <span key={groupId} className={styles.groupTag}>{groupId}</span>
                                        );
                                    })}
                                 </div>
                             ) : (
                                 // If no associated groups and user_id is present (indicating personal based on backend structure assumption)
                                 deadline.user_id && (
                                    <div className={styles.deadlineGroups}>
                                         <span className={styles.groupTag}>Личный дедлайн</span>
                                    </div>
                                 )
                             )}
                          </div>
                          {/* Action Buttons (Edit, Delete) */}
                          {/* Show actions if user is Admin, or the creator, or a Curator of one of the groups */}
                           {(user?.role === 'admin' // Admin can edit/delete anything
                              || (user?.id === deadline.created_by) // Creator can always edit/delete their own
                              || (user?.role === 'curator' && // Curator might edit/delete if they curate one of the groups associated with the deadline
                                   deadline.groups?.some(groupId => {
                                        const group = groups.find(g => String(g.id) === String(groupId));
                                        // Check if the group exists and the user is its curator
                                        return group && group.curator_id === user.id;
                                    })
                                 )
                           ) && (
                              <div className={styles.deadlineActions}>
                                <button
                                  type="button"
                                  className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                  onClick={() => {
                                    setSelectedDeadline(deadline); // Set deadline for edit dialog
                                    setShowEditDialog(true); // Show edit dialog
                                  }}
                                  disabled={isLoading} // Disable while other actions are loading
                                >
                                  <Edit style={{width: '1em', height: '1em', marginRight: '4px'}} />
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.buttonDestructive}`}
                                  onClick={() => {
                                    setSelectedDeadline(deadline); // Set deadline for delete dialog
                                    setShowDeleteDialog(true); // Show delete confirmation dialog
                                  }}
                                  disabled={isLoading} // Disable while other actions are loading
                                >
                                  <Trash2 style={{width: '1em', height: '1em', marginRight: '4px'}} />
                                  Удалить
                                </button>
                              </div>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Deadline Dialog (Modal) */}
      {/* Show modal if showCreateDialog is true */}
      {showCreateDialog && (
        <div className={styles.modalOverlay} onClick={() => !form.formState.isSubmitting && setShowCreateDialog(false)}> {/* Close on overlay click, unless submitting */}
          {/* Prevent closing modal when clicking inside modal content */}
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
               {/* Close button */}
               {!form.formState.isSubmitting && (
                  <button type="button" className={styles.closeButton} onClick={() => setShowCreateDialog(false)}>
                      <XCircle style={{width: '1.5em', height: '1.5em'}} />
                   </button>
               )}
              <h3 className={styles.modalTitle}>Создать новый дедлайн</h3>
              <p className={styles.modalDescription}>
                Заполните информацию о дедлайне и нажмите "Создать"
              </p>
            </div>

            {/* Form */}
            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.modalForm}>
               {/* Scope Selection (Myself or Groups) */}
               <div className={styles.formGroup}>
                   <label className={styles.formLabel}>Тип дедлайна</label>
                   <div className={styles.radioGroup}>
                       {/* "Личный дедлайн" option (available to all authenticated users) */}
                       <div className={styles.radioOption}>
                           <input
                               type="radio"
                               id="scope_myself"
                               name="scope"
                               value="myself"
                               checked={watchedScope === 'myself'} // Check if current scope is 'myself'
                               onChange={(e) => form.setValue('scope', e.target.value, { shouldValidate: true })} // Update form state
                                disabled={form.formState.isSubmitting} // Disable while submitting
                           />
                           <label htmlFor="scope_myself">Личный дедлайн</label>
                       </div>
                       {/* "Для групп" option (available only to Admin and Curator roles) */}
                        {(user?.role === 'admin' || user?.role === 'curator') && (
                            <div className={styles.radioOption}>
                                <input
                                    type="radio"
                                    id="scope_groups"
                                    name="scope"
                                    value="groups"
                                    checked={watchedScope === 'groups'} // Check if current scope is 'groups'
                                    onChange={(e) => form.setValue('scope', e.target.value, { shouldValidate: true })} // Update form state
                                     disabled={form.formState.isSubmitting} // Disable while submitting
                                />
                                <label htmlFor="scope_groups">Для групп</label>
                            </div>
                        )}
                   </div>
               </div>

              {/* Title Input */}
              <div className={styles.formGroup}>
                <label htmlFor="create-title" className={styles.formLabel}>Название дедлайна</label>
                <input
                  id="create-title"
                  className={styles.inputField}
                  placeholder="Введите название"
                  {...form.register('title')} // Register input with react-hook-form
                  disabled={form.formState.isSubmitting} // Disable while submitting
                />
                 {/* Display validation error message */}
                 {form.formState.errors.title && <p className={styles.formErrorMessage}>{form.formState.errors.title.message}</p>}
              </div>

              {/* Description Textarea */}
              <div className={styles.formGroup}>
                <label htmlFor="create-description" className={styles.formLabel}>Описание</label>
                <textarea
                   id="create-description"
                   className={styles.textareaField}
                   placeholder="Введите описание дедлайна"
                   {...form.register('description')} // Register textarea with react-hook-form
                    disabled={form.formState.isSubmitting} // Disable while submitting
                 ></textarea>
              </div>

              {/* Date and Priority Fields (side-by-side) */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                 {/* Due Date Input */}
                 <div className={styles.formGroup}>
                   <label htmlFor="create-due_date" className={styles.formLabel}>Дата дедлайна</label>
                   <input
                     id="create-due_date"
                     type="date" // Use type="date" for native date picker
                     className={styles.inputField}
                     {...form.register('due_date')} // Register input
                     disabled={form.formState.isSubmitting} // Disable while submitting
                   />
                    {/* Display validation error message */}
                    {form.formState.errors.due_date && <p className={styles.formErrorMessage}>{form.formState.errors.due_date.message}</p>}
                 </div>

                 {/* Priority Select */}
                 <div className={styles.formGroup}>
                   <label htmlFor="create-priority" className={styles.formLabel}>Приоритет</label>
                   <select
                      id="create-priority"
                      className={`${styles.inputField} ${styles.selectTrigger}`}
                      {...form.register('priority')} // Register select
                      defaultValue={form.getValues('priority')} // Set default value
                      disabled={form.formState.isSubmitting} // Disable while submitting
                   >
                      {/* Options for priority */}
                      <option value="high">Высокий</option>
                      <option value="medium">Средний</option>
                      <option value="low">Низкий</option>
                   </select>
                    {/* Display validation error message */}
                    {form.formState.errors.priority && <p className={styles.formErrorMessage}>{form.formState.errors.priority.message}</p>}
                 </div>
              </div>

              {/* Group Selection (Visible only if scope is 'groups') */}
              {watchedScope === 'groups' && (
                <div className={styles.formGroup}>
                   <label className={styles.formLabel}>Выберите группы</label>
                   <div className={styles.checkboxGroup}>
                     {/* Map over available groups to create checkboxes */}
                     {groups.map(group => (
                       <div key={group.id} className={styles.checkboxItem}>
                         <input
                           type="checkbox"
                           id={`create-group-${group.id}`}
                           value={group.id} // Use group ID as the value
                           // Check if the current group's ID is included in the watched 'groups' array
                           checked={watchedGroups?.includes(group.id) || false}
                           onChange={(e) => {
                             const groupId = Number(e.target.value); // Get ID as number
                             // Add or remove group ID from the watched 'groups' array based on checkbox state
                             const updatedGroups = e.target.checked
                               ? [...(watchedGroups || []), groupId] // Add ID if checked
                               : (watchedGroups || []).filter(id => id !== groupId); // Remove ID if unchecked
                             // Update form state for 'groups' field, trigger validation
                             form.setValue('groups', updatedGroups, { shouldValidate: true });
                           }}
                            disabled={form.formState.isSubmitting || !groups.length} // Disable while submitting or if no groups available
                         />
                         <label htmlFor={`create-group-${group.id}`}>{group.name}</label>
                       </div>
                     ))}
                      {/* Message if no groups are available */}
                      {groups.length === 0 && <p className={styles.formInfoMessage}>Нет доступных групп для выбора.</p>}
                   </div>
                    {/* Display validation error message for groups */}
                    {form.formState.errors.groups && <p className={styles.formErrorMessage}>{form.formState.errors.groups.message}</p>}
                </div>
              )}

              {/* Modal Footer with Buttons */}
              <div className={styles.modalFooter}>
                {/* Cancel Button */}
                <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => !form.formState.isSubmitting && setShowCreateDialog(false)} disabled={form.formState.isSubmitting}>
                  Отмена
                </button>
                {/* Submit Button - disabled while submitting or if group validation fails */}
                <button type="submit" className={styles.button} disabled={form.formState.isSubmitting || (watchedScope === 'groups' && (!watchedGroups || watchedGroups.length === 0))}>
                   {form.formState.isSubmitting ? 'Создание...' : 'Создать дедлайн'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Deadline Dialog (Modal) */}
      {/* Show modal if showEditDialog is true and a deadline is selected */}
      {showEditDialog && selectedDeadline && (
         <div className={styles.modalOverlay} onClick={() => !form.formState.isSubmitting && setShowEditDialog(false)}>
           <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
             {/* Modal Header */}
             <div className={styles.modalHeader}>
                {/* Close button */}
                {!form.formState.isSubmitting && (
                   <button type="button" className={styles.closeButton} onClick={() => setShowEditDialog(false)}>
                       <XCircle style={{width: '1.5em', height: '1.5em'}} />
                    </button>
                )}
               <h3 className={styles.modalTitle}>Редактировать дедлайн</h3>
               <p className={styles.modalDescription}>
                 Внесите изменения и нажмите "Сохранить"
               </p>
             </div>

             {/* Form (reusing onSubmit handler) */}
             <form onSubmit={form.handleSubmit(onSubmit)} className={styles.modalForm}>
                {/* Scope Selection (Editable) */}
                {/* Note: Backend PUT expects payload based on scope, handle scope change logic there */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Тип дедлайна</label>
                    <div className={styles.radioGroup}>
                        {/* "Личный дедлайн" option */}
                        <div className={styles.radioOption}>
                            <input
                                type="radio"
                                id="edit_scope_myself"
                                name="scope"
                                value="myself"
                                checked={watchedScope === 'myself'}
                                onChange={(e) => form.setValue('scope', e.target.value, { shouldValidate: true })}
                                 disabled={form.formState.isSubmitting}
                            />
                            <label htmlFor="edit_scope_myself">Личный дедлайн</label>
                        </div>
                         {/* "Для групп" option only for Admin/Curator */}
                         {(user?.role === 'admin' || user?.role === 'curator') && (
                             <div className={styles.radioOption}>
                                 <input
                                     type="radio"
                                     id="edit_scope_groups"
                                     name="scope"
                                     value="groups"
                                     checked={watchedScope === 'groups'}
                                     onChange={(e) => form.setValue('scope', e.target.value, { shouldValidate: true })}
                                      disabled={form.formState.isSubmitting}
                                 />
                                 <label htmlFor="edit_scope_groups">Для групп</label>
                             </div>
                         )}
                    </div>
                </div>

               {/* Title Input */}
               <div className={styles.formGroup}>
                 <label htmlFor="edit-title" className={styles.formLabel}>Название дедлайна</label>
                 <input
                   id="edit-title"
                   className={styles.inputField}
                   placeholder="Введите название"
                   {...form.register('title')}
                    disabled={form.formState.isSubmitting}
                 />
                  {form.formState.errors.title && <p className={styles.formErrorMessage}>{form.formState.errors.title.message}</p>}
               </div>

               {/* Description Textarea */}
               <div className={styles.formGroup}>
                 <label htmlFor="edit-description" className={styles.formLabel}>Описание</label>
                 <textarea
                    id="edit-description"
                    className={styles.textareaField}
                    placeholder="Введите описание дедлайна"
                    {...form.register('description')}
                     disabled={form.formState.isSubmitting}
                 ></textarea>
               </div>

               {/* Date and Priority Fields */}
               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                  {/* Due Date Input */}
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-due_date" className={styles.formLabel}>Дата дедлайна</label>
                    <input
                      id="edit-due_date"
                      type="date"
                      className={styles.inputField} // Corrected class name
                      {...form.register('due_date')}
                       disabled={form.formState.isSubmitting}
                    />
                     {form.formState.errors.due_date && <p className={styles.formErrorMessage}>{form.formState.errors.due_date.message}</p>}
                  </div>

                  {/* Priority Select */}
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-priority" className={styles.formLabel}>Приоритет</label>
                    <select
                       id="edit-priority"
                       className={`${styles.inputField} ${styles.selectTrigger}`}
                       {...form.register('priority')}
                       defaultValue={form.getValues('priority')}
                        disabled={form.formState.isSubmitting}
                    >
                       <option value="high">Высокий</option>
                       <option value="medium">Средний</option>
                       <option value="low">Низкий</option>
                    </select>
                     {form.formState.errors.priority && <p className={styles.formErrorMessage}>{form.formState.errors.priority.message}</p>}
                  </div>
               </div>

                {/* Group Selection (Visible only if scope is 'groups') */}
               {watchedScope === 'groups' && (
                 <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Выберите группы</label>
                    <div className={styles.checkboxGroup}>
                      {/* Map over available groups for checkboxes */}
                      {groups.map(group => (
                        <div key={group.id} className={styles.checkboxItem}>
                          <input
                            type="checkbox"
                            id={`edit-group-${group.id}`}
                            value={group.id} // Use group ID
                             checked={watchedGroups?.includes(group.id) || false} // Check if ID is in watched 'groups' array
                           onChange={(e) => {
                             const groupId = Number(e.target.value); // Get ID as number
                             // Add or remove ID from watched 'groups' array
                             const updatedGroups = e.target.checked
                               ? [...(watchedGroups || []), groupId]
                               : (watchedGroups || []).filter(id => id !== groupId);
                             form.setValue('groups', updatedGroups, { shouldValidate: true }); // Update form state, validate
                           }}
                            disabled={form.formState.isSubmitting || !groups.length} // Disable while submitting or if no groups
                          />
                          <label htmlFor={`edit-group-${group.id}`}>{group.name}</label>
                        </div>
                      ))}
                       {groups.length === 0 && <p className={styles.formInfoMessage}>Нет доступных групп для выбора.</p>}
                    </div>
                     {form.formState.errors.groups && <p className={styles.formErrorMessage}>{form.formState.errors.groups.message}</p>}
                 </div>
               )}

               {/* Modal Footer with Buttons */}
               <div className={styles.modalFooter}>
                 {/* Cancel Button */}
                 <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => !form.formState.isSubmitting && setShowEditDialog(false)} disabled={form.formState.isSubmitting}>
                   Отмена
                 </button>
                 {/* Submit Button - disabled while submitting or if group validation fails */}
                 <button type="submit" className={styles.button} disabled={form.formState.isSubmitting || (watchedScope === 'groups' && (!watchedGroups || watchedGroups.length === 0))}>
                    {form.formState.isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

        {/* Delete Confirmation Dialog (Modal) */}
       {/* Show modal if showDeleteDialog is true and a deadline is selected */}
       {showDeleteDialog && selectedDeadline && (
          <div className={styles.alertDialogOverlay} onClick={() => !isLoading && setShowDeleteDialog(false)}> {/* Close on overlay click unless loading */}
             {/* Prevent closing on clicking inside dialog content */}
             <div className={styles.alertDialogContent} onClick={(e) => e.stopPropagation()}>
                {/* Dialog Header */}
                <div className={styles.alertDialogHeader}>
                   {/* Close button */}
                    {!isLoading && ( // Disable close button while isLoading
                       <button type="button" className={styles.closeButton} onClick={() => setShowDeleteDialog(false)}>
                           <XCircle style={{width: '1.5em', height: '1.5em'}} />
                        </button>
                    )}
                   <h3 className={styles.alertDialogTitle}>Удалить дедлайн</h3>
                   <p className={styles.alertDialogDescription}>
                      Вы уверены, что хотите удалить дедлайн "{selectedDeadline.title}"?
                      Это действие нельзя отменить.
                   </p>
                </div>
                {/* Dialog Footer with Buttons */}
                <div className={styles.alertDialogFooter}>
                   {/* Cancel Button */}
                   <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => setShowDeleteDialog(false)} disabled={isLoading}>Отмена</button>
                   {/* Delete Button - disabled while deleting */}
                   <button
                      type="button"
                      className={`${styles.button} ${styles.buttonDestructive}`}
                       onClick={handleDeleteDeadline}
                       disabled={isLoading} // Use isLoading as general indicator for action in progress
                   >
                      <Trash2 style={{width: '1em', height: '1em', marginRight: '4px'}} />
                      Удалить
                   </button>
                </div>
             </div>
          </div>
       )}

        {/* TODO: Component for burning deadline notifications (optional, separate concern) */}
         {/* <BurningDeadlinesNotifier userId={user?.id} /> */}


    </SidebarLayout>
  );
};

export default Schedule;