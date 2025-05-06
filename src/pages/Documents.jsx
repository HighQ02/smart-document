import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, Upload, Download, CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Documents.module.css';

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

  const [filterStatus, setFilterStatus] = useState('');

  const [pagination, setPagination] = useState({
      limit: 10,
      offset: 0,
      total: 0,
  });
   const [isFetchingMore, setIsFetchingMore] = useState(false);


  // Определения функций fetchDocuments и fetchTemplates вынесены за пределы useEffect
  const fetchDocuments = async (currentOffset = 0) => {
      if (currentOffset > 0) {
          setIsFetchingMore(true);
      } else {
          setIsLoading(true);
          setPagination(prev => ({ ...prev, offset: 0, total: 0 })); // Сброс пагинации при новом фетче
          setDocuments([]); // Очистка списка документов при новом фетче
      }

      try {
        const response = await axios.get('/api/documents', {
          params: {
            status: filterStatus || undefined,
            limit: pagination.limit,
            offset: currentOffset,
          }
        });

        if (response.data && Array.isArray(response.data.items)) {
             setDocuments(prevDocs => currentOffset === 0 ? response.data.items : [...prevDocs, ...response.data.items]);
             setPagination(prev => ({ ...prev, total: response.data.total, offset: currentOffset }));
        } else if (response.data && Array.isArray(response.data)) {
             const formattedDocs = response.data.map((doc) => ({
                id: doc.id,
                name: doc.title || 'Без названия',
                type: doc.file_url?.endsWith('.pdf') ? 'PDF' : doc.file_url?.endsWith('.docx') ? 'DOCX' : 'Файл',
                status: doc.status,
                date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна',
                student_id: doc.student_id,
                student_name: doc.student_name || 'Неизвестно'
              }));
             setDocuments(formattedDocs);
             setPagination(prev => ({ ...prev, total: formattedDocs.length, offset: formattedDocs.length })); // Если нет пагинации от бэкенда
        }
         else {
             console.error('Error fetching documents: Invalid data format', response.data);
             setDocuments([]);
             setPagination(prev => ({ ...prev, total: 0, offset: 0 }));
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocuments([]);
        setPagination(prev => ({ ...prev, total: 0, offset: 0 }));
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    };

    const fetchTemplates = async () => {
      try {
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


  // Effect для вызова функций fetch при изменении зависимостей
  useEffect(() => {
     // Сбрасываем пагинацию и запускаем первый фетч при изменении user/роли или фильтра
     // setIsFetchingMore(false); // Сброс флага при изменении зависимостей
     fetchDocuments(0);
     fetchTemplates();

  }, [user?.id, user?.role, filterStatus]); // Зависимости, при изменении которых происходит повторный фетч


  const handleFetchMore = () => {
      // Вызываем fetchDocuments с новым смещением
      fetchDocuments(pagination.offset + pagination.limit);
  }


  const filteredDocuments = documents.filter(doc =>
    (doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) || '') ||
    (doc.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) || '')
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
      case 'archived':
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
              return styles.statusArchived;
          default:
              return '';
      }
  };

  const approveDocument = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    try {
      const response = await axios.put(`/api/documents/${selectedDoc.id}/status`, {
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
         const errorData = response.data || { message: 'Неизвестная ошибка сервера' };
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
         return;
    }
    setIsLoading(true);
    try {
      const response = await axios.put(`/api/documents/${selectedDoc.id}/status`, {
          status: 'rejected',
          review_comment: rejectReason.trim(),
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
          const errorData = response.data || { message: 'Неизвестная ошибка сервера' };
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

  const downloadDocument = async (doc) => {
    try {
      const response = await axios.get(`/api/documents/${doc.id}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = doc.name || 'document';
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

  const viewDocument = (doc) => {
      console.log('Просмотр документа:', doc);
      alert(`Просмотр документа "${doc.name}" (Функционал в разработке)`);
  }

  const archiveDocument = async (doc) => {
      if (!window.confirm(`Вы уверены, что хотите архивировать документ "${doc.name}"?`)) {
          return;
      }
      setIsLoading(true);
      try {
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
               const errorData = response.data || { message: 'Неизвестная ошибка сервера' };
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

   const uploadAgain = (doc) => {
        console.log('Загрузить заново документ:', doc);
        navigate('/create-document', { state: { documentToReplaceId: doc.id, documentName: doc.name } });
   }


  const getActionButtons = (doc) => {
    switch (user?.role) {
      case 'admin':
        return (
          <div className={styles.documentActions}>
            <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => downloadDocument(doc)} disabled={isLoading || isFetchingMore}>
              <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
              Скачать
            </button>
          </div>
        );
      case 'curator':
        return (
          <div className={styles.documentActions}>
            <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => downloadDocument(doc)} disabled={isLoading || isFetchingMore}>
               <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Скачать
            </button>
            {doc.status === 'pending' && (
              <>
                <button
                  className={`${styles.btnOutline} ${styles.btn}`}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowApproveDialog(true);
                  }}
                   disabled={isLoading || isFetchingMore}
                >
                   <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Одобрить
                </button>
                <button
                  className={`${styles.btnOutline} ${styles.btnDanger} ${styles.btn}`}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setShowRejectDialog(true);
                  }}
                   disabled={isLoading || isFetchingMore}
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
             <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => viewDocument(doc)} disabled={isLoading || isFetchingMore}>
               <Eye style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Просмотр
            </button>
            <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => downloadDocument(doc)} disabled={isLoading || isFetchingMore}>
               <Download style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Скачать
            </button>
            {doc.status === 'rejected' && (
              <button className={`${styles.btnPrimary} ${styles.btn}`} onClick={() => uploadAgain(doc)} disabled={isLoading || isFetchingMore}>
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

          {(user?.role === 'admin' || user?.role === 'curator' || user?.role === 'parent') && (
             <button className={`${styles.btnPrimary} ${styles.btn}`} onClick={() => navigate('/create-document')} disabled={isLoading || isFetchingMore}>
               <Upload style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Создать/Загрузить документ
             </button>
           )}
        </div>

        <div className={styles.searchAndFilter}>
          <div className={styles.searchInputContainer}>
            <Search style={{width: '1.1em', height: '1.1em'}} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Поиск документов по названию или студенту..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading || isFetchingMore}
            />
          </div>
           <div className={styles.filterControls}>
               <select
                   value={filterStatus}
                   onChange={(e) => setFilterStatus(e.target.value)}
                   className={styles.selectInput}
                   disabled={isLoading || isFetchingMore}
               >
                   <option value="">Все статусы</option>
                   <option value="pending">Ожидает проверки</option>
                   <option value="approved">Одобрен</option>
                   <option value="rejected">Отклонен</option>
                    <option value="new">Новый</option>
                    <option value="archived">В архиве</option>
               </select>
           </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Список документов</h3>
            <p className={styles.cardDescription}>
              {user?.role === 'admin'
                ? `Все документы в системе (${pagination.total})`
                : user?.role === 'curator'
                ? 'Документы для вашей группы и отправленные вами'
                : 'Ваши документы'}
            </p>
          </div>
          <div className={styles.cardContent}>
            {isLoading && !isFetchingMore ? (
              <div className={styles.loadingContainer}>
                <Loader2 className={styles.loadingSpinner} style={{width: '2em', height: '2em'}} />
                <p>Загрузка документов...</p>
              </div>
            ) : filteredDocuments.length === 0 && !isLoading ? (
              <div className={styles.emptyContainer}>
                <p>
                  {searchQuery
                    ? 'Документы не найдены по вашему запросу. Попробуйте изменить параметры поиска.'
                    : filterStatus
                    ? `Документы со статусом "${translateStatus(filterStatus)}" не найдены.`
                    : 'Документы отсутствуют.'}
                </p>
              </div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.documentsTable}>
                  <thead>
                    <tr>
                      <th>Название</th>
                      {(user?.role === 'admin' || user?.role === 'curator') && (
                        <th>Студент</th>
                      )}
                      <th>Тип</th>
                      <th>Статус</th>
                      <th>Дата</th>
                      <th className={styles.actionsHeader}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td className={styles.documentNameCell}>
                          <FileText style={{width: '1.1em', height: '1.1em'}} />
                          {doc.name}
                        </td>
                         {(user?.role === 'admin' || user?.role === 'curator') && (
                           <td>{doc.student_name || 'Неизвестно'}</td>
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

            {user?.role === 'admin' && filteredDocuments.length > 0 && filteredDocuments.length < pagination.total && (
                <div className={styles.paginationControls}>
                    <button
                        className={styles.showMoreButton}
                        onClick={handleFetchMore}
                        disabled={isLoading || isFetchingMore}
                    >
                        {isFetchingMore ? (
                           <>
                             <Loader2 className={styles.loadingSpinnerSmall} /> Загрузка...
                           </>
                         ) : (
                            `Показать еще ${Math.min(pagination.limit, pagination.total - filteredDocuments.length)} из ${pagination.total - filteredDocuments.length}`
                         )}
                    </button>
                </div>
            )}

             {isFetchingMore && user?.role !== 'admin' && (
                 <div className={styles.loadingContainer}>
                     <Loader2 className={styles.loadingSpinnerSmall} />
                     <p>Загрузка дополнительных документов...</p>
                 </div>
             )}

          </div>
        </div>

        {/* Шаблоны документов */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Шаблоны документов</h3>
            <p className={styles.cardDescription}>Используйте шаблоны для быстрого создания документов</p>
          </div>
          <div className={styles.cardContent}>
             {isLoading && templates.length === 0 ? (
                 <div className={styles.loadingContainer}>
                     <Loader2 className={styles.loadingSpinnerSmall} />
                     <p>Загрузка шаблонов...</p>
                 </div>
             ) : templates.length === 0 ? (
                 <div className={styles.emptyContainer}>
                     <p>Шаблоны документов отсутствуют или недоступны.</p>
                 </div>
             ) : (
                <div className={styles.templatesGrid}>
                  {templates.map((template) => (
                    <div key={template.id} className={styles.templateCard}>
                      <div className={styles.templateHeader}>
                        <div className={styles.templateTitle}>
                          <FileText style={{width: '1.1em', height: '1.1em', color: 'hsl(221, 83%, 53%)'}} />
                          <h3>Шаблон: {template.name}</h3>
                        </div>
                      </div>
                      <p className={styles.templateDescription}>
                        {template.description || 'Без описания'}
                      </p>
                       <div className={styles.templateActions}>
                           {user?.role === 'admin' && (
                                <button className={`${styles.btnOutline} ${styles.btn}`} disabled={isLoading || isFetchingMore}>
                                  Редактировать
                                </button>
                           )}
                            <button className={`${styles.btnOutline} ${styles.btn}`} disabled={isLoading || isFetchingMore}>
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

        {showApproveDialog && selectedDoc && (
          <div className={styles.modalBackdrop} onClick={() => { setShowApproveDialog(false); setSelectedDoc(null); }}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Подтверждение одобрения</h3>
              </div>
              <div className={styles.modalBody}>
                <p>Вы уверены, что хотите одобрить документ "{selectedDoc.name}"?</p>
              </div>
              <div className={styles.modalFooter}>
                <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => { setShowApproveDialog(false); setSelectedDoc(null); }} disabled={isLoading || isFetchingMore}>Отмена</button>
                <button className={`${styles.btnPrimary} ${styles.btn}`} onClick={approveDocument} disabled={isLoading || isFetchingMore}>
                   <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Одобрить
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectDialog && selectedDoc && (
          <div className={styles.modalBackdrop} onClick={() => { setShowRejectDialog(false); setSelectedDoc(null); setRejectReason(''); }}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                     disabled={isLoading || isFetchingMore}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={`${styles.btnOutline} ${styles.btn}`} onClick={() => { setShowRejectDialog(false); setSelectedDoc(null); setRejectReason(''); }} disabled={isLoading || isFetchingMore}>Отмена</button>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={rejectDocument}
                  disabled={!rejectReason.trim() || isLoading || isFetchingMore}
                >
                  <XCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
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