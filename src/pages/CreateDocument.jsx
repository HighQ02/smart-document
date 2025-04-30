// CreateDocument.jsx
import React, { useState, useEffect, useMemo } from 'react'; // Добавлено useMemo
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Upload, Download, ArrowLeft, QrCode, CheckCircle, X } from 'lucide-react';
import axios from 'axios';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { useAuth } from './../contexts/AuthContext';
import qrcode from 'qrcode';

import styles from './../styles/CreateDocument.module.css';

const CreateDocument = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customDocName, setCustomDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [formData, setFormData] = useState({});

  const [isSigned, setIsSigned] = useState(false);
  const [signedDetails, setSignedDetails] = useState(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [signatureInitiatedDocId, setSignatureInitiatedDocId] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, title: '', description: '', variant: '' });

  // Определяем слот подписи для текущего пользователя на основе его роли и шаблона
  const userSignatureSlot = useMemo(() => {
    console.log("Calculating userSignatureSlot...");
    console.log("Current user role:", user?.role);
    console.log("Selected template:", selectedTemplate?.name);
    console.log("Required signatures in template:", selectedTemplate?.requiredSignatures);

      if (!user?.role || !selectedTemplate?.requiredSignatures) {
          console.log("userSignatureSlot: null (user or template missing required signatures)");
          return null;
      }
      const requiredSlots = selectedTemplate.requiredSignatures;
      const userRole = user.role;

      // Определяем, какой слот соответствует роли текущего пользователя
      // Предполагаем, что роли прямо соответствуют именам слотов или есть явное соответствие
      const matchingSlot = requiredSlots.find(sig => sig.role === userRole);

      // TODO: Если одна роль может подписывать разные слоты (например, Админ),
      // или если имя слота не совпадает с ролью, нужна более сложная логика или выбор слота в UI.
      // Для простоты, предполагаем прямое соответствие роли и имени слота.

      if (matchingSlot) {
           // Проверяем, является ли этот слот одним из цифровых слотов
           const digitalSignerRoles = ['admin', 'curator', 'dean']; // Список ролей, которые подписывают цифрово
           if (digitalSignerRoles.includes(userRole)) {
            console.log("userSignatureSlot: Found matching digital slot:", matchingSlot.role);
               return matchingSlot.role;
           }
      }

      console.log("userSignatureSlot: null (user role doesn't match required digital slot)");
      return null; // Возвращаем null, если текущий пользователь не может подписать этот шаблон цифрово
  }, [user?.role, selectedTemplate?.requiredSignatures]);


  const showToast = (title, description, variant = 'default') => {
    setToast({ show: true, title, description, variant });
    setTimeout(() => {
      setToast({ show: false, title: '', description: '', variant: '' });
    }, 3000);
  };

  useEffect(() => {
    console.log(`userSignatureSlot calculation finished. Value: ${userSignatureSlot}`);
    
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/document-templates');

        if (response.data && Array.isArray(response.data)) {
          const formattedTemplates = response.data.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            fields: item.template_fields,
            requiredSignatures: item.required_signatures
          }));
          setTemplates(formattedTemplates);
        } else {
             console.error('Error fetching templates: Invalid data format', response.data);
             setTemplates([]);
             showToast('Ошибка загрузки шаблонов', 'Получен некорректный формат данных', 'error');
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
        showToast(
          'Ошибка загрузки шаблонов',
          'Не удалось загрузить список шаблонов документов',
          'error'
        );
      }
    };

    const fetchStudents = async () => {
      try {
         let response;
         if (user?.role === 'parent') {
           response = await axios.get(`/api/parent/students`);
         } else if (user?.role === 'curator') {
            response = await axios.get('/api/users', { params: { role: 'student', curator_id: user.id } });
         } else if (user?.role === 'admin') {
             response = await axios.get('/api/users', { params: { role: 'student' } });
         } else if (user?.role === 'student') {
              // Студент не выбирает студента, документ для него самого
              setStudents([{ id: user.id, name: user.name }]);
              setSelectedStudent(user.id); // Автоматически выбираем себя
              return;
         } else {
             setStudents([]);
             console.warn(`Role ${user?.role} is not authorized to create documents`);
             return;
         }

        if (response.data && Array.isArray(response.data)) {
          const formattedStudents = response.data.map(student => ({
              id: student.id,
              name: student.full_name || student.name
          }));
          setStudents(formattedStudents);
          if (user?.role === 'parent' && formattedStudents.length === 1) {
             setSelectedStudent(formattedStudents[0].id);
          }
        } else {
             console.error('Error fetching students: Invalid data format', response.data);
             setStudents([]);
             showToast('Ошибка загрузки студентов', 'Получен некорректный формат данных', 'error');
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        if (error.response?.status === 403) {
             // showToast('Ошибка доступа', 'Недостаточно прав для загрузки списка студентов', 'error');
        } else {
            showToast(
              'Ошибка загрузки списка студентов',
              'Не удалось загрузить список студентов',
              'error'
            );
        }
        setStudents([]);
      } finally {
      }
    };

    if (user?.id && user?.role) {
         // Если пользователь - студент, сразу загружаем шаблоны
         if (user.role === 'student') {
              fetchTemplates().finally(() => setIsLoading(false));
         } else {
             // Для других ролей (админ, куратор, родитель) загружаем и шаблоны, и студентов
             Promise.allSettled([fetchTemplates(), fetchStudents()]).finally(() => {
                  setIsLoading(false);
             });
         }

    } else {
        setIsLoading(false);
    }

  }, [user?.id, user?.role]);

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCustomDocName(template.name || template.name);

      if (template.fields && Array.isArray(template.fields)) {
         const initialData = {};
         template.fields.forEach(field => {
           initialData[field.name] = '';
         });
         setFormData(initialData);
      } else {
         setFormData({});
      }

      setIsSigned(false);
      setSignedDetails(null);
      setQrCodeDataUrl('');
      setShowQRCodeModal(false);
      setSignatureInitiatedDocId(null);


    } else {
       setSelectedTemplate(null);
       setCustomDocName('');
       setFormData({});
       setIsSigned(false);
       setSignedDetails(null);
       setQrCodeDataUrl('');
       setShowQRCodeModal(false);
       setSignatureInitiatedDocId(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setCustomDocName(file.name);
      setSelectedTemplate(null);
      setFormData({});
      setIsSigned(false);
      setSignedDetails(null);
      setQrCodeDataUrl('');
      setShowQRCodeModal(false);
      setSignatureInitiatedDocId(null);

    } else {
      setSelectedFile(null);
      setCustomDocName('');
    }
  };

  const handleFieldChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const requestSignatureUrl = async (docId, slotName) => {
       setIsLoading(true);
       setQrCodeDataUrl('');

       try {
           const response = await axios.get(`/api/documents/${docId}/generate-signature-url/${slotName}`);

           if (response.data?.signatureUrl) {
               const signatureUrl = response.data.signatureUrl; // Получаем строку URL
               console.log("Received Signature URL from backend:", signatureUrl); // <-- ДОБАВЬТЕ ЭТУ СТРОКУ

               // Попробуйте также сгенерировать QR-код из этой строки прямо здесь для проверки
               // Это поможет понять, проблема в строке или в самой библиотеке QR-кода
               try {
                   const qrTest = await qrcode.toString(signatureUrl, { type: 'terminal' }); // Попробует вывести в консоль в виде текста
                   console.log("QR code generated successfully by frontend library (text format):", qrTest);
               } catch(qrErrTest) {
                    console.error("Frontend QR code library failed to generate from URL:", qrErrTest);
               }


               const qrDataUrl = await qrcode.toDataURL(signatureUrl);
               console.log("Generated QR Code Data URL (first 50 chars):", qrDataUrl.substring(0, 50) + '...');
               setQrCodeDataUrl(qrDataUrl);
               setShowQRCodeModal(true);
           } else {
               console.error("Backend did not return signatureUrl:", response.data); // Логируем, если URL не пришел
               showToast('Ошибка QR', 'Не удалось получить URL для подписи.', 'error');
               setShowQRCodeModal(false);
           }
       } catch (error) {
           console.error('Error requesting signature URL:', error);
            const errorMessage = error.response?.data?.message || 'Неизвестная ошибка при запросе ссылки для подписи.';
           showToast('Ошибка подписи', errorMessage, 'error');
           setQrCodeDataUrl('');
           setShowQRCodeModal(false);
       } finally {
           setIsLoading(false);
       }
  };


  // Функция запуска процесса подписи (вызывается кнопкой "Подписать")
  const handleInitiateSignatureQR = async () => {
       // Проверка, что выбран студент (если не студент сам)
       if (user?.role !== 'student' && !selectedStudent) {
         showToast('Ошибка', 'Выберите студента перед подписью', 'error');
         return;
       }
        // Проверка, что выбран шаблон и текущий пользователь может подписать этот шаблон
       if (!selectedTemplate || !userSignatureSlot) {
            const message = selectedTemplate
                ? 'Ваша роль не соответствует ни одному требуемому цифровому слоту подписи в этом шаблоне.'
                : 'Выберите шаблон для подписи.';
            showToast('Ошибка подписи', message, 'error');
            return;
       }

       // Убедимся, что выбран студент, даже если пользователь - студент (поле может быть disabled)
       const finalStudentId = user?.role === 'student' ? user.id : selectedStudent;
        if (!finalStudentId) {
            showToast('Ошибка', 'Не удалось определить студента для документа.', 'error');
            return;
        }


       setIsLoading(true);
       setQrCodeDataUrl('');

       let currentDocId = signatureInitiatedDocId;

       // 1. Если документа еще нет (не сохранялся даже как черновик), сохраняем черновик
       if (!currentDocId) {
           console.log("Saving draft document before initiating signature...");
           try {
               let draftResponse;
                // Сохранение черновика возможно только для шаблонов
                if (activeTab === 'template' && selectedTemplate) {
                    draftResponse = await axios.post('/api/documents', {
                        title: customDocName || selectedTemplate.name || 'Черновик документа',
                        template_id: selectedTemplate.id,
                        student_id: finalStudentId, // Используем определенного студента
                        status: 'draft', // Сохраняем как черновик
                        content: formData,
                        submitted_by: user.id
                    });
                } else {
                     // Если выбрана вкладка "Загрузить", нельзя инициировать подпись до загрузки файла
                    throw new Error('Подпись по QR доступна только для документов, созданных из шаблона.');
                }

               if (draftResponse.status === 201) {
                  currentDocId = draftResponse.data.documentId;
                  setSignatureInitiatedDocId(currentDocId);
                  console.log(`Draft document saved with ID: ${currentDocId}`);
                  showToast('Черновик сохранен', 'Черновик документа сохранен для подписи.');
               } else {
                    const errorData = draftResponse.data || { message: 'Неизвестная ошибка сервера при сохранении черновика' };
                    throw new Error(`Ошибка сервера при сохранении черновика: ${draftResponse.status} - ${errorData.message}`);
               }

           } catch (error) {
                console.error('Error saving draft for signature:', error);
                 showToast(
                   'Ошибка сохранения черновика',
                   error.message || 'Не удалось сохранить черновик для подписи.',
                   'error'
                 );
                 setIsLoading(false);
                 return;
           }
       }

       // 2. Теперь у нас есть documentId и определен signatureSlotName для текущего пользователя
       if (!userSignatureSlot) { // Повторная проверка, хотя должна быть проверена выше
            showToast('Ошибка подписи', 'Ваша роль не соответствует требуемому слоту подписи в этом шаблоне.', 'error');
            setIsLoading(false);
            return;
       }

        if (!currentDocId) {
            console.error("Failed to get document ID for signature.");
            showToast('Ошибка подписи', 'Не удалось получить ID документа для подписи.', 'error');
            setIsLoading(false);
            return;
        }

        // 3. Запрашиваем URL для QR-кода для сохраненного документа и слота
        await requestSignatureUrl(currentDocId, userSignatureSlot);
  };


  // Функция для имитации завершения подписи (вызывается из модального окна)
  const handleSimulateSignatureComplete = () => {
      // Здесь userSignatureSlot определен из useMemo
      const signedSlot = userSignatureSlot || 'unknown_slot'; // Используем определенный слот

      setIsSigned(true);
      setSignedDetails({
          name: user?.name || 'Неизвестный пользователь',
          date: new Date().toISOString(),
          slot: signedSlot
      });
      setShowQRCodeModal(false);
      showToast('Подпись получена', `Имитация: подпись для слота "${signedSlot}" успешно получена и сохранена!`);
  };

  const handleSubmit = async () => {
    // Проверка, что выбран студент (или определен автоматически)
     const finalStudentId = user?.role === 'student' ? user.id : selectedStudent;
    if (!finalStudentId) {
      showToast('Ошибка', 'Не удалось определить студента для документа', 'error');
      return;
    }
    if (!user?.id) {
         showToast('Ошибка', 'Пользователь не авторизован', 'error');
         return;
    }

    setIsLoading(true);

    try {
       let finalResponse;

       // Логика отправки шаблона
      if (activeTab === 'template' && selectedTemplate) {
         const fields = selectedTemplate.fields || [];
        const missingFields = fields
          .filter(field => field.required && (!formData[field.name] || String(formData[field.name]).trim() === ''))
          .map(field => field.label);

        if (missingFields.length > 0) {
          showToast(
            'Заполните обязательные поля',
            `Необходимо заполнить: ${missingFields.join(', ')}`,
            'error'
          );
          setIsLoading(false);
          return;
        }

        // Проверка подписи для отправки из шаблона (если требуется и текущий пользователь может подписать)
         // Если шаблон требует цифровую подпись (хотя бы один цифровой слот есть)
         const requiresAnyDigitalSignature = selectedTemplate.requiredSignatures?.some(sig => ['curator', 'admin', 'dean'].includes(sig.role));
         if (requiresAnyDigitalSignature) {
             // И если текущий пользователь может поставить одну из этих подписей (userSignatureSlot не null)
             if (userSignatureSlot && !isSigned) {
                showToast(
                  'Требуется подпись',
                  `Пожалуйста, подпишите документ как "${user?.role}" перед отправкой на проверку`,
                  'error'
                );
                setIsLoading(false);
                return;
             }
             // Если userSignatureSlot == null, но требуется цифровая подпись, возможно, отправку должен делать другой пользователь.
             // Или этот пользователь может отправить, но документ будет ждать подписи других.
             // В этой логике, если требуется цифровая подпись *от кого-то*, то текущий пользователь,
             // если он может подписать, должен это сделать. Если не может, он не должен видеть кнопку "Подписать".
             // Если он видит кнопку, значит он может подписать, и подпись требуется.
         }


        // Если черновик уже был сохранен для подписи, обновляем его статус
        if (signatureInitiatedDocId) {
             finalResponse = await axios.put(`/api/documents/${signatureInitiatedDocId}/status`, {
                 status: 'submitted', // Меняем статус черновика на submitted
                 reviewed_by: user.id
             });
             if (finalResponse.status === 200) {
                  finalResponse = { data: { documentId: signatureInitiatedDocId } };
             } else {
                 const errorData = finalResponse.data || { message: 'Неизвестная ошибка сервера при обновлении статуса черновика' };
                 throw new Error(`Ошибка сервера при обновлении статуса: ${finalResponse.status} - ${errorData.message}`);
             }

        } else {
           // Если черновик не сохранялся через кнопку "Подписать", создаем новый документ.
           // В этом flow, если шаблон требует цифровую подпись, но пользователь ее не поставил через QR,
           // документ создастся, но не будет подписан нужным лицом. Это может быть нежелательно.
           // Возможно, стоит разрешать отправку ТОЛЬКО через флоу подписи для шаблонов с цифровыми подписями.
           // Для простоты, пока разрешим, но документ будет в статусе 'pending' и без нужной подписи.
           console.warn("Creating new template document without prior draft save/signature initiation.");
           finalResponse = await axios.post('/api/documents', {
               title: customDocName || selectedTemplate.name || 'Документ из шаблона',
               template_id: selectedTemplate.id,
               student_id: finalStudentId,
               status: 'pending', // Или 'new', или 'draft', если подписи нет
               content: formData,
               submitted_by: user.id
             });
            if (finalResponse.status !== 201) {
                const errorData = finalResponse.data || { message: 'Неизвестная ошибка сервера при создании документа' };
                throw new Error(`Ошибка сервера при создании документа: ${finalResponse.status} - ${errorData.message}`);
            }
        }


      }
      // Логика отправки загруженного файла
      else if (activeTab === 'upload' && selectedFile) {
         console.log("Uploading file document...");
        const uploadFormData = new FormData();
        uploadFormData.append('document', selectedFile);
        uploadFormData.append('name', customDocName || selectedFile.name);
        uploadFormData.append('student_id', finalStudentId);
        uploadFormData.append('status', 'pending');
        uploadFormData.append('submitted_by', user.id);

        finalResponse = await axios.post('/api/documents/upload', uploadFormData, {
           headers: {
             'Content-Type': 'multipart/form-data'
           }
        });

        if (finalResponse.status !== 201) {
             const errorData = finalResponse.data || { message: 'Неизвестная ошибка сервера при загрузке' };
             throw new Error(`Ошибка сервера при загрузке документа: ${finalResponse.status} - ${errorData.message}`);
        }

      } else {
        showToast(
          'Ошибка',
          'Выберите шаблон или загрузите файл',
          'error'
        );
         setIsLoading(false);
         return;
      }

       showToast(
        'Документ отправлен',
        'Документ успешно создан или обновлен и отправлен на проверку',
        'success'
       );
       navigate('/documents');


    } catch (error) {
      console.error('Error submitting document:', error);
      showToast(
        'Ошибка отправки документа',
        error.message || 'Произошла неизвестная ошибка при отправке',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <SidebarLayout>
      <div className={styles.createDocumentContainer}>
         {/* Toast notifications */}
         {toast.show && (
             <div className={`${styles.toast} ${styles[toast.variant]}`}>
               <h4>{toast.title}</h4>
               <p>{toast.description}</p>
             </div>
           )}

        {/* Header */}
        <div className={styles.pageHeader}>
          <button
            className={styles.iconButton}
            onClick={() => navigate('/documents')}
            type="button"
          >
            <ArrowLeft style={{width: '1.5em', height: '1.5em'}} />
          </button>
          <div>
            <h2 className={styles.pageTitle}>Создание документа</h2>
            <p className={styles.pageDescription}>Создайте новый документ или загрузите файл</p>
          </div>
        </div>

        {/* Student Selection Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Информация о документе</h3>
            <p className={styles.cardDescription}>Выберите студента, для которого создается документ</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.formGroup}>
              <label htmlFor="student" className={styles.formLabel}>Студент</label>
              {user?.role === 'student' ? (
                  <input
                      type="text"
                       id="studentName"
                       value={user.name}
                       className={styles.textInput}
                       disabled // Студент не может менять себя
                  />
              ) : (
                 <select
                    id="student"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className={styles.selectInput}
                    disabled={isLoading || (user?.role === 'parent' && students.length === 1)}
                 >
                   <option value="">Выберите студента</option>
                   {students.map(student => (
                     <option key={student.id} value={student.id}>
                       {student.name}
                     </option>
                   ))}
                 </select>
              )}

               {!isLoading && students.length === 0 && user?.role !== 'student' && (
                 <p className={styles.formInfoMessage}>Нет доступных студентов для выбора.</p>
               )}
               {!isLoading && user?.role === 'parent' && students.length === 1 && selectedStudent && (
                  <p className={styles.formInfoMessage}>Студент выбран автоматически.</p>
               )}

            </div>
          </div>
        </div>

        {/* Tabs for Template vs Upload */}
        <div className={styles.tabs}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabButton} ${activeTab === 'template' ? styles.active : ''}`}
              onClick={() => !isLoading && setActiveTab('template')}
              type="button"
               disabled={isLoading}
            >
              Создать из шаблона
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'upload' ? styles.active : ''}`}
              onClick={() => !isLoading && setActiveTab('upload')}
              type="button"
               disabled={isLoading}
            >
              Загрузить документ
            </button>
          </div>

          {/* Template Tab Content */}
          <div className={`${styles.tabContent} ${activeTab === 'template' ? styles.active : ''}`}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Выберите шаблон документа</h3>
                <p className={styles.cardDescription}>Заполните необходимые поля для создания документа</p>
              </div>
              <div className={styles.cardContent}>
                 {isLoading && templates.length === 0 ? (
                      <div className={styles.loadingText}>Загрузка шаблонов...</div>
                 ) : templates.length === 0 ? (
                      <div className={styles.emptyStateText}>
                          Нет доступных шаблонов документов.
                      </div>
                 ) : (
                     <div className={styles.formSection}>
                       <label className={styles.formLabel}>Шаблон документа</label>
                       <div className={styles.templateGrid}>
                         {templates.map(template => (
                           <div
                             key={template.id}
                             className={`${styles.templateCard} ${
                               selectedTemplate?.id === template.id
                                 ? styles.selected
                                 : ''
                             }`}
                             onClick={() => !isLoading && handleTemplateSelect(template.id)}
                              role="button"
                              tabIndex={0}
                              onKeyPress={(e) => {
                                   if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                                        handleTemplateSelect(template.id);
                                   }
                              }}
                           >
                             <div className={styles.templateHeader}>
                               <FileText className={styles.templateIcon} />
                               <h3>{template.name}</h3>
                             </div>
                             <p className={styles.templateDescription}>
                               {template.description || 'Без описания'}
                             </p>
                           </div>
                         ))}
                       </div>
                     </div>
                 )}


                {selectedTemplate && (
                  <>
                    {/* Document Name Input */}
                    <div className={styles.formGroup} style={{marginTop: '20px'}}>
                      <label htmlFor="docName" className={styles.formLabel}>Название документа</label>
                      <input
                        type="text"
                        id="docName"
                        value={customDocName}
                        onChange={(e) => setCustomDocName(e.target.value)}
                        placeholder="Введите название документа"
                        className={styles.textInput}
                        disabled={isLoading}
                      />
                    </div>

                    {/* Template Fields */}
                     <div className={styles.formSection} style={{marginTop: '20px'}}>
                       <h3 className={styles.sectionTitle}>Заполните данные</h3>
                       <div className={styles.fieldsContainer}>
                         {selectedTemplate.fields && Array.isArray(selectedTemplate.fields) && selectedTemplate.fields.map(field => (
                           <div key={field.name} className={styles.formGroup}>
                             <label htmlFor={field.name} className={styles.formLabel}>
                               {field.label}
                               {field.required && <span className={styles.requiredMark}>*</span>}
                             </label>

                             {field.type === 'text' && (
                               <input
                                 type="text"
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.textInput}
                                  disabled={isLoading}
                                  placeholder={field.placeholder}
                               />
                             )}

                             {field.type === 'textarea' && (
                               <textarea
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.textareaInput}
                                  disabled={isLoading}
                                   placeholder={field.placeholder}
                               />
                             )}

                             {field.type === 'date' && (
                               <input
                                 type="date"
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.dateInput}
                                  disabled={isLoading}
                               />
                             )}

                             {field.type === 'select' && field.options && Array.isArray(field.options) && (
                               <select
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 className={styles.selectInput}
                                  disabled={isLoading}
                               >
                                 <option value="">Выберите опцию</option>
                                 {field.options.map(option => (
                                   <option key={option.value} value={option.value}>
                                     {option.label}
                                   </option>
                                 ))}
                               </select>
                             )}

                             {field.type === 'email' && (
                               <input
                                 type="email"
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.textInput}
                                  disabled={isLoading}
                                   placeholder={field.placeholder}
                               />
                             )}

                             {field.type === 'tel' && (
                               <input
                                 type="tel"
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.textInput}
                                  disabled={isLoading}
                                   placeholder={field.placeholder}
                               />
                             )}
                           </div>
                         ))}
                       </div>
                     </div>

                     {/* Required Signatures Display */}
                      {selectedTemplate.requiredSignatures && Array.isArray(selectedTemplate.requiredSignatures) && selectedTemplate.requiredSignatures.length > 0 && (
                          <div className={styles.formSection} style={{marginTop: '20px'}}>
                              <h3 className={styles.sectionTitle}>Требуемые подписи</h3>
                              <p className={styles.sectionDescription}>Документ требует следующих подписей:</p>
                              <ul className={styles.requiredSignaturesList}>
                                  {selectedTemplate.requiredSignatures.map((sig, index) => (
                                      <li key={sig.role || index}>
                                          {sig.title || sig.role} {/* TODO: Отображать статус подписи, если он известен */}
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      )}


                    {/* Digital Signature Section - Show only if Template selected, Student selected/identified, AND user role matches a digital slot */}
                    {selectedStudent && userSignatureSlot && ( // Показываем, если выбран студент и текущий пользователь может подписать цифровой слот
                        <div className={styles.formSection} style={{marginTop: '20px'}}>
                            <h3 className={styles.sectionTitle}>Цифровая подпись</h3>
                            <div className={styles.signatureContainer}>
                                {!isSigned ? (
                                    <div className={styles.signaturePlaceholder}>
                                        <button
                                            className={`${styles.button} ${styles.outlineButton}`}
                                            type="button"
                                            onClick={handleInitiateSignatureQR}
                                            disabled={isLoading}
                                        >
                                            <QrCode style={{width: '1em', height: '1em', marginRight: '6px'}} />
                                            Подписать как "{user?.role}"
                                        </button>
                                        <p className={styles.signatureInfo}>
                                            Для отправки документа на проверку требуется ваша цифровая подпись как "{user?.role}".
                                        </p>
                                    </div>
                                ) : (
                                    <div className={styles.signatureComplete}>
                                        <div className={styles.signatureDetails}>
                                            <div>
                                                <h4>Документ подписан</h4>
                                                {signedDetails && (
                                                    <p className={styles.signatureDate}>
                                                        {signedDetails.name} • {new Date(signedDetails.date).toLocaleDateString('ru-RU')} ({signedDetails.slot})
                                                    </p>
                                                )}
                                            </div>
                                            <CheckCircle style={{width: '2em', height: '2em', color: 'hsl(120, 84%, 40%)'}} />
                                        </div>
                                        <p className={styles.signatureInfo}>
                                            Подпись успешно добавлена.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upload Tab Content */}
          <div className={`${styles.tabContent} ${activeTab === 'upload' ? styles.active : ''}`}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Загрузите документ</h3>
                <p className={styles.cardDescription}>Выберите файл для загрузки</p>
              {/* TODO: Возможно, здесь тоже нужна секция для подписи загруженного документа после его загрузки? */}
              </div>
              <div className={styles.cardContent}>
                <div className={styles.formSection}>
                  <label htmlFor="file" className={styles.formLabel}>Файл документа</label>
                  <div className={styles.fileUploadArea}>
                    {selectedFile ? (
                      <div className={styles.filePreview}>
                        <FileText style={{width: '2em', height: '2em', color: 'hsl(221, 83%, 53%)'}} />
                        <div className={styles.fileDetails}>
                           <p className={styles.fileName}>{selectedFile.name}</p>
                           <p className={styles.fileSize}>
                            {(selectedFile.size / 1024).toFixed(2)} KB
                           </p>
                        </div>
                        <button
                          className={`${styles.button} ${styles.outlineButton} ${styles.buttonSmall}`}
                          type="button"
                          onClick={() => !isLoading && setSelectedFile(null)}
                          disabled={isLoading}
                        >
                          Изменить
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload style={{width: '3em', height: '3em', color: 'hsl(215, 16%, 47%)'}} />
                        <h3 className={styles.uploadTitle}>Перетащите файл или нажмите для загрузки</h3>
                        <p className={styles.uploadDescription}>
                          Поддерживаемые форматы: PDF, DOC, DOCX, JPG, PNG
                        </p>
                        <input
                          id="file"
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                          className={styles.hiddenInput}
                          disabled={isLoading}
                        />
                        <button
                          className={`${styles.button} ${styles.outlineButton}`}
                          type="button"
                          onClick={() => !isLoading && document.getElementById('file')?.click()}
                          disabled={isLoading}
                        >
                          Выбрать файл
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {selectedFile && (
                  <div className={styles.formGroup} style={{marginTop: '20px'}}>
                    <label htmlFor="uploadDocName" className={styles.formLabel}>Название документа</label>
                    <input
                      type="text"
                      id="uploadDocName"
                      value={customDocName}
                      onChange={(e) => setCustomDocName(e.target.value)}
                      placeholder="Введите название документа"
                      className={styles.textInput}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={styles.card}>
           <div className={styles.cardFooter}>
             <button
               type="button"
               className={`${styles.button} ${styles.outlineButton}`}
               onClick={() => navigate('/documents')}
               disabled={isLoading}
             >
               Отмена
             </button>
             <button
               type="button"
               className={`${styles.button} ${styles.primaryButton}`}
               onClick={handleSubmit}
               disabled={
                 isLoading ||
                 !selectedStudent ||
                 (activeTab === 'template' && (!selectedTemplate || (userSignatureSlot && !isSigned))) || // Для шаблона: нужен шаблон И если требуется подпись пользователя, она должна быть поставлена
                 (activeTab === 'upload' && !selectedFile) // Для загрузки нужен файл
               }
             >
               {isLoading ? 'Отправка...' : 'Создать документ'}
             </button>
           </div>
        </div>

        {/* QR Code Modal */}
        {showQRCodeModal && (
          <div className={styles.modalOverlay} onClick={() => !isLoading && setShowQRCodeModal(false)}>
             <div className={styles.signatureModalContent} onClick={(e) => e.stopPropagation()}>
                  {/* Close button */}
                 <button
                      className={styles.modalCloseButton}
                      onClick={() => !isLoading && setShowQRCodeModal(false)}
                      disabled={isLoading || !qrCodeDataUrl}
                 >
                     <X style={{width: '1.5em', height: '1.5em'}} />
                 </button>

                 <h3 className={styles.modalTitle}>Подпишите документ</h3>
                 {signatureInitiatedDocId && userSignatureSlot ? (
                     <p className={styles.modalDescription}>
                       Отсканируйте этот код вашим мобильным устройством, чтобы поставить подпись для слота "{userSignatureSlot}" документа ID: {signatureInitiatedDocId}.
                     </p>
                 ) : (
                      <p className={styles.modalDescription}>
                       Подготовьтесь к сканированию QR-кода для подписи.
                     </p>
                 )}


                  <div className={styles.qrCodeDisplay}>
                       {qrCodeDataUrl ? (
                            <img src={qrCodeDataUrl} alt="QR Code для подписи" className={styles.qrCodeImage} />
                       ) : (
                           <div className={styles.qrCodePlaceholder}>
                                <QrCode style={{width: '4em', height: '4em', color: 'hsl(215, 16%, 47%)'}} />
                                <p>{isLoading ? 'Генерация QR-кода...' : 'Ожидание QR-кода...'}</p>
                           </div>
                       )}
                  </div>

                 {!qrCodeDataUrl && !isLoading && (
                      <p className={styles.qrCodeScanInfo}>
                         QR-код появится после успешной подготовки.
                     </p>
                 )}
                  {qrCodeDataUrl && (
                       <p className={styles.qrCodeScanInfo}>
                          Откройте камеру или приложение для сканирования QR-кодов на телефоне и отсканируйте изображение выше.
                          После подписания на мобильном устройстве, статус подписи обновится здесь автоматически.
                       </p>
                  )}


                 {/* Кнопка для ИМИТАЦИИ завершения подписи (для тестирования) */}
                 {qrCodeDataUrl && !isSigned && ( // Показываем, если QR виден и подпись еще не поставлена
                      <button
                         type="button"
                         className={`${styles.button} ${styles.primaryButton}`}
                         onClick={handleSimulateSignatureComplete}
                         disabled={isLoading}
                         style={{marginTop: '20px'}}
                     >
                         Имитировать завершение подписи
                     </button>
                 )}


               </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    );
  };

export default CreateDocument;