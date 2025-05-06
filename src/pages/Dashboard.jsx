import React, { useState, useEffect } from 'react';
import { useAuth } from './../contexts/AuthContext';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Bell, Calendar, MessageSquare, FolderOpen } from 'lucide-react';
import axios from 'axios';

import styles from './../styles/Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Состояние для списка документов (теперь используется для "Последних активностей")
  const [documentsList, setDocumentsList] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true); // Переименовал для ясности

  // Fetch Dashboard Stats
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

        // Fetch unread notifications count for everyone
        const unreadNotificationsResponse = await axios.get('/api/notifications/count', {
            params: { status: 'unread' }
        });
        const unreadNotificationsCount = unreadNotificationsResponse.data.count;


        if (user.role === 'admin') {
          // Fetch total counts for admin
          const [docsResponse, usersResponse, requestsResponse] = await Promise.all([
            // Получаем общее количество документов (без лимита, если API поддерживает total в ответе)
            axios.get('/api/documents', { params: { limit: 1 } }), // Запрашиваем только 1 для получения total
            axios.get('/api/users'),
            axios.get('/api/requests', { params: { status: 'new' } }), // Assuming 'new' is pending in requests
          ]);

          fetchedStats = {
            totalDocuments: docsResponse.data.total || docsResponse.data.items?.length || 0, // Предполагаем, что /api/documents возвращает total
            totalUsers: usersResponse.data.length,
            pendingRequests: requestsResponse.data.length,
            notifications: unreadNotificationsCount,
          };
        } else if (user.role === 'curator') {
           // Fetch relevant documents/requests for curator and assigned students count
          const [docsResponse, requestsResponse, studentsListResponse] = await Promise.all([
             // Fetch all documents relevant to the curator
             axios.get('/api/documents'),
             // Fetch all requests relevant to the curator
             axios.get('/api/requests'),
              // Fetch assigned students count for curator
             axios.get('/api/students-list'), // This already filters by curator role
          ]);

          // Filter documents by status 'pending' on frontend
          const pendingDocs = docsResponse.data.items ? docsResponse.data.items.filter(doc => doc.status === 'pending').length : 0;

          // Filter requests by status 'new' or 'pending' on frontend
          const approvalRequests = requestsResponse.data ? requestsResponse.data.filter(req => req.status === 'new' || req.status === 'pending').length : 0;

          const assignedStudentsCount = studentsListResponse.data.length;

          fetchedStats = {
            assignedStudents: assignedStudentsCount,
            pendingDocuments: pendingDocs,
            approvalRequests: approvalRequests,
            notifications: unreadNotificationsCount,
          };
        } else if (user.role === 'parent') {
             // Parent needs counts for their children's documents and upcoming deadlines
             const [docsResponse, upcomingDeadlinesResponse] = await Promise.all([
                 axios.get('/api/documents', { params: { limit: 1 } }), // For total count
                 axios.get('/api/schedule/upcoming', { params: { days: 7 } }), // Get deadlines in next 7 days
             ]);


             const totalDocuments = docsResponse.data.total || docsResponse.data.items?.length || 0;
             // Fetch documents again to filter for pending submissions if total doesn't suffice
             // Or modify the initial /api/documents call to include status counts
             // For simplicity, let's refetch or rely on the separate document list fetch below
             // Assuming the document list fetch below will cover this, or adjust fetchStats to get counts directly

             // Let's fetch docs again to count pending for parent role
             const allParentDocs = await axios.get('/api/documents');
             const pendingSubmissions = allParentDocs.data.items ? allParentDocs.data.items.filter(doc => doc.status === 'pending').length : 0;


             const upcomingDeadlinesCount = upcomingDeadlinesResponse.data.length;

             fetchedStats = {
               documents: totalDocuments,
               pendingSubmissions: pendingSubmissions,
               notifications: unreadNotificationsCount,
               upcomingDeadlines: upcomingDeadlinesCount,
             };
        } else if (user.role === 'student') {
             // Student needs counts for their documents and upcoming deadlines
             const [docsResponse, upcomingDeadlinesResponse] = await Promise.all([
                axios.get('/api/documents', { params: { limit: 1 } }), // For total count
                axios.get('/api/schedule/upcoming', { params: { days: 7 } }), // Get deadlines in next 7 days
            ]);

             const totalDocuments = docsResponse.data.total || docsResponse.data.items?.length || 0;
             // Refetch docs for pending count
             const allStudentDocs = await axios.get('/api/documents');
             const pendingSubmissions = allStudentDocs.data.items ? allStudentDocs.data.items.filter(doc => doc.status === 'pending').length : 0;

             const upcomingDeadlinesCount = upcomingDeadlinesResponse.data.length;

             fetchedStats = {
               documents: totalDocuments,
               pendingSubmissions: pendingSubmissions,
               notifications: unreadNotificationsCount,
               upcomingDeadlines: upcomingDeadlinesCount,
             };
        } else {
             // Default or unknown role stats
             fetchedStats = {
                notifications: unreadNotificationsCount,
                totalDocuments: 0, // Default to 0 if no specific logic
                pendingSubmissions: 0,
                upcomingDeadlines: 0
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
  }, [user?.role, user?.id]);


  // Fetch User's Documents for "Latest Activities" section
  useEffect(() => {
      const fetchDocumentsForActivities = async () => {
          if (!user?.id) {
              setDocumentsList([]);
              setIsLoadingActivities(false);
              return;
          }

          setIsLoadingActivities(true);
          try {
              // Fetch a limited number of recent documents relevant to the user
              // The backend /api/documents endpoint already filters by user role
              const response = await axios.get('/api/documents', {
                  params: {
                      limit: 5, // Fetch latest 5 documents
                      offset: 0
                  }
              });
              setDocumentsList(response.data.items || []); // Assuming backend returns { items: [], total: N }
          } catch (error) {
              console.error('Error fetching documents for activities:', error);
              setDocumentsList([]); // Set to empty on error
          } finally {
              setIsLoadingActivities(false);
          }
      };

      fetchDocumentsForActivities();
  }, [user?.id]);


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
    if (user.role === 'student') return 'Личный кабинет';
    return 'Главная страница';
  };

  // Define navigation targets based on user role and stat
  const getStatTarget = (statLabel, userRole) => {
      // Use more specific labels from renderStats
      switch (statLabel) {
          case 'Всего документов':
              return '/documents'; // Link to main documents page
          case 'Всего пользователей':
              return userRole === 'admin' ? '/users' : null;
          case 'Новых запросов': // Admin stat
          case 'Запросов на одобрение': // Curator stat
              return '/requests?status=new'; // Link to requests page filtered by new
          case 'Непрочитанных уведомлений':
              return '/notifications'; // Link to notifications page
          case 'Закрепленных студентов':
              return userRole === 'curator' ? '/students' : null; // Link to students list
          case 'Документов на рассмотрении': // Curator stat
          case 'Ожидают отправки': // Parent/Student stat
              return '/documents?status=pending'; // Link to documents filtered by pending
          case 'Предстоящих дедлайнов':
              return '/schedule?upcoming_days=7'; // Link to schedule page with upcoming filter
          default:
              return null; // No navigation for other stats
      }
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
                  <p>Убедитесь, что сервер запущен и доступен, а также что пользователь аутентифицирован.</p>
              </div>
           );
      }

      // Define stats mapping based on user role and fetched keys
      const statsMapping = {
          admin: [
              { icon: FileText, label: 'Всего документов', value: stats.totalDocuments },
              { icon: Users, label: 'Всего пользователей', value: stats.totalUsers },
              { icon: MessageSquare, label: 'Новых запросов', value: stats.pendingRequests },
              { icon: Bell, label: 'Непрочитанных уведомлений', value: stats.notifications }
          ],
          curator: [
              { icon: Users, label: 'Закрепленных студентов', value: stats.assignedStudents },
              { icon: FileText, label: 'Документов на рассмотрении', value: stats.pendingDocuments },
              { icon: MessageSquare, label: 'Запросов на одобрение', value: stats.approvalRequests },
              { icon: Bell, label: 'Непрочитанных уведомлений', value: stats.notifications }
          ],
          parent: [
              { icon: FileText, label: 'Всего документов', value: stats.documents },
              { icon: FileText, label: 'Ожидают отправки', value: stats.pendingSubmissions },
              { icon: Bell, label: 'Непрочитанных уведомлений', value: stats.notifications },
              { icon: Calendar, label: 'Предстоящих дедлайнов', value: stats.upcomingDeadlines }
          ],
           student: [
              { icon: FileText, label: 'Всего документов', value: stats.documents },
              { icon: FileText, label: 'Ожидают отправки', value: stats.pendingSubmissions },
              { icon: Bell, label: 'Непрочитанных уведомлений', value: stats.notifications },
              { icon: Calendar, label: 'Предстоящих дедлайнов', value: stats.upcomingDeadlines }
          ]
      };

      const currentStats = statsMapping[user?.role] || [];

      return (
          <div className={styles.statsGrid}>
              {currentStats.map((stat, i) => {
                  const StatIcon = stat.icon;
                  const target = getStatTarget(stat.label, user?.role); // Get navigation target

                  return (
                   // Make the stat item clickable if there's a target
                   <div
                        key={i}
                        className={`${styles.statItem} ${target ? styles.statItemClickable : ''}`}
                        onClick={target ? () => navigate(target) : null}
                        role={target ? 'button' : undefined} // Add accessibility role
                        tabIndex={target ? 0 : undefined} // Make focusable if clickable
                   >
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


  // Render the list of documents for the "Latest Activities" section
   const renderActivitiesList = () => {
        if (isLoadingActivities) {
            return (
                <div className={styles.loadingText}>
                    <p>Загрузка последних активностей...</p>
                </div>
            );
        }

        if (!documentsList || documentsList.length === 0) {
            return (
                <div className={styles.loadingText}>
                    <p>Нет последних активностей для отображения.</p>
                </div>
            );
        }

        return (
            <div className={styles.recentActivityList}> {/* Reuse activity list styles */}
                {documentsList.map(doc => (
                    <div key={doc.id} className={styles.activityItem}> {/* Reuse activity item styles */}
                        <div className={styles.activityIconContainer}>
                             <FileText className={styles.activityIcon} /> {/* Use FileText icon */}
                        </div>
                        <div className={styles.activityDetails}>
                            <p className={styles.activityTitle}>Документ: {doc.name}</p> {/* Display document name */}
                            <p className={styles.activityMeta}>Статус: {doc.status}</p> {/* Display status */}
                            {user?.role !== 'student' && doc.student_name && ( // Show student name for non-students if available
                                <p className={styles.activityMeta}>Студент: {doc.student_name}</p>
                            )}
                             {doc.submitted_by_name && doc.submitted_by_name !== doc.student_name && ( // Show who submitted if different from student
                                 <p className={styles.activityMeta}>Загружен: {doc.submitted_by_name}</p>
                             )}
                        </div>
                         {doc.date && <div className={styles.activityMeta}>{doc.date}</div>} {/* Display document date */}
                        {/* Optional: Make item clickable to view document details */}
                        {/* <div
                             className={styles.activityViewButton}
                             onClick={() => navigate(`/documents/${doc.id}`)}
                             role="button"
                             tabIndex={0}
                         >
                             Просмотр
                         </div> */}
                    </div>
                ))}
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

        {/* Stats Section */}
        {renderStats()}

        <div className={styles.sectionsGrid}>
          {/* Latest Activity Section - Now using fetched documents */}
          <div className={`${styles.sectionCard} ${styles.card} ${styles.spanMd2}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Последние активности (документы)</h3> {/* Updated title */}
              <p className={styles.cardDescription}>Список последних измененных документов</p> {/* Updated description */}
            </div>
            <div className={styles.cardContent}>
               {renderActivitiesList()} {/* Render the list of documents as activities */}
            </div>
          </div>

          {/* Quick Access Section - Made Clickable */}
          <div className={`${styles.sectionCard} ${styles.card}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Быстрый доступ</h3>
              <p className={styles.cardDescription}>Часто используемые функции</p>
            </div>
            <div className={styles.cardContent}>
              <ul className={styles.quickAccessList}>
                <li
                    className={styles.quickAccessItem}
                    onClick={() => navigate('/documents')} // Navigate to documents page
                    role="button"
                    tabIndex={0}
                >
                  <FileText className={styles.quickAccessIcon} />
                  <span>Открыть документы</span>
                </li>
                <li
                    className={styles.quickAccessItem}
                    onClick={() => navigate('/notifications')} // Navigate to notifications page
                     role="button"
                    tabIndex={0}
                >
                  <Bell className={styles.quickAccessIcon} />
                  <span>Просмотреть уведомления</span>
                </li>
                 {/* Conditional Quick Access based on role */}
                {user?.role === 'admin' && (
                     <>
                         <li
                             className={styles.quickAccessItem}
                             onClick={() => navigate('/users')} // Navigate to users page
                              role="button"
                             tabIndex={0}
                         >
                           <Users className={styles.quickAccessIcon} />
                           <span>Управление пользователями</span>
                         </li>
                         <li
                              className={styles.quickAccessItem}
                              onClick={() => navigate('/groups')} // Navigate to groups page
                               role="button"
                              tabIndex={0}
                         >
                           <FolderOpen className={styles.quickAccessIcon} />
                           <span>Управление группами</span>
                         </li>
                     </>
                )}
                 {['curator', 'parent'].includes(user?.role) && (
                    <li
                        className={styles.quickAccessItem}
                        onClick={() => navigate('/students')} // Navigate to students list page (filtered by role on backend)
                         role="button"
                        tabIndex={0}
                    >
                      <Users className={styles.quickAccessIcon} />
                      <span>Просмотр студентов</span>
                    </li>
                 )}
              </ul>
            </div>
          </div>
        </div>

        {/* AI Assistant Section - Commented Out */}
        {/* <div className={`${styles.aiAssistantSection} ${styles.card}`}>
          ...
        </div> */}
      </div>
    </SidebarLayout>
  );
};

export default Dashboard;