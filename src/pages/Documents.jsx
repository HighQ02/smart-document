import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, Upload, Download, CheckCircle, XCircle, Eye } from 'lucide-react'; // Заменили QrCode на более подходящие иконки
import SidebarLayout from './../components/layouts/SidebarLayout';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Documents.module.css'; // Убедитесь, что путь правильный

const Documents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        // Замените на ваш актуальный эндпоинт для получения документов
        const response = await axios.get('/api/documents', {
          params: {
            // Возможно, здесь нужно добавить параметры для фильтрации по роли пользователя
            // Например, student_id для родителя, group_id для куратора, или без параметров для админа
            ...(user?.role === 'parent' && { student_id: user.student_id }), // Пример фильтрации для родителя
            // ...(user?.role === 'curator' && { group_id: user.group_id }), // Пример фильтрации для куратора
          }
        });

        if (response.data && Array.isArray(response.data)) {
          const formattedDocs = response.data.map((doc) => ({
            id: doc.id,
            name: doc.title || 'Без названия', // Убедимся, что есть название
            type: doc.name?.endsWith('.pdf') ? 'PDF' :
                  doc.name?.endsWith('.docx') ? 'DOCX' : 'Файл',
            status: doc.status,
            date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна', // Проверка на наличие даты
            student_id: doc.student_id,
            student_name: doc.student_name || 'Неизвестно' // Убедимся, что есть имя студента
          }));
          setDocuments(formattedDocs);
        } else {
             console.error('Error fetching documents: Invalid data format', response.data);
             setDocuments([]); // Устанавливаем пустой массив при ошибке формата
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        // Обработка ошибки: показать сообщение пользователю или установить пустое состояние
        setDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTemplates = async () => {
      try {
        // Замените на ваш актуальный эндпоинт для получения шаблонов
        const response = await axios.get('/api/document-templates');
        if (response.data && Array.isArray(response.data)) {
           setTemplates(response.data);
        } else {
           console.warn('No templates found or invalid data format', response.data);
           setTemplates([]);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
        setTemplates([]);
      }
    };

    fetchDocuments();
    // Загружаем шаблоны только для админа
    if (user?.role === 'admin') {
      fetchTemplates();
    }

    // Убираем setTimeout, если нет необходимости в имитации задержки
    // const timer = setTimeout(() => setIsLoading(false), 1000);
    // return () => clearTimeout(timer);

  }, [user?.role, user?.student_id]); // Добавляем user?.student_id в зависимости, если используется для фильтрации


  const filteredDocuments = documents.filter(doc =>
    (doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') || // Добавлена проверка на doc.name
    (doc.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') // Добавлена проверка на doc.student_name
  );

  const translateStatus = (status) => {
    switch (status) {
      case 'approved':
        return 'Одобрен';
      case 'pending':
        return 'Ожидает проверки';
      case 'rejected':
        return 'Отклонен';
      case 'new':
        return 'Новый';
      case 'archived': // Добавляем статус архивирован
        return 'В архиве';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status) => {
      switch (status) {
          case 'approved':
              return styles.statusApproved;
          case 'pending':
              return styles.statusPending;
          case 'rejected':
              return styles.statusRejected;
           case 'new':
              return styles.statusNew;
           case 'archived':
              return styles.statusArchived; // Добавляем класс для архивированных
          default:
              return '';
      }
  };

  const approveDocument = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    try {
      const response = await axios.put(`/api/documents/${selectedDoc.id}/status`, { // Пример эндпоинта для смены статуса
          status: 'approved',
          reviewed_by: user?.id,
      });

      if (response.status === 200) {
          setDocuments(prevDocs =>
            prevDocs.map(doc =>
              doc.id === selectedDoc.id ? { ...doc, status: 'approved' } : doc
            )
          );
          console.log(`Документ "${selectedDoc.name}" был успешно одобрен`);
      } else {
         // Обработка ошибок HTTP (не 200)
         const errorData = await response.json(); // Попытка прочитать тело ответа
         console.error(`Ошибка сервера при одобрении: ${response.status}`, errorData);
         alert(`Ошибка при одобрении документа: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error approving document:', error);
      alert('Ошибка при одобрении документа. Попробуйте снова.');
    } finally {
      setShowApproveDialog(false);
      setSelectedDoc(null);
      setIsLoading(false);
    }
  };

  const rejectDocument = async () => {
    if (!selectedDoc) return;
    if (!rejectReason.trim()) {
         console.log('Укажите причину отклонения');
         // Возможно, стоит показать пользователю уведомление
         return;
    }
    setIsLoading(true);
    try {
      const response = await axios.put(`/api/documents/${selectedDoc.id}/status`, { // Пример эндпоинта для смены статуса
          status: 'rejected',
          review_comment: rejectReason.trim(), // Убираем лишние пробелы
          reviewed_by: user?.id,
      });

       if (response.status === 200) {
          setDocuments(prevDocs =>
            prevDocs.map(doc =>
              doc.id === selectedDoc.id ? { ...doc, status: 'rejected' } : doc
            )
          );
          console.log(`Документ "${selectedDoc.name}" был отклонен`);
       } else {
          // Обработка ошибок HTTP (не 200)
          const errorData = await response.json();
          console.error(`Ошибка сервера при отклонении: ${response.status}`, errorData);
          alert(`Ошибка при отклонении документа: ${errorData.message || response.statusText}`);
       }
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Ошибка при отклонении документа. Попробуйте снова.');
    } finally {
      setShowRejectDialog(false);
      setSelectedDoc(null);
      setRejectReason('');
      setIsLoading(false);
    }
  };

  // Функция для скачивания документа
  const downloadDocument = async (doc) => {
    try {
      // Замените на ваш актуальный эндпоинт для скачивания
      const response = await axios.get(`/api/documents/${doc.id}/download`, {
        responseType: 'blob', // Важно для скачивания файлов
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Попытка получить имя файла из заголовков или использовать имя из данных
      const contentDisposition = response.headers['content-disposition'];
      let filename = doc.name || 'document'; // Имя файла по умолчанию
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Ошибка при скачивании документа.');
    }
  };

   // Функция для просмотра документа (для родителя)
  const viewDocument = (doc) => {
      console.log('Просмотр документа:', doc);
      // Реализация просмотра документа. Возможно, открытие в новом окне
      // или модальном окне с iframe/pdf-viewer
      alert(`Просмотр документа "${doc.name}" (Функционал в разработке)`);
  }

  // Функция для архивирования документа (для админа)
  const archiveDocument = async (doc) => {
      if (!window.confirm(`Вы уверены, что хотите архивировать документ "${doc.name}"?`)) {
          return;
      }
      setIsLoading(true);
      try {
           // Замените на ваш актуальный эндпоинт для архивирования
          const response = await axios.put(`/api/documents/${doc.id}/status`, {
               status: 'archived',
               reviewed_by: user?.id,
           });

           if (response.status === 200) {
               setDocuments(prevDocs =>
                   prevDocs.map(d =>
                       d.id === doc.id ? { ...d, status: 'archived' } : d
                   )
               );
               console.log(`Документ "${doc.name}" был архивирован`);
           } else {
               const errorData = await response.json();
               console.error(`Ошибка сервера при архивировании: ${response.status}`, errorData);
               alert(`Ошибка при архивировании документа: ${errorData.message || response.statusText}`);
           }
      } catch (error) {
          console.error('Error archiving document:', error);
          alert('Ошибка при архивировании документа. Попробуйте снова.');
      } finally {
          setIsLoading(false);
      }
  }

   // Функция для загрузки документа заново (для родителя после отклонения)
   const uploadAgain = (doc) => {
        console.log('Загрузить заново документ:', doc);
        // Перенаправление на страницу загрузки с предзаполненными данными
        // или открытие модального окна для загрузки новой версии
        navigate('/create-document', { state: { documentToReplaceId: doc.id, documentName: doc.name } });
   }


  const getActionButtons = (doc) => {
    switch (user?.role) {
      case 'admin':
        return (
          <div className={styles.documentActions}>
            <button className={styles.btnOutline} onClick={() => downloadDocument(doc)} disabled={isLoading}>
              <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
              Скачать
            </button>
            {doc.status === 'pending' && (
              <>
                <button
                  className={styles.btnOutline}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowApproveDialog(true);
                  }}
                  disabled={isLoading}
                >
                   <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Одобрить
                </button>
                <button
                  className={`${styles.btnOutline} ${styles.btnDanger}`}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowRejectDialog(true);
                  }}
                   disabled={isLoading}
                >
                  <XCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                  Отклонить
                </button>
              </>
            )}
             {(doc.status === 'approved' || doc.status === 'rejected') && (
                 <button className={styles.btnOutline} onClick={() => archiveDocument(doc)} disabled={isLoading || doc.status === 'archived'}>
                      Архивировать
                  </button>
             )}
          </div>
        );
      case 'curator':
        return (
          <div className={styles.documentActions}>
            <button className={styles.btnOutline} onClick={() => downloadDocument(doc)} disabled={isLoading}>
               <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Скачать
            </button>
            {doc.status === 'pending' && (
              <>
                <button
                  className={styles.btnOutline}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowApproveDialog(true);
                  }}
                   disabled={isLoading}
                >
                   <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Одобрить
                </button>
                <button
                  className={`${styles.btnOutline} ${styles.btnDanger}`}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowRejectDialog(true);
                  }}
                   disabled={isLoading}
                >
                   <XCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Отклонить
                </button>
              </>
            )}
          </div>
        );
      case 'parent':
        return (
          <div className={styles.documentActions}>
             <button className={styles.btnOutline} onClick={() => viewDocument(doc)} disabled={isLoading}>
               <Eye style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Просмотр
            </button>
            <button className={styles.btnOutline} onClick={() => downloadDocument(doc)} disabled={isLoading}>
               <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Скачать
            </button>
            {doc.status === 'rejected' && (
              <button className={styles.btnPrimary} onClick={() => uploadAgain(doc)} disabled={isLoading}>
                Загрузить заново
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarLayout>
      <div className={styles.documentsContainer}>
        <div className={styles.documentsHeader}>
          <div>
            <h2 className={styles.pageTitle}>Документы</h2>
            <p className={styles.pageDescription}>Управление документами и файлами</p>
          </div>

          {/* Кнопка "Создать/Загрузить документ" всегда видима для соответствующих ролей */}
          {(user?.role === 'admin' || user?.role === 'curator' || user?.role === 'parent') && (
            <button className={styles.btnPrimary} onClick={() => navigate('/create-document')}>
              <Upload style={{width: '1em', height: '1em', marginRight: '6px'}} />
              Создать/Загрузить документ
            </button>
          )}
        </div>

        <div className={styles.searchAndFilter}> {/* Объединяем поиск и фильтр в один блок */}
          <div className={styles.searchInputContainer}>
            <Search style={{width: '1.1em', height: '1.1em'}} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Поиск документов..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {/* Placeholder для будущих фильтров, как на фото */}
          <button className={styles.btnOutline} disabled={isLoading}>
                Фильтры
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Список документов</h3>
            <p className={styles.cardDescription}>
              {user?.role === 'admin'
                ? 'Все документы в системе'
                : user?.role === 'curator'
                ? 'Документы для вашей группы'
                : 'Ваши документы'}
            </p>
          </div>
          <div className={styles.cardContent}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <p>Загрузка документов...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className={styles.emptyContainer}>
                <p>
                  {searchQuery
                    ? 'Документы не найдены. Попробуйте изменить параметры поиска.'
                    : 'Документы отсутствуют.'}
                </p>
              </div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.documentsTable}>
                  <thead>
                    <tr>
                      <th>Название</th>
                      {/* Колонка "Студент" отображается только для админа и куратора */}
                      {(user?.role === 'admin' || user?.role === 'curator') && (
                        <th>Студент</th>
                      )}
                      <th>Тип</th>
                      <th>Статус</th>
                      <th>Дата</th>
                      <th className={styles.actionsHeader}>Действия</th> {/* Добавлен класс для стилизации заголовка */}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td className={styles.documentNameCell}> {/* Добавлен класс для ячейки с названием */}
                          <FileText style={{width: '1.1em', height: '1.1em'}} />
                          {doc.name}
                        </td>
                        {(user?.role === 'admin' || user?.role === 'curator') && (
                          <td>{doc.student_name}</td>
                        )}
                        <td>{doc.type || 'Файл'}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${getStatusBadgeClass(doc.status)}`}>
                            {translateStatus(doc.status)}
                          </span>
                        </td>
                        <td>{doc.date}</td>
                        <td>
                          {getActionButtons(doc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Шаблоны документов</h3>
              <p className={styles.cardDescription}>Управление шаблонами для автоматического создания документов</p>
            </div>
            <div className={styles.cardContent}>
              {templates.length === 0 ? (
                  <div className={styles.emptyContainer}>
                      <p>Шаблоны документов отсутствуют.</p>
                  </div>
              ) : (
                  <div className={styles.templatesGrid}>
                    {templates.map((template) => (
                      <div key={template.id} className={styles.templateCard}>
                        <div className={styles.templateHeader}>
                          <div className={styles.templateTitle}>
                            <FileText style={{width: '1.1em', height: '1.1em', color: '#007bff'}} /> {/* Цвет иконки */}
                            <h3>Шаблон: {template.name}</h3>
                          </div>
                          {/* Кнопка добавления (плюс) на фото */}
                          {/* <button className={styles.btnAddTemplate}>
                              <Plus style={{width: '1em', height: '1em'}} />
                          </button> */}
                        </div>
                        <p className={styles.templateDescription}>
                          {template.description || 'Без описания'} {/* Проверка на описание */}
                        </p>
                        <div className={styles.templateActions}>
                          {/* Возможно, кнопка редактирования нужна только для админа */}
                          <button className={styles.btnOutline} disabled={isLoading}>
                            Редактировать
                          </button>
                          <button className={styles.btnOutline} disabled={isLoading}>
                            <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
                            Скачать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
            </div>
          </div>
        )}

        {/* Модальное окно одобрения */}
        {showApproveDialog && selectedDoc && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Подтверждение одобрения</h3>
              </div>
              <div className={styles.modalBody}>
                <p>Вы уверены, что хотите одобрить документ "{selectedDoc.name}"?</p>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnOutline} onClick={() => { setShowApproveDialog(false); setSelectedDoc(null); }} disabled={isLoading}>Отмена</button>
                <button className={styles.btnPrimary} onClick={approveDocument} disabled={isLoading}>
                  <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} /> {/* Иконка Одобрить */}
                  Одобрить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно отклонения */}
        {showRejectDialog && selectedDoc && (
          <div className={styles.modalBackdrop}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Отклонение документа</h3>
              </div>
              <div className={styles.modalBody}>
                <p>Пожалуйста, укажите причину отклонения документа "{selectedDoc.name}"</p>
                <div className={styles.formGroup}>
                  <label htmlFor="rejectReason" className={styles.formLabel}>Причина отклонения</label>
                  <input
                    id="rejectReason"
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Укажите причину отклонения"
                    className={styles.formInput}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnOutline} onClick={() => { setShowRejectDialog(false); setSelectedDoc(null); setRejectReason(''); }} disabled={isLoading}>Отмена</button>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={rejectDocument}
                  disabled={!rejectReason.trim() || isLoading}
                >
                  <XCircle style={{width: '1em', height: '1em', marginRight: '6px'}} /> {/* Иконка Отклонить */}
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
};

export default Documents;