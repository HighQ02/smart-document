import React, { useState, useEffect } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Bell, Check, Users, FileText, Calendar, X, Info, Archive, Trash2 } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Notifications.module.css';

const Notifications = () => {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Новый документ требует подтверждения',
      message: 'Документ "Заявление о приеме" требует вашего подтверждения.',
      date: '21.04.2025 10:15',
      read: false,
      archived: false,
      icon: FileText
    },
    {
      id: 2,
      title: 'Дедлайн приближается',
      message: 'До завершения приема документов на первый семестр осталось 5 дней.',
      date: '20.04.2025 09:30',
      read: true,
      archived: false,
      icon: Calendar
    },
    {
      id: 3,
      title: 'Документ отклонен',
      message: 'Документ "Справка с места жительства" был отклонен. Требуется повторная загрузка.',
      date: '19.04.2025 14:45',
      read: false,
      archived: false,
      icon: FileText
    },
    {
      id: 4,
      title: 'Добавлен новый студент',
      message: 'В вашу группу добавлен новый студент "Аслан Ерболов".',
      date: '18.04.2025 11:20',
      read: true,
      archived: false,
      icon: Users
    },
    {
      id: 5,
      title: 'Система обновлена',
      message: 'Система документооборота была обновлена до версии 2.1.',
      date: '17.04.2025 16:00',
      read: true,
      archived: false,
      icon: Bell
    },
  ]);

  const [activeTab, setActiveTab] = useState('all');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationCategory, setNotificationCategory] = useState('success');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    setNotifications(updatedNotifications);
    showStatusNotification('Все уведомления отмечены как прочитанные', 'success');
  };

  const markAsRead = (id) => {
    const updatedNotifications = notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    );
    
    setNotifications(updatedNotifications);
    showStatusNotification('Уведомление отмечено как прочитанное', 'success');
  };

  const archiveNotification = (id) => {
    const updatedNotifications = notifications.map(notification => 
      notification.id === id ? { ...notification, archived: true } : notification
    );
    
    setNotifications(updatedNotifications);
    showStatusNotification('Уведомление архивировано', 'success');
  };
  
  const confirmDeleteNotification = (notification) => {
    setNotificationToDelete(notification);
    setShowDeleteModal(true);
  };
  
  const deleteNotification = () => {
    const updatedNotifications = notifications.filter(notification => 
      notification.id !== notificationToDelete.id
    );
    
    setNotifications(updatedNotifications);
    setShowDeleteModal(false);
    showStatusNotification('Уведомление удалено', 'success');
  };

  const showStatusNotification = (message, category = 'success') => {
    setNotificationMessage(message);
    setNotificationCategory(category);
    setShowNotification(true);
    
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  const filteredNotifications = notifications.filter(notification => {
    // Сначала по архивированности
    if (activeTab === 'archived' && !notification.archived) return false;
    if (activeTab !== 'archived' && notification.archived) return false;

    // Затем по категории
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'documents') return notification.icon === FileText;
    if (selectedCategory === 'calendar') return notification.icon === Calendar;
    if (selectedCategory === 'users') return notification.icon === Users;
    if (selectedCategory === 'system') return notification.icon === Bell;
    return true;
  });

  const getFilteredNotificationsForTab = (tab) => {
    if (tab === 'unread') return filteredNotifications.filter(n => !n.read);
    return filteredNotifications;
  };

  useEffect(() => {
    // Здесь в будущем можно реализовать загрузку уведомлений с сервера
  }, []);


  return (
    <SidebarLayout>
      <div className={styles.notificationsContainer}>
        <div>
          <h2 className={styles.pageTitle}>Уведомления</h2>
          <p className={styles.pageDescription}>Просмотр и управление уведомлениями</p>
        </div>

        {showNotification && (
          <div className={`${styles.statusNotification} ${styles[`notification${notificationCategory.charAt(0).toUpperCase() + notificationCategory.slice(1)}`]}`}>
            <div className={styles.notificationContent}>
              <Info className={styles.notificationIcon} />
              <span>{notificationMessage}</span>
            </div>
            <button 
              className={styles.closeNotificationButton}
              onClick={() => setShowNotification(false)}
            >
              <X style={{ width: '1em', height: '1em' }} />
            </button>
          </div>
        )}

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
                Непрочитанные
                {notifications.filter(n => !n.read && !n.archived).length > 0 && (
                  <span className={styles.tabsBadge}>
                    {notifications.filter(n => !n.read && !n.archived).length}
                  </span>
                )}
              </button>
              <button
                className={`${styles.tabsTrigger} ${activeTab === 'archived' ? styles.active : ''}`}
                onClick={() => handleTabChange('archived')}
              >
                Архив
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

            <button 
              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSm}`}
              onClick={markAllAsRead}
              disabled={notifications.every(n => n.read || n.archived) || activeTab === 'archived'}
            >
              <Check style={{ width: '1em', height: '1em', marginRight: '8px' }} />
              Отметить все как прочитанные
            </button>
          </div>

          {(activeTab === 'all' || activeTab === 'archived') && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    {activeTab === 'archived' ? 'Архивированные уведомления' : 'Все уведомления'}
                  </h3>
                  <p className={styles.cardDescription}>
                    {activeTab === 'archived' 
                      ? 'Уведомления, которые вы отправили в архив' 
                      : 'Список всех уведомлений системы'}
                  </p>
                </div>
                <div className={styles.filterCategories}>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'all' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('all')}
                  >
                    Все
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'documents' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('documents')}
                  >
                    <FileText className={styles.categoryIcon} />
                    Документы
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'calendar' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('calendar')}
                  >
                    <Calendar className={styles.categoryIcon} />
                    Сроки
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'users' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('users')}
                  >
                    <Users className={styles.categoryIcon} />
                    Пользователи
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'system' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('system')}
                  >
                    <Bell className={styles.categoryIcon} />
                    Система
                  </button>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.notificationsList}>
                    {getFilteredNotificationsForTab(activeTab).length === 0 ? (
                      <div className={styles.emptyState}>
                        <Bell style={{ width: '2em', height: '2em', opacity: 0.3 }} />
                        <p>
                          {activeTab === 'archived' 
                            ? 'У вас нет архивированных уведомлений' 
                            : 'Нет уведомлений в выбранной категории'}
                        </p>
                      </div>
                    ) : (
                      getFilteredNotificationsForTab(activeTab).map((notification) => (
                        <div
                          key={notification.id}
                          className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
                        >
                          <div className={`${styles.notificationIconContainer} ${!notification.read ? styles.notificationIconContainerUnread : ''}`}>
                            <notification.icon className={styles.icon} />
                          </div>
                          <div className={styles.notificationContent}>
                            <div className={styles.notificationHeader}>
                              <h3 className={`${styles.notificationTitle} ${!notification.read ? styles.notificationTitleUnread : ''}`}>
                                {notification.title}
                              </h3>
                              <span className={styles.notificationDate}>{notification.date}</span>
                            </div>
                            <p className={styles.notificationMessage}>{notification.message}</p>
                          </div>
                          <div className={styles.notificationActions}>
                            {!notification.read && !notification.archived && (
                              <button 
                                className={styles.markReadButton}
                                onClick={() => markAsRead(notification.id)}
                                title="Отметить как прочитанное"
                              >
                                <Check style={{ width: '1em', height: '1em' }} />
                              </button>
                            )}
                            {!notification.archived && (
                              <button 
                                className={styles.archiveButton}
                                onClick={() => archiveNotification(notification.id)}
                                title="Архивировать"
                              >
                                <Archive style={{ width: '1em', height: '1em' }} />
                              </button>
                            )}
                            {notification.archived && (
                              <button 
                                className={styles.deleteButton}
                                onClick={() => confirmDeleteNotification(notification)}
                                title="Удалить"
                              >
                                <Trash2 style={{ width: '1em', height: '1em' }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'unread' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Непрочитанные уведомления</h3>
                  <p className={styles.cardDescription}>Уведомления, требующие вашего внимания</p>
                </div>
                <div className={styles.filterCategories}>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'all' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('all')}
                  >
                    Все
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'documents' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('documents')}
                  >
                    <FileText className={styles.categoryIcon} />
                    Документы
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'calendar' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('calendar')}
                  >
                    <Calendar className={styles.categoryIcon} />
                    Сроки
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'users' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('users')}
                  >
                    <Users className={styles.categoryIcon} />
                    Пользователи
                  </button>
                  <button 
                    className={`${styles.categoryButton} ${selectedCategory === 'system' ? styles.categoryActive : ''}`}
                    onClick={() => handleCategoryChange('system')}
                  >
                    <Bell className={styles.categoryIcon} />
                    Система
                  </button>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.notificationsList}>
                    {getFilteredNotificationsForTab('unread').length === 0 ? (
                      <div className={styles.emptyState}>
                        <Bell style={{ width: '2em', height: '2em', opacity: 0.3 }} />
                        <p>У вас нет непрочитанных уведомлений в выбранной категории</p>
                      </div>
                    ) : (
                      getFilteredNotificationsForTab('unread').map((notification) => (
                        <div
                          key={notification.id}
                          className={`${styles.notificationItem} ${styles.notificationItemUnread}`}
                        >
                          <div className={`${styles.notificationIconContainer} ${styles.notificationIconContainerUnread}`}>
                            <notification.icon className={styles.icon} />
                          </div>
                          <div className={styles.notificationContent}>
                            <div className={styles.notificationHeader}>
                              <h3 className={`${styles.notificationTitle} ${styles.notificationTitleUnread}`}>{notification.title}</h3>
                              <span className={styles.notificationDate}>{notification.date}</span>
                            </div>
                            <p className={styles.notificationMessage}>{notification.message}</p>
                          </div>
                          <button 
                            className={styles.markReadButton}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check style={{ width: '1em', height: '1em' }} />
                          </button>
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
                  <form className={styles.formSpaceY}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Получатели</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonRounded} ${styles.buttonSm}`}>Все пользователи</button>
                        <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonRounded} ${styles.buttonSm}`}>Кураторы</button>
                        <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonRounded} ${styles.buttonSm}`}>Родители</button>
                        <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonRounded} ${styles.buttonSm}`}>Группа 101</button>
                        <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonRounded} ${styles.buttonSm}`}>Группа 102</button>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Заголовок</label>
                      <input type="text" className={styles.inputField} placeholder="Введите заголовок уведомления" />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Сообщение</label>
                      <textarea className={styles.textareaField} placeholder="Введите текст уведомления" rows={4}></textarea>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Тип уведомления</label>
                      <div className={styles.radioGroup}>
                        <div className={styles.radioOption}>
                          <input
                            type="radio"
                            id="info"
                            name="notificationType"
                            defaultChecked
                          />
                          <label htmlFor="info">Информация</label>
                        </div>

                        <div className={styles.radioOption}>
                          <input
                            type="radio"
                            id="warning"
                            name="notificationType"
                          />
                          <label htmlFor="warning">Предупреждение</label>
                        </div>

                        <div className={styles.radioOption}>
                          <input
                            type="radio"
                            id="urgent"
                            name="notificationType"
                          />
                          <label htmlFor="urgent">Срочно</label>
                        </div>
                      </div>
                    </div>

                    <div className={styles.buttonGroupHorizontal}>
                      <button type="submit" className={styles.button}>Отправить уведомление</button>
                      <button type="button" className={`${styles.button} ${styles.buttonOutline}`}>Отмена</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>

        {showDeleteModal && notificationToDelete && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Подтверждение удаления</h3>
              </div>
              <div className={styles.modalBody}>
                <p>Вы уверены, что хотите удалить уведомление "{notificationToDelete.title}"?</p>
                <p className={styles.modalWarning}>Это действие нельзя будет отменить.</p>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setNotificationToDelete(null);
                  }}
                >
                  Отмена
                </button>
                <button 
                  className={styles.deleteConfirmButton}
                  onClick={deleteNotification}
                >
                  <Trash2 style={{ width: '1em', height: '1em', marginRight: '6px' }} />
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
};

export default Notifications;