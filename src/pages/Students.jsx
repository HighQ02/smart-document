import React, { useState } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Search, User, FileText, Download } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Students.module.css';

const Students = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');

  let students = [];

  if (user?.role === 'curator') {
    students = [
      { id: 1, name: 'Аслан Ерболов', group: '101', parent: 'Birzhanov Arlan', docsCompleted: 5, docsTotal: 5 },
      { id: 2, name: 'Камила Нуржан', group: '101', parent: 'Нуржан Айдар', docsCompleted: 4, docsTotal: 5 },
      { id: 3, name: 'Диас Мурат', group: '101', parent: 'Мурат Серик', docsCompleted: 5, docsTotal: 5 },
      { id: 4, name: 'Алия Касым', group: '103', parent: 'Касым Дамир', docsCompleted: 3, docsTotal: 5 },
      { id: 5, name: 'Арман Серик', group: '103', parent: 'Серик Болат', docsCompleted: 5, docsTotal: 5 },
    ];
  } else if (user?.role === 'parent') {
    students = [
      { id: 1, name: 'Аслан Ерболов', group: '101', curator: 'Ermek Ahmed', docsCompleted: 5, docsTotal: 5 },
    ];
  }

  const documents = [
    {
      id: 1,
      name: 'Заявление о приеме',
      student: 'Аслан Ерболов',
      status: 'Одобрен',
      date: '10.04.2025',
      file: 'application.pdf'
    },
    {
      id: 2,
      name: 'Согласие на обработку данных',
      student: 'Аслан Ерболов',
      status: 'Одобрен',
      date: '12.04.2025',
      file: 'consent.pdf'
    },
    {
      id: 3,
      name: 'Медицинская карта',
      student: 'Аслан Ерболов',
      status: 'Одобрен',
      date: '15.04.2025',
      file: 'medical.pdf'
    },
    {
      id: 4,
      name: 'Справка с места жительства',
      student: 'Аслан Ерболов',
      status: 'Одобрен',
      date: '18.04.2025',
      file: 'residence.pdf'
    },
    {
      id: 5,
      name: 'Сертификат о вакцинации',
      student: 'Аслан Ерболов',
      status: 'Одобрен',
      date: '20.04.2025',
      file: 'vaccination.pdf'
    },
  ];

  const getStatusClass = (status) => {
    const formattedStatus = status.replace(/\s+/g, '_');
    switch (formattedStatus) {
      case 'Одобрен': return 'status-indicator-Одобрен';
      case 'В_обработке': return 'status-indicator-В_обработке';
      case 'Ожидает_проверки': return 'status-indicator-Ожидает_проверки';
      case 'Отклонен': return 'status-indicator-Отклонен';
      default: return 'status-indicator-default';
    }
  };

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  return (
    <SidebarLayout>
      <div className={styles.studentsContainer}>
        <div>
          <h2 className={styles.pageTitle}>Студенты</h2>
          <p className={styles.pageDescription}>
            {user?.role === 'curator'
              ? 'Управление студентами ваших групп'
              : 'Информация о ваших детях'}
          </p>
        </div>

        <div className={styles.searchFilterArea}>
          <div className={styles.searchInputContainer}>
            <Search style={{width: '1.1em', height: '1.1em'}} className={styles.searchIcon} />
            <input type="text" placeholder="Поиск по студентам..." className={styles.searchInput} />
          </div>
          <button type="button" className={`${styles.button} ${styles.buttonOutline}`}>Фильтры</button>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'list' ? styles.active : ''}`}
              onClick={() => handleTabChange('list')}
            >
              Список студентов
            </button>
            {user?.role === 'parent' && (
              <button
                className={`${styles.tabsTrigger} ${activeTab === 'documents' ? styles.active : ''}`}
                onClick={() => handleTabChange('documents')}
              >
                Документы
              </button>
            )}
          </div>

          {activeTab === 'list' && (
            <div className={styles.tabsContent}>
              <div className={styles.studentsListGrid}>
                {students.map((student) => (
                  <div key={student.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.studentCardHeader}>
                        <div className={styles.studentInfo}>
                          <div className={styles.studentAvatar}>
                            <User />
                          </div>
                          <div>
                            <h3 className={styles.studentName}>{student.name}</h3>
                            <p className={styles.studentMeta}>
                              Группа {student.group}
                              {user?.role === 'parent' && student.curator && ` • Куратор: ${student.curator}`}
                              {user?.role === 'curator' && student.parent && ` • Родитель: ${student.parent}`}
                            </p>
                          </div>
                        </div>
                        <div className={styles.studentActions}>
                          {user?.role === 'curator' && (
                            <button type="button" className={styles.button}>Управление студентом</button>
                          )}
                          {user?.role === 'parent' && (
                            <button type="button" className={`${styles.button} ${styles.buttonOutline}`}>Связаться с куратором</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.documentProgressSection}>
                        <h3>
                          <FileText />
                          Документы
                        </h3>
                        <div className={styles.progressContainer}>
                          <div className={styles.progressBarContainer}>
                            <div
                              className={styles.progressBar}
                              style={{ width: `${(student.docsCompleted / student.docsTotal) * 100}%` }}
                            ></div>
                          </div>
                          <div className={styles.progressText}>
                            {student.docsCompleted}/{student.docsTotal} документов
                          </div>
                        </div>
                      </div>

                      {user?.role === 'curator' && (
                        <div className={styles.studentCardButtons}>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                            Просмотреть документы
                          </button>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                            Добавить документ
                          </button>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                            Отправить уведомление
                          </button>
                        </div>
                      )}

                      {user?.role === 'parent' && (
                        <div className={styles.studentCardButtons}>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                            Просмотреть профиль
                          </button>
                          <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                            Загрузить документ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.role === 'parent' && activeTab === 'documents' && (
            <div className={styles.tabsContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Документы вашего ребенка</h3>
                  <p className={styles.cardDescription}>Просмотр и управление документами</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.documentsTableContainer}>
                    <table>
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th>Статус</th>
                          <th>Дата</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={doc.id}>
                            <td className={styles.tableDocCell}>
                              <FileText />
                              {doc.name}
                            </td>
                            <td>
                              <span className={`${styles.statusIndicator} ${styles[getStatusClass(doc.status)]}`}>
                                {doc.status}
                              </span>
                            </td>
                            <td>{doc.date}</td>
                            <td>
                              <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                                <Download style={{width: '1em', height: '1em', marginRight: '8px'}} />
                                Скачать
                              </button>
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

export default Students;