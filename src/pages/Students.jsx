import React, { useState } from 'react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Search, User, FileText, Download } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import './../styles/Students.module.css';

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

  // Get status class for badge
  const getStatusClass = (status) => {
    // Replace spaces with underscores for CSS class names
    const formattedStatus = status.replace(/\s+/g, '_');
    switch (formattedStatus) {
      case 'Одобрен':
        return 'status-indicator-Одобрен';
      case 'В_обработке':
        return 'status-indicator-В_обработке';
      case 'Ожидает_проверки':
        return 'status-indicator-Ожидает_проверки';
      case 'Отклонен':
        return 'status-indicator-Отклонен';
      default:
        return 'status-indicator-default';
    }
  };

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  return (
    <SidebarLayout>
      <div className="students-container">
        <div>
          <h2 className="page-title">Студенты</h2>
          <p className="page-description">
            {user?.role === 'curator'
              ? 'Управление студентами ваших групп'
              : 'Информация о ваших детях'}
          </p>
        </div>

        <div className="search-filter-area">
          <div className="search-input-container">
            <Search className="search-icon" />
            <input type="text" placeholder="Поиск по студентам..." className="search-input" />
          </div>
          <button type="button" className="button button-outline">Фильтры</button>
        </div>

        <div className="tabs-container">
          <div className="tabs-list">
            <button
              className={`tabs-trigger ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => handleTabChange('list')}
            >
              Список студентов
            </button>
            {user?.role === 'parent' && (
              <button
                className={`tabs-trigger ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => handleTabChange('documents')}
              >
                Документы
              </button>
            )}
          </div>

          {activeTab === 'list' && (
            <div className="tabs-content">
              <div className="students-list-grid">
                {students.map((student) => (
                  <div key={student.id} className="card">
                    <div className="card-header">
                      <div className="student-card-header">
                        <div className="student-info">
                          <div className="student-avatar">
                            <User />
                          </div>
                          <div>
                            <h3 className="student-name">{student.name}</h3>
                            <p className="student-meta">
                              Группа {student.group}
                              {user?.role === 'parent' && student.curator && ` • Куратор: ${student.curator}`}
                              {user?.role === 'curator' && student.parent && ` • Родитель: ${student.parent}`}
                            </p>
                          </div>
                        </div>
                        <div className="student-actions">
                          {user?.role === 'curator' && (
                            <button type="button" className="button">Управление студентом</button>
                          )}
                          {user?.role === 'parent' && (
                            <button type="button" className="button button-outline">Связаться с куратором</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="card-content">
                      <div className="document-progress-section">
                        <h3>
                          <FileText />
                          Документы
                        </h3>
                        <div className="progress-container">
                          <div className="progress-bar-container">
                            <div
                              className="progress-bar"
                              style={{ width: `${(student.docsCompleted / student.docsTotal) * 100}%` }}
                            ></div>
                          </div>
                          <div className="progress-text">
                            {student.docsCompleted}/{student.docsTotal} документов
                          </div>
                        </div>
                      </div>

                      {user?.role === 'curator' && (
                        <div className="student-card-buttons">
                          <button type="button" className="button button-outline button-small">
                            Просмотреть документы
                          </button>
                          <button type="button" className="button button-outline button-small">
                            Добавить документ
                          </button>
                          <button type="button" className="button button-outline button-small">
                            Отправить уведомление
                          </button>
                        </div>
                      )}

                      {user?.role === 'parent' && (
                        <div className="student-card-buttons">
                          <button type="button" className="button button-outline button-small">
                            Просмотреть профиль
                          </button>
                          <button type="button" className="button button-outline button-small">
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
            <div className="tabs-content">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Документы вашего ребенка</h3>
                  <p className="card-description">Просмотр и управление документами</p>
                </div>
                <div className="card-content">
                  <div className="documents-table-container">
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
                            <td className="table-doc-cell">
                              <FileText />
                              {doc.name}
                            </td>
                            <td>
                              <span className={`status-indicator ${getStatusClass(doc.status)}`}>
                                {doc.status}
                              </span>
                            </td>
                            <td>{doc.date}</td>
                            <td>
                              <button type="button" className="button button-outline button-small">
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