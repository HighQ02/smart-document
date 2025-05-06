import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Импортируем axios напрямую
import SidebarLayout from './../components/layouts/SidebarLayout'; // Убедитесь, что путь правильный
import { Bell, Check, Users, FileText, Calendar, Info, AlertTriangle, CircleAlert, ChevronDown } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext'; // Убедитесь, что путь правильный
import styles from './../styles/Notifications.module.css'; // Убедитесь, что путь правильный


// Предполагаемые иконки для типов уведомлений из Lucide React
const typeIcons = {
    system: Bell,
    document: FileText,
    request: Users,
    deadline: Calendar,
    general: Info,
    info: Info,
    warning: AlertTriangle,
    urgent: CircleAlert
};

// Функция для получения компонента иконки по типу
const getNotificationIcon = (type) => {
    const iconKey = typeIcons[type] ? type : (['info', 'warning', 'urgent'].includes(type) ? type : 'general');
    const IconComponent = typeIcons[iconKey] || Bell;
    return <IconComponent className={styles.icon} />;
};


const Notifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true); // Общий статус загрузки (уведомлений или опций для формы)
    const [error, setError] = useState(null);
    const [totalUnread, setTotalUnread] = useState(0);

    const [createForm, setCreateForm] = useState({
        title: '',
        message: '',
        type: 'general'
    });

    // Состояние для управления выбором получателей в форме создания
    const [recipientTarget, setRecipientTarget] = useState('all_users'); // 'all_users', 'group'
    const [selectedGroup, setSelectedGroup] = useState(''); // ID выбранной группы
    const [groupRecipientRole, setGroupRecipientRole] = useState(''); // 'curators', 'parents', 'students'
    // Новое состояние для выбранных КОНКРЕТНЫХ пользователей (ID)
    const [selectedIndividualRecipientIds, setSelectedIndividualRecipientIds] = useState([]);
    const [resolvedRecipientCriteria, setResolvedRecipientCriteria] = useState([]); // Финальный массив критериев для отправки на бэкенд

    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroupMembers, setSelectedGroupMembers] = useState({
        curators: [],
        parents: [],
        students: []
    });
    const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);


    const fetchNotifications = useCallback(async (statusFilter = 'all') => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const params = { status: statusFilter };
            const response = await axios.get('/api/notifications', { params });
            setNotifications(response.data.items);
            const unreadResponse = await axios.get('/api/notifications', { params: { status: 'unread' } });
            setTotalUnread(unreadResponse.data.items.length);
        } catch (err) {
            console.error("Error fetching notifications:", err);
            setError('Не удалось загрузить уведомления.');
            setNotifications([]);
            setTotalUnread(0);
        } finally {
            setLoading(false);
        }
    }, [user]);

     const fetchAvailableGroups = useCallback(async () => {
        if (user?.role !== 'admin') return;
        setLoading(true);
        try {
            const response = await axios.get('/api/groups');
            if (Array.isArray(response.data)) {
                 setAvailableGroups(response.data);
            } else {
                 console.error("Error fetching groups: Invalid data format", response.data);
                 setAvailableGroups([]);
            }
        } catch (err) {
             console.error("Error fetching available groups:", err);
             setAvailableGroups([]);
        } finally {
             setLoading(false);
        }
     }, [user]);

    const fetchGroupMembers = useCallback(async (groupId) => {
        setLoadingGroupMembers(true);
        setSelectedGroupMembers({ curators: [], parents: [], students: [] });
         // Сбрасываем выбранных индивидуальных получателей при загрузке новых членов
        setSelectedIndividualRecipientIds([]);
        try {
            const response = await axios.get(`/api/groups/${groupId}/members`);
            if (response.data && typeof response.data === 'object') {
                setSelectedGroupMembers({
                    curators: Array.isArray(response.data.curators) ? response.data.curators : [],
                    parents: Array.isArray(response.data.parents) ? response.data.parents : [],
                    students: Array.isArray(response.data.students) ? response.data.students : []
                });
            } else {
                console.error("Error fetching group members: Invalid data format", response.data);
                setSelectedGroupMembers({ curators: [], parents: [], students: [] });
            }
        } catch (err) {
            console.error(`Error fetching members for group ${groupId}:`, err);
            // setError('Не удалось загрузить членов группы.'); // TODO: Отображать ошибку загрузки членов
            setSelectedGroupMembers({ curators: [], parents: [], students: [] });
        } finally {
            setLoadingGroupMembers(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'create') {
             const statusFilter = activeTab === 'unread' ? 'unread' : 'all';
             fetchNotifications(statusFilter);
        } else {
             if (user?.role === 'admin') {
                fetchAvailableGroups();
             }
        }
    }, [user, activeTab, fetchNotifications, fetchAvailableGroups]);

    useEffect(() => {
        if (recipientTarget === 'group' && selectedGroup && user?.role === 'admin') {
            fetchGroupMembers(selectedGroup);
        } else {
            setSelectedGroupMembers({ curators: [], parents: [], students: [] });
            setLoadingGroupMembers(false);
            setSelectedIndividualRecipientIds([]); // Сбрасываем при смене группы или типа
        }
    }, [recipientTarget, selectedGroup, user, fetchGroupMembers]);

    // Логика определения финального массива критериев для отправки на бэкенд
    useEffect(() => {
        let criteriaArray = [];
        if (recipientTarget === 'all_users') {
            criteriaArray = ['all_users'];
        } else if (recipientTarget === 'group' && selectedGroup && groupRecipientRole) {
            // Если выбраны конкретные пользователи И выбрана роль Студенты или Родители
            if (selectedIndividualRecipientIds.length > 0 && (groupRecipientRole === 'students' || groupRecipientRole === 'parents')) {
                 // Отправляем список конкретных ID пользователей
                 criteriaArray = selectedIndividualRecipientIds.map(id => `user:${id}`);
            } else {
                // Иначе отправляем критерий группы/роли (Все Кураторы, Все Студенты/Родители группы)
                criteriaArray = [`group:${selectedGroup}:${groupRecipientRole}`];
            }
        }

        // Если выбраны "По группе", но не выбрана группа или роль,
        // или если выбраны студенты/родители, но список членов пуст после загрузки,
        // или если выбраны индивидуально, но selectedIndividualRecipientIds пуст
        // criteriaArray может оказаться пуст, и это правильно - кнопка будет неактивна.

        setResolvedRecipientCriteria(criteriaArray);

    }, [recipientTarget, selectedGroup, groupRecipientRole, selectedIndividualRecipientIds]);


    const handleTabChange = (tabValue) => {
        setActiveTab(tabValue);
         if (tabValue === 'create') {
             setCreateForm({ title: '', message: '', type: 'general' });
             setRecipientTarget('all_users');
             setSelectedGroup('');
             setGroupRecipientRole('');
             setSelectedIndividualRecipientIds([]); // Сбрасываем выбранных индивидуальных
             setResolvedRecipientCriteria(['all_users']);
             setSelectedGroupMembers({ curators: [], parents: [], students: [] });
             setLoadingGroupMembers(false);
        }
         if (activeTab === 'create' && tabValue !== 'create') {
             setCreateForm({ title: '', message: '', type: 'general' });
             setRecipientTarget('all_users');
             setSelectedGroup('');
             setGroupRecipientRole('');
             setSelectedIndividualRecipientIds([]); // Сбрасываем выбранных индивидуальных
             setResolvedRecipientCriteria([]);
             setSelectedGroupMembers({ curators: [], parents: [], students: [] });
             setLoadingGroupMembers(false);
         }
    };

    // Обработчик отметки одного уведомления как прочитанного
    const handleMarkAsRead = async (id) => {
        try {
             // Оптимистичное обновление UI
             setNotifications(prevNotifications =>
                 prevNotifications.map(notif =>
                     notif.id === id ? { ...notif, read: true } : notif
                 )
             );
             setTotalUnread(prev => Math.max(0, prev - 1)); // Уменьшаем счетчик

            // Вызов API
            await axios.put(`/api/notifications/${id}/read`);

            // Опционально: Перезагрузить уведомления после успешного обновления для полной синхронизации
            // fetchNotifications(activeTab === 'unread' ? 'unread' : 'all');

        } catch (err) {
            console.error(`Error marking notification ${id} as read:`, err);
             setError('Не удалось отметить уведомление как прочитанное.');
             // В случае ошибки, можно откатить оптимистичное обновление или просто перезагрузить данные
             fetchNotifications(activeTab === 'unread' ? 'unread' : 'all');
        }
    };

    // Обработчик отметки всех непрочитанных уведомлений как прочитанных
    const handleMarkAllAsRead = async () => {
        try {
             // Оптимистичное обновление UI
             setNotifications(prevNotifications =>
                 prevNotifications.map(notif => ({ ...notif, read: true }))
             );
             setTotalUnread(0); // Сбрасываем счетчик

            // Вызов API
            await axios.put('/api/notifications/mark-all-read');

            // Перезагрузить уведомления после успешной отметки всех (обычно на вкладку "Все")
             fetchNotifications('all');

        } catch (err) {
            console.error('Error marking all notifications as read:', err);
            setError('Не удалось отметить все уведомления как прочитанные.');
            // В случае ошибки
            fetchNotifications(activeTab === 'unread' ? 'unread' : 'all');
        }
    };

    const handleCreateFormChange = (e) => {
        const { name, value } = e.target;
        setCreateForm({
            ...createForm,
            [name]: value
        });
    };

    const handleRecipientTargetChange = (e) => {
        setRecipientTarget(e.target.value);
        setSelectedGroup('');
        setGroupRecipientRole('');
        setSelectedIndividualRecipientIds([]); // Сбрасываем индивидуальный выбор
    };

    const handleGroupSelectChange = (e) => {
        setSelectedGroup(e.target.value);
        setGroupRecipientRole('');
        setSelectedIndividualRecipientIds([]); // Сбрасываем индивидуальный выбор
    };

    const handleGroupRecipientRoleChange = (e) => {
        setGroupRecipientRole(e.target.value);
        setSelectedIndividualRecipientIds([]); // Сбрасываем индивидуальный выбор при смене роли
    };

    // НОВАЯ ЛОГИКА: Обработчик выбора/снятия выбора конкретного пользователя из списка
    const handleIndividualRecipientSelect = (userId) => {
        setSelectedIndividualRecipientIds(prevSelectedIds => {
            if (prevSelectedIds.includes(userId)) {
                // Если уже выбран, убираем
                return prevSelectedIds.filter(id => id !== userId);
            } else {
                // Если не выбран, добавляем
                return [...prevSelectedIds, userId];
            }
        });
        // resolvedRecipientCriteria обновится через useEffect
    };


    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!createForm.title.trim() || !createForm.message.trim() || resolvedRecipientCriteria.length === 0) {
            alert('Пожалуйста, заполните заголовок, сообщение и выберите хотя бы одного получателя.');
            return;
        }
        // TODO: Добавить состояние загрузки для самой формы отправки
        // setIsLoading(true);
        try {
            const notificationData = {
                 ...createForm,
                 recipients: resolvedRecipientCriteria, // Отправляем финальный массив критериев
            };

            const response = await axios.post('/api/notifications', notificationData);
            console.log('Notification creation response:', response.data);
            alert(response.data.message || `Уведомление успешно отправлено для ${response.data.createdCount || 'нескольких'} пользователей.`);
            setCreateForm({ title: '', message: '', type: 'general' });
            setRecipientTarget('all_users');
            setSelectedGroup('');
            setGroupRecipientRole('');
            setSelectedIndividualRecipientIds([]); // Сбрасываем выбранных индивидуальных
            setResolvedRecipientCriteria(['all_users']);
            setSelectedGroupMembers({ curators: [], parents: [], students: [] });
            setLoadingGroupMembers(false);
            setActiveTab('all');
        } catch (err) {
            console.error("Error creating notification:", err);
            const errorMessage = err.response?.data?.message || 'Произошла ошибка при отправке уведомления.';
            setError(errorMessage);
            alert(`Ошибка: ${errorMessage}`);
        } finally {
            // TODO: Отключить состояние loading формы
            // setIsLoading(false);
        }
    };

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(notif => !notif.read)
        : notifications;

    // Определяем, должна ли кнопка отправки быть активной
    const isSubmitDisabled = !createForm.title.trim() || !createForm.message.trim() || resolvedRecipientCriteria.length === 0 || (activeTab === 'create' && loading);


    return (
        <SidebarLayout>
            <div className={styles.notificationsContainer}>
                <div>
                    <h2 className={styles.pageTitle}>Уведомления</h2>
                    <p className={styles.pageDescription}>Просмотр и управление уведомлениями</p>
                </div>

                <div className={styles.tabsContainer}>
                    <div className={styles.tabsHeader}>
                        <div className={styles.tabsList}>
                            <button
                                className={`${styles.tabsTrigger} ${activeTab === 'all' ? styles.active : ''}`}
                                onClick={() => handleTabChange('all')}
                            >
                                Все
                            </button>
                            <button
                                className={`${styles.tabsTrigger} ${activeTab === 'unread' ? styles.active : ''}`}
                                onClick={() => handleTabChange('unread')}
                            >
                                Непрочитанные {totalUnread > 0 && `(${totalUnread})`}
                            </button>
                            {user?.role === 'admin' && (
                                <button
                                    className={`${styles.tabsTrigger} ${activeTab === 'create' ? styles.active : ''}`}
                                    onClick={() => handleTabChange('create')}
                                >
                                    Создать уведомление
                                </button>
                            )}
                        </div>

                        {activeTab !== 'create' && (
                             <button
                                className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSm}`}
                                onClick={handleMarkAllAsRead}
                                disabled={totalUnread === 0 || loading}
                             >
                                <Check style={{ width: '1em', height: '1em', marginRight: '8px' }} />
                                Отметить все как прочитанные
                            </button>
                        )}
                    </div>

                     {loading && activeTab !== 'create' && <p>Загрузка уведомлений...</p>}
                     {error && <p style={{ color: 'red' }}>{error}</p>}

                     {!loading && !error && activeTab !== 'create' && (
                         <div className={styles.tabsContent}>
                             <div className={styles.card}>
                                 <div className={styles.cardHeader}>
                                     <h3 className={styles.cardTitle}>
                                         {activeTab === 'all' ? 'Все уведомления' : 'Непрочитанные уведомления'}
                                     </h3>
                                     <p className={styles.cardDescription}>
                                         {activeTab === 'all' ? 'Список всех уведомлений системы' : 'Уведомления, требующие вашего внимания'}
                                     </p>
                                 </div>
                                 <div className={styles.cardContent}>
                                     <div className={styles.notificationsList}>
                                         {filteredNotifications.length === 0 ? (
                                             <p>{activeTab === 'all' ? 'Уведомлений пока нет.' : 'У вас нет непрочитанных уведомлений.'}</p>
                                         ) : (
                                             filteredNotifications.map((notification) => (
                                                 <div
                                                     key={notification.id}
                                                     className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
                                                 >
                                                     <div className={`${styles.notificationIconContainer} ${!notification.read ? styles.notificationIconContainerUnread : ''}`}>
                                                         {getNotificationIcon(notification.type)}
                                                     </div>
                                                     <div className={styles.notificationContent}>
                                                         <div className={styles.notificationHeader}>
                                                              <h3 className={`${styles.notificationTitle} ${!notification.read ? styles.notificationTitleUnread : ''}`}>
                                                                {notification.title}
                                                             </h3>
                                                             <span className={styles.notificationDate}>
                                                                 {new Date(notification.date).toLocaleString('ru-RU', {
                                                                     year: 'numeric',
                                                                     month: '2-digit',
                                                                     day: '2-digit',
                                                                     hour: '2-digit',
                                                                     minute: '2-digit'
                                                                 })}
                                                              </span>
                                                         </div>
                                                         <p className={styles.notificationMessage}>{notification.message}</p>
                                                     </div>
                                                     {!notification.read && (
                                                         <button
                                                              className={styles.markReadButton}
                                                              onClick={() => handleMarkAsRead(notification.id)}
                                                              title="Отметить как прочитанное"
                                                         >
                                                             <Check style={{ width: '1em', height: '1em' }} />
                                                         </button>
                                                     )}
                                                 </div>
                                             ))
                                         )}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     )}


                    {user?.role === 'admin' && activeTab === 'create' && (
                        <div className={styles.tabsContent}>
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>Создать уведомление</h3>
                                    <p className={styles.cardDescription}>Отправка уведомления пользователям системы</p>
                                </div>
                                <div className={styles.cardContent}>
                                    <form className={styles.formSpaceY} onSubmit={handleCreateSubmit}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Получатели</label>

                                             {/* Шаг 1: Выбор основного типа получателя */}
                                            <div className={styles.radioGroup}>
                                                <div className={styles.radioOption}>
                                                    <input
                                                        type="radio"
                                                        id="recipient_all"
                                                        name="recipientTarget"
                                                        value="all_users"
                                                        checked={recipientTarget === 'all_users'}
                                                        onChange={handleRecipientTargetChange}
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="recipient_all">Все пользователи</label>
                                                </div>
                                                <div className={styles.radioOption}>
                                                    <input
                                                        type="radio"
                                                        id="recipient_group"
                                                        name="recipientTarget"
                                                        value="group"
                                                        checked={recipientTarget === 'group'}
                                                        onChange={handleRecipientTargetChange}
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="recipient_group">По группе</label>
                                                </div>
                                            </div>

                                             {/* Шаг 2: Выбор конкретной группы (если выбран тип "По группе") */}
                                             {recipientTarget === 'group' && (
                                                <>
                                                    <label className={styles.formLabel} htmlFor="group-select">Выберите группу</label>
                                                    <select
                                                         id="group-select"
                                                         className={styles.selectInput}
                                                         value={selectedGroup}
                                                         onChange={handleGroupSelectChange}
                                                         disabled={availableGroups.length === 0 || loadingGroupMembers || loading}
                                                    >
                                                         <option value="">Выберите группу</option>
                                                         {availableGroups.map(group => (
                                                             <option key={group.id} value={group.id}>
                                                                 {group.name}
                                                             </option>
                                                         ))}
                                                    </select>
                                                    {availableGroups.length === 0 && !loading && <p className={styles.formInfoMessage}>Нет доступных групп.</p>}
                                                    {loading && <p className={styles.formInfoMessage}>Загрузка групп...</p>}
                                                </>
                                             )}

                                             {/* Шаг 3: Выбор роли внутри группы (если выбрана группа) */}
                                             {recipientTarget === 'group' && selectedGroup && (
                                                 <>
                                                    <label className={styles.formLabel} htmlFor="group-role-select">Выберите роль в группе</label>
                                                    <select
                                                         id="group-role-select"
                                                         className={styles.selectInput}
                                                         value={groupRecipientRole}
                                                         onChange={handleGroupRecipientRoleChange}
                                                         disabled={loadingGroupMembers || loading}
                                                    >
                                                         <option value="">Выберите роль в группе</option>
                                                         <option value="curators">Все кураторы</option>
                                                         <option value="parents">Все родители</option>
                                                         <option value="students">Все студенты</option>
                                                    </select>
                                                 </>
                                             )}

                                            {/* Отображение списка членов выбранной группы (ТЕПЕРЬ ИНТЕРАКТИВНЫЙ) */}
                                             {recipientTarget === 'group' && selectedGroup && groupRecipientRole && ( // Отображаем список, только если выбраны Группа И Роль в группе
                                                 <div className={styles.groupMembersList}>
                                                     {loadingGroupMembers ? (
                                                        <p>Загрузка списка членов группы...</p>
                                                     ) : (
                                                        <>
                                                             <h4>Выберите {groupRecipientRole === 'curators' ? 'куратора' : groupRecipientRole === 'parents' ? 'родителей' : 'студентов'} в группе ({availableGroups.find(g => g.id === parseInt(selectedGroup))?.name}):</h4>

                                                             {/* Здесь рендерим списки в зависимости от выбранной роли */}
                                                             {groupRecipientRole === 'curators' && ( // Кураторов обычно один или несколько, показываем их
                                                                 selectedGroupMembers.curators.length > 0 ? (
                                                                     <ul className={styles.linkedList}> {/* Используем linkedList для единообразия */}
                                                                         {selectedGroupMembers.curators.map(member => (
                                                                             <li
                                                                                 key={`curator-${member.id}`}
                                                                                 className={`${styles.selectableListItem} ${selectedIndividualRecipientIds.includes(member.id) ? styles.selectedListItem : ''}`}
                                                                                 onClick={() => handleIndividualRecipientSelect(member.id)}
                                                                             >
                                                                                  {/* Чекбокс или другой индикатор выбора */}
                                                                                  <input
                                                                                     type="checkbox"
                                                                                     checked={selectedIndividualRecipientIds.includes(member.id)}
                                                                                     onChange={() => handleIndividualRecipientSelect(member.id)} // Привязываем к onChange для доступности
                                                                                     onClick={(e) => e.stopPropagation()} // Останавливаем всплытие, чтобы клик по li тоже работал
                                                                                  />
                                                                                 {member.name}
                                                                             </li>
                                                                         ))}
                                                                     </ul>
                                                                 ) : (
                                                                     <p>Нет кураторов в этой группе.</p>
                                                                 )
                                                             )}

                                                              {groupRecipientRole === 'parents' && ( // Родители
                                                                 selectedGroupMembers.parents.length > 0 ? (
                                                                     <ul className={styles.linkedList}>
                                                                         {selectedGroupMembers.parents.map(member => (
                                                                              <li
                                                                                 key={`parent-${member.id}`}
                                                                                 className={`${styles.selectableListItem} ${selectedIndividualRecipientIds.includes(member.id) ? styles.selectedListItem : ''}`}
                                                                                 onClick={() => handleIndividualRecipientSelect(member.id)}
                                                                             >
                                                                                  <input
                                                                                     type="checkbox"
                                                                                     checked={selectedIndividualRecipientIds.includes(member.id)}
                                                                                     onChange={() => handleIndividualRecipientSelect(member.id)}
                                                                                     onClick={(e) => e.stopPropagation()}
                                                                                  />
                                                                                 {member.name}
                                                                                 {member.student_name && <span className={styles.relatedInfo}>(Студент: {member.student_name})</span>}
                                                                             </li>
                                                                         ))}
                                                                     </ul>
                                                                 ) : (
                                                                     <p>Нет родителей у студентов этой группы.</p>
                                                                 )
                                                              )}

                                                              {groupRecipientRole === 'students' && ( // Студенты
                                                                 selectedGroupMembers.students.length > 0 ? (
                                                                     <ul className={styles.linkedList}>
                                                                         {selectedGroupMembers.students.map(member => (
                                                                             <li
                                                                                 key={`student-${member.id}`}
                                                                                  className={`${styles.selectableListItem} ${selectedIndividualRecipientIds.includes(member.id) ? styles.selectedListItem : ''}`}
                                                                                 onClick={() => handleIndividualRecipientSelect(member.id)}
                                                                             >
                                                                                  <input
                                                                                     type="checkbox"
                                                                                     checked={selectedIndividualRecipientIds.includes(member.id)}
                                                                                     onChange={() => handleIndividualRecipientSelect(member.id)}
                                                                                     onClick={(e) => e.stopPropagation()}
                                                                                  />
                                                                                 {member.name}
                                                                                 {member.parent_name && <span className={styles.relatedInfo}>(Родитель: {member.parent_name})</span>}
                                                                             </li>
                                                                         ))}
                                                                     </ul>
                                                                 ) : (
                                                                     <p>Нет студентов в этой группе.</p>
                                                                 )
                                                              )}
                                                              {/* Сообщение, если ни одна роль не выбрана, но группа выбрана */}
                                                              {!groupRecipientRole && <p>Выберите роль в группе выше.</p>}
                                                        </>
                                                     )}
                                                      {/* Инструкция по выбору */}
                                                       {(selectedGroupMembers.curators.length > 0 || selectedGroupMembers.parents.length > 0 || selectedGroupMembers.students.length > 0) && groupRecipientRole && (
                                                           <p className={styles.formInfoMessage}>
                                                               Выберите конкретных {groupRecipientRole === 'curators' ? 'кураторов' : groupRecipientRole === 'parents' ? 'родителей' : 'студентов'} из списка.
                                                               Если никого не выбрать, уведомление будет отправлено {groupRecipientRole === 'curators' ? 'всем кураторам' : groupRecipientRole === 'parents' ? 'всем родителям' : 'всем студентам'} в этой группе.
                                                           </p>
                                                       )}
                                                 </div>
                                              )}


                                            {/* Сообщение об ошибке или необходимости выбора */}
                                            {resolvedRecipientCriteria.length === 0 && (
                                                <p style={{ color: 'orange', fontSize: '0.8em', marginTop: '4px' }}>
                                                     {recipientTarget === 'all_users' ? 'Выберите тип получателя.' : (selectedGroup ? (groupRecipientRole ? 'Выберите получателей.' : 'Выберите роль в группе.') : 'Выберите группу.')}
                                                </p>
                                             )}

                                        </div>

                                        {/* Поля Заголовок, Сообщение, Тип уведомления */}
                                        <div className={styles.formGroup}>
                                            <label htmlFor="title" className={styles.formLabel}>Заголовок</label>
                                            <input
                                                id="title"
                                                name="title"
                                                type="text"
                                                className={styles.inputField}
                                                placeholder="Введите заголовок уведомления"
                                                value={createForm.title}
                                                onChange={handleCreateFormChange}
                                                required
                                                disabled={loading}
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label htmlFor="message" className={styles.formLabel}>Сообщение</label>
                                            <textarea
                                                id="message"
                                                name="message"
                                                className={styles.textareaField}
                                                placeholder="Введите текст уведомления"
                                                rows={4}
                                                value={createForm.message}
                                                onChange={handleCreateFormChange}
                                                required
                                                disabled={loading}
                                            ></textarea>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Тип уведомления</label>
                                            <div className={styles.radioGroup}>
                                                <div className={styles.radioOption}>
                                                    <input
                                                        type="radio"
                                                        id="type_general"
                                                        name="type"
                                                        value="general"
                                                        checked={createForm.type === 'general'}
                                                        onChange={handleCreateFormChange}
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="type_general">Информация</label>
                                                </div>

                                                <div className={styles.radioOption}>
                                                    <input
                                                        type="radio"
                                                        id="type_warning"
                                                        name="type"
                                                        value="warning"
                                                        checked={createForm.type === 'warning'}
                                                        onChange={handleCreateFormChange}
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="type_warning">Предупреждение</label>
                                                </div>

                                                <div className={styles.radioOption}>
                                                    <input
                                                        type="radio"
                                                        id="type_urgent"
                                                        name="type"
                                                        value="urgent"
                                                        checked={createForm.type === 'urgent'}
                                                        onChange={handleCreateFormChange}
                                                        disabled={loading}
                                                    />
                                                    <label htmlFor="type_urgent">Срочно</label>
                                                </div>
                                            </div>
                                        </div>


                                        {/* Кнопки Отправить, Отмена */}
                                         <div className={styles.buttonGroupHorizontal}>
                                            <button
                                                type="submit"
                                                className={styles.button}
                                                disabled={isSubmitDisabled}
                                            >Отправить уведомление</button>
                                            <button
                                                 type="button"
                                                 className={`${styles.button} ${styles.buttonOutline}`}
                                                onClick={() => {
                                                    setCreateForm({ title: '', message: '', type: 'general' });
                                                    setRecipientTarget('all_users');
                                                    setSelectedGroup('');
                                                    setGroupRecipientRole('');
                                                    setSelectedIndividualRecipientIds([]); // Сбрасываем выбранных индивидуальных
                                                    setResolvedRecipientCriteria(['all_users']);
                                                     setSelectedGroupMembers({ curators: [], parents: [], students: [] });
                                                    setLoadingGroupMembers(false);
                                                    setActiveTab('all');
                                                }}
                                                disabled={loading}
                                            >Отмена</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SidebarLayout>
    );
};

export default Notifications;