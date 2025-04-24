import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Download, ArrowLeft, QrCode } from 'lucide-react';
import axios from 'axios';

import styles from './../styles/CreateDocument.module.css';

const CreateDocument = () => {
  const navigate = useNavigate();

  const user = { id: '123', name: 'Example User', role: 'parent' };

  const [activeTab, setActiveTab] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customDocName, setCustomDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [formData, setFormData] = useState({});
  const [signature, setSignature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [toast, setToast] = useState({ show: false, title: '', description: '', variant: '' });

  const showToast = (title, description, variant = 'default') => {
    setToast({ show: true, title, description, variant });
    setTimeout(() => {
      setToast({ show: false, title: '', description: '', variant: '' });
    }, 3000);
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/document-templates');

        if (response.data) {
          const formattedTemplates = response.data.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            fields: item.template_fields
          }));
          setTemplates(formattedTemplates);
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
           response = await axios.get('/api/parent/students');
         } else if (user?.role === 'curator') {
            response = await axios.get('/api/users', { params: { role: 'student', curator_id: user?.id } });
         } else {
             response = await axios.get('/api/users', { params: { role: 'student' } });
         }

        if (response.data) {
          const formattedStudents = response.data.map(student => ({
              id: student.id,
              name: student.full_name
          }));
          setStudents(formattedStudents);
          if (formattedStudents.length === 1) {
            setSelectedStudent(formattedStudents[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        showToast(
          'Ошибка загрузки списка студентов',
          'Не удалось загрузить список студентов',
          'error'
        );
      }
    };

    if (user?.id && user?.role) {
      fetchTemplates();
      fetchStudents();
    }
  }, [user?.id, user?.role]);

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCustomDocName(template.name);

      if (template.fields && Array.isArray(template.fields.fields)) {
         const initialData = {};
         template.fields.fields.forEach(field => {
           initialData[field.name] = '';
         });
         setFormData(initialData);
      } else {
         setFormData({});
      }
      setSignature('');
    } else {
       setSelectedTemplate(null);
       setCustomDocName('');
       setFormData({});
       setSignature('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setCustomDocName(file.name);
      setSelectedTemplate(null);
      setFormData({});
      setSignature('');
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

  const handleSign = () => {
    setShowQRCode(true);
    setTimeout(() => {
      setSignature(`${user?.name || 'Подписант'}_${new Date().toISOString()}`);
      setShowQRCode(false);
      showToast('Документ подписан', 'Цифровая подпись добавлена к документу');
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      showToast('Ошибка', 'Выберите студента', 'error');
      return;
    }

    setIsLoading(true);

    try {
      if (activeTab === 'template' && selectedTemplate) {
         const fields = selectedTemplate.fields?.fields || [];
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

        if (!signature) {
          showToast(
            'Требуется подпись',
            'Пожалуйста, подпишите документ',
            'error'
          );
          setIsLoading(false);
          return;
        }

        const response = await axios.post('/api/documents', {
            name: customDocName,
            template_id: selectedTemplate.id,
            student_id: selectedStudent,
            status: 'pending',
            content: formData,
            signature: signature,
            submitted_by: user?.id
          });

        if (response.status === 201) {
           showToast(
             'Документ создан',
             'Документ успешно создан и отправлен на проверку'
           );
           navigate('/documents');
        } else {
             throw new Error(`Ошибка сервера: ${response.status}`);
        }

      }
      else if (activeTab === 'upload' && selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('document', selectedFile);
        uploadFormData.append('name', customDocName || selectedFile.name);
        uploadFormData.append('student_id', selectedStudent);
        uploadFormData.append('status', 'pending');
        uploadFormData.append('submitted_by', user?.id);

        const response = await axios.post('/api/documents/upload', uploadFormData, {
           headers: {
             'Content-Type': 'multipart/form-data'
           }
        });

        if (response.status === 201) {
            showToast(
             'Документ загружен',
             'Документ успешно загружен и отправлен на проверку'
            );
            navigate('/documents');
        } else {
             throw new Error(`Ошибка сервера: ${response.status}`);
        }

      } else {
        showToast(
          'Ошибка',
          'Выберите шаблон или загрузите файл',
          'error'
        );
      }
    } catch (error) {
      console.error('Error creating document:', error);
      showToast(
        'Ошибка создания документа',
        error.message || 'Произошла неизвестная ошибка',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className={styles.sidebarLayout}>
      {toast.show && (
        <div className={`${styles.toast} ${styles[toast.variant]}`}>
          <h4>{toast.title}</h4>
          <p>{toast.description}</p>
        </div>
      )}

      <div className={styles.contentContainer}>
        <div className={styles.pageHeader}>
          <button
            className={styles.iconButton}
            onClick={() => navigate('/documents')}
            type="button"
          >
            <ArrowLeft />
          </button>
          <div>
            <h2 className={styles.pageTitle}>Создание документа</h2>
            <p className={styles.pageDescription}>Создайте новый документ или загрузите файл</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Информация о документе</h3>
            <p className={styles.cardDescription}>Выберите студента, для которого создается документ</p>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.formGroup}>
              <label htmlFor="student" className={styles.formLabel}>Студент</label>
              <select
                id="student"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className={styles.selectInput}
                disabled={students.length <= 1}
              >
                <option value="">Выберите студента</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.tabs}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabButton} ${activeTab === 'template' ? styles.active : ''}`}
              onClick={() => setActiveTab('template')}
              type="button"
            >
              Создать из шаблона
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'upload' ? styles.active : ''}`}
              onClick={() => setActiveTab('upload')}
              type="button"
            >
              Загрузить документ
            </button>
          </div>

          <div className={`${styles.tabContent} ${activeTab === 'template' ? styles.active : ''}`}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Выберите шаблон документа</h3>
                <p className={styles.cardDescription}>Заполните необходимые поля для создания документа</p>
              </div>
              <div className={styles.cardContent}>
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
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <div className={styles.templateHeader}>
                          <FileText className={styles.templateIcon} />
                          <h3>{template.name}</h3>
                        </div>
                        <p className={styles.templateDescription}>
                          {template.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTemplate && (
                  <>
                    <div className={styles.formGroup} style={{marginTop: '20px'}}>
                      <label htmlFor="docName" className={styles.formLabel}>Название документа</label>
                      <input
                        type="text"
                        id="docName"
                        value={customDocName}
                        onChange={(e) => setCustomDocName(e.target.value)}
                        placeholder="Введите название документа"
                        className={styles.textInput}
                      />
                    </div>

                     <div className={styles.formSection} style={{marginTop: '20px'}}>
                       <h3 className={styles.sectionTitle}>Заполните данные</h3>
                       <div className={styles.fieldsContainer}>
                         {selectedTemplate.fields && Array.isArray(selectedTemplate.fields.fields) && selectedTemplate.fields.fields.map(field => (
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
                               />
                             )}

                             {field.type === 'textarea' && (
                               <textarea
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 required={field.required}
                                 className={styles.textareaInput}
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
                               />
                             )}

                             {field.type === 'select' && field.options && (
                               <select
                                 id={field.name}
                                 value={formData[field.name] || ''}
                                 onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                 className={styles.selectInput}
                               >
                                 <option value="">Выберите опцию</option>
                                 {field.options.map(option => (
                                   <option key={option} value={option}>
                                     {option}
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
                               />
                             )}
                           </div>
                         ))}
                       </div>
                     </div>

                    <div className={styles.formSection} style={{marginTop: '20px'}}>
                      <h3 className={styles.sectionTitle}>Цифровая подпись</h3>
                      <div className={styles.signatureContainer}>
                        {!signature ? (
                          <div className={styles.signaturePlaceholder}>
                            {showQRCode ? (
                              <div className={styles.qrCodeContainer}>
                                <QrCode className={styles.qrCodeIcon} />
                                <p className={styles.qrCodeText}>
                                  Отсканируйте QR-код с помощью мобильного приложения для подписи
                                </p>
                              </div>
                            ) : (
                              <button
                                className={styles.outlineButton}
                                type="button"
                                onClick={handleSign}
                                disabled={isLoading}
                              >
                                <QrCode className={styles.buttonIcon} />
                                Подписать документ
                              </button>
                            )}
                            <p className={styles.signatureInfo}>
                              Документ должен быть подписан для отправки на проверку
                            </p>
                          </div>
                        ) : (
                          <div className={styles.signatureComplete}>
                            <div className={styles.signatureDetails}>
                              <div>
                                <h4>Документ подписан</h4>
                                <p className={styles.signatureDate}>
                                  {user?.name || 'Подписант'} • {new Date().toLocaleDateString('ru-RU')}
                                </p>
                              </div>
                              <QrCode className={styles.signatureIcon} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={`${styles.tabContent} ${activeTab === 'upload' ? styles.active : ''}`}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Загрузите документ</h3>
                <p className={styles.cardDescription}>Выберите файл для загрузки</p>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.formSection}>
                  <label htmlFor="file" className={styles.formLabel}>Файл документа</label>
                  <div className={styles.fileUploadArea}>
                    {selectedFile ? (
                      <div className={styles.filePreview}>
                        <FileText className={styles.fileIcon} />
                        <p className={styles.fileName}>{selectedFile.name}</p>
                        <p className={styles.fileSize}>
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                        <button
                          className={styles.outlineButton}
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          disabled={isLoading}
                        >
                          Изменить файл
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className={styles.uploadIcon} />
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
                          className={styles.outlineButton}
                          type="button"
                          onClick={() => document.getElementById('file')?.click()}
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

        <div className={styles.card}>
          <div className={styles.cardFooter}>
            <button
              type="button"
              className={styles.outlineButton}
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
                (activeTab === 'template' && (!selectedTemplate || (selectedTemplate && !signature))) ||
                (activeTab === 'upload' && !selectedFile)
              }
            >
              {isLoading ? 'Создание...' : 'Создать документ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDocument;