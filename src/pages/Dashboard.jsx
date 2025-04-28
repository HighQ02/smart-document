import React, { useState, useEffect } from 'react';
import { useAuth } from './../contexts/AuthContext';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { FileText, Users, Bell, Calendar, MessageSquare } from 'lucide-react';
import axios from 'axios';

import styles from './../styles/Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.role) {
        setStats(null);
        setIsLoadingStats(false);
        return;
      }

      setIsLoadingStats(true);
      try {
        let fetchedStats = {};

        if (user.role === 'admin') {
          const [docsResponse, usersResponse, requestsResponse] = await Promise.all([
            axios.get('/api/documents'),
            axios.get('/api/users'),
            axios.get('/api/requests', { params: { status: 'new' } }), // Assuming 'new' is pending in requests
          ]);

          fetchedStats = {
            totalDocuments: docsResponse.data.length,
            totalUsers: usersResponse.data.length,
            pendingRequests: requestsResponse.data.length,
            // Notifications count is still hardcoded or needs another endpoint
            notifications: 7,
          };
        } else if (user.role === 'curator') {
          // Curator needs counts for their groups/students
          // Assuming '/api/documents' and '/api/requests' automatically filter based on user role via JWT
          // Assigned Students count is complex without a specific endpoint, mocking for now
          const [docsResponse, requestsResponse] = await Promise.all([
             axios.get('/api/documents'), // Assuming this fetches docs for curator's students/groups
             axios.get('/api/requests', { params: { status: 'new' } }), // Assuming this fetches requests for curator's students/groups
          ]);

          // Need to filter documents by status 'pending' on frontend as backend may return all
          const pendingDocs = docsResponse.data.filter(doc => doc.status === 'pending');

          fetchedStats = {
            // Assigned Students count needs backend endpoint or mock
            assignedStudents: 42, // Mocked
            pendingDocuments: pendingDocs.length,
            approvalRequests: requestsResponse.data.length, // Assuming requests = approval requests for curator
            notifications: 5, // Mocked
          };
        } else if (user.role === 'parent') {
             // Parent needs counts for their children's documents
             // Assuming '/api/documents' automatically filters based on user role via JWT
             // Upcoming Deadlines is still hardcoded or needs another endpoint
             const docsResponse = await axios.get('/api/documents');

             const pendingSubmissions = docsResponse.data.filter(doc => doc.status === 'pending'); // Assuming pending is pending submission for parent

             fetchedStats = {
               documents: docsResponse.data.length,
               pendingSubmissions: pendingSubmissions.length,
               notifications: 3, // Mocked
               upcomingDeadlines: 1, // Mocked - Needs Schedule data API
             };
        }

        setStats(fetchedStats);

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setStats({}); // Set to empty object on error
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.role]); // Refetch stats when user role changes


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

  const renderStats = () => {
      if (isLoadingStats) {
          return (
              <div className={styles.loadingText}>
                  <p>Загрузка статистики...</p>
              </div>
          );
      }

      if (!stats || Object.keys(stats).length === 0) {
           return (
              <div className={styles.loadingText}>
                  <p>Не удалось загрузить статистику.</p>
              </div>
           );
      }

      // Define stats mapping based on fetched keys
      const statsMapping = {
          admin: [
              { icon: FileText, label: 'Total Documents', value: stats.totalDocuments },
              { icon: Users, label: 'Total Users', value: stats.totalUsers },
              { icon: MessageSquare, label: 'Pending Requests', value: stats.pendingRequests },
              { icon: Bell, label: 'Notifications', value: stats.notifications }
          ],
          curator: [
              { icon: Users, label: 'Assigned Students', value: stats.assignedStudents },
              { icon: FileText, label: 'Pending Documents', value: stats.pendingDocuments },
              { icon: MessageSquare, label: 'Approval Requests', value: stats.approvalRequests },
              { icon: Bell, label: 'Notifications', value: stats.notifications }
          ],
          parent: [
              { icon: FileText, label: 'Documents', value: stats.documents },
              { icon: FileText, label: 'Pending Submissions', value: stats.pendingSubmissions },
              { icon: Bell, label: 'Notifications', value: stats.notifications },
              { icon: Calendar, label: 'Upcoming Deadlines', value: stats.upcomingDeadlines }
          ]
      };

      const currentStats = statsMapping[user?.role] || [];

      return (
          <div className={styles.statsGrid}>
              {currentStats.map((stat, i) => {
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
      );
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

        {renderStats()} {/* Render stats based on state */}


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

        {/* <div className={`${styles.aiAssistantSection} ${styles.card}`}>
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
        </div> */}
      </div>
    </SidebarLayout>
  );
};

export default Dashboard;