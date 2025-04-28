import React, { useState, useEffect } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Search, User, FileText, Download, Filter, X, CheckCircle, AlertCircle, Bell, Plus, Eye, PlusCircle } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';
import axios from 'axios';

import styles from './../styles/Students.module.css';

const Students = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [students, setStudents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Состояние для фильтров
  const [filters, setFilters] = useState({
    group: '',
    completionStatus: '',
    sortBy: 'name',
  });

  // Состояние для модальных окон функциональности
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let studentsData = [];
        
        if (user?.role === 'curator') {
          const response = await axios.get('/api/students');
          studentsData = response.data;
        } else if (user?.role === 'parent') {
          const response = await axios.get('/api/parent/students');
          studentsData = response.data;
        }
        
        setStudents(studentsData);
      } catch (err) {
        console.error('Error fetching students:', err);
        
        // Моковые данные при ошибке загрузки
        if (user?.role === 'curator') {
          setStudents([
            { id: 1, name: 'Аслан Ерболов', group: '101', parent: 'Birzhanov Arlan', docsCompleted: 5, docsTotal: 5 },
            { id: 2, name: 'Камила Нуржан', group: '101', parent: 'Нуржан Айдар', docsCompleted: 4, docsTotal: 5 },
            { id: 3, name: 'Диас Мурат', group: '101', parent: 'Мурат Серик', docsCompleted: 5, docsTotal: 5 },
            { id: 4, name: 'Алия Касым', group: '103', parent: 'Касым Дамир', docsCompleted: 3, docsTotal: 5 },
            { id: 5, name: 'Арман Серик', group: '103', parent: 'Серик Болат', docsCompleted: 5, docsTotal: 5 },
          ]);
        } else if (user?.role === 'parent') {
          setStudents([
            { id: 1, name: 'Аслан Ерболов', group: '101', curator: 'Ermek Ahmed', docsCompleted: 5, docsTotal: 5 },
          ]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/documents/student');
        setDocuments(response.data);
      } catch (err) {
        console.error('Error fetching documents:', err);
        
        // Моковые данные для документов
        setDocuments([
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
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    if (user?.role === 'parent') {
      fetchDocuments();
    }
  }, [user?.role]);

  // Фильтрация студентов по поисковому запросу и фильтрам
  const filteredStudents = students.filter(student => {
    // Фильтрация по поиску
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.parent && student.parent.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (student.curator && student.curator.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Фильтрация по группе
    const matchesGroup = filters.group === '' || student.group === filters.group;
    
    // Фильтрация по статусу завершения документов
    let matchesCompletionStatus = true;
    if (filters.completionStatus === 'complete') {
      matchesCompletionStatus = student.docsCompleted === student.docsTotal;
    } else if (filters.completionStatus === 'incomplete') {
      matchesCompletionStatus = student.docsCompleted < student.docsTotal;
    }
    
    return matchesSearch && matchesGroup && matchesCompletionStatus;
  }).sort((a, b) => {
    // Сортировка
    if (filters.sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (filters.sortBy === 'group') {
      return a.group.localeCompare(b.group);
    } else if (filters.sortBy === 'completion') {
      const aCompletionRate = a.docsCompleted / a.docsTotal;
      const bCompletionRate = b.docsCompleted / b.docsTotal;
      return bCompletionRate - aCompletionRate;
    }
    return 0;
  });

  // Получение уникальных групп для фильтрации
  const uniqueGroups = [...new Set(students.map(student => student.group))];

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

  // Обработка изменения фильтров
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Обработка сброса фильтров
  const handleResetFilters = () => {
    setFilters({
      group: '',
      completionStatus: '',
      sortBy: 'name'
    });
  };

  // Обработка открытия модального окна просмотра документов
  const handleViewDocuments = (student) => {
    setCurrentStudent(student);
    setShowDocumentsModal(true);
  };

  // Обработка открытия модального окна добавления документа
  const handleAddDocument = (student) => {
    setCurrentStudent(student);
    setShowAddDocumentModal(true);
  };

  // Обработка открытия модального окна отправки уведомления
  const handleSendNotification = (student) => {
    setCurrentStudent(student);
    setShowNotificationModal(true);
  };

  // Компонент модального окна фильтров
  const FilterModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Фильтры</h3>
          <button className={styles.closeButton} onClick={() => setShowFilterModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.filterGroup}>
            <label>Группа</label>
            <select 
              name="group" 
              value={filters.group} 
              onChange={handleFilterChange}
              className={styles.formControl}
            >
              <option value="">Все группы</option>
              {uniqueGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label>Статус документов</label>
            <select 
              name="completionStatus" 
              value={filters.completionStatus} 
              onChange={handleFilterChange}
              className={styles.formControl}
            >
              <option value="">Все</option>
              <option value="complete">Завершено</option>
              <option value="incomplete">Незавершено</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label>Сортировать по</label>
            <select 
              name="sortBy" 
              value={filters.sortBy} 
              onChange={handleFilterChange}
              className={styles.formControl}
            >
              <option value="name">Имя (А-Я)</option>
              <option value="group">Группа</option>
              <option value="completion">Прогресс документов</option>
            </select>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button 
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={handleResetFilters}
          >
            Сбросить
          </button>
          <button 
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => setShowFilterModal(false)}
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );

  // Компонент модального окна просмотра документов
  const DocumentsModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Документы студента: {currentStudent?.name}</h3>
          <button className={styles.closeButton} onClick={() => setShowDocumentsModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalContent}>
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
                {documents.filter(doc => doc.student === currentStudent?.name).map((doc) => (
                  <tr key={doc.id}>
                    <td className={styles.tableDocCell}>
                      <FileText size={16} />
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
                        <Download size={14} style={{ marginRight: '4px' }} />
                        Скачать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button 
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => handleAddDocument(currentStudent)}
          >
            <PlusCircle size={16} style={{ marginRight: '4px' }} />
            Добавить документ
          </button>
        </div>
      </div>
    </div>
  );

  // Компонент модального окна добавления документа
  const AddDocumentModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Добавить документ для {currentStudent?.name}</h3>
          <button className={styles.closeButton} onClick={() => setShowAddDocumentModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.formGroup}>
            <label>Тип документа</label>
            <select className={styles.formControl}>
              <option value="">Выберите тип документа</option>
              <option value="application">Заявление о приеме</option>
              <option value="consent">Согласие на обработку данных</option>
              <option value="medical">Медицинская карта</option>
              <option value="residence">Справка с места жительства</option>
              <option value="vaccination">Сертификат о вакцинации</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Файл</label>
            <div className={styles.fileUpload}>
              <input type="file" id="document-file" className={styles.fileInput} />
              <label htmlFor="document-file" className={styles.fileLabel}>
                <Plus size={16} style={{ marginRight: '4px' }} />
                Выбрать файл
              </label>
            </div>
            <p className={styles.fileHint}>Поддерживаемые форматы: PDF, JPG, PNG (максимум 5MB)</p>
          </div>
          <div className={styles.formGroup}>
            <label>Комментарий (необязательно)</label>
            <textarea 
              className={styles.formControl} 
              rows="3" 
              placeholder="Добавьте комментарий к документу..."
            ></textarea>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button 
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={() => setShowAddDocumentModal(false)}
          >
            Отмена
          </button>
          <button className={`${styles.button} ${styles.buttonPrimary}`}>
            Загрузить документ
          </button>
        </div>
      </div>
    </div>
  );

  // Компонент модального окна отправки уведомления
  const NotificationModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Отправить уведомление</h3>
          <button className={styles.closeButton} onClick={() => setShowNotificationModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.formGroup}>
            <label>Получатель</label>
            <input
              type="text"
              className={styles.formControl}
              value={`${currentStudent?.name} (${currentStudent?.parent})`}
              disabled
            />
          </div>
          <div className={styles.formGroup}>
            <label>Тема</label>
            <input
              type="text"
              className={styles.formControl}
              placeholder="Введите тему уведомления..."
            />
          </div>
          <div className={styles.formGroup}>
            <label>Сообщение</label>
            <textarea 
              className={styles.formControl} 
              rows="5" 
              placeholder="Введите текст уведомления..."
            ></textarea>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.checkboxContainer}>
              <input type="checkbox" />
              <span className={styles.checkboxLabel}>Отправить также SMS уведомление</span>
            </label>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button 
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={() => setShowNotificationModal(false)}
          >
            Отмена
          </button>
          <button className={`${styles.button} ${styles.buttonPrimary}`}>
            <Bell size={16} style={{ marginRight: '4px' }} />
            Отправить
          </button>
        </div>
      </div>
    </div>
  );

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
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Поиск по студентам..." 
              className={styles.searchInput} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            type="button" 
            className={`${styles.button} ${styles.buttonFilter}`}
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={16} />
            {Object.values(filters).some(v => v !== '' && v !== 'name') && (
              <span className={styles.filterBadge}></span>
            )}
          </button>
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
              {loading ? (
                <div className={styles.loading}>Загрузка данных...</div>
              ) : filteredStudents.length === 0 ? (
                <div className={styles.emptyState}>
                  <User size={48} className={styles.emptyIcon} />
                  <p>Студенты не найдены</p>
                  <p className={styles.emptySubtext}>Попробуйте изменить параметры поиска или фильтры</p>
                </div>
              ) : (
                <div className={styles.studentsListGrid}>
                  {filteredStudents.map((student) => (
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
                              <button 
                                type="button" 
                                className={styles.button}
                                onClick={() => handleViewDocuments(student)}
                              >
                                <Eye size={16} style={{ marginRight: '6px' }} />
                                Управление студентом
                              </button>
                            )}
                            {user?.role === 'parent' && (
                              <button type="button" className={`${styles.button} ${styles.buttonOutline}`}>
                                Связаться с куратором
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.cardContent}>
                        <div className={styles.documentProgressSection}>
                          <h3>
                            <FileText size={18} />
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
                              {student.docsCompleted === student.docsTotal && (
                                <CheckCircle size={16} className={styles.completedIcon} />
                              )}
                              {student.docsCompleted < student.docsTotal && (
                                <AlertCircle size={16} className={styles.pendingIcon} />
                              )}
                            </div>
                          </div>
                        </div>

                        {user?.role === 'curator' && (
                          <div className={styles.studentCardButtons}>
                            <button 
                              type="button" 
                              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                              onClick={() => handleViewDocuments(student)}
                            >
                              <Eye size={14} style={{ marginRight: '4px' }} />
                              Просмотреть документы
                            </button>
                            <button 
                              type="button" 
                              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                              onClick={() => handleAddDocument(student)}
                            >
                              <PlusCircle size={14} style={{ marginRight: '4px' }} />
                              Добавить документ
                            </button>
                            <button 
                              type="button" 
                              className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                              onClick={() => handleSendNotification(student)}
                            >
                              <Bell size={14} style={{ marginRight: '4px' }} />
                              Отправить уведомление
                            </button>
                          </div>
                        )}

                        {user?.role === 'parent' && (
                          <div className={styles.studentCardButtons}>
                            <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                              <Eye size={14} style={{ marginRight: '4px' }} />
                              Просмотреть профиль
                            </button>
                            <button type="button" className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}>
                              <PlusCircle size={14} style={{ marginRight: '4px' }} />
                              Загрузить документ
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                              <FileText size={16} />
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
                                <Download size={14} style={{ marginRight: '4px' }} />
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
        
        {/* Модальные окна */}
        {showFilterModal && <FilterModal />}
        {showDocumentsModal && <DocumentsModal />}
        {showAddDocumentModal && <AddDocumentModal />}
        {showNotificationModal && <NotificationModal />}
      </div>
    </SidebarLayout>
  );
};

export default Students;