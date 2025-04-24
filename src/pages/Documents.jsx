import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, Upload, Download, ArrowLeft, QrCode } from 'lucide-react';
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

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);

      try {
        const response = await axios.get('/api/documents');

        if (response.data) {
          const formattedDocs = response.data.map((doc) => ({
            id: doc.id,
            name: doc.title,
            type: doc.name?.endsWith('.pdf') ? 'PDF' :
                  doc.name?.endsWith('.docx') ? 'DOCX' : 'Файл',
            status: doc.status,
            date: new Date(doc.created_at).toLocaleDateString('ru-RU'),
            student_id: doc.student_id || undefined,
            student_name: doc.student_name
          }));

          setDocuments(formattedDocs);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/document-templates');

        if (response.data) {
          setTemplates(response.data);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };

    fetchDocuments();
    if (user?.role === 'admin') {
      fetchTemplates();
    }
  }, [user?.role]);

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.student_name && doc.student_name.toLowerCase().includes(searchQuery.toLowerCase()))
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
      default:
        return status;
    }
  };

  const approveDocument = async () => {
    if (!selectedDoc) return;

    setIsLoading(true);

    try {
      const response = await axios.put(`/api/documents/${selectedDoc.id}`, {
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
         throw new Error(`Ошибка сервера: ${response.status}`);
      }
    } catch (error) {
      console.error('Error approving document:', error);
       console.error('Ошибка: Не удалось одобрить документ', error);
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
      const response = await axios.put(`/api/documents/${selectedDoc.id}`, {
          status: 'rejected',
          review_comment: rejectReason,
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
         throw new Error(`Ошибка сервера: ${response.status}`);
       }
    } catch (error) {
      console.error('Error rejecting document:', error);
      console.error('Ошибка: Не удалось отклонить документ', error);
    } finally {
      setShowRejectDialog(false);
      setSelectedDoc(null);
      setRejectReason('');
      setIsLoading(false);
    }
  };

  const getActionButtons = (doc) => {
    const DownloadIcon = Download;
    const CheckIcon = QrCode;
    const XIcon = QrCode;
    const EyeIcon = QrCode;

    switch (user?.role) {
      case 'admin':
        return (
          <div className={styles.documentActions}>
            <button className={styles.btnOutline}>
              <DownloadIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
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
                   <CheckIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
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
                  <XIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
                  Отклонить
                </button>
              </>
            )}
            <button className={styles.btnOutline} disabled={isLoading}>
              Архивировать
            </button>
          </div>
        );
      case 'curator':
        return (
          <div className={styles.documentActions}>
            <button className={styles.btnOutline}>
               <DownloadIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
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
                   <CheckIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
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
                   <XIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
                   Отклонить
                </button>
              </>
            )}
          </div>
        );
      case 'parent':
        return (
          <div className={styles.documentActions}>
            <button className={styles.btnOutline}>
               <EyeIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Просмотр
            </button>
            <button className={styles.btnOutline}>
               <DownloadIcon style={{width: '1em', height: '1em', marginRight: '6px'}} />
               Скачать
            </button>
            {doc.status === 'rejected' && (
              <button className={styles.btnPrimary}>
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

      <div className={styles.searchContainer}>
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
                    {user?.role !== 'parent' && (
                      <th>Студент</th>
                    )}
                    <th>Тип</th>
                    <th>Статус</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td className={styles.documentName}>
                        <FileText style={{width: '1.1em', height: '1.1em'}} />
                        {doc.name}
                      </td>
                      {user?.role !== 'parent' && (
                        <td>{doc.student_name}</td>
                      )}
                      <td>{doc.type || 'Файл'}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[`status-${doc.status}`]}`}>
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
            <div className={styles.templatesGrid}>
              {templates.map((template) => (
                <div key={template.id} className={styles.templateCard}>
                  <div className={styles.templateHeader}>
                    <div className={styles.templateTitle}>
                      <FileText style={{width: '1.1em', height: '1.1em'}} />
                      <h3>Шаблон: {template.name}</h3>
                    </div>
                  </div>
                  <p className={styles.templateDescription}>
                    {template.description}
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
          </div>
        </div>
      )}

      {showApproveDialog && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Подтверждение одобрения</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Вы уверены, что хотите одобрить документ "{selectedDoc?.name}"?</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={() => setShowApproveDialog(false)} disabled={isLoading}>Отмена</button>
              <button className={styles.btnPrimary} onClick={approveDocument} disabled={isLoading}>
                 <QrCode style={{width: '1em', height: '1em', marginRight: '6px'}} />
                 Одобрить
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectDialog && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Отклонение документа</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Пожалуйста, укажите причину отклонения документа "{selectedDoc?.name}"</p>
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
              <button className={styles.btnOutline} onClick={() => setShowRejectDialog(false)} disabled={isLoading}>Отмена</button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={rejectDocument}
                disabled={!rejectReason.trim() || isLoading}
              >
                <QrCode style={{width: '1em', height: '1em', marginRight: '6px'}} />
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;