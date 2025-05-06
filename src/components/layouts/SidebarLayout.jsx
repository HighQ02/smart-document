import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios'; // Import axios
import { Home, FileText, Bell, Calendar, Users, User, Menu, X, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from './../../contexts/AuthContext';

import styles from './../../styles/SidebarLayout.module.css';

const sidebarItems = [
  { label: 'Главная', icon: Home, path: '/dashboard', roles: ['admin', 'curator', 'parent', 'student'] },
  { label: 'Документы', icon: FileText, path: '/documents', roles: ['admin', 'curator', 'parent', 'student'] },
  { label: 'Уведомление', icon: Bell, path: '/notifications', roles: ['admin', 'curator', 'parent', 'student'] },
  { label: 'Запросы', icon: MessageSquare, path: '/requests', roles: ['admin', 'curator'] },
  { label: 'Расписание', icon: Calendar, path: '/schedule', roles: ['admin', 'curator', 'parent', 'student'] },
  { label: 'Группы', icon: Users, path: '/groups', roles: ['admin', 'curator'] },
  { label: 'Студенты', icon: Users, path: '/students', roles: [] }, 
  { label: 'Личный кабинет', icon: User, path: '/profile', roles: ['admin', 'curator', 'parent', 'student'] },
];

const SidebarLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotificationsCount, setLoadingNotificationsCount] = useState(false); // Optional loading state

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const filteredItems = sidebarItems.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // --- НОВАЯ ЛОГИКА: Получение количества непрочитанных уведомлений ---
   useEffect(() => {
       const fetchUnreadCount = async () => {
           if (!user) {
               setUnreadNotifications(0);
               return;
           }
           // setLoadingNotificationsCount(true); // Start loading indicator (optional)
           try {
               // Делаем запрос на бэкенд для получения только непрочитанных уведомлений
               const response = await axios.get('/api/notifications', { params: { status: 'unread' } });
               if (response.data && Array.isArray(response.data.items)) {
                   setUnreadNotifications(response.data.items.length); // Устанавливаем количество
               } else {
                   console.error("Error fetching unread count: Invalid data format", response.data);
                   setUnreadNotifications(0);
               }
           } catch (error) {
               console.error("Error fetching unread count:", error);
               setUnreadNotifications(0); // Сбрасываем счетчик при ошибке
           } finally {
               // setLoadingNotificationsCount(false); // Stop loading indicator (optional)
           }
       };

       fetchUnreadCount(); // Вызываем функцию при изменении пользователя (логин/разлогин)

        // TODO: Для обновления в реальном времени после пометки как прочитанных
        // на странице уведомлений, потребуется более сложный механизм (Context, Global State)
        // или периодический опрос (менее эффективно).
        // Например, можно добавить зависимость от location.pathname, чтобы обновлять при смене страницы,
        // но это не гарантирует, что переход произошел именно со страницы уведомлений после их прочтения.
        // Или можно использовать библиотеку react-query и ее хук useQuery с option refetchOnWindowFocus.

   }, [user]); // Зависимость от пользователя


  return (
    <div className={styles.sidebarLayout}>

      <div className={styles.sidebarHeaderMobile}>
        <button type="button" onClick={toggleSidebar} className={styles.menuButton}>
          <Menu className={styles.icon} />
        </button>
        <h1 className={styles.title}>SmartDocuments</h1>
      </div>

      {sidebarOpen && window.innerWidth < 1024 && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.title}>SmartDocuments</h2>
           {window.innerWidth < 1024 && (
             <button type="button" onClick={toggleSidebar} className={styles.closeButton}>
               <X className={styles.icon} />
             </button>
           )}
        </div>

        <div className={styles.sidebarItems}>
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            // Проверяем, является ли текущий элемент ссылкой на Уведомления
            const isNotificationLink = item.label === 'Уведомление';

            return (
              <button
                key={item.path}
                className={`${styles.sidebarItem} ${isActive ? styles.active : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(false);
                  }
                }}
              >
                <item.icon className={styles.icon} />
                <span>{item.label}</span>
                {/* Отображаем счетчик только для ссылки "Уведомление" и если есть непрочитанные */}
                {isNotificationLink && unreadNotifications > 0 && (
                  <span className={styles.notificationCount}>{unreadNotifications}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.sidebarFooter}>
          {user?.name && (
            <div className={styles.userProfile}>
              <div className={styles.avatar}>{user.name ? user.name.slice(0, 1) : '?'}</div> {/* Безопасное обращение */}
              <div className={styles.userDetails}>
                <p className={styles.userName}>{user.name}</p>
                <p className={styles.userRole}>
                   {/* Добавим отображение роли студента */}
                  {user?.role === 'admin' ? 'Администратор' :
                   user?.role === 'curator' ? 'Куратор' :
                   user?.role === 'parent' ? 'Родитель' :
                   user?.role === 'student' ? 'Студент' : 'Пользователь'}
                </p>
              </div>
            </div>
          )}
           {user && (
             <button type="button" className={styles.logoutButton} onClick={logout}>
               <LogOut className={styles.icon} />
               Выйти
             </button>
           )}
        </div>
      </div>

      <div className={styles.contentArea}>
        <header className={styles.headerMain}>
          <div className={styles.headerLeft}>
             {window.innerWidth < 1024 && (
               <button type="button" onClick={toggleSidebar} className={styles.menuButton}>
                 <Menu className={styles.icon} />
               </button>
             )}
          </div>
          <div className={styles.headerRight}>
             {/* Кнопка уведомлений в хедере */}
             <button type="button" onClick={() => navigate('/notifications')} className={styles.notificationButton}>
               <Bell className={styles.icon} />
               {unreadNotifications > 0 && (
                 <span className={styles.notificationCount}>{unreadNotifications}</span>
               )}
             </button>
             {user?.name && (
               <button type="button" onClick={() => navigate('/profile')} className={styles.userButton}>
                 <User className={styles.icon} />
                 <span>{user.name}</span>
               </button>
             )}
          </div>
        </header>

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default SidebarLayout;