import React from 'react';
import { useAuth } from './../contexts/AuthContext';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { FileText, Users, Bell, Calendar, MessageSquare } from 'lucide-react';

import styles from './../styles/Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();

  const getStats = () => {
    if (!user) return [];

    if (user.role === 'admin') {
      return [
        { icon: FileText, label: 'Total Documents', value: '245' },
        { icon: Users, label: 'Total Users', value: '102' },
        { icon: MessageSquare, label: 'Pending Requests', value: '18' },
        { icon: Bell, label: 'Notifications', value: '7' }
      ];
    }

    if (user.role === 'curator') {
      return [
        { icon: Users, label: 'Assigned Students', value: '42' },
        { icon: FileText, label: 'Pending Documents', value: '14' },
        { icon: MessageSquare, label: 'Approval Requests', value: '8' },
        { icon: Bell, label: 'Notifications', value: '5' }
      ];
    }

    if (user.role === 'parent') {
      return [
        { icon: FileText, label: 'Documents', value: '8' },
        { icon: FileText, label: 'Pending Submissions', value: '2' },
        { icon: Bell, label: 'Notifications', value: '3' },
        { icon: Calendar, label: 'Upcoming Deadlines', value: '1' }
      ];
    }

    return [];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  const getDashboardTitle = () => {
    if (!user) return 'Главная страница';

    if (user.role === 'admin') return 'Панель администратора';
    if (user.role === 'curator') return 'Панель куратора';
    if (user.role === 'parent') return 'Личный кабинет';
    return 'Главная страница';
  };

  return (
    <SidebarLayout>
      <div className={styles.dashboardContainer}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>
            {getGreeting()}, {user?.name?.split(' ')[0]}
          </h2>
          <p className={styles.pageDescription}>{getDashboardTitle()}</p>
        </div>

        <div className={styles.statsGrid}>
          {getStats().map((stat, i) => {
            const StatIcon = stat.icon;
            return (
             <div key={i} className={styles.statItem}>
                <div className={styles.statItemHeader}>
                  <h3 className={styles.statItemTitle}>{stat.label}</h3>
                  <div className={styles.statItemIcon}>
                     <StatIcon style={{width: '1em', height: '1em'}} />
                  </div>
                </div>
                <div className={styles.statValue}>{stat.value}</div>
             </div>
            );
          })}
        </div>

        <div className={styles.sectionsGrid}>
          <div className={`${styles.sectionCard} ${styles.card} ${styles.spanMd2}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Последние активности</h3>
              <p className={styles.cardDescription}>Обзор недавних действий в системе</p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.recentActivityList}>
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className={styles.activityItem}>
                    <div className={styles.activityIconContainer}>
                      <FileText className={styles.activityIcon} />
                    </div>
                    <div className={styles.activityDetails}>
                      <p className={styles.activityTitle}>Документ обновлен</p>
                      <p className={styles.activityMeta}>
                        Документ "Заявление о приеме" был обновлен
                      </p>
                    </div>
                    <div className={styles.activityMeta}>5 мин. назад</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${styles.sectionCard} ${styles.card}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Быстрый доступ</h3>
              <p className={styles.cardDescription}>Часто используемые функции</p>
            </div>
            <div className={styles.cardContent}>
              <ul className={styles.quickAccessList}>
                <li className={styles.quickAccessItem}>
                  <FileText className={styles.quickAccessIcon} />
                  <span>Открыть документы</span>
                </li>
                <li className={styles.quickAccessItem}>
                  <Bell className={styles.quickAccessIcon} />
                  <span>Просмотреть уведомления</span>
                </li>
                <li className={styles.quickAccessItem}>
                  <Users className={styles.quickAccessIcon} />
                  <span>
                    {user?.role === 'admin' ? 'Управление группами' : 'Просмотр студентов'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className={`${styles.aiAssistantSection} ${styles.card}`}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>AI Ассистент</h3>
            <p className={styles.cardDescription}>Задайте вопрос AI ассистенту</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.aiInputArea}>
              <input
                type="text"
                placeholder="Как я могу помочь вам сегодня?"
                className={styles.aiInput}
              />
              <button type="button" className={styles.aiSendButton}>
                Отправить
              </button>
            </div>
            <div className={styles.aiResponseArea}>
              <div className={styles.aiResponseContent}>
                <div className={styles.aiAvatar}>
                  AI
                </div>
                <div style={{flexGrow: 1}}>
                  <p className={styles.aiResponseText}>
                    Здесь будут отображаться ответы от AI ассистента. Задайте свой вопрос выше.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Dashboard;