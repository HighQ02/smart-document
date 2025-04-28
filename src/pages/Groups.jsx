import React, { useState } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import styles from './../styles/Groups.module.css';

const Groups = () => {
  const [activeTab, setActiveTab] = useState('groups');

  const groups = [
    {
      id: 1,
      name: '101',
      curator: 'Ermek Ahmed',
      studentCount: 25,
      requiredDocs: 5,
      completedDocs: 95,
    },
    {
      id: 2,
      name: '102',
      curator: 'Zarina Mukhtar',
      studentCount: 22,
      requiredDocs: 5,
      completedDocs: 80,
    },
    {
      id: 3,
      name: '103',
      curator: 'Ermek Ahmed',
      studentCount: 20,
      requiredDocs: 5,
      completedDocs: 75,
    },
  ];

  const students = [
    { id: 1, name: 'Аслан Ерболов', group: '101', parent: 'Birzhanov Arlan', docsCompleted: 5, docsTotal: 5 },
    { id: 2, name: 'Камила Нуржан', group: '101', parent: 'Нуржан Айдар', docsCompleted: 4, docsTotal: 5 },
    { id: 3, name: 'Диас Мурат', group: '101', parent: 'Мурат Серик', docsCompleted: 5, docsTotal: 5 },
    { id: 4, name: 'Алия Касым', group: '102', parent: 'Касым Дамир', docsCompleted: 3, docsTotal: 5 },
    { id: 5, name: 'Арман Серик', group: '102', parent: 'Серик Болат', docsCompleted: 5, docsTotal: 5 },
  ];

  return (
    <SidebarLayout>
      <div className={styles.groupsContainer}>
        <div className={styles.groupsHeader}>
          <div>
            <h2 className={styles.pageTitle}>Группы</h2>
            <p className={styles.pageDescription}>Управление группами и студентами</p>
          </div>
          <div className={styles.headerActions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => {}}>
              <span className={styles.icon}>+</span>
              Создать группу
            </button>
          </div>
        </div>

        <div className={styles.tabs}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabButton} ${activeTab === 'groups' ? styles.active : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              Группы
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'students' ? styles.active : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Студенты
            </button>
          </div>

          {activeTab === 'groups' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Список групп</h3>
                  <p className={styles.cardDescription}>Просмотр и управление группами</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.searchContainer}>
                    <div className={styles.searchInputContainer}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input type="text" placeholder="Поиск по группам..." className={styles.searchInput} />
                    </div>
                    <button className={`${styles.btn} ${styles.btnOutline}`}>Фильтры</button>
                  </div>

                  <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Группа</th>
                          <th>Куратор</th>
                          <th>Студенты</th>
                          <th>Документы</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group) => (
                          <tr key={group.id}>
                            <td className={styles.groupName}>
                              <span className={styles.icon}>👥</span>
                              Группа {group.name}
                            </td>
                            <td>{group.curator}</td>
                            <td>{group.studentCount} студентов</td>
                            <td>
                              <div className={styles.progressContainer}>
                                <div className={styles.progressBar}>
                                  <div
                                    className={styles.progressFill}
                                    style={{ width: `${group.completedDocs}%` }}
                                  ></div>
                                </div>
                                <span className={styles.progressText}>{group.completedDocs}%</span>
                              </div>
                            </td>
                            <td>
                              <div className={styles.actionsContainer}>
                                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
                                  Просмотр
                                </button>
                                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
                                  Редактировать
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

          {activeTab === 'students' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Список студентов</h3>
                    <p className={styles.cardDescription}>Просмотр и управление студентами</p>
                  </div>
                  <button className={`${styles.btn} ${styles.btnPrimary}`}>
                    <span className={styles.icon}>+</span>
                    Добавить студента
                  </button>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.searchContainer}>
                    <div className={styles.searchInputContainer}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input type="text" placeholder="Поиск по студентам..." className={styles.searchInput} />
                    </div>
                    <button className={`${styles.btn} ${styles.btnOutline}`}>Фильтры</button>
                  </div>

                  <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Студент</th>
                          <th>Группа</th>
                          <th>Родитель</th>
                          <th>Документы</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id}>
                            <td className={styles.studentName}>
                              <span className={styles.icon}>👤</span>
                              {student.name}
                            </td>
                            <td>Группа {student.group}</td>
                            <td>{student.parent}</td>
                            <td>
                              <div className={styles.docsContainer}>
                                <div className={styles.docsCount}>
                                  <span className={styles.icon}>📄</span>
                                  <span>
                                    {student.docsCompleted}/{student.docsTotal}
                                  </span>
                                </div>
                                <div className={styles.progressBar}>
                                  <div
                                    className={styles.progressFill}
                                    style={{ width: `${(student.docsCompleted / student.docsTotal) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className={styles.actionsContainer}>
                                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
                                  Просмотр
                                </button>
                                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
                                  Редактировать
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
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Groups;