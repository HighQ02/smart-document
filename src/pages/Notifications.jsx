import React, { useState } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Bell, Check, Users, FileText, Calendar } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Notifications.module.css';

const Notifications = () => {
  const { user } = useAuth();

  const notifications = [
    {
      id: 1,
      title: 'Новый документ требует подтверждения',
      message: 'Документ "Заявление о приеме" требует вашего подтверждения.',
      date: '21.04.2025 10:15',
      read: false,
      icon: FileText
    },
    {
      id: 2,
      title: 'Дедлайн приближается',
      message: 'До завершения приема документов на первый семестр осталось 5 дней.',
      date: '20.04.2025 09:30',
      read: true,
      icon: Calendar
    },
    {
      id: 3,
      title: 'Документ отклонен',
      message: 'Документ "Справка с места жительства" был отклонен. Требуется повторная загрузка.',
      date: '19.04.2025 14:45',
      read: false,
      icon: FileText
    },
    {
      id: 4,
      title: 'Добавлен новый студент',
      message: 'В вашу группу добавлен новый студент "Аслан Ерболов".',
      date: '18.04.2025 11:20',
      read: true,
      icon: Users
    },
    {
      id: 5,
      title: 'Система обновлена',
      message: 'Система документооборота была обновлена до версии 2.1.',
      date: '17.04.2025 16:00',
      read: true,
      icon: Bell
    },
  ];

  const [activeTab, setActiveTab] = useState('all');

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };


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
                Непрочитанные
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

            <button className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSm}`}>
              <Check style={{ width: '1em', height: '1em', marginRight: '8px' }} />
              Отметить все как прочитанные
            </button>
          </div>

          {activeTab === 'all' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Все уведомления</h3>
                  <p className={styles.cardDescription}>Список всех уведомлений системы</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.notificationsList}>
                    {notifications.map((notification) => (
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
                        {!notification.read && (
                          <button className={styles.markReadButton}>
                            <Check style={{ width: '1em', height: '1em' }} />
                          </button>
                        )}
                      </div>
                    ))}
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
                <div className={styles.cardContent}>
                  <div className={styles.notificationsList}>
                    {notifications
                      .filter(notification => !notification.read)
                      .map((notification) => (
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
                          <button className={styles.markReadButton}>
                            <Check style={{ width: '1em', height: '1em' }} />
                          </button>
                        </div>
                      ))}
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
      </div>
    </SidebarLayout>
  );
};

export default Notifications;