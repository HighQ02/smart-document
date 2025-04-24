import React, { useState, useEffect } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';
import axios from 'axios';

import { format, addMonths, subMonths, isSameDay, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import styles from './../styles/Schedule.module.css';

const deadlineFormSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  due_date: z.string().min(1, 'Дата обязательна'),
  groups: z.array(z.string()).min(1, 'Выберите хотя бы одну группу'),
  priority: z.enum(['high', 'medium', 'low']),
});

const mockDeadlines = [
  { id: 1, title: 'Сдать отчет по практике', description: 'Отчет за 1 семестр', due_date: '2025-04-28T23:59:59Z', groups: ['101', '102'], priority: 'high', created_by: 'user1' },
  { id: 2, title: 'Оплатить обучение', description: 'Оплата за 2 семестр', due_date: '2025-05-15T23:59:59Z', groups: ['101', '102', '103'], priority: 'medium', created_by: 'user2' },
  { id: 3, title: 'Зарегистрироваться на конференцию', description: 'Ежегодная студенческая конференция', due_date: '2025-06-01T23:59:59Z', groups: ['103'], priority: 'low', created_by: 'user1' },
  { id: 4, title: 'Подтвердить данные', description: 'Обновить контактную информацию', due_date: '2025-04-25T23:59:59Z', groups: ['101'], priority: 'high', created_by: 'user3' },
];

const mockGroups = [
    { id: 1, name: '101' },
    { id: 2, name: '102' },
    { id: 3, name: '103' },
];


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
      description: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      groups: [],
      priority: 'medium',
    },
  });

  const watchedGroups = form.watch('groups');

  useEffect(() => {
    const fetchDeadlines = async () => {
      setIsLoading(true);
      try {
           const response = await new Promise(resolve => setTimeout(() => resolve({ data: mockDeadlines }), 1000));

           if (response.data) {
             setDeadlines(response.data);
           }
        } catch (error) {
        console.error('Error fetching deadlines:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchGroups = async () => {
      try {
        const response = await new Promise(resolve => setTimeout(() => resolve({ data: mockGroups }), 500));

        if (response.data) {
          setGroups(response.data);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };

    fetchDeadlines();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (showCreateDialog) {
      form.reset({
        title: '',
        description: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        groups: [],
        priority: 'medium',
      });
       form.clearErrors();
    }
  }, [showCreateDialog, form]);

  useEffect(() => {
    if (showEditDialog && selectedDeadline) {
      const dueDate = parseISO(selectedDeadline.due_date);

      form.reset({
        title: selectedDeadline.title,
        description: selectedDeadline.description || '',
        due_date: isValid(dueDate) ? format(dueDate, 'yyyy-MM-dd') : '',
        groups: selectedDeadline.groups,
        priority: selectedDeadline.priority,
      });
       form.clearErrors();
    }
  }, [showEditDialog, selectedDeadline, form]);

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return styles.eventHigh;
      case 'medium': return styles.eventMedium;
      case 'low': return styles.eventLow;
      default: return '';
    }
  };

   const getPriorityBgClass = (priority) => {
     switch (priority) {
       case 'high': return styles.high;
       case 'medium': return styles.medium;
       case 'low': return styles.low;
       default: return '';
     }
   };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high':
        return 'Высокий';
      case 'medium':
        return 'Средний';
        case 'low':
        return 'Низкий';
      default:
        return priority;
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };

  const getDaysForCalendar = () => {
       const firstDayMonth = startOfMonth(currentMonth);
       const lastDayMonth = endOfMonth(currentMonth);

       const startDayGrid = startOfWeek(firstDayMonth, { weekStartsOn: 1 });
       const endDayGrid = endOfWeek(lastDayMonth, { weekStartsOn: 1 });

       const days = eachDayOfInterval({ start: startDayGrid, end: endDayGrid });

       return days;
  };

  const getEventsForDay = (day) => {
    if (!day) return [];

    return deadlines.filter(deadline => {
      const deadlineDate = parseISO(deadline.due_date);
      return isValid(deadlineDate) && isSameDay(deadlineDate, day);
    }).sort((a, b) => {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };


  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const formattedDate = `${data.due_date}T23:59:59+00:00`;

      if (showEditDialog && selectedDeadline) {
        const response = await new Promise(resolve => setTimeout(() => resolve({ status: 200 }), 1000));

        if (response.status === 200) {
             setDeadlines(prev =>
               prev.map(d =>
                 d.id === selectedDeadline.id
                   ? {
                       ...d,
                       title: data.title,
                       description: data.description,
                       due_date: formattedDate,
                       groups: data.groups,
                       priority: data.priority,
                     }
                   : d
               )
             );
             setShowEditDialog(false);
        } else {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }


      } else {
         const newMockDeadline = {
             id: Date.now(),
             title: data.title,
             description: data.description,
             due_date: formattedDate,
             groups: data.groups,
             priority: data.priority,
             created_by: user?.id,
             created_at: new Date().toISOString(),
         };
        const response = await new Promise(resolve => setTimeout(() => resolve({ status: 201, data: newMockDeadline }), 1000));

        if (response.status === 201) {
           setDeadlines(prev => [...prev, response.data]);
           setShowCreateDialog(false);
        } else {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

      }
       form.reset();
    } catch (error) {
      console.error('Error saving deadline:', error);
    } finally {
       setIsLoading(false);
    }
  };

  const handleDeleteDeadline = async () => {
    if (!selectedDeadline) return;

    setIsLoading(true);
    try {
      const response = await new Promise(resolve => setTimeout(() => resolve({ status: 204 }), 1000));

      if (response.status === 204) {
         setDeadlines(prev => prev.filter(d => d.id !== selectedDeadline.id));
      } else {
         throw new Error(`Ошибка сервера: ${response.status}`);
      }


    } catch (error) {
      console.error('Error deleting deadline:', error);
    } finally {
      setShowDeleteDialog(false);
      setSelectedDeadline(null);
      setIsLoading(false);
    }
  };

  const handleTabChange = (tabValue) => {
     setActiveTab(tabValue);
  };

  return (
    <SidebarLayout>
      <div className={styles.scheduleContainer}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Расписание</h2>
            <p className={styles.pageDescription}>Управление дедлайнами и расписанием</p>
          </div>
          <button type="button" className={styles.button} onClick={() => setShowCreateDialog(true)} disabled={isLoading}>
            <Plus style={{width: '1em', height: '1em', marginRight: '8px'}} />
            Создать дедлайн
          </button>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'calendar' ? styles.active : ''}`}
              onClick={() => handleTabChange('calendar')}
            >
              Календарь
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'deadlines' ? styles.active : ''}`}
              onClick={() => handleTabChange('deadlines')}
            >
              Дедлайны
              <span className={styles.badge}>{deadlines.length}</span>
            </button>
          </div>

          {activeTab === 'calendar' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.calendarHeader}>
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
                <div className={styles.cardContent}>
                  <div className={styles.calendarWeekdays}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>

                  <div className={styles.calendarGrid}>
                    {getDaysForCalendar().map((day, index) => {
                      const events = day ? getEventsForDay(day) : [];
                      const dayClass = day ? (isToday(day) ? 'today' : '') : 'empty';

                      return (
                        <div
                          key={index}
                          className={`${styles.calendarDay} ${styles[dayClass]}`}
                          onClick={() => day && setShowCreateDialog(true)}
                        >
                          {day && (
                            <>
                              <div className={styles.calendarDayNumber}>{day.getDate()}</div>

                              <div className={styles.calendarDayEvents}>
                                {events.slice(0, 2).map((event) => (
                                  <div
                                    key={event.id}
                                    className={`${styles.calendarEvent} ${getPriorityClass(event.priority)}`}
                                    title={`${event.title} (${getPriorityText(event.priority)} приоритет)`}
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

          {activeTab === 'deadlines' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Все дедлайны</h3>
                  <p className={styles.cardDescription}>Просмотр и управление дедлайнами документов</p>
                </div>
                <div className={styles.cardContent}>
                  {isLoading ? (
                    <div className={styles.loadingText}>
                      <p>Загрузка дедлайнов...</p>
                    </div>
                  ) : deadlines.length === 0 ? (
                    <div className={styles.emptyStateText}>
                      <p>
                        Нет дедлайнов. Создайте новый дедлайн, нажав кнопку "Создать дедлайн".
                      </p>
                    </div>
                  ) : (
                    <div className={styles.deadlinesList}>
                      {deadlines.map((deadline) => (
                        <div key={deadline.id} className={styles.deadlineItem}>
                          <div className={`${styles.deadlineIconContainer} ${getPriorityBgClass(deadline.priority)}`}>
                            <Clock />
                          </div>
                          <div className={styles.deadlineContent}>
                            <div className={styles.deadlineHeader}>
                              <h3 className={styles.deadlineTitle}>{deadline.title}</h3>
                              <div className={styles.deadlineMeta}>
                                <span className={`${styles.priorityBadge} ${getPriorityClass(deadline.priority)}`}>
                                  {getPriorityText(deadline.priority)} приоритет
                                </span>
                                <span className={styles.dateBadge}>
                                  <CalendarIcon style={{width: '0.9em', height: '0.9em', marginRight: '4px'}} />
                                  {format(parseISO(deadline.due_date), 'dd.MM.yyyy')}
                                </span>
                              </div>
                            </div>
                            {deadline.description && (
                              <p className={styles.deadlineDescription}>
                                {deadline.description}
                              </p>
                            )}
                             {deadline.groups && deadline.groups.length > 0 && (
                              <div className={styles.deadlineGroups}>
                                <span>Группы:</span>
                                {deadline.groups.map((group) => (
                                  <span
                                    key={group}
                                    className={styles.groupTag}
                                  >
                                    {group}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={styles.deadlineActions}>
                            <button
                              type="button"
                              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                              onClick={() => {
                                setSelectedDeadline(deadline);
                                setShowEditDialog(true);
                              }}
                              disabled={isLoading}
                            >
                              <Edit style={{width: '1em', height: '1em', marginRight: '4px'}} />
                              Редактировать
                            </button>
                            <button
                              type="button"
                              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.buttonDestructive}`}
                              onClick={() => {
                                setSelectedDeadline(deadline);
                                setShowDeleteDialog(true);
                              }}
                              disabled={isLoading}
                            >
                              <Trash2 style={{width: '1em', height: '1em', marginRight: '4px'}} />
                              Удалить
                            </button>
                          </div>
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

      {showCreateDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateDialog(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Создать новый дедлайн</h3>
              <p className={styles.modalDescription}>
                Заполните информацию о дедлайне и нажмите "Создать"
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label htmlFor="create-title" className={styles.formLabel}>Название дедлайна</label>
                <input
                  id="create-title"
                  className={styles.inputField}
                  placeholder="Введите название"
                  {...form.register('title')}
                  disabled={form.formState.isSubmitting}
                />
                 {form.formState.errors.title && <p className={styles.formErrorMessage}>{form.formState.errors.title.message}</p>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="create-description" className={styles.formLabel}>Описание</label>
                <textarea
                   id="create-description"
                   className={styles.textareaField}
                   placeholder="Введите описание дедлайна"
                   {...form.register('description')}
                    disabled={form.formState.isSubmitting}
                 ></textarea>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                 <div className={styles.formGroup}>
                   <label htmlFor="create-due_date" className={styles.formLabel}>Дата дедлайна</label>
                   <input
                     id="create-due_date"
                     type="date"
                     className={styles.inputField}
                     {...form.register('due_date')}
                     disabled={form.formState.isSubmitting}
                   />
                    {form.formState.errors.due_date && <p className={styles.formErrorMessage}>{form.formState.errors.due_date.message}</p>}
                 </div>

                 <div className={styles.formGroup}>
                   <label htmlFor="create-priority" className={styles.formLabel}>Приоритет</label>
                   <select
                      id="create-priority"
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

              <div className={styles.formGroup}>
                 <label className={styles.formLabel}>Группы</label>
                 <div className={styles.checkboxGroup}>
                   {groups.map(group => (
                     <div key={group.id} className={styles.checkboxItem}>
                       <input
                         type="checkbox"
                         id={`create-group-${group.id}`}
                         checked={watchedGroups?.includes(group.name) || false}
                         onChange={(e) => {
                           const updatedGroups = e.target.checked
                             ? [...(watchedGroups || []), group.name]
                             : (watchedGroups || []).filter(g => g !== group.name);
                           form.setValue('groups', updatedGroups);
                         }}
                          disabled={form.formState.isSubmitting}
                       />
                       <label htmlFor={`create-group-${group.id}`}>{group.name}</label>
                     </div>
                   ))}
                 </div>
                  {form.formState.errors.groups && <p className={styles.formErrorMessage}>{form.formState.errors.groups.message}</p>}
               </div>

              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => setShowCreateDialog(false)} disabled={form.formState.isSubmitting}>
                  Отмена
                </button>
                <button type="submit" className={styles.button} disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting ? 'Создание...' : 'Создать дедлайн'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditDialog && selectedDeadline && (
         <div className={styles.modalOverlay} onClick={() => setShowEditDialog(false)}>
           <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
             <div className={styles.modalHeader}>
               <h3 className={styles.modalTitle}>Редактировать дедлайн</h3>
               <p className={styles.modalDescription}>
                 Внесите изменения и нажмите "Сохранить"
               </p>
             </div>

             <form onSubmit={form.handleSubmit(onSubmit)} className={styles.modalForm}>
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

               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                  <div className={styles.formGroup}>
                    <label htmlFor="edit-due_date" className={styles.formLabel}>Дата дедлайна</label>
                    <input
                      id="edit-due_date"
                      type="date"
                      className={styles.inputField}
                      {...form.register('due_date')}
                       disabled={form.formState.isSubmitting}
                    />
                     {form.formState.errors.due_date && <p className={styles.formErrorMessage}>{form.formState.errors.due_date.message}</p>}
                  </div>

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

               <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Группы</label>
                  <div className={styles.checkboxGroup}>
                    {groups.map(group => (
                      <div key={group.id} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          id={`edit-group-${group.id}`}
                           checked={watchedGroups?.includes(group.name) || false}
                          onChange={(e) => {
                            const updatedGroups = e.target.checked
                              ? [...(watchedGroups || []), group.name]
                              : (watchedGroups || []).filter(g => g !== group.name);
                            form.setValue('groups', updatedGroups);
                          }}
                           disabled={form.formState.isSubmitting}
                        />
                        <label htmlFor={`edit-group-${group.id}`}>{group.name}</label>
                      </div>
                    ))}
                  </div>
                   {form.formState.errors.groups && <p className={styles.formErrorMessage}>{form.formState.errors.groups.message}</p>}
                </div>

               <div className={styles.modalFooter}>
                 <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => setShowEditDialog(false)} disabled={form.formState.isSubmitting}>
                   Отмена
                 </button>
                 <button type="submit" className={styles.button} disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

       {showDeleteDialog && selectedDeadline && (
          <div className={styles.alertDialogOverlay} onClick={() => setShowDeleteDialog(false)}>
             <div className={styles.alertDialogContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.alertDialogHeader}>
                   <h3 className={styles.alertDialogTitle}>Удалить дедлайн</h3>
                   <p className={styles.alertDialogDescription}>
                      Вы уверены, что хотите удалить дедлайн "{selectedDeadline.title}"?
                      Это действие нельзя отменить.
                   </p>
                </div>
                <div className={styles.alertDialogFooter}>
                   <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={() => setShowDeleteDialog(false)} disabled={isLoading}>Отмена</button>
                   <button
                      type="button"
                      className={`${styles.button} ${styles.buttonDestructive}`}
                       onClick={handleDeleteDeadline}
                       disabled={isLoading}
                   >
                      <Trash2 style={{width: '1em', height: '1em', marginRight: '8px'}} />
                      Удалить
                   </button>
                </div>
             </div>
          </div>
       )}

    </SidebarLayout>
  );
};

export default Schedule;