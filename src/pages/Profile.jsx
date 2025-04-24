import React, { useState, useEffect } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { User, Bell, Mail, Phone, Key, Users, Plus } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';
import axios from 'axios';

import styles from './../styles/Profile.module.css';

const Profile = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const [systemUsers, setSystemUsers] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileAbout, setProfileAbout] = useState('');


  useEffect(() => {
      const fetchUserProfile = async () => {
          if (!user?.id) return;

          setIsLoadingProfile(true);
          try {
              const response = await axios.get('/api/users/me');

              if (response.data) {
                  const userData = response.data;
                  setCurrentUserProfile(userData);
                  setProfileName(userData.name || '');
                  setProfileEmail(userData.email || '');
                  setProfileRole(userData.role || '');
              }
          } catch (error) {
              console.error('Error fetching user profile:', error);
              setCurrentUserProfile(null);
          } finally {
              setIsLoadingProfile(false);
          }
      };

      fetchUserProfile();
  }, [user?.id]);


  useEffect(() => {
      const fetchSystemUsers = async () => {
          if (user?.role !== 'admin') {
              setSystemUsers([]);
              setIsLoadingUsers(false);
              return;
          }

          setIsLoadingUsers(true);
          try {
              const response = await axios.get('/api/users');

              if (response.data) {
                  const formattedUsers = response.data.map(u => ({
                      id: u.id,
                      name: u.full_name,
                      role: u.role,
                      email: u.email,
                      groups: [],
                      phone: u.phone || '',
                      avatar: u.avatar_url,
                      isActive: u.is_active
                  }));
                  setSystemUsers(formattedUsers);
              } else {
                  setSystemUsers([]);
              }
          } catch (error) {
              console.error('Error fetching system users:', error);
              setSystemUsers([]);
          } finally {
              setIsLoadingUsers(false);
          }
      };

      fetchSystemUsers();
  }, [user?.role]);


   useEffect(() => {
        const fetchLoginHistory = async () => {
            if (!user?.id) {
                setLoginHistory([]);
                setIsLoadingHistory(false);
                return;
            }
            setIsLoadingHistory(true);
            try {
                 const mockData = [
                   { device: 'Chrome на Windows', ip: '192.168.1.1', date: '21.04.2025, 10:23' },
                   { device: 'Safari на Mac', ip: '192.168.1.2', date: '20.04.2025, 16:45' },
                   { device: 'Firefox на Linux', ip: '192.168.1.3', date: '19.04.2025, 09:12' },
                 ];
                const response = await new Promise(resolve => setTimeout(() => resolve({ data: mockData }), 1000));

                if (response.data) {
                    setLoginHistory(response.data);
                } else {
                    setLoginHistory([]);
                }
            } catch (error) {
                 console.error('Error fetching login history:', error);
                 setLoginHistory([]);
            } finally {
                 setIsLoadingHistory(false);
            }
        };

        fetchLoginHistory();
   }, [user?.id]);


  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  const displayUserName = currentUserProfile?.name || user?.name;
  const displayUserEmail = currentUserProfile?.email || user?.email || 'Загрузка...';
  const displayUserRole = currentUserProfile?.role || user?.role;
  const displayUserAvatarInitial = displayUserName ? displayUserName.slice(0, 1) : '?';


  return (
    <SidebarLayout>
      <div className={styles.profileContainer}>
        <div>
          <h2 className={styles.pageTitle}>Личный кабинет</h2>
          <p className={styles.pageDescription}>Управление профилем и настройками</p>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'profile' ? styles.active : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              Профиль
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'notifications' ? styles.active : ''}`}
              onClick={() => handleTabChange('notifications')}
            >
              Настройки уведомлений
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'security' ? styles.active : ''}`}
              onClick={() => handleTabChange('security')}
            >
              Безопасность
            </button>
            {user?.role === 'admin' && (
              <button
                className={`${styles.tabsTrigger} ${activeTab === 'users' ? styles.active : ''}`}
                onClick={() => handleTabChange('users')}
              >
                Управление пользователями
              </button>
            )}
          </div>

          {activeTab === 'profile' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Информация профиля</h3>
                  <p className={styles.cardDescription}>Просмотр и редактирование личной информации</p>
                </div>
                <div className={styles.cardContent}>
                 {isLoadingProfile ? (
                     <div className={styles.loadingText}><p>Загрузка профиля...</p></div>
                 ) : (
                   <div className={styles.profileInfoLayout}>
                     <div className={styles.profileAvatarSection}>
                       <div className={styles.avatar}>
                         {displayUserAvatarInitial}
                       </div>
                       <h3 className={styles.profileName}>{displayUserName}</h3>
                       <p className={styles.profileRole}>{displayUserRole}</p>
                       <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonFullWidth}`}>
                         Изменить фото
                       </button>
                     </div>

                     <div className={styles.profileDetailsSection}>
                       <div className={styles.formGrid}>
                         <div className={styles.formGroup}>
                           <label className={styles.formLabel}>Полное имя</label>
                           <input type="text" className={styles.inputField} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                         </div>

                         <div className={styles.formGroup}>
                           <label className={styles.formLabel}>Email</label>
                           <input type="email" className={styles.inputField} value={displayUserEmail} readOnly />
                         </div>

                         <div className={styles.formGroup}>
                           <label className={styles.formLabel}>Телефон</label>
                           <input type="tel" className={styles.inputField} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+7 (___) ___-__-__" />
                         </div>

                         <div className={styles.formGroup}>
                           <label className={styles.formLabel}>Роль</label>
                           <input type="text" className={styles.inputField} value={displayUserRole} readOnly />
                         </div>
                       </div>

                       <div className={styles.formGroup} style={{marginTop: '15px'}}>
                         <label className={styles.formLabel}>О себе</label>
                         <textarea className={styles.textareaField} rows={4} value={profileAbout} onChange={(e) => setProfileAbout(e.target.value)} placeholder="Краткая информация о себе"></textarea>
                       </div>

                       <div className={styles.buttonRightAlignedGroup}>
                         <button type="button" className={`${styles.button} ${styles.buttonOutline}`}>Отмена</button>
                         <button type="button" className={styles.button}>Сохранить изменения</button>
                       </div>
                     </div>
                   </div>
                 )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Настройки уведомлений</h3>
                  <p className={styles.cardDescription}>Управление уведомлениями системы</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.settingsSection}>
                    <div>
                      <h3 className={styles.formLabel} style={{marginBottom: '15px'}}>Каналы уведомлений</h3>

                      <div className={styles.settingsItem}>
                        <div className={styles.settingsItemContent}>
                          <Bell />
                          <div className={styles.settingsItemText}>
                            <h3>В системе</h3>
                            <p>Уведомления внутри платформы</p>
                          </div>
                        </div>
                        <div className={styles.settingsItemActions}>
                           <input
                            type="checkbox"
                            id="in-app"
                            defaultChecked
                          />
                        </div>
                      </div>

                      <div className={styles.settingsItem} style={{marginTop: '10px'}}>
                        <div className={styles.settingsItemContent}>
                          <Mail />
                          <div className={styles.settingsItemText}>
                            <h3>Email</h3>
                            <p>Получение уведомлений на email</p>
                          </div>
                        </div>
                        <div className={styles.settingsItemActions}>
                          <input
                            type="checkbox"
                            id="email"
                            defaultChecked
                          />
                        </div>
                      </div>

                      <div className={styles.settingsItem} style={{marginTop: '10px'}}>
                        <div className={styles.settingsItemContent}>
                          <Phone />
                          <div className={styles.settingsItemText}>
                            <h3>Telegram бот</h3>
                            <p>Получение уведомлений в Telegram</p>
                          </div>
                        </div>
                        <div className={styles.settingsItemActions}>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline}`} style={{padding: '5px 10px', fontSize: '0.9em'}}>Подключить</button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.settingsTypes}>
                      <h3>Типы уведомлений</h3>

                      <div className={styles.settingsTypeItem}>
                        <label htmlFor="docs">Документы и запросы</label>
                        <input type="checkbox" id="docs" defaultChecked />
                      </div>

                       <div className={styles.settingsTypeItem}>
                        <label htmlFor="system">Системные уведомления</label>
                        <input type="checkbox" id="system" defaultChecked />
                      </div>

                       <div className={styles.settingsTypeItem}>
                        <label htmlFor="deadline">Напоминания о дедлайнах</label>
                        <input type="checkbox" id="deadline" defaultChecked />
                      </div>

                       <div className={styles.settingsTypeItem}>
                        <label htmlFor="news">Новости и объявления</label>
                        <input type="checkbox" id="news" defaultChecked />
                      </div>
                    </div>

                    <div className={styles.buttonRightAlignedGroup} style={{marginTop: '0'}}>
                       <button type="button" className={styles.button}>Сохранить настройки</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Безопасность</h3>
                  <p className={styles.cardDescription}>Управление паролем и настройками безопасности</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.securitySection}>
                    <div>
                       <h3 style={{display: 'flex', alignItems: 'center'}}><Key style={{marginRight: '8px'}}/>Изменение пароля</h3>

                      <div className={styles.passwordChangeForm}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Текущий пароль</label>
                          <input type="password" className={styles.inputField} />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Новый пароль</label>
                          <input type="password" className={styles.inputField} />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Подтверждение нового пароля</label>
                          <input type="password" className={styles.inputField} />
                        </div>

                        <button type="button" className={styles.button} style={{alignSelf: 'flex-start'}}>Обновить пароль</button>
                      </div>
                    </div>

                    <div style={{borderTop: '1px solid #eee', paddingTop: '20px'}}>
                      <h3>История входов</h3>
                      {isLoadingHistory ? (
                          <div className={styles.loadingText}><p>Загрузка истории...</p></div>
                      ) : loginHistory.length === 0 ? (
                          <div className={styles.loginHistory}><p style={{fontSize: '0.9em', color: '#666'}}>История входов отсутствует.</p></div>
                      ) : (
                         <div className={styles.loginHistory}>
                            {loginHistory.map((session, i) => (
                             <div key={i} className={styles.loginHistoryItem}>
                               <div>
                                 <p>{session.device}</p>
                                 <p>IP: {session.ip}</p>
                               </div>
                               <div style={{textAlign: 'right'}}>
                                 <p style={{fontSize: '0.9em'}}>{session.date}</p>
                                 {i === 0 && (
                                   <p className={styles.currentSessionText}>Текущий сеанс</p>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {user?.role === 'admin' && activeTab === 'users' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <h3 className={styles.cardTitle}>Управление пользователями</h3>
                    <p className={styles.cardDescription}>Создание и управление аккаунтами пользователей</p>
                  </div>
                  <button type="button" className={styles.button}>
                    <Plus style={{width: '1em', height: '1em', marginRight: '8px'}} />
                    Добавить пользователя
                  </button>
                </div>
                <div className={styles.cardContent}>
                 {isLoadingUsers ? (
                     <div className={styles.loadingText}><p>Загрузка пользователей...</p></div>
                 ) : systemUsers.length === 0 ? (
                     <div className={styles.loadingText}><p style={{fontSize: '0.9em', color: '#666'}}>Пользователи не найдены.</p></div>
                 ) : (
                   <div className={styles.usersTableContainer}>
                     <table>
                       <thead>
                         <tr>
                           <th>Имя</th>
                           <th>Роль</th>
                           <th>Email</th>
                           <th>Телефон</th>
                           <th>Группы</th>
                           <th>Действия</th>
                         </tr>
                       </thead>
                       <tbody>
                         {systemUsers.map((sysUser) => (
                           <tr key={sysUser.id}>
                             <td className={styles.tableUserCell}>
                               <User style={{width: '1.1em', height: '1.1em'}} />
                               {sysUser.name}
                             </td>
                             <td style={{textTransform: 'capitalize'}}>{sysUser.role}</td>
                             <td>{sysUser.email}</td>
                             <td>{sysUser.phone}</td>
                             <td>
                               <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                                  {sysUser.groups && sysUser.groups.length > 0 ? (
                                       sysUser.groups.map((group) => (
                                         <span key={group} className={styles.userGroupTag}>{group}</span>
                                       ))
                                  ) : (
                                      <span style={{color: '#999', fontSize: '0.8em'}}>Нет данных</span>
                                  )}
                               </div>
                             </td>
                             <td className={styles.userActionsCell}>
                               <button type="button" className={`${styles.button} ${styles.buttonOutline}`} style={{padding: '5px 10px', fontSize: '0.9em'}}>
                                 Редактировать
                               </button>
                               <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonDestructive}`} style={{padding: '5px 10px', fontSize: '0.9em'}}>
                                 Деактивировать
                               </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </SidebarLayout>
  );
};

export default Profile;