import React, { useState, useEffect } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Search, Users, UserPlus, Edit, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Groups.module.css';

const Groups = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  
  // Форма для создания/редактирования группы
  const [formData, setFormData] = useState({
    name: '',
    curator: '',
  });

  // Загрузка данных групп
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/groups');
        setGroups(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching groups:', err);
        setError('Ошибка при загрузке групп. Пожалуйста, попробуйте позже.');
        // Используем моковые данные, если API недоступен
        setGroups([
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
        ]);
      } finally {
        setLoading(false);
      }
    };

    // Загрузка данных студентов
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/students');
        setStudents(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching students:', err);
        // Используем моковые данные, если API недоступен
        setStudents([
          { id: 1, name: 'Аслан Ерболов', group: '101', parent: 'Birzhanov Arlan', docsCompleted: 5, docsTotal: 5 },
          { id: 2, name: 'Камила Нуржан', group: '101', parent: 'Нуржан Айдар', docsCompleted: 4, docsTotal: 5 },
          { id: 3, name: 'Диас Мурат', group: '101', parent: 'Мурат Серик', docsCompleted: 5, docsTotal: 5 },
          { id: 4, name: 'Алия Касым', group: '102', parent: 'Касым Дамир', docsCompleted: 3, docsTotal: 5 },
          { id: 5, name: 'Арман Серик', group: '102', parent: 'Серик Болат', docsCompleted: 5, docsTotal: 5 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchStudents();
  }, []);

  // Фильтрация групп
  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    group.curator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Фильтрация студентов
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    student.group.toLowerCase().includes(searchTerm.toLowerCase()) || 
    student.parent.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Обработка изменения полей формы
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Открытие модального окна для редактирования группы
  const handleEditGroup = (group) => {
    setCurrentGroup(group);
    setFormData({
      name: group.name,
      curator: group.curator
    });
    setShowEditModal(true);
  };

  // Обработка создания новой группы
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/groups', formData);
      setGroups([...groups, response.data]);
      setShowCreateModal(false);
      setFormData({ name: '', curator: '' });
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Ошибка при создании группы. Пожалуйста, попробуйте позже.');
    }
  };

  // Обработка редактирования группы
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/groups/${currentGroup.id}`, formData);
      setGroups(groups.map(group => 
        group.id === currentGroup.id ? { ...group, ...formData } : group
      ));
      setShowEditModal(false);
      setCurrentGroup(null);
    } catch (err) {
      console.error('Error updating group:', err);
      setError('Ошибка при обновлении группы. Пожалуйста, попробуйте позже.');
    }
  };

  // Обработка удаления группы
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту группу?')) return;
    
    try {
      await axios.delete(`/api/groups/${groupId}`);
      setGroups(groups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Ошибка при удалении группы. Пожалуйста, попробуйте позже.');
    }
  };

  // Модальное окно для создания группы
  const CreateGroupModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Создать новую группу</h3>
          <button className={styles.closeButton} onClick={() => setShowCreateModal(false)}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreateGroup}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Название группы</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Введите название группы"
              required
              className={styles.formControl}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="curator">Куратор</label>
            <input
              type="text"
              id="curator"
              name="curator"
              value={formData.curator}
              onChange={handleInputChange}
              placeholder="Введите имя куратора"
              required
              className={styles.formControl}
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setShowCreateModal(false)}>
              Отмена
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Модальное окно для редактирования группы
  const EditGroupModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Редактировать группу</h3>
          <button className={styles.closeButton} onClick={() => setShowEditModal(false)}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleUpdateGroup}>
          <div className={styles.formGroup}>
            <label htmlFor="edit-name">Название группы</label>
            <input
              type="text"
              id="edit-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Введите название группы"
              required
              className={styles.formControl}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-curator">Куратор</label>
            <input
              type="text"
              id="edit-curator"
              name="curator"
              value={formData.curator}
              onChange={handleInputChange}
              placeholder="Введите имя куратора"
              required
              className={styles.formControl}
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setShowEditModal(false)}>
              Отмена
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <SidebarLayout>
      <div className={styles.groupsContainer}>
        <div className={styles.groupsHeader}>
          <div>
            <h2 className={styles.pageTitle}>Группы</h2>
            <p className={styles.pageDescription}>Управление группами и студентами</p>
          </div>
          <div className={styles.headerActions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
              <UserPlus size={16} style={{ marginRight: '8px' }} />
              Создать группу
            </button>
          </div>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

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

          <div className={styles.searchContainer}>
            <div className={styles.searchInputContainer}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder={activeTab === 'groups' ? "Поиск по группам..." : "Поиск по студентам..."} 
                className={styles.searchInput} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className={`${styles.btn} ${styles.btnOutline}`}>Фильтры</button>
          </div>

          {activeTab === 'groups' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Список групп</h3>
                  <p className={styles.cardDescription}>Просмотр и управление группами</p>
                </div>
                <div className={styles.cardContent}>
                  {loading ? (
                    <div className={styles.loadingIndicator}>Загрузка данных...</div>
                  ) : filteredGroups.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Users size={48} className={styles.emptyStateIcon} />
                      <p>Группы не найдены</p>
                      <button 
                        className={`${styles.btn} ${styles.btnPrimary}`} 
                        onClick={() => setShowCreateModal(true)}
                      >
                        Создать группу
                      </button>
                    </div>
                  ) : (
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
                          {filteredGroups.map((group) => (
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
                                  <button 
                                    className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                                    onClick={() => handleEditGroup(group)}
                                  >
                                    <Edit size={14} style={{ marginRight: '4px' }} />
                                    Редактировать
                                  </button>
                                  <button 
                                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                    onClick={() => handleDeleteGroup(group.id)}
                                  >
                                    <Trash2 size={14} style={{ marginRight: '4px' }} />
                                    Удалить
                                  </button>
                                </div>
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

          {activeTab === 'students' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Список студентов</h3>
                    <p className={styles.cardDescription}>Просмотр и управление студентами</p>
                  </div>
                  <button className={`${styles.btn} ${styles.btnPrimary}`}>
                    <UserPlus size={16} style={{ marginRight: '8px' }} />
                    Добавить студента
                  </button>
                </div>
                <div className={styles.cardContent}>
                  {loading ? (
                    <div className={styles.loadingIndicator}>Загрузка данных...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Users size={48} className={styles.emptyStateIcon} />
                      <p>Студенты не найдены</p>
                    </div>
                  ) : (
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
                          {filteredStudents.map((student) => (
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
                                    <Edit size={14} style={{ marginRight: '4px' }} />
                                    Редактировать
                                  </button>
                                  <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}>
                                    <Trash2 size={14} style={{ marginRight: '4px' }} />
                                    Удалить
                                  </button>
                                </div>
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
        
        {showCreateModal && <CreateGroupModal />}
        {showEditModal && <EditGroupModal />}
      </div>
    </SidebarLayout>
  );
};

export default Groups;