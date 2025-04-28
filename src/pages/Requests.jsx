import React, { useState } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Clock, CheckCircle, XCircle, FileText, Calendar, Users, Eye, FileCheck, AlertCircle } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Requests.module.css';

const Requests = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  const requests = [
    {
      id: 1,
      title: 'Заявление о приеме',
      student: 'Аслан Ерболов',
      group: '101',
      type: 'Документ',
      icon: FileText,
      status: 'pending',
      date: '21.04.2025'
    },
    {
      id: 2,
      title: 'Медицинская справка',
      student: 'Камила Нуржан',
      group: '102',
      type: 'Документ',
      icon: FileText,
      status: 'approved',
      date: '20.04.2025'
    },
    {
      id: 3,
      title: 'Перевод в другую группу',
      student: 'Диас Мурат',
      group: '101',
      type: 'Запрос',
      icon: Users,
      status: 'pending',
      date: '19.04.2025'
    },
    {
      id: 4,
      title: 'Перенос сроков сдачи',
      student: 'Алия Касым',
      group: '103',
      type: 'Запрос',
      icon: Calendar,
      status: 'rejected',
      date: '18.04.2025'
    },
    {
      id: 5,
      title: 'Справка о составе семьи',
      student: 'Арман Серик',
      group: '102',
      type: 'Документ',
      icon: FileText,
      status: 'pending',
      date: '17.04.2025'
    },
  ];

  const StatusBadge = ({ status }) => {
    let statusClass = '';
    let statusText = '';
    let StatusIcon = null;

    switch (status) {
      case 'pending':
        statusClass = styles.statusBadgePending;
        statusText = 'Ожидает';
        StatusIcon = Clock;
        break;
      case 'approved':
        statusClass = styles.statusBadgeApproved;
        statusText = 'Одобрено';
        StatusIcon = CheckCircle;
        break;
      case 'rejected':
        statusClass = styles.statusBadgeRejected;
        statusText = 'Отклонено';
        StatusIcon = XCircle;
        break;
      default:
        return null;
    }

    return (
      <span className={`${styles.statusBadge} ${statusClass}`}>
        {StatusIcon && <StatusIcon style={{width: '0.9em', height: '0.9em', marginRight: '4px'}} />}
        {statusText}
      </span>
    );
  };

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');


  return (
    <SidebarLayout>
      <div className={styles.requestsContainer}>
        <div>
          <h2 className={styles.pageTitle}>Запросы</h2>
          <p className={styles.pageDescription}>
            {user?.role === 'admin'
              ? 'Управление запросами в системе'
              : 'Управление запросами ваших групп'}
          </p>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'all' ? styles.active : ''}`}
              onClick={() => handleTabChange('all')}
            >
              Все
              <span className={styles.badgeCircle}>
                {requests.length}
              </span>
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'pending' ? styles.active : ''}`}
              onClick={() => handleTabChange('pending')}
            >
              Ожидающие
              <span className={styles.badgeCircle}>
                {pendingRequests.length}
              </span>
            </button>
            <button
               className={`${styles.tabsTrigger} ${activeTab === 'processed' ? styles.active : ''}`}
               onClick={() => handleTabChange('processed')}
             >
               Обработанные
               <span className={styles.badgeCircle}>
                 {processedRequests.length}
               </span>
             </button>
           </div>

          {activeTab === 'all' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Все запросы</h3>
                  <p className={styles.cardDescription}>
                    {user?.role === 'admin'
                      ? 'Список всех запросов в системе'
                      : 'Список всех запросов ваших групп'}
                  </p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.requestsTableContainer}>
                    <table className={styles.requestsTableContainer}>
                      <thead>
                        <tr>
                          <th>Запрос</th>
                          <th>Студент</th>
                          <th>Группа</th>
                          <th>Статус</th>
                          <th>Дата</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((request) => (
                          <tr key={request.id}>
                            <td className={styles.tableRequestCell}>
                              <request.icon style={{width: '1.1em', height: '1.1em'}} />
                              {request.title}
                            </td>
                            <td>{request.student}</td>
                            <td>{request.group}</td>
                            <td>
                              <StatusBadge status={request.status} />
                            </td>
                            <td>{request.date}</td>
                            <td>
                              {request.status === 'pending' ? (
                                <div className={styles.buttonGroupHorizontal}>
                                  <button 
                                    type="button" 
                                    className={`${styles.actionButton} ${styles.viewButton}`}
                                    title="Просмотреть запрос"
                                  >
                                    <Eye className={styles.actionIcon} />
                                    <span>Просмотр</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`${styles.actionButton} ${styles.processButton}`}
                                    title="Обработать запрос"
                                  >
                                    <FileCheck className={styles.actionIcon} />
                                    <span>Обработать</span>
                                  </button>
                                </div>
                              ) : (
                                <div className={styles.buttonGroupHorizontal}>
                                  <button 
                                    type="button" 
                                    className={`${styles.actionButton} ${styles.viewButton}`}
                                    title="Просмотреть запрос"
                                  >
                                    <Eye className={styles.actionIcon} />
                                    <span>Просмотр</span>
                                  </button>
                                  {request.status === 'rejected' && (
                                    <button 
                                      type="button" 
                                      className={`${styles.actionButton} ${styles.warningButton}`}
                                      title="Просмотреть причину отклонения"
                                    >
                                      <AlertCircle className={styles.actionIcon} />
                                      <span>Причина</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pending' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Ожидающие запросы</h3>
                  <p className={styles.cardDescription}>Запросы, требующие вашего внимания</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.requestsTableContainer}>
                    <table className={styles.requestsTableContainer}>
                      <thead>
                        <tr>
                          <th>Запрос</th>
                          <th>Студент</th>
                          <th>Группа</th>
                          <th>Дата</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRequests.map((request) => (
                          <tr key={request.id}>
                            <td className={styles.tableRequestCell}>
                              <request.icon style={{width: '1.1em', height: '1.1em'}} />
                              {request.title}
                            </td>
                            <td>{request.student}</td>
                            <td>{request.group}</td>
                            <td>{request.date}</td>
                            <td>
                              <div className={styles.buttonGroupHorizontal}>
                                <button 
                                  type="button" 
                                  className={`${styles.actionButton} ${styles.viewButton}`}
                                  title="Просмотреть запрос"
                                >
                                  <Eye className={styles.actionIcon} />
                                  <span>Просмотр</span>
                                </button>
                                <button 
                                  type="button" 
                                  className={`${styles.actionButton} ${styles.processButton}`}
                                  title="Обработать запрос"
                                >
                                  <FileCheck className={styles.actionIcon} />
                                  <span>Обработать</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'processed' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Обработанные запросы</h3>
                  <p className={styles.cardDescription}>Обработанные запросы и решения по ним</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.requestsTableContainer}>
                    <table className={styles.requestsTableContainer}>
                      <thead>
                        <tr>
                          <th>Запрос</th>
                          <th>Студент</th>
                          <th>Группа</th>
                          <th>Статус</th>
                          <th>Дата</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedRequests.map((request) => (
                          <tr key={request.id}>
                            <td className={styles.tableRequestCell}>
                              <request.icon style={{width: '1.1em', height: '1.1em'}} />
                              {request.title}
                            </td>
                            <td>{request.student}</td>
                            <td>{request.group}</td>
                            <td>
                              <StatusBadge status={request.status} />
                            </td>
                            <td>{request.date}</td>
                            <td>
                              <div className={styles.buttonGroupHorizontal}>
                                <button 
                                  type="button" 
                                  className={`${styles.actionButton} ${styles.viewButton}`}
                                  title="Просмотреть запрос"
                                >
                                  <Eye className={styles.actionIcon} />
                                  <span>Просмотр</span>
                                </button>
                                {request.status === 'rejected' && (
                                  <button 
                                    type="button" 
                                    className={`${styles.actionButton} ${styles.warningButton}`}
                                    title="Просмотреть причину отклонения"
                                  >
                                    <AlertCircle className={styles.actionIcon} />
                                    <span>Причина</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Requests;