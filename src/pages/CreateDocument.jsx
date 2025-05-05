// CreateDocument.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Upload, ArrowLeft, QrCode, CheckCircle, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import SidebarLayout from './../components/layouts/SidebarLayout';
import { useAuth } from './../contexts/AuthContext';
import qrcode from 'qrcode';
// Импорты для генерации PDF
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import styles from './../styles/CreateDocument.module.css';

// Маппинг для перевода типа причины отпуска (из select'а)
const leaveReasonTypeTranslations = {
    medical: 'медицинские показания',
    family: 'семейные обстоятельства',
    other: 'Иная причина',
};

// Функция для расчета курса по году группы (например, ПО23 -> 2 курс в 2024/2025 году)
// academicYearStartYear: год начала текущего академического года (например, 2024 для 2024-2025)
const getCourseFromGroup = (groupName, academicYearStartYear = new Date().getFullYear()) => {
    if (!groupName || typeof groupName !== 'string') return '___';
    const match = groupName.match(/\d{2}/); // Ищем две цифры подряд (например, 23 в ПО2301)
    if (!match) return '___';
    const groupYearLastTwoDigits = parseInt(match[0], 10);
    if (isNaN(groupYearLastTwoDigits)) return '___';

    // Преобразуем двузначный год группы в полный год (например, 23 -> 2023)
    // Предполагаем, что все группы созданы в 21 веке
    const groupFullYear = 2000 + groupYearLastTwoDigits;

    // Курс = Текущий академ. год (начало) - Год набора + 1
    const course = academicYearStartYear - groupFullYear + 1;

    // Простая валидация курса (например, от 1 до 4)
    if (course >= 1 && course <= 4) {
        return String(course);
    }

    return '___'; // Если курс не в ожидаемом диапазоне
};


// Хелпер функция для заполнения HTML-шаблона данными
// data должен быть объектом { fieldName: value, student_name: '...', student_group: '...', ... }
const populateHtmlTemplate = (htmlString, data) => {
    let populatedHtml = htmlString;
    if (!data) return populatedHtml; // Вернуть шаблон, если данных нет

    // Простая замена плейсхолдеров вида {{fieldName}}
    for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            const placeholder = `{{${key}}}`;
            // Преобразуем значение в строку, используем пустую строку для null/undefined
            const value = String(data[key] ?? ''); // Использование ?? для обработки null и undefined
            // Экранируем спецсимволы в имени ключа для RegExp
            const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
            populatedHtml = populatedHtml.replace(regex, value);
        }
    }
    return populatedHtml;
};


// Хелпер функция для генерации PDF из HTML строки
// Возвращает Blob или выбрасывает ошибку
const generatePdf = async (htmlContent, filename = 'document') => {
  if (!htmlContent) {
      console.error("DEBUG_PDF_EMPTY: htmlContent is empty."); // Лог: HTML пуст?
      throw new Error("HTML content is empty. Cannot generate PDF.");
  }

  // Создаем временный элемент в DOM для рендеринга HTML
  const container = document.createElement('div');
  // Временно делаем контейнер видимым для отладки
  container.style.position = 'relative'; // Измените на relative
  container.style.left = '0'; // Измените на 0
  container.style.width = '210mm'; // A4 ширина
  container.style.padding = '10mm';
  container.style.backgroundColor = 'white';
  container.style.boxSizing = 'border-box';
  container.style.whiteSpace = 'normal';

  console.log("DEBUG_PDF_EMPTY: Setting container innerHTML..."); // Лог перед установкой HTML
  container.innerHTML = htmlContent;
  console.log("DEBUG_PDF_EMPTY: Container innerHTML set. Length:", container.innerHTML.length); // Лог после установки HTML

  document.body.appendChild(container);

  try {
      // Дождемся, пока элемент будет отрисован в DOM
      await new Promise(resolve => setTimeout(resolve, 100)); // Увеличьте задержку на всякий случай
       console.log("DEBUG_PDF_EMPTY: Container should be in DOM and potentially visible now."); // Лог: контейнер добавлен

      // Используем html2canvas для преобразования HTML в Canvas
      console.log("DEBUG_PDF_EMPTY: Starting html2canvas..."); // Лог перед html2canvas
      const canvas = await html2canvas(container, {
           scale: 2,
           logging: true, // Включите логи html2canvas в консоли
           useCORS: true,
           windowWidth: container.offsetWidth,
           windowHeight: container.offsetHeight,
           scrollX: -window.scrollX,
           scrollY: -window.scrollY,
           width: container.offsetWidth,
           height: container.offsetHeight,
      });
       console.log("DEBUG_PDF_EMPTY: html2canvas finished. Canvas size:", canvas.width, canvas.height); // Лог размера холста

      // Используем jsPDF для создания PDF
      const imgData = canvas.toDataURL('image/png');
       console.log("DEBUG_PDF_EMPTY: Canvas toDataURL length:", imgData.length); // Лог длины Data URL (пустой Data URL очень короткий)

      if (imgData.length < 1000) { // Если Data URL слишком короткий, вероятно, изображение пустое
          console.error("DEBUG_PDF_EMPTY: Generated image data is too short. HTML content or rendering might be the issue.");
          throw new Error("Generated image data is empty or corrupted.");
      }


      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfPageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfPageHeight;

      while (heightLeft > 0) {
          position = heightLeft * -1;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfPageHeight;
      }

      const pdfBlob = pdf.output('blob');
       console.log("DEBUG_PDF_EMPTY: PDF Blob generated. Size:", pdfBlob.size); // Лог размера Blob

      // Очищаем временный DOM-элемент
      document.body.removeChild(container);
       console.log("DEBUG_PDF_EMPTY: Container removed from DOM.");

      return pdfBlob;

  } catch (error) {
      console.error('Error generating PDF:', error);
      // Очищаем временный элемент даже в случае ошибки
      if (document.body.contains(container)) {
           document.body.removeChild(container);
      }
       console.log("DEBUG_PDF_EMPTY: Container removed from DOM on error.");
      throw new Error('Ошибка при генерации PDF документа: ' + error.message);
  }
};



const CreateDocument = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('template');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customDocName, setCustomDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); // Используется только для вкладки Upload
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(''); // ID выбранного студента

  const [formData, setFormData] = useState({}); // Для полей шаблона

  const [isSigned, setIsSigned] = useState(false); // Флаг успешной подписи текущим пользователем
  const [signedDetails, setSignedDetails] = useState(null); // Детали подписи
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(''); // URL для QR-кода подписи
  const [signatureInitiatedDocId, setSignatureInitiatedDocId] = useState(null); // ID черновика, для которого инициирована подпись

  const [savedSignatureUuid, setSavedSignatureUuid] = useState(null); // UUID изображения подписи (получено по опросу)
  const [signatureImageUrl, setSignatureImageUrl] = useState(null); // Blob URL для отображения изображения подписи


  const [isLoading, setIsLoading] = useState(true); // Общий статус загрузки/обработки
  const [toast, setToast] = useState({ show: false, title: '', description: '', variant: '' });

  // Ref для управления интервалом опроса
  const pollingIntervalRef = useRef(null);


  // Определяем слот подписи для текущего пользователя на основе его роли и шаблона
  const userSignatureSlot = useMemo(() => {
      if (!user?.role || !selectedTemplate?.requiredSignatures) { return null; }
      const requiredSlots = selectedTemplate.requiredSignatures; const userRole = user.role;
      const digitalSignerRoles = ['admin', 'curator', 'dean']; // Роли, которые подписывают цифровой подписью в системе
      // Ищем слот, чья роль совпадает с ролью текущего пользователя
      const matchingSlot = requiredSlots.find(sig => sig.role === userRole);
      // Проверяем, что найденный слот является цифровым слотом, который может быть подписан в системе
      if (matchingSlot && digitalSignerRoles.includes(userRole)) {
          return matchingSlot.role; // Возвращаем имя слота (которое совпадает с ролью)
      }
      return null; // Если нет соответствующего цифрового слота для этой роли
  }, [user?.role, selectedTemplate?.requiredSignatures]);

   // Определяем, требует ли шаблон какие-либо цифровые подписи
   const requiresAnyDigitalSignature = useMemo(() => {
       if (!selectedTemplate?.requiredSignatures) return false;
       const digitalSignerRoles = ['admin', 'curator', 'dean'];
       return selectedTemplate.requiredSignatures.some(sig => digitalSignerRoles.includes(sig.role));
   }, [selectedTemplate?.requiredSignatures]);


  const showToast = (title, description, variant = 'default') => {
    setToast({ show: true, title, description, variant });
    setTimeout(() => { setToast({ show: false, title: '', description: '', variant: '' }); }, 3000);
  };

  // TODO: Логика "Загрузить заново"
  useEffect(() => {
      if (location.state?.documentToReplaceId) {
           console.log("Initiated 'Upload Again' for document ID:", location.state.documentToReplaceId);
           showToast('Загрузить заново', `Функционал загрузки заново для документа ID ${location.state.documentToReplaceId} в разработке.`, 'info');
           navigate(location.pathname, { replace: true, state: {} });
      }
  }, [location.state, navigate]);


  // Логика отслеживания подписи (Polling) - Остается без изменений, реагирует на showQRCodeModal, signatureInitiatedDocId, userSignatureSlot
  useEffect(() => {
      const pollSignatureStatus = async (docId, slotName) => {
          try {
              const response = await axios.get(`/api/documents/${docId}/signature-status/${slotName}`);
              if (response.data?.status === 'signed' && response.data?.signatureImageUuid) {
                  console.log("Polling successful: Signature found!");
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;

                  setIsSigned(true);
                  setSignedDetails({
                      name: response.data.signedByName || user?.name || 'Неизвестный',
                      date: response.data.signedAt || new Date().toISOString(),
                      slot: slotName,
                  });
                  setSavedSignatureUuid(response.data.signatureImageUuid);
                  setShowQRCodeModal(false);
                  showToast('Подпись получена', `Ваша подпись для слота "${slotName}" успешно зарегистрирована!`, 'success');
              } else {
                   console.log("Polling: Signature status not 'signed' or signatureImageUuid missing.", response.data);
              }
          } catch (error) {
               console.error("Polling error:", error);
               // TODO: Add retry logic or stop polling after multiple errors
          }
      };

      // Start polling if modal is open, we have a draft ID, a user slot, and the signature isn't already signed
      if (showQRCodeModal && signatureInitiatedDocId && userSignatureSlot && !isSigned && !pollingIntervalRef.current) {
          console.log(`Starting polling for Doc ID: ${signatureInitiatedDocId}, Slot: ${userSignatureSlot}`);
          // Poll immediately and then set interval
          pollSignatureStatus(signatureInitiatedDocId, userSignatureSlot);
          pollingIntervalRef.current = setInterval(() => {
              pollSignatureStatus(signatureInitiatedDocId, userSignatureSlot);
          }, 3000); // Poll every 3 seconds
      }

      // Cleanup interval on modal close, signature success (isSigned becomes true), or unmount
      return () => {
          if (pollingIntervalRef.current) {
              console.log("Polling stopped or cleared on cleanup.");
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
          }
      };
  }, [showQRCodeModal, signatureInitiatedDocId, userSignatureSlot, isSigned, user?.name]);


  // Effect to fetch signature image when UUID is available - Remains as implemented
   useEffect(() => {
       let currentImageUrl = null; // Variable to hold the URL created in this effect run

       const fetchSignatureImage = async (uuid) => {
           try {
               const response = await axios.get(`/api/signatures/${uuid}/image`, {
                   responseType: 'blob', // Essential for fetching binary data (image)
                   timeout: 10000
               });

               if (response.data instanceof Blob && response.data.type.startsWith('image/')) {
                   const url = URL.createObjectURL(response.data);
                   currentImageUrl = url; // Store the newly created URL for cleanup
                   console.log("Generated blob URL for signature image:", url);
                   setSignatureImageUrl(url);
               } else {
                    console.error("Fetched data is not a valid image blob.");
                    setSignatureImageUrl(null);
               }
           } catch (err) {
               console.error("Error fetching signature image:", err);
               setSignatureImageUrl(null);
           }
       };

       if (savedSignatureUuid) {
           console.log("Attempting to fetch signature image for UUID:", savedSignatureUuid);
           fetchSignatureImage(savedSignatureUuid);
       } else {
            setSignatureImageUrl(null); // Clear image if UUID is cleared
       }

       return () => {
           if (currentImageUrl) { // Only revoke if a URL was successfully created in this run
               console.log("Cleanup: Revoking blob URL", currentImageUrl);
               URL.revokeObjectURL(currentImageUrl);
           }
       };
   }, [savedSignatureUuid]); // Dependency array: run when savedSignatureUuid changes


  // Эффект для начальной загрузки данных (шаблоны, студенты)
  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    const fetchTemplates = async () => {
      try {
        const response = await axios.get('/api/document-templates');
        if (response.data && Array.isArray(response.data)) {
          const formattedTemplates = response.data.map((item) => ({
            id: item.id, name: item.name, description: item.description || '',
            fields: item.template_fields, requiredSignatures: item.required_signatures,
            htmlTemplate: item.html_template // <-- Fetch html_template
          }));
          // Filter out templates without HTML_template if PDF generation is required for all template submissions
          // For now, we'll show all, but disable PDF features if htmlTemplate is missing
          setTemplates(formattedTemplates);
        } else { console.error('Error fetching templates: Invalid data format', response.data); setTemplates([]); showToast('Ошибка загрузки шаблонов', 'Получен некорректный формат данных', 'error'); }
      } catch (error) { console.error('Error fetching templates:', error); showToast('Ошибка загрузки шаблонов', 'Не удалось загрузить список шаблонов документов', 'error'); }
    };
    const fetchStudents = async () => {
      try {
         let response;
         if (user?.role === 'parent') { response = await axios.get(`/api/parent/students`); }
         // Backend /api/users needs to be updated to include student's group and course
         else if (user?.role === 'curator') { response = await axios.get('/api/users', { params: { role: 'student', curator_id: user.id } }); }
         else if (user?.role === 'admin') { response = await axios.get('/api/users', { params: { role: 'student' } }); }
         else if (user?.role === 'student') {
             // For student themselves, fetch their own user details which *should* include group/course if backend provides it
             const studentSelfResponse = await axios.get('/api/users/me'); // Assuming /me endpoint returns group/course
             if (studentSelfResponse.data) {
                 const student = studentSelfResponse.data;
                 setStudents([{
                     id: student.id,
                     name: student.full_name || student.name,
                     group_name: student.group_name, // Assuming backend /me returns these
                     course: student.course, // Assuming backend /me returns these
                     // Add other student details needed for templates here
                 }]);
                 setSelectedStudent(student.id);
                 return;
             } else {
                 console.error('Error fetching student own data: Invalid format');
                 setStudents([]); // Clear students
             }
         }
         else { setStudents([]); console.warn(`Role ${user?.role} is not authorized to create documents`); return; }

        if (user?.role !== 'student') { // For roles other than student, process list response
            if (response.data && Array.isArray(response.data)) {
              const formattedStudents = response.data.map(student => ({
                  id: student.id,
                  name: student.full_name || student.name, // Use full_name if available
                  group_name: student.group_name, // Assuming backend /users includes this
                  course: student.course, // Assuming backend /users includes this
                  // Add other student details needed for templates here
              }));
              setStudents(formattedStudents);
              if (user?.role === 'parent' && formattedStudents.length === 1) { setSelectedStudent(formattedStudents[0].id); }
            } else { console.error('Error fetching students: Invalid data format', response.data); setStudents([]); showToast('Ошибка загрузки студентов', 'Получен некорректный формат данных', 'error'); }
        }
      } catch (error) { console.error('Error fetching students:', error); if (error.response?.status !== 403) { showToast('Ошибка загрузки списка студентов', 'Не удалось загрузить список студентов', 'error'); } setStudents([]); } finally { }
    };

    if (user?.id && user?.role) {
         setIsLoading(true);
         // Fetch templates and students parallelly
         Promise.allSettled([fetchTemplates(), fetchStudents()]).finally(() => { setIsLoading(false); });
    } else { setIsLoading(false); }
  }, [user?.id, user?.role]); // Add students dependency if their group/course is fetched here and used


  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      // Default name based on template name or generic if no name
      setCustomDocName(template.name || 'Новый документ из шаблона');
      // Initialize formData based on template fields
      if (template.fields && Array.isArray(template.fields)) {
         const initialData = {}; template.fields.forEach(field => { initialData[field.name] = ''; }); setFormData(initialData);
      } else { setFormData({}); }
      // Reset signature-related states when selecting a new template
      setIsSigned(false); setSignedDetails(null); setQrCodeDataUrl(''); setShowQRCodeModal(false); setSignatureInitiatedDocId(null);
      setSavedSignatureUuid(null); // Reset saved signature UUID
       if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; } // Stop polling
    } else {
       // Clear states if no template is selected (e.g., templateId is null or not found)
       setSelectedTemplate(null); setCustomDocName(''); setFormData({});
       setIsSigned(false); setSignedDetails(null); setQrCodeDataUrl(''); setShowQRCodeModal(false); setSignatureInitiatedDocId(null);
       setSavedSignatureUuid(null); // Reset saved signature UUID
       if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; } // Stop polling
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setCustomDocName(file.name); // Set document name to filename by default
      setSelectedTemplate(null); setFormData({}); // Clear template-related state
      // Reset signature-related states when switching to file upload
      setIsSigned(false); setSignedDetails(null); setQrCodeDataUrl(''); setShowQRCodeModal(false); setSignatureInitiatedDocId(null);
      setSavedSignatureUuid(null); // Reset saved signature UUID
      if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; } // Stop polling
    } else {
      setSelectedFile(null);
      setCustomDocName(''); // Clear document name if file is deselected
    }
  };

  const handleFieldChange = (name, value) => { setFormData(prev => ({ ...prev, [name]: value })); };

  // requestSignatureUrl remains mostly unchanged, requests QR URL for a given documentId and slotName
  const requestSignatureUrl = async (docId, slotName) => {
       setIsLoading(true);
       setQrCodeDataUrl(''); // Clear previous QR data

       try {
           const response = await axios.get(`/api/documents/${docId}/generate-signature-url/${slotName}`);
           if (response.data?.signatureUrl) {
               const signatureUrl = response.data.signatureUrl;
               console.log("Received Signature URL from backend:", signatureUrl);
               try {
                   const qrDataUrl = await qrcode.toDataURL(signatureUrl);
                   console.log("Generated QR Code Data URL (first 50 chars):", qrDataUrl.substring(0, 50) + '...');
                   setQrCodeDataUrl(qrDataUrl);
                   setShowQRCodeModal(true); // Only show modal on successful QR generation
               } catch (qrError) {
                   console.error("Error generating QR code from URL:", qrError);
                   showToast('Ошибка QR', 'Не удалось сгенерировать QR-код из ссылки.', 'error');
                   setShowQRCodeModal(false); // Do not show modal on QR error
               }
           } else {
               console.error("Backend did not return signatureUrl:", response.data);
               showToast('Ошибка QR', 'Не удалось получить URL для подписи.', 'error');
               setShowQRCodeModal(false); // Do not show modal on backend error
           }
       } catch (error) {
           console.error('Error requesting signature URL:', error);
           const errorMessage = error.response?.data?.message || 'Неизвестная ошибка при запросе ссылки для подписи.';
           showToast('Ошибка подписи', errorMessage, 'error');
           setQrCodeDataUrl('');
           setShowQRCodeModal(false); // Do not show modal on request error
       } finally {
           setIsLoading(false); // Stop loading indicator
       }
  };


  // MODIFIED LOGIC: This button now generates/uploads PDF, creates a draft, then initiates signature.
  const handleInitiateSignatureQR = async () => {
       const finalStudentId = user?.role === 'student' ? user.id : selectedStudent;
       if (!finalStudentId) { showToast('Ошибка', 'Выберите студента перед подписью', 'error'); return; }
       if (!selectedTemplate) { showToast('Ошибка', 'Выберите шаблон.', 'error'); return; }
       // Check if the selected template has an HTML template defined for PDF generation
       if (!selectedTemplate.htmlTemplate) { showToast('Ошибка', 'Выбранный шаблон не поддерживает генерацию PDF для подписи.', 'error'); return; }
       // Check if the current user's role is expected to sign this template digitally
       if (!userSignatureSlot) {
            const requiresAnyDigitalSignature = selectedTemplate.requiredSignatures?.some(sig => ['admin', 'curator', 'dean'].includes(sig.role));
            const message = requiresAnyDigitalSignature
                ? `Ваша роль (${user?.role}) не соответствует ни одному требуемому цифровому слоту подписи в этом шаблоне.`
                : 'Этот шаблон не требует цифровой подписи в системе.';
            showToast('Подпись не требуется здесь', message, 'info');
            return;
       }

       setIsLoading(true); // Start loading indicator
       showToast('Подготовка документа', 'Генерация PDF документа...', 'info');
       setQrCodeDataUrl(''); // Clear any previous QR data

       try {
           // 1. Collect all necessary data for the template
           const studentDetails = students.find(s => s.id === finalStudentId);
           const studentGroup = studentDetails?.group_name || '___'; // Get group name if available
           const studentCourse = getCourseFromGroup(studentGroup); // Calculate course
           const today = new Date().toLocaleDateString('ru-RU'); // Get today's date

           // Construct the data object for populateHtmlTemplate
           // Add student name, group, course, etc. here as needed by HTML placeholders
           const dataForTemplate = {
               ...formData, // Data from form fields
               // --- Standard Student/Document Data ---
               student_name: studentDetails?.name || 'Неизвестный студент', // Add student name
               student_group: studentGroup, // Add student group
               student_course: studentCourse, // Add student course
               data_segodnya: today, // Add today's date
               naimenovanie_uchebnogo_zavedeniya: 'Astana IT University', // Add static institution name
               // TODO: Add faculty if needed and available
               // fakultet: studentDetails?.faculty || '___',

               // --- Translate specific fields if needed ---
               leave_reason_type_translated: leaveReasonTypeTranslations[formData.leave_reason_type] || formData.leave_reason_type,

               // --- Digital Signature Placeholders (prepare data) ---
               digital_signature_role: '', // Will be filled dynamically below if signed
               digital_signature_name: '',
               digital_signature_image_html: '', // Placeholder for <img tag or signature block HTML
           };

           // If signature is already signed (unlikely in initiate flow, but for completeness)
           if (isSigned && signedDetails && signatureImageUrl) {
               dataForTemplate.digital_signature_role = signedDetails.slot;
               dataForTemplate.digital_signature_name = signedDetails.name;
               // Construct the HTML for the signature image + details block
               dataForTemplate.digital_signature_image_html = `
                    <div class="${styles.digitalSignatureStamp}">
                        <p class="${styles.signatureRole}">${signedDetails.slot === 'curator' ? 'Куратор' : signedDetails.slot === 'admin' ? 'Администратор' : signedDetails.slot}</p>
                        <p class="${styles.signatureName}">${signedDetails.name}</p>
                        <img src="${signatureImageUrl}" alt="Подпись ${signedDetails.slot}" style="display:block; max-width: 150px; max-height: 80px; margin: 5px auto; border: 1px solid #ccc; background-color: #fff;">
                        <p class="${styles.signatureDate}">${signedDetails.date ? new Date(signedDetails.date).toLocaleString('ru-RU') : ''}</p>
                    </div>
               `;
           }


           // 2. Populate the HTML template with the collected data
           const populatedHtml = populateHtmlTemplate(selectedTemplate.htmlTemplate, dataForTemplate);
           console.log("Populated HTML (start):", populatedHtml.substring(0, 200) + '...');


           // 3. Generate the PDF Blob from the populated HTML
           const pdfBlob = await generatePdf(populatedHtml, customDocName || selectedTemplate.name);
           console.log("PDF Blob generated:", pdfBlob);
            showToast('Подготовка документа', 'PDF успешно сгенерирован, начинается загрузка...', 'info');


           // 4. Upload the PDF Blob to the backend (which forwards to FastAPI)
           const uploadFormData = new FormData();
           uploadFormData.append('document', pdfBlob, `${customDocName || selectedTemplate.name || 'document'}.pdf`);
           uploadFormData.append('student_id', finalStudentId);
           uploadFormData.append('submitted_by', user.id); // The user initiating the process

           // Pass initial status and content for document creation on backend /upload route
           uploadFormData.append('status', 'draft'); // Initial status for draft
           uploadFormData.append('content', JSON.stringify(formData)); // Pass form data JSON
           uploadFormData.append('template_id', selectedTemplate.id); // <-- Передаем template_id


           // The /api/documents/upload endpoint should handle both file upload AND creating the document entry
           const uploadResponse = await axios.post('/api/documents/upload', uploadFormData, {
              headers: {
                'Content-Type': 'multipart/form-data' // Ensure correct Content-Type for FormData
              }
           });

           const currentDocId = uploadResponse.data?.documentId; // Backend /upload should return the created document ID
           if (!currentDocId) { throw new Error('Ошибка создания черновика: Не получен ID документа от сервера.'); }

           setSignatureInitiatedDocId(currentDocId); // Store the ID of the created draft document
            console.log(`Draft document created via upload with ID: ${currentDocId}`);
            showToast('Черновик сохранен', `Черновик документа сохранен с ID ${currentDocId}. Генерация QR для подписи...`, 'info');


           // 5. Request the signature URL for the created draft document (linked to the PDF)
           // requestSignatureUrl will show the QR modal and start polling via useEffect
           await requestSignatureUrl(currentDocId, userSignatureSlot);

       } catch (error) {
           console.error('Error in handleInitiateSignatureQR flow:', error);
           // Extract detailed error message if available
            const errorMessage = error.message || error.response?.data?.message || 'Произошла неизвестная ошибка в процессе подготовки подписи.';
           showToast('Ошибка подготовки', errorMessage, 'error');
           // Clear all signature-related state on error
           setIsSigned(false); setSignedDetails(null); setQrCodeDataUrl(''); setShowQRCodeModal(false); setSignatureInitiatedDocId(null);
           setSavedSignatureUuid(null);
           if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
       } finally {
           setIsLoading(false); // Stop global loading indicator
       }
  };


  // MODIFIED LOGIC: Handles final submission. For templates, either update draft status or generate/upload/create document. For uploads, just upload.
  const handleSubmit = async () => {
     const finalStudentId = user?.role === 'student' ? user.id : selectedStudent;
    if (!finalStudentId) { showToast('Ошибка', 'Не удалось определить студента для документа', 'error'); return; }
    if (!user?.id) { showToast('Ошибка', 'Пользователь не авторизован', 'error'); return; }

    setIsLoading(true); // Start global loading indicator
     showToast('Отправка документа', 'Начало процесса отправки...', 'info');


    try {
       let finalDocId = null; // To store the ID of the final document entry

       // Logic for submitting a document created from a template
      if (activeTab === 'template' && selectedTemplate) {
         // Validate required fields in the form
         const fields = selectedTemplate.fields || [];
        const missingFields = fields.filter(field => field.required && (!formData[field.name] || String(formData[field.name]).trim() === '')).map(field => field.label);
        if (missingFields.length > 0) { showToast('Заполните обязательные поля', `Необходимо заполнить: ${missingFields.join(', ')}`, 'error'); setIsLoading(false); return; }

        // Determine if the template requires ANY digital signature
        const requiresAnyDigitalSignature = selectedTemplate.requiredSignatures?.some(sig => ['admin', 'curator', 'dean'].includes(sig.role));

        // Check for current user digital signature requirement if applicable
        const requiresSignatureFromCurrentUser = !!userSignatureSlot;

        // --- NEW CHECK: If any digital signature is required, force the user to use the "Sign" flow first ---
        if (requiresAnyDigitalSignature && !signatureInitiatedDocId) {
             showToast('Требуется подготовка документа', 'Для шаблонов с цифровыми подписями необходимо сначала нажать "Подписать как...", чтобы сгенерировать и подготовить документ.', 'error');
             setIsLoading(false);
             return;
        }
        // --- END NEW CHECK ---


         // Ensure current user's signature is done if required (only reachable if signatureInitiatedDocId exists IF requiresAnyDigitalSignature is true)
         if (requiresSignatureFromCurrentUser && !isSigned) {
              // This might still be reachable if the user initiated signature, signed, but page state was reset
              // or if signatureInitiatedDocId existed from a previous session/draft.
              // The primary enforcement is now the !signatureInitiatedDocId check above for requiredAnyDigitalSignature=true templates.
              showToast('Требуется подпись', `Пожалуйста, поставьте цифровую подпись как "${user?.role}" перед отправкой.`, 'error');
              setIsLoading(false); return;
         }


        // Now, since !requiresAnyDigitalSignature OR signatureInitiatedDocId is NOT null:
        if (signatureInitiatedDocId) {
             // Scenario 1: Used "Sign" flow -> draft exists -> Update status
             showToast('Отправка документа', 'Обновление статуса черновика...', 'info');
             console.log(`Updating draft document ID ${signatureInitiatedDocId} status to 'submitted'...`);

             // Use the CORRECTED backend endpoint for status update
             const updateStatusResponse = await axios.put(`/api/documents/${signatureInitiatedDocId}/status`, {
                 status: 'submitted',
                 // No review_comment needed for 'submitted' status
             });

             if (updateStatusResponse.status === 200) {
                console.log("Draft status updated successfully via /status endpoint.");
                finalDocId = signatureInitiatedDocId; // The final document ID is the existing draft ID

                // TODO: Maybe update content here too, if form data could have changed since draft creation?
                // Requires a PUT /api/documents/:id endpoint that updates content.
                // For now, content is saved during the initial draft creation via /upload.

             } else {
                const errorData = updateStatusResponse.data || { message: 'Неизвестная ошибка сервера при обновлении статуса черновика' };
                throw new Error(`Ошибка сервера при обновлении статуса: ${updateStatusResponse.status} - ${errorData.message}`);
             }

        } else { // signatureInitiatedDocId is null. This branch is only reached if requiresAnyDigitalSignature is FALSE.
             // Scenario 2a (simplified): Template requires NO digital signatures.
             // Generate PDF, upload, create NEW document with 'submitted' status.
             const requiresPdfGeneration = !!selectedTemplate.htmlTemplate;
             if (!requiresPdfGeneration) {
                  // This case should ideally be impossible due to disabled state, but double-check
                   showToast('Ошибка', 'Выбран шаблон без HTML и без цифровых подписей. Неизвестный сценарий отправки.', 'error');
                   setIsLoading(false); return;
             }

             showToast('Отправка документа', 'Генерация PDF документа...', 'info');
             // Collect data for template, including student details
             const studentDetails = students.find(s => s.id === finalStudentId);
             const studentGroup = studentDetails?.group_name || '___';
             const studentCourse = getCourseFromGroup(studentGroup);
             const today = new Date().toLocaleDateString('ru-RU');

             const dataForTemplate = {
                 ...formData, // Data from form fields
                 student_name: studentDetails?.name || 'Неизвестный студент',
                 student_group: studentGroup,
                 student_course: studentCourse,
                 data_segodnya: today,
                 naimenovanie_uchebnogo_zavedeniya: 'Astana IT University',
                 leave_reason_type_translated: leaveReasonTypeTranslations[formData.leave_reason_type] || formData.leave_reason_type,

                 // Digital Signature Placeholders - these will be empty if not signed via QR flow
                 // This branch is only reached if requiresAnyDigitalSignature is FALSE, so these should be empty anyway.
                 digital_signature_role: '',
                 digital_signature_name: '',
                 digital_signature_image_html: '',
             };

             const populatedHtml = populateHtmlTemplate(selectedTemplate.htmlTemplate, dataForTemplate);
             const pdfBlob = await generatePdf(populatedHtml, customDocName || selectedTemplate.name);
              showToast('Отправка документа', 'PDF сгенерирован, начинается загрузка...', 'info');


             const uploadFormData = new FormData();
             uploadFormData.append('document', pdfBlob, `${customDocName || selectedTemplate.name || 'document'}.pdf`); // Filename for upload
             uploadFormData.append('student_id', finalStudentId); // Metadata for backend upload route
             uploadFormData.append('submitted_by', user.id); // Metadata for backend upload route
             uploadFormData.append('status', 'submitted'); // Status is 'submitted' if no digital signatures required
             uploadFormData.append('content', JSON.stringify(formData)); // Pass form data JSON
             uploadFormData.append('template_id', selectedTemplate.id); // Pass template_id


             // The /api/documents/upload endpoint should handle both file upload AND creating the document entry
             const uploadResponse = await axios.post('/api/documents/upload', uploadFormData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
             });

              if (uploadResponse.status === 201) {
                  finalDocId = uploadResponse.data.documentId; // Backend /upload should return the created document ID
                   console.log(`New document created via upload with ID: ${finalDocId} and status: submitted`);
                   showToast('Отправка документа', 'PDF успешно загружен и зарегистрирован как документ.', 'success');
              }
              else {
                   const errorData = uploadResponse.data || { message: 'Неизвестная ошибка сервера при загрузке и создании документа' };
                   throw new Error(`Ошибка сервера при загрузке и создании документа: ${uploadResponse.status} - ${errorData.message}`);
              }
          }
      }
      // Logic for submitting an uploaded file - Remains as implemented
      else if (activeTab === 'upload' && selectedFile) {
         console.log("Uploading file document...");
         showToast('Отправка документа', 'Загрузка выбранного файла...', 'info');

        const uploadFormData = new FormData();
        uploadFormData.append('document', selectedFile); // Append the selected file
        uploadFormData.append('name', customDocName || selectedFile.name); // Document title
        uploadFormData.append('student_id', finalStudentId); // Student ID
        uploadFormData.append('status', 'pending'); // Uploaded files typically need review
        uploadFormData.append('submitted_by', user.id); // User who uploaded
        // For uploaded files, template_id and content are not applicable here.

        // Use the /api/documents/upload endpoint
        const uploadResponse = await axios.post('/api/documents/upload', uploadFormData, {
           headers: {
             'Content-Type': 'multipart/form-data' // Important
           }
        });

        if (uploadResponse.status === 201) {
            finalDocId = uploadResponse.data.documentId; // Backend /upload should return the created document ID
             showToast('Отправка документа', 'Файл успешно загружен и зарегистрирован.', 'success');
        }
        else {
             const errorData = uploadResponse.data || { message: 'Неизвестная ошибка сервера при загрузке' };
             throw new Error(`Ошибка сервера при загрузке документа: ${uploadResponse.status} - ${errorData.message}`);
        }

      } else {
        // This case should ideally be prevented by the disabled state, but good fallback
        showToast(
          'Ошибка',
          'Выберите шаблон или загрузите файл',
          'error'
        );
         setIsLoading(false);
         return;
      }

       // If we reached here, a document was successfully created or updated
       if (finalDocId) {
            // Clear states to prepare for the next document creation
            // setActiveTab('template'); // Decide if you want to reset tab
            setSelectedTemplate(null);
            setCustomDocName('');
            setSelectedFile(null);
            setFormData({});
            setIsSigned(false); setSignedDetails(null); setQrCodeDataUrl(''); setShowQRCodeModal(false); setSignatureInitiatedDocId(null);
            setSavedSignatureUuid(null);
             // signatureImageUrl will be cleared by the effect listening to savedSignatureUuid
            if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }

            navigate('/documents'); // Navigate to the documents list
       } else {
           // Should not happen if logic is correct, but as a safeguard
            throw new Error("Document ID was not obtained after submission.");
       }


    } catch (error) {
      console.error('Error submitting document:', error);
      // Extract detailed error message if available
      const errorMessage = error.message || error.response?.data?.message || 'Произошла неизвестная ошибка при отправке документа.';
      showToast(
        'Ошибка отправки документа',
        errorMessage,
        'error'
      );
    } finally {
      setIsLoading(false); // Stop global loading indicator
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
            disabled={isLoading}
          >
            <ArrowLeft style={{width: '1.5em', height: '1.5em'}} />
          </button>
          <div>
            <h2 className={styles.pageTitle}>Создание документа</h2>
            <p className={styles.pageDescription}>Создайте новый документ из шаблона или загрузите файл</p>
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
                       value={user.name} // Display student's own name
                       className={styles.textInput}
                       disabled // Student cannot change themselves
                  />
              ) : (
                 <select
                    id="student"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className={styles.selectInput}
                    disabled={isLoading || (user?.role === 'parent' && students.length === 1) || students.length === 0} // Disable if loading, parent with one student (auto-selected), or no students available
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
                 {/* Show loading, empty state, or templates */}
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
                           // Show all templates, but maybe style differently if no htmlTemplate
                           <div key={template.id} className={`${styles.templateCard} ${ selectedTemplate?.id === template.id ? styles.selected : '' } ${!template.htmlTemplate ? styles.templateCardNoPdf : ''}`} // Add class if no HTML template
                             onClick={() => !isLoading && handleTemplateSelect(template.id)} role="button" tabIndex={0}
                             onKeyPress={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isLoading) { handleTemplateSelect(template.id); } }}>
                             <div className={styles.templateHeader}>
                               <FileText style={{width: '1.1em', height: '1.1em'}} />
                               <h3>{template.name}</h3>
                             </div>
                             <p className={styles.templateDescription}>
                               {template.description || 'Без описания'}
                             </p>
                             {!template.htmlTemplate && (
                                 <p className={styles.templateWarning}>
                                     (Нет HTML для PDF)
                                 </p>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                 )}


                {/* Display form fields if a template is selected */}
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
                     {selectedTemplate.fields && Array.isArray(selectedTemplate.fields) && selectedTemplate.fields.length > 0 && (
                         <div className={styles.formSection} style={{marginTop: '20px'}}>
                           <h3 className={styles.sectionTitle}>Заполните данные</h3>
                           <div className={styles.fieldsContainer}>
                             {selectedTemplate.fields.map(field => (
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
                     )}
                     {/* Message if template has no fields defined */}
                     {selectedTemplate.fields && Array.isArray(selectedTemplate.fields) && selectedTemplate.fields.length === 0 && (
                         <div className={styles.formInfoMessage} style={{marginTop: '20px'}}>
                              <p>Для этого шаблона не определены поля для заполнения.</p>
                         </div>
                     )}


                     {/* Required Signatures Display */}
                      {selectedTemplate.requiredSignatures && Array.isArray(selectedTemplate.requiredSignatures) && selectedTemplate.requiredSignatures.length > 0 && (
                          <div className={styles.formSection} style={{marginTop: '20px'}}>
                              <h3 className={styles.sectionTitle}>Требуемые подписи</h3>
                              <p className={styles.sectionDescription}>Документ требует следующих подписей:</p>
                              <ul className={styles.requiredSignaturesList}>
                                  {selectedTemplate.requiredSignatures.map((sig, index) => (
                                      // TODO: Display status of each signature if known for this document
                                      <li key={sig.role || index}>
                                          {sig.title || sig.role}
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      )}


                    {/* Digital Signature Section - Show only if Template selected, has HTML, Student selected, AND requires ANY digital signature */}
                    {selectedStudent && selectedTemplate?.htmlTemplate && requiresAnyDigitalSignature && ( // Show if requires ANY digital signature
                        <div className={styles.formSection} style={{marginTop: '20px'}}>
                            <h3 className={styles.sectionTitle}>Цифровая подпись</h3>
                            <div className={styles.signatureContainer}>
                                {!isSigned ? ( // Check if CURRENT USER has signed THEIR slot
                                    userSignatureSlot ? ( // Check if current user's role matches a digital slot
                                        <div className={styles.signaturePlaceholder}>
                                            <button
                                                className={`${styles.button} ${styles.outlineButton}`}
                                                type="button"
                                                onClick={handleInitiateSignatureQR}
                                                disabled={isLoading || !selectedStudent || !selectedTemplate?.htmlTemplate}
                                            >
                                                <QrCode style={{width: '1em', height: '1em', marginRight: '6px'}} />
                                                Подписать как "{user?.role}" (PDF)
                                            </button>
                                            <p className={styles.signatureInfo}>
                                                {signatureInitiatedDocId ?
                                                    `Ваша подпись для слота "${user?.role}" требуется для документа ID: ${signatureInitiatedDocId}. Отсканируйте QR-код.` :
                                                    `Для шаблонов с цифровыми подписями необходимо сначала сгенерировать документ и инициировать подпись как "${user?.role}".`
                                                }
                                            </p>
                                            {signatureInitiatedDocId && (
                                                <p className={styles.signatureInfoSmall}>
                                                    (Черновик документа ID: {signatureInitiatedDocId} ожидает подписи)
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        // Template requires digital signature, but not from CURRENT user's role
                                        <div className={styles.signaturePlaceholder}>
                                             <p className={styles.signatureInfo}>
                                                Этот шаблон требует цифровые подписи, но не от пользователя с вашей ролью ({user?.role}).
                                             </p>
                                             {/* TODO: Maybe display status of required signatures here */}
                                        </div>
                                    )
                                ) : (
                                    // CURRENT USER has signed THEIR slot
                                    <div className={styles.signatureComplete}>
                                        <div className={styles.signatureDetails}>
                                            <div>
                                                <h4>Документ подписан вами</h4> {/* Clarify it's *this* user's signature */}
                                                {signedDetails && (
                                                    <p className={styles.signatureDate}>
                                                        {signedDetails.name} • {signedDetails.date ? new Date(signedDetails.date).toLocaleDateString('ru-RU') : 'Дата неизвестна'} ({signedDetails.slot})
                                                    </p>
                                                )}
                                            </div>
                                            <CheckCircle style={{width: '2em', height: '2em', color: 'hsl(120, 84%, 40%)'}} />
                                        </div>
                                        {signatureImageUrl ? (
                                              <img
                                                  src={signatureImageUrl}
                                                  alt="Цифровая подпись"
                                                  style={{
                                                      border: '1px solid #ccc', margin: '15px auto', maxWidth: '90%', height: 'auto', maxHeight: '100px', display: 'block', backgroundColor: '#fff'
                                                  }}
                                              />
                                         ) : savedSignatureUuid ? (
                                             <div style={{ textAlign: 'center', margin: '15px 0' }}>
                                                 <Loader2 style={{ width: '2em', height: '2em', animation: 'spin 1s linear infinite' }} />
                                                 <p>Загрузка подписи...</p>
                                             </div>
                                         ) : null}
                                        <p className={styles.signatureInfo}>
                                            Ваша подпись успешно добавлена.
                                             {/* TODO: Check and inform user if OTHER signatures are still pending */}
                                             {/* {requiresAnyDigitalSignature && !isDocumentFullySigned ? " Ожидаются другие подписи." : " Теперь документ можно отправить на проверку."} */}
                                        </p>
                                    </div>
                                )}
                                {/* Message if template selected and has HTML, requires digital signature, but no student selected */}
                                {!selectedStudent && (
                                    <div className={styles.formInfoMessage} style={{marginTop: '20px'}}>
                                        Выберите студента, чтобы инициировать процесс подписи.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                     {/* Message if template selected but no HTML for PDF generation */}
                    {selectedTemplate && !selectedTemplate?.htmlTemplate && (
                         <div className={styles.formSection} style={{marginTop: '20px'}}>
                              <div className={styles.formInfoMessage}>
                                  <p>Для выбранного шаблона отсутствует HTML-структура для генерации PDF.</p>
                                   {(userSignatureSlot || requiresAnyDigitalSignature) && <p>Поэтому цифровая подпись и отправка документа по шаблону недоступны.</p>}
                                   <p>Обратитесь к администратору для настройки шаблона.</p>
                              </div>
                         </div>
                    )}
                     {/* Message if template selected, has HTML, but requires NO digital signature */}
                     {selectedTemplate?.htmlTemplate && !requiresAnyDigitalSignature && (
                         <div className={styles.formSection} style={{marginTop: '20px'}}>
                             <div className={styles.formInfoMessage}>
                                 <p>Этот шаблон не требует цифровых подписей в системе.</p>
                                 <p>Вы можете заполнить данные и отправить документ.</p>
                             </div>
                         </div>
                     )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upload Tab Content - Remains as implemented */}
          <div className={`${styles.tabContent} ${activeTab === 'upload' ? styles.active : ''}`}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Загрузите документ</h3>
                <p className={styles.cardDescription}>Выберите файл для загрузки (PDF, DOCX, JPG, PNG и др.)</p>
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
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" // Specify supported types
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
                 !selectedStudent || // Student must be selected for any creation
                 // Template tab conditions:
                 (activeTab === 'template' && (
                   !selectedTemplate || // A template must be selected
                   !selectedTemplate.htmlTemplate || // The selected template must have HTML for PDF generation (as per new flow)
                   (requiresAnyDigitalSignature && !signatureInitiatedDocId) || // ADDED: If ANY digital signature required, must use "Sign" flow first
                   (userSignatureSlot && !isSigned) // If CURRENT user signature required, it must be signed
                 )) ||
                 // Upload tab conditions:
                 (activeTab === 'upload' && !selectedFile) // A file must be selected
               }
             >
               {isLoading ? 'Обработка...' : 'Создать документ'}
             </button>
           </div>
        </div>

        {/* QR Code Modal - Remains as implemented */}
        {showQRCodeModal && (
          <div className={styles.modalOverlay} onClick={() => !isLoading && setShowQRCodeModal(false)}>
             <div className={styles.signatureModalContent} onClick={(e) => e.stopPropagation()}>
                  {/* Close button */}
                 <button
                      className={styles.modalCloseButton}
                      onClick={() => !isLoading && setShowQRCodeModal(false)}
                      disabled={isLoading} // Disable close if loading/processing
                 >
                     <X style={{width: '1.5em', height: '1.5em'}} />
                 </button>

                 <h3 className={styles.modalTitle}>Подпишите документ</h3>
                 {signatureInitiatedDocId && userSignatureSlot ? (
                     <p className={styles.modalDescription}>
                       Отсканируйте этот код вашим мобильным устройством, чтобы поставить подпись для слота "{userSignatureSlot}" документа ID: {signatureInitiatedDocId}.
                       Документ был сгенерирован в PDF.
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
                                {/* Add a spinner while loading QR data */}
                                {isLoading ? (
                                     <Loader2 style={{ width: '4em', height: '4em', color: 'hsl(215, 16%, 47%)', animation: 'spin 1s linear infinite' }} />
                                ) : (
                                     <QrCode style={{width: '4em', height: '4em', color: 'hsl(215, 16%, 47%)'}} />
                                )}
                                <p>{isLoading ? 'Генерация QR-кода...' : 'Ожидание QR-кода...'}</p>
                           </div>
                       )}
                  </div>

                 {!qrCodeDataUrl && !isLoading && signatureInitiatedDocId && (
                      <p className={styles.qrCodeScanInfo}> QR-код появится после успешной подготовки ссылки подписи для документа ID: {signatureInitiatedDocId}. </p>
                 )}
                  {qrCodeDataUrl && (
                       <p className={styles.qrCodeScanInfo}>
                          Откройте камеру или приложение для сканирования QR-кодов на телефоне и отсканируйте изображение выше.
                          После подписания на мобильном устройстве, статус подписи обновится здесь автоматически.
                       </p>
                  )}

                   <div className={styles.modalFooter} style={{justifyContent: 'center'}}>
                        <button type="button" className={`${styles.button} ${styles.outlineButton}`} onClick={() => setShowQRCodeModal(false)} disabled={isLoading}>
                            Закрыть
                        </button>
                   </div>


               </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    );
  };

export default CreateDocument;