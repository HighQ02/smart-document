import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AIAssistant from './../../components/AIAssistant';
import { Home, FileText, Bell, Calendar, Users, User, Menu, X, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from './../../contexts/AuthContext';

import styles from './../../styles/SidebarLayout.module.css';

const sidebarItems = [
  { label: 'Главная', icon: Home, path: '/dashboard', roles: ['admin', 'curator', 'parent'] },
  { label: 'Документы', icon: FileText, path: '/documents', roles: ['admin', 'curator', 'parent'] },
  { label: 'Уведомление', icon: Bell, path: '/notifications', roles: ['admin', 'curator', 'parent'] },
  { label: 'Запросы', icon: MessageSquare, path: '/requests', roles: ['admin', 'curator'] },
  { label: 'Расписание', icon: Calendar, path: '/schedule', roles: ['admin'] },
  { label: 'Группы', icon: Users, path: '/groups', roles: ['admin', 'curator'] },
  { label: 'Студенты', icon: Users, path: '/students', roles: ['curator', 'parent'] },
  { label: 'Личный кабинет', icon: User, path: '/profile', roles: ['admin', 'curator', 'parent'] },
];

const SidebarLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

   useEffect(() => {
        setTimeout(() => {
            setUnreadNotifications(3);
        }, 500);
   }, [user]);


  return (
    <div className={styles.sidebarLayout}>

      <div className={styles.sidebarHeaderMobile}>
        <button type="button" onClick={toggleSidebar} className={styles.menuButton}>
          <Menu className={styles.icon} />
        </button>
        <h1 className={styles.title}>SmartNation College</h1>
        {user?.name && (
           <div className={styles.userInfoMobile}>
             <button type="button" onClick={() => navigate('/profile')} className={styles.userButton}>
               <User className={styles.icon} />
               {user?.name?.split(' ')[0]}
             </button>
           </div>
        )}
      </div>

      {sidebarOpen && window.innerWidth < 1024 && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.title}>SmartNation College</h2>
           {window.innerWidth < 1024 && (
             <button type="button" onClick={toggleSidebar} className={styles.closeButton}>
               <X className={styles.icon} />
             </button>
           )}
        </div>

        <div className={styles.sidebarItems}>
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
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
                {item.label === 'Уведомление' && unreadNotifications > 0 && (
                  <span className={styles.notificationCount}>{unreadNotifications}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.sidebarFooter}>
          {user?.name && (
            <div className={styles.userProfile}>
              <div className={styles.avatar}>{user.name.slice(0, 1)}</div>
              <div className={styles.userDetails}>
                <p className={styles.userName}>{user.name}</p>
                <p className={styles.userRole}>
                  {user?.role === 'admin' ? 'Администратор' :
                   user?.role === 'curator' ? 'Куратор' : 'Родитель'}
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
            <h1 className={styles.title}>SmartNation College</h1>
          </div>
          <div className={styles.headerRight}>
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