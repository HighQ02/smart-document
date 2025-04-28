import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, Upload, Download, CheckCircle, XCircle, Eye, Filter, ChevronDown, ChevronUp, AlertTriangle, Tag, SortAsc, SortDesc, Check, Calendar, X } from 'lucide-react';
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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    dateRange: 'all',
    sortBy: 'date',
    sortDirection: 'desc'
  });
  const [showDownloadNotification, setShowDownloadNotification] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('/api/documents', {
          params: {
            ...(user?.role === 'parent' && { student_id: user.student_id }),
          }
        });

        if (response.data && Array.isArray(response.data)) {
          const formattedDocs = response.data.map((doc) => ({
            id: doc.id,
            name: doc.title || 'Без названия',
            type: doc.name?.endsWith('.pdf') ? 'PDF' :
                  doc.name?.endsWith('.docx') ? 'DOCX' : 'Файл',
            status: doc.status,
            date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна',
            student_id: doc.student_id,
            student_name: doc.student_name || 'Неизвестно'
          }));
          setDocuments(formattedDocs);
        } else {
             console.error('Error fetching documents: Invalid data format', response.data);
             setDocuments([]);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocuments([]);
      } finally {
        setIsLoading(false);
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

    fetchDocuments();
    if (user?.role === 'admin' || user?.role === 'curator') {
      fetchTemplates();
    }
  }, [user?.role, user?.student_id]);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filters.type === 'all' || doc.type === filters.type;
    
    const matchesStatus = filters.status === 'all' || doc.status === filters.status;
    
    const matchesDate = filters.dateRange === 'all';
    
    return matchesSearch && matchesType && matchesStatus && matchesDate;
  }).sort((a, b) => {
    const field = filters.sortBy;
    
    const direction = filters.sortDirection === 'asc' ? 1 : -1;
    
    if (field === 'date') {
      const dateA = a.date.split('.').reverse().join('-');
      const dateB = b.date.split('.').reverse().join('-');
      return direction * (new Date(dateA) - new Date(dateB));
    }
    
    if (field === 'name') {
      return direction * a.name.localeCompare(b.name);
    }
    
    if (field === 'status') {
      return direction * a.status.localeCompare(b.status);
    }
    
    return 0;
  });

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
         const errorData = await response.json();
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

  const downloadDocument = (doc) => {
    setShowDownloadNotification(true);
    setDownloadingFile(doc);
    setDownloadProgress(0);
    
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setShowDownloadNotification(false);
          }, 1500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const cancelDownload = () => {
    setShowDownloadNotification(false);
    setDownloadingFile(null);
    setDownloadProgress(0);
  };

  const previewTemplate = (template) => {
    setSelectedTemplate(template);
    setShowTemplatePreview(true);
  };

  const downloadTemplate = (template) => {
    downloadDocument(template);
  };

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

  const uploadAgain = (doc) => {
        console.log('Загрузить заново документ:', doc);
        navigate('/create-document', { state: { documentToReplaceId: doc.id, documentName: doc.name } });
   }

  return (
    <SidebarLayout>
      <div className={styles.documentsContainer}>
        <div className={styles.documentsHeader}>
          <div>
            <h2 className={styles.pageTitle}>Документы</h2>
            <p className={styles.pageDescription}>Управление документами и файлами</p>
          </div>

          {(user?.role === 'admin' || user?.role === 'curator' || user?.role === 'parent') && (
            <button className={styles.btnPrimary} onClick={() => navigate('/create-document')}>
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
              placeholder="Поиск документов..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button 
            className={styles.filterButton}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <Filter className={styles.filterIcon} />
            <span className={styles.filterButtonText}>Фильтры</span>
            {showFilters ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {showFilters && (
          <div className={styles.filtersPanel}>
            <div className={styles.filterGroup}>
              <h4 className={styles.filterGroupTitle}>
                <Tag className={styles.filterGroupIcon} />
                Тип документа
              </h4>
              <div className={styles.filterOptions}>
                <button 
                  className={`${styles.filterOption} ${filters.type === 'all' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, type: 'all'})}
                >
                  Все
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.type === 'PDF' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, type: 'PDF'})}
                >
                  PDF
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.type === 'DOCX' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, type: 'DOCX'})}
                >
                  DOCX
                </button>
              </div>
            </div>
            
            <div className={styles.filterGroup}>
              <h4 className={styles.filterGroupTitle}>
                <Check className={styles.filterGroupIcon} />
                Статус
              </h4>
              <div className={styles.filterOptions}>
                <button 
                  className={`${styles.filterOption} ${filters.status === 'all' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, status: 'all'})}
                >
                  Все
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.status === 'new' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, status: 'new'})}
                >
                  Новые
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.status === 'pending' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, status: 'pending'})}
                >
                  Ожидающие
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.status === 'approved' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, status: 'approved'})}
                >
                  Одобренные
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.status === 'rejected' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, status: 'rejected'})}
                >
                  Отклоненные
                </button>
              </div>
            </div>
            
            <div className={styles.filterGroup}>
              <h4 className={styles.filterGroupTitle}>
                <Calendar className={styles.filterGroupIcon} />
                Период
              </h4>
              <div className={styles.filterOptions}>
                <button 
                  className={`${styles.filterOption} ${filters.dateRange === 'all' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, dateRange: 'all'})}
                >
                  Все время
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.dateRange === 'week' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, dateRange: 'week'})}
                >
                  Неделя
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.dateRange === 'month' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, dateRange: 'month'})}
                >
                  Месяц
                </button>
                <button 
                  className={`${styles.filterOption} ${filters.dateRange === 'year' ? styles.activeFilter : ''}`}
                  onClick={() => setFilters({...filters, dateRange: 'year'})}
                >
                  Год
                </button>
              </div>
            </div>
            
            <div className={styles.filterGroup}>
              <h4 className={styles.filterGroupTitle}>
                <SortAsc className={styles.filterGroupIcon} />
                Сортировка
              </h4>
              <div className={styles.filterOptions}>
                <div className={styles.sortOptionGroup}>
                  <select 
                    className={styles.sortSelect}
                    value={filters.sortBy}
                    onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                  >
                    <option value="date">По дате</option>
                    <option value="name">По названию</option>
                    <option value="status">По статусу</option>
                  </select>
                  <button 
                    className={styles.sortDirectionButton}
                    onClick={() => setFilters({
                      ...filters, 
                      sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc'
                    })}
                  >
                    {filters.sortDirection === 'asc' ? <SortAsc /> : <SortDesc />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className={styles.filterActions}>
              <button 
                className={styles.resetFiltersButton}
                onClick={() => setFilters({
                  type: 'all',
                  status: 'all',
                  dateRange: 'all',
                  sortBy: 'date',
                  sortDirection: 'desc'
                })}
              >
                Сбросить
              </button>
              <button 
                className={styles.saveFiltersButton}
                onClick={() => {
                  setShowFilters(false);
                }}
              >
                Применить фильтры
              </button>
            </div>
          </div>
        )}

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
                            <FileText style={{width: '1.1em', height: '1.1em', color: '#007bff'}} />
                            <h3>Шаблон: {template.name}</h3>
                          </div>
                        </div>
                        <p className={styles.templateDescription}>
                          {template.description || 'Без описания'}
                        </p>
                        <div className={styles.templateActions}>
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

        {showDownloadNotification && downloadingFile && (
          <div className={styles.downloadNotification}>
            <div className={styles.downloadNotificationContent}>
              <div className={styles.downloadNotificationHeader}>
                <FileText className={styles.downloadNotificationIcon} />
                <div className={styles.downloadNotificationInfo}>
                  <p className={styles.downloadNotificationTitle}>
                    {downloadProgress < 100 ? 'Скачивание файла...' : 'Файл скачан'}
                  </p>
                  <p className={styles.downloadNotificationFilename}>{downloadingFile.name}</p>
                </div>
                <button 
                  className={styles.downloadNotificationClose}
                  onClick={() => setShowDownloadNotification(false)}
                >
                  <X className={styles.closeIcon} />
                </button>
              </div>
              
              <div className={styles.downloadProgressContainer}>
                <div 
                  className={styles.downloadProgressBar} 
                  style={{width: `${downloadProgress}%`}}
                ></div>
              </div>
              
              <div className={styles.downloadNotificationFooter}>
                {downloadProgress < 100 ? (
                  <button 
                    className={styles.cancelDownloadButton}
                    onClick={cancelDownload}
                  >
                    Отменить
                  </button>
                ) : (
                  <button 
                    className={styles.openFolderButton}
                    onClick={() => {
                      setShowDownloadNotification(false);
                    }}
                  >
                    Открыть папку
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {showTemplatePreview && selectedTemplate && (
          <div className={styles.templatePreviewModal}>
            <div className={styles.templatePreviewContent}>
              <div className={styles.templatePreviewHeader}>
                <h3>Предпросмотр шаблона</h3>
                <button 
                  className={styles.templatePreviewClose}
                  onClick={() => setShowTemplatePreview(false)}
                >
                  <X className={styles.closeIcon} />
                </button>
              </div>
              
              <div className={styles.templatePreviewBody}>
                <div className={styles.templatePreviewInfo}>
                  <h4>{selectedTemplate.name}</h4>
                  <p>{selectedTemplate.description}</p>
                  <p>Тип файла: {selectedTemplate.type}</p>
                </div>
                
                <div className={styles.templatePreviewImageContainer}>
                  <div className={styles.templatePreviewPlaceholder}>
                    <FileText className={styles.templatePreviewPlaceholderIcon} />
                    <p>Предпросмотр документа</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.templatePreviewFooter}>
                <button 
                  className={styles.templatePreviewCancel}
                  onClick={() => setShowTemplatePreview(false)}
                >
                  Закрыть
                </button>
                <button 
                  className={styles.templatePreviewDownload}
                  onClick={() => {
                    downloadTemplate(selectedTemplate);
                    setShowTemplatePreview(false);
                  }}
                >
                  Скачать
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <CheckCircle style={{width: '1em', height: '1em', marginRight: '6px'}} />
                  Одобрить
                </button>
              </div>
            </div>
          </div>
        )}

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