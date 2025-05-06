import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Импортируем axios
import SidebarLayout from './../components/layouts/SidebarLayout';
import { Clock, CheckCircle, XCircle, FileText, Calendar, Users, Eye, Loader2 } from 'lucide-react'; // Добавлены Eye, Loader2
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/Requests.module.css'; // Убедитесь, что путь правильный


// Маппинг типов документов/шаблонов к иконкам
const documentTypeIcons = {
    'Заявление о приеме': FileText, // Пример: по имени шаблона
    'Медицинская справка': FileText,
    'Заявление на академический отпуск': FileText,
    // Добавьте другие маппинги по именам ваших шаблонов или типам контента
    'pdf': FileText, // Пример: по расширению файла
    'docx': FileText,
    'jpg': FileText,
    'png': FileText,
    // Добавьте иконки для общих типов запросов, если requests таблица используется для не-документов
    'permission': Users, // Запрос на разрешение
    'absence': Calendar, // Запрос об отсутствии
    'assistance': Users, // Запрос о помощи
    'other': FileText, // Общий запрос
};

// Функция для получения иконки по типу документа или запроса
const getRequestIcon = (item) => {
    // Пытаемся определить по имени шаблона или оригинальному имени файла
    const typeKey = item.template_name || (item.original_filename ? item.original_filename.split('.').pop().toLowerCase() : item.type);
    let IconComponent = documentTypeIcons[typeKey] || FileText; // По умолчанию иконка файла

    // Если item.type из таблицы requests (для не-документов)
    if (item.type && documentTypeIcons[item.type.toLowerCase()]) {
        IconComponent = documentTypeIcons[item.type.toLowerCase()];
    }

    return <IconComponent style={{width: '1.1em', height: '1.1em', marginRight: '8px'}} />;
};


const Requests = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending'); // Начинаем с вкладки "Ожидающие"

  const [documentsForReview, setDocumentsForReview] = useState([]); // Здесь будут документы из /api/documents
  const [loading, setLoading] = useState(true); // Состояние загрузки
  const [error, setError] = useState(null); // Состояние ошибки

  // Состояние для модального окна просмотра документа
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [modalDocumentUrl, setModalDocumentUrl] = useState(''); // URL PDF для iframe
  const [loadingDocumentModal, setLoadingDocumentModal] = useState(false);


  // Маппинг статусов для отображения
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
      case 'submitted': // Добавим обработку статуса 'submitted', если он используется для документов на рассмотрении
        statusClass = styles.statusBadgePending; // Можно использовать тот же стиль, что и для pending
        statusText = 'На рассмотрении';
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
       case 'archived': // Обработка статуса 'archived'
         statusClass = styles.statusBadgeArchived; // Нужен соответствующий стиль в CSS
         statusText = 'Архивировано';
         StatusIcon = FileText; // Или другая иконка
         break;
       case 'draft': // Обработка статуса 'draft'
         statusClass = styles.statusBadgeDraft; // Нужен соответствующий стиль в CSS
         statusText = 'Черновик';
         StatusIcon = FileText;
         break;
      default:
        return null; // Скрыть бейдж для неизвестных статусов
    }

    return (
      <span className={`${styles.statusBadge} ${statusClass}`}>
        {StatusIcon && <StatusIcon style={{width: '0.9em', height: '0.9em', marginRight: '4px'}} />}
        {statusText}
      </span>
    );
  };

  // Функция для загрузки документов/запросов с бэкенда
  const fetchRequests = useCallback(async (statusFilter) => {
      if (!user) return;

      setLoading(true);
      setError(null);
      setDocumentsForReview([]); // Очищаем список перед загрузкой

      try {
          let params = {};
          // Определяем статус фильтрации для бэкенда на основе активной вкладки
          if (statusFilter === 'pending') {
               params.status = 'pending'; // Фильтр для статуса 'pending' или 'submitted' (если бэкенд поддерживает несколько)
               // TODO: Уточнить на бэкенде, как фильтровать "ожидающие" документы (pending, submitted?)
          } else if (statusFilter === 'processed') {
               params.status = 'processed'; // Фильтр для статусов 'approved', 'rejected', 'archived' (если бэкенд поддерживает фильтр по группе статусов)
               // TODO: Уточнить на бэкенде, как фильтровать "обработанные" документы
          }
          // Если statusFilter === 'all', params.status не устанавливается, бэкенд вернет все доступные для пользователя

          // Используем эндпоинт документов, так как речь идет о документах на рассмотрении
          const response = await axios.get('/api/documents', { params });

          if (response.data && Array.isArray(response.data.items)) {
              setDocumentsForReview(response.data.items);
          } else {
              console.error("Error fetching documents: Invalid data format", response.data);
              setDocumentsForReview([]);
              setError('Получен некорректный формат данных документов.');
          }

      } catch (err) {
          console.error("Error fetching documents:", err);
          setError('Не удалось загрузить список документов для рассмотрения.');
          setDocumentsForReview([]);
      } finally {
          setLoading(false);
      }
  }, [user]); // Зависимость от user

  // Загрузка запросов/документов при монтировании и смене вкладки/пользователя
  useEffect(() => {
      fetchRequests(activeTab);
  }, [user, activeTab, fetchRequests]); // Добавлены зависимости

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
     // fetchRequests будет вызван через useEffect
  };


  // Функция для открытия модального окна с документом
  const handleViewDocument = async (documentId) => {
      setLoadingDocumentModal(true);
      setModalDocumentUrl(''); // Очищаем предыдущий URL
      setShowDocumentModal(true); // Показываем модальное окно

      try {
          // Эндпоинт /api/documents/:id/download уже реализован для получения файла
          // ВАЖНО: Этот эндпоинт должен возвращать файл, доступный через GET запрос
          // Если он требует токен, то прямо в iframe его использовать сложно.
          // Простейший способ: если бэкенд настроен отдавать файл по прямому URL после проверки прав,
          // или если мы можем получить временный подписанный URL.
          // Для iframe проще использовать URL, который не требует дополнительных заголовков.
          // Если ваш эндпоинт /api/documents/:id/download требует токен, нужно его переделать
          // либо на отдачу файла напрямую без токена (менее безопасно), либо на генерацию временного URL.
          // Предположим, что '/api/documents/${documentId}/download' возвращает файл, который iframe может отобразить.
          // В противном случае, вам потребуется более сложная логика получения Blob и его отображения в браузере.

           // Если ваш эндпоинт /download требует авторизацию, вы можете:
           // 1. Перенаправить пользователя на отдельную страницу просмотра PDF, которая сама сделает запрос с токеном.
           // 2. Запросить файл как Blob здесь, создать Blob URL и передать его в iframe (сложнее, но токен не нужен в iframe src).
           // 3. Изменить бэкенд, чтобы /download endpoint принимал токен через query param (небезопасно) или куку.
           // 4. Изменить бэкенд, чтобы /download endpoint генерировал временный URL.
           // Самый простой способ для iframe: если эндпоинт /download доступен с токеном ИЛИ может быть адаптирован.

           // Для iframe src нам нужен URL, который браузер может открыть.
           // Если ваш /api/documents/:id/download возвращает файл напрямую, этот URL подойдет.
           // Если нет, вам может понадобиться отдельный эндпоинт для просмотра.

           // В текущей реализации бэкенд /api/documents/:id/download использует authenticateToken.
           // iframe напрямую не может использовать этот токен.
           // Простейшее решение для теста: сделать эндпоинт download публичным или изменить его.
           // Альтернатива: получить Blob и создать URL.
           // Давайте попробуем получить Blob и создать URL для iframe.
            const response = await axios.get(`/api/documents/${documentId}/download`, {
                 responseType: 'blob' // Получаем данные как Blob
            });

           const pdfBlob = response.data;
           if (pdfBlob instanceof Blob) {
               const blobUrl = URL.createObjectURL(pdfBlob);
               setModalDocumentUrl(blobUrl); // Устанавливаем URL для iframe
           } else {
               throw new Error("Не удалось получить данные PDF.");
           }


      } catch (error) {
          console.error(`Error viewing document ${documentId}:`, error);
          // TODO: Отобразить сообщение об ошибке в модальном окне или тосте
          alert('Не удалось загрузить документ для просмотра.');
          setShowDocumentModal(false); // Скрываем модальное окно при ошибке
      } finally {
          setLoadingDocumentModal(false); // Загрузка завершена
      }
  };

    // Функция для закрытия модального окна
    const handleCloseDocumentModal = () => {
        setShowDocumentModal(false);
        // Освобождаем Blob URL, когда модальное окно закрывается
        if (modalDocumentUrl) {
            URL.revokeObjectURL(modalDocumentUrl);
            setModalDocumentUrl('');
        }
    };


  // Функция для обработки действия (Одобрить, Отклонить, Архивировать)
  const handleProcessRequest = async (documentId, action) => {
      // action может быть 'approved', 'rejected', 'archived'
      let newStatus;
      let confirmationMessage = '';
      let reviewComment = ''; // Для причины отклонения

      switch (action) {
          case 'approve':
              newStatus = 'approved';
              confirmationMessage = 'Вы уверены, что хотите одобрить этот документ?';
              break;
          case 'reject':
              newStatus = 'rejected';
              confirmationMessage = 'Вы уверены, что хотите отклонить этот документ? Пожалуйста, укажите причину:';
              // TODO: Реализовать ввод причины отклонения, например, через prompt или отдельное модальное окно
              reviewComment = prompt(confirmationMessage); // Используем простой prompt для примера
              if (reviewComment === null) { // Если пользователь отменил ввод
                   return; // Прерываем операцию
              }
              // reviewComment может быть пустой строкой, если пользователь нажал OK без ввода
              if (newStatus === 'rejected' && reviewComment.trim() === '') {
                   alert('Причина отклонения обязательна.');
                   return;
              }
              break;
          case 'archive':
              newStatus = 'archived';
              confirmationMessage = 'Вы уверены, что хотите заархивировать этот документ?';
              if (!window.confirm(confirmationMessage)) { // Простая проверка через confirm
                  return; // Прерываем операцию, если пользователь отменил
              }
              break;
          default:
              console.error("Unknown action:", action);
              return;
      }

      // Если это не отклонение (где prompt уже был) и требуется подтверждение
      if (action !== 'reject' && !window.confirm(confirmationMessage)) {
          return; // Прерываем, если пользователь отменил
      }


      // TODO: Добавить индикатор загрузки для кнопок действий или всей таблицы
      // setLoading(true); // Можно установить загрузку всей таблицы

      try {
          // Вызываем API для изменения статуса документа
          const response = await axios.put(`/api/documents/${documentId}/status`, {
              status: newStatus,
              review_comment: reviewComment // Отправляем причину отклонения, если есть
          });

          if (response.status === 200) {
              alert(`Статус документа успешно изменен на "${newStatus}".`);
              // После успешного изменения статуса, перезагружаем список документов
              fetchRequests(activeTab); // Перезагружаем данные для текущей вкладки
          } else {
               // Если бэкенд вернул статус, отличный от 200, но не ошибку (маловероятно для PUT)
               console.error("Status update failed with non-200 status:", response);
               alert('Не удалось изменить статус документа.'); // TODO: Использовать тост
          }

      } catch (error) {
          console.error(`Error updating document status ${documentId} to ${newStatus}:`, error);
           // TODO: Использовать тост для ошибок
          const errorMessage = error.response?.data?.message || 'Произошла ошибка при изменении статуса документа.';
          alert(`Ошибка: ${errorMessage}`);
      } finally {
          // TODO: Отключить индикатор загрузки
          // setLoading(false);
      }
  };

  // Определяем документы для каждой вкладки (фильтруем на фронтенде)
  // В реальном приложении лучше, чтобы бэкенд возвращал только нужные для каждой вкладки
  // (что мы уже пытались сделать, передавая statusFilter в fetchRequests)
  // Если бэкенд не фильтрует идеально, можно дополнительно отфильтровать здесь.
  const pendingRequests = documentsForReview.filter(d => ['pending', 'submitted'].includes(d.status)); // "Ожидающие" могут быть в статусах pending или submitted
  const processedRequests = documentsForReview.filter(d => ['approved', 'rejected', 'archived'].includes(d.status)); // "Обработанные"


  return (
    <SidebarLayout>
      <div className={styles.requestsContainer}>
        {/* ... (заголовок страницы) ... */}
         <div>
           <h2 className={styles.pageTitle}>Документы на рассмотрении</h2> {/* Изменено название страницы для ясности */}
           <p className={styles.pageDescription}>
             {user?.role === 'admin'
               ? 'Просмотр и управление документами, требующими рассмотрения или уже обработанными'
               : 'Просмотр и управление документами, требующими рассмотрения в ваших группах'}
           </p>
         </div>


        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'all' ? styles.active : ''}`}
              onClick={() => handleTabChange('all')}
               disabled={loading} // Отключаем вкладки во время загрузки
            >
              Все
              <span className={styles.badge}>
                {documentsForReview.length}
              </span>
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'pending' ? styles.active : ''}`}
              onClick={() => handleTabChange('pending')}
               disabled={loading} // Отключаем вкладки во время загрузки
            >
              Ожидающие
              <span className={styles.badge}>
                {pendingRequests.length}
              </span>
            </button>
            <button
               className={`${styles.tabsTrigger} ${activeTab === 'processed' ? styles.active : ''}`}
               onClick={() => handleTabChange('processed')}
                disabled={loading} // Отключаем вкладки во время загрузки
             >
               Обработанные
               <span className={styles.badge}>
                  {processedRequests.length}
               </span>
             </button>
           </div>

          {loading && <p>Загрузка документов...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}

          {!loading && !error && ( // Отображаем содержимое вкладок только если не идет загрузка и нет ошибки
             <>
               {activeTab === 'all' && (
                 <div className={styles.tabContent}>
                   <div className={styles.card}>
                     <div className={styles.cardHeader}>
                       <h3 className={styles.cardTitle}>Все доступные документы</h3>
                       <p className={styles.cardDescription}>
                         {user?.role === 'admin'
                           ? 'Список всех документов в системе, доступных для просмотра/обработки'
                           : 'Список всех документов ваших групп'}
                       </p>
                     </div>
                     <div className={styles.cardContent}>
                       <div className={styles.requestsTableContainer}> {/* Можно переименовать класс стилей, т.к. это таблица документов */}
                         <table className={styles.requestsTable}> {/* И этот класс */}
                           <thead>
                             <tr>
                               <th>Документ</th> {/* Изменено */}
                               <th>Студент</th>
                               <th>Группа</th>
                               <th>Статус</th>
                               <th>Дата создания</th> {/* Изменено */}
                               <th>Действия</th>
                             </tr>
                           </thead>
                           <tbody>
                             {documentsForReview.length === 0 ? (
                               <tr><td colSpan={6}>Документы не найдены.</td></tr> // Сообщение, если список пуст
                             ) : (
                               documentsForReview.map((document) => ( // Переименовано request в document
                                 <tr key={document.id}>
                                   <td className={styles.tableDocumentCell}> {/* Переименовано */}
                                     {getRequestIcon(document)} {/* Получаем иконку по данным документа */}
                                     {document.name || document.title} {/* Название документа */}
                                   </td>
                                   <td>{document.student_name || 'Неизвестно'}</td> {/* Имя студента из бэкенда */}
                                   <td>{document.group_name || 'Неизвестно'}</td> {/* Имя группы из бэкенда */}
                                   <td>
                                     <StatusBadge status={document.status} /> {/* Статус из бэкенда */}
                                   </td>
                                   <td>{document.date}</td> {/* Дата из бэкенда (уже отформатирована) */}
                                   <td>
                                     {/* Действия зависят от статуса и роли пользователя */}
                                     <div className={styles.buttonGroupHorizontal}>
                                         {/* Кнопка просмотра всегда доступна */}
                                        <button
                                            type="button"
                                            className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                            onClick={() => handleViewDocument(document.id)}
                                        >
                                           <Eye style={{width: '1.1em', height: '1.1em', marginRight: '4px'}} /> Просмотр
                                         </button>

                                         {/* Кнопки обработки доступны только если статус 'pending' или 'submitted' */}
                                         {['pending', 'submitted'].includes(document.status) && (user?.role === 'admin' || user?.role === 'curator') && (
                                            <>
                                               <button
                                                  type="button"
                                                  className={`${styles.button} ${styles.buttonSmall}`}
                                                  onClick={() => handleProcessRequest(document.id, 'approve')}
                                               >
                                                 Одобрить
                                               </button>
                                               <button
                                                  type="button"
                                                  className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.buttonDanger}`} // {/* Добавлен стиль для Danger кнопки */}
                                                  onClick={() => handleProcessRequest(document.id, 'reject')}
                                               >
                                                 Отклонить
                                               </button>
                                               {/* Кнопка Архивировать может быть только для админа или для определенных статусов */}
                                                {user?.role === 'admin' && ( // Пример: только админ может архивировать
                                                     <button
                                                        type="button"
                                                        className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                        onClick={() => handleProcessRequest(document.id, 'archive')}
                                                     >
                                                       Архивировать
                                                     </button>
                                                )}
                                            </>
                                         )}
                                         {/* Кнопка "Обработать" (общая) удалена, вместо нее конкретные действия */}
                                     </div>
                                   </td>
                                 </tr>
                               ))
                             )}
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
                       <h3 className={styles.cardTitle}>Документы, ожидающие рассмотрения</h3> {/* Изменено название */}
                       <p className={styles.cardDescription}>Документы, требующие вашего внимания для одобрения или отклонения</p>
                     </div>
                     <div className={styles.cardContent}>
                        <div className={styles.requestsTableContainer}>
                          <table className={styles.requestsTable}>
                            <thead>
                              <tr>
                                <th>Документ</th>
                                <th>Студент</th>
                                <th>Группа</th>
                                <th>Дата создания</th>
                                <th>Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingRequests.length === 0 ? (
                                 <tr><td colSpan={5}>Нет документов, ожидающих рассмотрения.</td></tr>
                              ) : (
                                pendingRequests.map((document) => (
                                  <tr key={document.id}>
                                    <td className={styles.tableDocumentCell}>
                                      {getRequestIcon(document)}
                                      {document.name || document.title}
                                    </td>
                                    <td>{document.student_name || 'Неизвестно'}</td>
                                    <td>{document.group_name || 'Неизвестно'}</td>
                                    <td>{document.date}</td>
                                    <td>
                                      <div className={styles.buttonGroupHorizontal}>
                                        <button
                                            type="button"
                                            className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                            onClick={() => handleViewDocument(document.id)}
                                        >
                                           <Eye style={{width: '1.1em', height: '1.1em', marginRight: '4px'}} /> Просмотр
                                         </button>
                                         {/* Кнопки обработки доступны только если статус 'pending' или 'submitted' и роль соответствующая */}
                                         {['pending', 'submitted'].includes(document.status) && (user?.role === 'admin' || user?.role === 'curator') && (
                                            <>
                                               <button
                                                  type="button"
                                                  className={`${styles.button} ${styles.buttonSmall}`}
                                                  onClick={() => handleProcessRequest(document.id, 'approve')}
                                               >
                                                 Одобрить
                                               </button>
                                               <button
                                                  type="button"
                                                  className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.buttonDanger}`}
                                                  onClick={() => handleProcessRequest(document.id, 'reject')}
                                               >
                                                 Отклонить
                                               </button>
                                            </>
                                         )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
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
                       <h3 className={styles.cardTitle}>Обработанные документы</h3> {/* Изменено название */}
                       <p className={styles.cardDescription}>Документы, по которым уже принято решение (одобрены, отклонены, архивированы)</p>
                     </div>
                     <div className={styles.cardContent}>
                       <div className={styles.requestsTableContainer}>
                         <table className={styles.requestsTable}>
                           <thead>
                             <tr>
                               <th>Документ</th>
                               <th>Студент</th>
                               <th>Группа</th>
                               <th>Статус</th>
                               <th>Дата создания</th>
                               <th>Действия</th>
                             </tr>
                           </thead>
                           <tbody>
                             {processedRequests.length === 0 ? (
                                 <tr><td colSpan={6}>Нет обработанных документов.</td></tr>
                             ) : (
                                processedRequests.map((document) => (
                                   <tr key={document.id}>
                                     <td className={styles.tableDocumentCell}>
                                       {getRequestIcon(document)}
                                       {document.name || document.title}
                                     </td>
                                     <td>{document.student_name || 'Неизвестно'}</td>
                                     <td>{document.group_name || 'Неизвестно'}</td>
                                     <td>
                                       <StatusBadge status={document.status} />
                                     </td>
                                     <td>{document.date}</td>
                                     <td>
                                       <button
                                           type="button"
                                           className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                           onClick={() => handleViewDocument(document.id)}
                                       >
                                          <Eye style={{width: '1.1em', height: '1.1em', marginRight: '4px'}} /> Просмотр
                                        </button>
                                         {/* Кнопка Архивировать может быть доступна и для обработанных, если роль админ */}
                                         {['approved', 'rejected'].includes(document.status) && user?.role === 'admin' && ( // Пример: админ может архивировать одобренные/отклоненные
                                              <button
                                                 type="button"
                                                 className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                 onClick={() => handleProcessRequest(document.id, 'archive')}
                                              >
                                                Архивировать
                                              </button>
                                         )}
                                     </td>
                                   </tr>
                                 ))
                             )}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   </div>
                 </div>
               )}
             </>
          )}


        </div>
      </div>

      {/* Модальное окно для просмотра документа */}
      {showDocumentModal && (
          <div className={styles.modalOverlay}>
              <div className={styles.modalContent} style={{width: '90%', maxWidth: '800px', height: '90%', display: 'flex', flexDirection: 'column'}}>
                  <div className={styles.modalHeader} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <h3 className={styles.modalTitle}>Просмотр документа</h3>
                      <button type="button" className={styles.closeButton} onClick={handleCloseDocumentModal} disabled={loadingDocumentModal}>
                          <XCircle style={{width: '1.5em', height: '1.5em'}} />
                      </button>
                  </div>
                  <div className={styles.modalBody} style={{flexGrow: 1, overflowY: 'auto'}}>
                      {loadingDocumentModal ? (
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                              <Loader2 style={{width: '3em', height: '3em', animation: 'spin 1s linear infinite'}} />
                              <p style={{marginTop: '10px'}}>Загрузка документа...</p>
                          </div>
                      ) : modalDocumentUrl ? (
                          // Используем iframe для отображения PDF. src должен быть URL, который браузер может открыть.
                          // Если /api/documents/:id/download возвращает Blob, URL.createObjectURL создает такой URL.
                          // Если ваш бэкенд /download настроен отдавать файл напрямую (возможно, после проверки токена),
                          // то можно использовать прямой URL бэкенда здесь.
                          <iframe
                              src={modalDocumentUrl}
                              title="Просмотр документа"
                              style={{width: '100%', height: '100%', border: 'none'}}
                              allowFullScreen // Разрешить полноэкранный режим
                          >
                              Ваш браузер не поддерживает просмотр PDF через iframe. Скачайте документ по ссылке. {/* Fallback message */}
                          </iframe>
                      ) : (
                           <p>Не удалось загрузить документ.</p> // Сообщение об ошибке загрузки
                      )}
                  </div>
                  <div className={styles.modalFooter} style={{display: 'flex', justifyContent: 'flex-end', marginTop: '15px'}}>
                      <button type="button" className={styles.button} onClick={handleCloseDocumentModal} disabled={loadingDocumentModal}>Закрыть</button>
                  </div>
              </div>
          </div>
      )}

    </SidebarLayout>
  );
};

export default Requests;