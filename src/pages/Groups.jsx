import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SidebarLayout from './../components/layouts/SidebarLayout';
// Import necessary icons from Lucide React
import { Users as UsersIcon, Award, Book, Eye, Plus, Edit, Trash2, Loader2, XCircle, Search, Filter } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

// Import CSS
import styles from './../styles/Groups.module.css';

// TODO: Create a dedicated component for the Edit User Modal (e.g., EditUserModal.jsx)
// import EditUserModal from './components/EditUserModal';

// Placeholder component for Edit User Modal (replace with actual implementation)
// NOTE: This component structure assumes you WILL implement the backend PUT /api/users/:id
// and the form logic inside it. The Groups component correctly passes data to it.
const EditUserModal = ({ user, onClose, onSave, loading, error, userRole }) => { // Added userRole prop
    // TODO: Implement the actual form with input fields, validation, and save logic

    const [formData, setFormData] = useState(user || {});
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState(null);

    useEffect(() => {
        setFormData(user || {});
        setSaveError(null); // Clear previous save errors when user changes
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

     const handleCheckboxChange = (e) => {
         const { name, checked } = e.target;
         setFormData({ ...formData, [name]: checked });
     };


    const handleSave = async () => {
        setSaveLoading(true);
        setSaveError(null);
        try {
            // TODO: Implement the actual API call to save user data
            console.log("Attempting to save user data:", formData);

            // Example PUT request (replace with your actual backend endpoint and data structure)
            // The backend /api/users/:id route needs to exist and handle authorization/updates
             const response = await axios.put(`/api/users/${formData.id}`, formData);
             console.log("Save successful:", response.data);

             // If save is successful, call parent's onSave callback
             if (onSave) {
                 // Pass the updated user data back to the parent component
                 // Assuming backend returns the updated user object
                 onSave(response.data);
             }

            // Close modal after successful save
            onClose();

        } catch (err) {
            console.error("Error saving user data:", err);
             const errorMessage = err.response?.data?.message || "Не удалось сохранить изменения.";
             setSaveError(errorMessage);
             // TODO: Handle error display (e.g., toast, inline message)
             // For now, the error state will be displayed below the form
        } finally {
            setSaveLoading(false);
            // Decide whether to close on error or let user retry
            // For now, let's not close on error automatically
        }
    };

    // Display loading state while fetching user data for the modal
    if (loading) {
        return (
             <div className={styles.modalOverlay}>
                 <div className={styles.modalContent} style={{width: '90%', maxWidth: '600px'}}>
                    <div className={styles.modalHeader}>
                         <h3 className={styles.modalTitle}>Загрузка данных пользователя...</h3>
                         {/* Close button visible even during loading */}
                         <button type="button" className={styles.closeButton} onClick={onClose} disabled={saveLoading || loading}><XCircle style={{width: '1.5em', height: '1.5em'}} /></button>
                     </div>
                    <div className={styles.modalBody} style={{minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                        <Loader2 className={styles.loaderIcon} />
                        <p style={{marginTop: '10px'}}>Пожалуйста, подождите...</p>
                    </div>
                 </div>
             </div>
        );
    }

    // Display error state if fetching user data failed
     if (error) {
         return (
              <div className={styles.modalOverlay}>
                  <div className={styles.modalContent} style={{width: '90%', maxWidth: '600px'}}>
                      <div className={styles.modalHeader}>
                           <h3 className={styles.modalTitle}>Ошибка загрузки</h3>
                           <button type="button" className={styles.closeButton} onClick={onClose} disabled={saveLoading}><XCircle style={{width: '1.5em', height: '1.5em'}} /></button>
                       </div>
                       <div className={styles.modalBody}>
                           <p style={{color: 'red', textAlign: 'center'}}>{error}</p>
                       </div>
                       <div className={styles.modalFooter}>
                            <button className={styles.button} onClick={onClose} disabled={saveLoading}>Закрыть</button>
                       </div>
                   </div>
               </div>
         );
     }

    // If not loading and no error, and user data is available, show the form
    if (!user) {
         // Should ideally not happen if loading/error states are correct
         return null;
     }


    // Render the actual form when user data is loaded
    return (
        <div className={styles.modalOverlay}> {/* Modal overlay class */}
            {/* Prevent closing on clicking inside dialog content */}
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{width: '90%', maxWidth: '600px'}}> {/* Adjust size as needed */}
                {/* Modal Header */}
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>Редактировать профиль: {user.full_name || user.name || 'Загрузка...'}</h3> {/* Modal Title */}
                    {/* Close button */}
                    <button type="button" className={styles.closeButton} onClick={onClose} disabled={saveLoading}>
                         <XCircle style={{width: '1.5em', height: '1.5em'}} />
                     </button>
                 </div>

                {/* Modal Body - Form */}
                <div className={styles.modalBody} style={{overflowY: 'auto'}}>
                    {/* TODO: Replace this simple structure with react-hook-form / Zod */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <div className={styles.formGroup}>
                            <label htmlFor="full_name" className={styles.formLabel}>Полное имя:</label>
                            <input
                                id="full_name"
                                name="full_name"
                                type="text"
                                className={styles.inputField}
                                value={formData.full_name || ''}
                                onChange={handleChange}
                                disabled={saveLoading}
                                required
                            />
                        </div>
                         {/* Assuming email is not editable or requires separate flow */}
                         {/* <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.formLabel}>Email:</label>
                            <input id="email" name="email" type="email" className={styles.inputField} value={formData.email || ''} onChange={handleChange} disabled={saveLoading} required />
                        </div> */}
                        <div className={styles.formGroup}>
                            <label htmlFor="phone" className={styles.formLabel}>Телефон:</label>
                            <input
                                id="phone"
                                name="phone"
                                type="text"
                                className={styles.inputField}
                                value={formData.phone || ''}
                                onChange={handleChange}
                                disabled={saveLoading}
                            />
                        </div>
                         {/* Role and is_active editing might be restricted by user role */}
                         {/* Only Admin can change roles - pass userRole prop from parent */}
                        {(userRole === 'admin') && (
                             <div className={styles.formGroup}>
                                 <label htmlFor="role" className={styles.formLabel}>Роль:</label>
                                 <select id="role" name="role" className={styles.selectTrigger} value={formData.role || ''} onChange={handleChange} disabled={saveLoading}>
                                     <option value="student">Студент</option>
                                     <option value="parent">Родитель</option>
                                     <option value="curator">Куратор</option>
                                      {/* Admin role change might be restricted or handled separately */}
                                      {/* <option value="admin">Админ</option> */}
                                 </select>
                             </div>
                         )}
                         {/* Only Admin can change active status - pass userRole prop from parent */}
                         {(userRole === 'admin') && (
                              <div className={styles.formGroup} style={{display: 'flex', alignItems: 'center'}}>
                                  <label htmlFor="is_active" className={styles.formLabel} style={{marginRight: '10px'}}>Активен:</label>
                                  <input id="is_active" name="is_active" type="checkbox" checked={!!formData.is_active} onChange={handleCheckboxChange} disabled={saveLoading} />
                              </div>
                          )}

                        {/* TODO: Add password reset button/logic (separate flow) */}

                        <div className={styles.modalFooter} style={{display: 'flex', justifyContent: 'flex-end', marginTop: '15px'}}>
                            <button type="button" className={`${styles.button} ${styles.buttonOutline}`} onClick={onClose} disabled={saveLoading}>Отмена</button>
                            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={saveLoading}>
                                {saveLoading && <Loader2 className={styles.loaderIcon} style={{marginRight: '8px'}} />}
                                Сохранить
                            </button>
                        </div>
                    </form>
                     {saveError && <p style={{color: 'red', textAlign: 'center', marginTop: '10px'}}>{saveError}</p>}
                </div>
            </div>
        </div>
    );
};


const Groups = () => {
  const { user } = useAuth(); // Get current user

  // Tabs
  const [activeTab, setActiveTab] = useState('groups');

  const [groupsList, setGroupsList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Document Viewing Modal
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [modalStudentDocuments, setModalStudentDocuments] = useState([]);
  const [loadingDocumentModal, setLoadingDocumentModal] = useState(false);
  const [modalStudentName, setModalStudentName] = useState('');
  const [modalDocumentError, setModalDocumentError] = useState(null);

  // Student Filtering and Search
  const [availableGroupsForFilter, setAvailableGroupsForFilter] = useState([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState(''); // Keep as string for select value
  const [searchInput, setSearchInput] = useState(''); // State for the input field value
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // State for the debounced search term


  // PDF Viewer Modal (Nested)
  const [showPdfViewerModal, setShowPdfViewerModal] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState(''); // Blob URL for PDF iframe
  const [loadingPdfViewer, setLoadingPdfViewer] = useState(false);
  const [pdfModalTitle, setPdfModalTitle] = useState('');
  const [pdfModalError, setPdfModalError] = useState(null);


  // Edit User Modal
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null); // User object loaded for editing
  const [loadingUserForEdit, setLoadingUserForEdit] = useState(false);
  const [editUserError, setEditUserError] = useState(null);


  // --- Data Fetching Functions ---

  const fetchGroups = useCallback(async () => {
      if (!user) { setGroupsList([]); setLoading(false); return; }
      setLoading(true); setError(null); setGroupsList([]);

      try {
           const response = await axios.get('/api/groups-summary');

          if (response.data && Array.isArray(response.data)) {
              const formattedGroups = response.data.map(group => ({
                ...group,
                studentCount: parseInt(group.student_count, 10) || 0, // Ensure count is number
                docsOnReview: parseInt(group.docs_on_review_count, 10) || 0, // Use docs_on_review_count from backend
                docsTotal: parseInt(group.docs_total_count, 10) || 0,      // Use docs_total_count from backend
                 // Calculate percentage based on OnReview / Total
                 onReviewPercentage: group.docs_total_count > 0 ? ((parseInt(group.docs_on_review_count, 10) || 0) / parseInt(group.docs_total_count, 10)) * 100 : 0
              }));
              setGroupsList(formattedGroups);
          } else {
              console.error('Error fetching groups: Invalid data format', response.data);
              setGroupsList([]);
              setError('Не удалось загрузить список групп.');
          }

      } catch (error) {
          console.error('Error fetching groups:', error);
           const errorMessage = error.response?.data?.message || 'Не удалось загрузить список групп.';
           setError(errorMessage);
          setGroupsList([]);
      } finally {
          setLoading(false);
      }
  }, [user]);


  // Fetch list of students with filters/search
  // Now depends on debouncedSearchTerm and selectedGroupFilter
  const fetchStudents = useCallback(async (groupId = null, searchTerm = '') => {
    if (!user) { setStudentsList([]); setLoading(false); return; }
    setLoading(true); setError(null);

    try {
        let params = {};

        if (groupId) {
            params.groupId = groupId;
        }

        if (searchTerm) {
            params.searchTerm = searchTerm;
        }
        console.log('=====================ARLAN=======')

        const response = await axios.get('/api/students-list', { params });
        
        console.log("DEBUG: Frontend received data:", response.data);

        if (response.data && Array.isArray(response.data)) {
            const formattedStudents = response.data.map(student => ({
              id: student.id,
              name: student.name || 'Неизвестно', // Use full_name
              group: student.group || 'Неизвестно', // Map group_name
              parent: student.parent || 'Неизвестно', // Map parent_name
              docsTotal: student.docsTotal || 0, // Use docs_total from backend
              docsOnReview: student.docsOnReview || 0, // Use docs_on_review from backend
              onReviewPercentage: student.docsTotal > 0 ? ((student.docsOnReview || 0) / student.docsTotal) * 100 : 0
            }));

            console.log('=====================ARLAN 20000==============')
            console.log("DEBUG: formatted Students received data:", formattedStudents);
            setStudentsList(formattedStudents);
        } else {
            console.error('Error fetching students: Invalid data format', response.data);
            // setStudentsList([]); // Очистить список только если данные некорректны
            setError('Не удалось загрузить список студентов.');
        };

    } catch (error) {
        console.error('Error fetching students:', error);
        const errorMessage = error.response?.data?.message || 'Не удалось загрузить список студентов.';
        setError(errorMessage);
        // setStudentsList([]); // Очистить список при ошибке
    } finally {
        setLoading(false);
    }
  }, [user]);


  // Fetch list of groups for the filter dropdown
  const fetchGroupsForFilter = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'curator')) {
        setAvailableGroupsForFilter([]);
        return;
    }
    try {
        const response = await axios.get('/api/groups');

        if (response.data && Array.isArray(response.data)) {
            const allGroupsOption = { id: '', name: 'Все группы' };
            const formattedGroups = response.data.map(g => ({ ...g, id: String(g.id) }));
            setAvailableGroupsForFilter([allGroupsOption, ...formattedGroups]);
        } else {
            console.error('Error fetching groups for filter: Invalid data format', response.data);
            setAvailableGroupsForFilter([]);
        }
    } catch (error) {
        console.error('Error fetching groups for filter:', error);
        setAvailableGroupsForFilter([]);
    }
  }, [user]);


  // --- Effects ---

  // Effect to load initial data or refetch on tab/filter/search change
  useEffect(() => {
    console.log("useEffect triggered:", { activeTab, selectedGroupFilter, debouncedSearchTerm }); // Log useEffect triggers
    if (activeTab === 'groups') {
      setSelectedGroupFilter(''); // Reset student filters
      setSearchInput(''); // Reset search input state
      setDebouncedSearchTerm(''); // Reset debounced search term state
      fetchGroups();
    } else if (activeTab === 'students') {
        fetchStudents(selectedGroupFilter, debouncedSearchTerm);
        fetchGroupsForFilter();
    }
  }, [user, activeTab, fetchGroups, fetchStudents, selectedGroupFilter, debouncedSearchTerm]); // Dependencies updated


  // Effect for search input debouncing
  useEffect(() => {
    console.log("Debounce useEffect triggered:", { searchInput }); // Log debounce effect triggers
    const handler = setTimeout(() => {
      // Update debounced term after the delay
      setDebouncedSearchTerm(searchInput);
    }, 500); // 500ms debounce delay

    // Cleanup function: clear the timeout if the input value changes before the delay
    return () => {
      console.log("Debounce timeout cleared"); // Log timeout clearing
      clearTimeout(handler);
    };
     // Depend on searchInput so the timer resets whenever the user types
  }, [searchInput]);


  // --- Handlers ---

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  const handleGroupFilterChange = (e) => {
    setSelectedGroupFilter(e.target.value);
    setSearchInput(''); // Clear search input state
    setDebouncedSearchTerm(''); // Clear debounced search term state
    // useEffect will handle fetching
  };

  const handleSearchInputChange = (e) => {
      setSearchInput(e.target.value); // Update the input value state immediately
      setSelectedGroupFilter(''); // Clear group filter state
      // Debouncing effect will handle updating debouncedSearchTerm and triggering fetch
  };


  // Handle clicking "Просмотр документов" for a student
  const handleViewStudentDocuments = async (studentId, studentName) => {
      setLoadingDocumentModal(true);
      setModalStudentDocuments([]);
      setModalStudentName(studentName || 'Выбранного студента');
      setModalDocumentError(null);
      setShowDocumentModal(true);

      try {
           const response = await axios.get('/api/documents', { params: { studentId: studentId, limit: 100, offset: 0 } });

          if (response.data && Array.isArray(response.data.items)) {
              setModalStudentDocuments(response.data.items);
          } else {
              console.error(`Error fetching documents list for student ${studentId}: Invalid data format`, response.data);
               setModalDocumentError('Не удалось загрузить список документов: Неверный формат ответа.');
          }

      } catch (error) {
          console.error(`Error fetching documents list for student ${studentId}:`, error);
          const errorMessage = error.response?.data?.message || `Не удалось загрузить список документов для студента ${studentName}.`;
           setModalDocumentError(errorMessage);
          setModalStudentDocuments([]);
      } finally {
          setLoadingDocumentModal(false);
      }
  };

   // Handle closing the document viewing modal
   const handleCloseDocumentModal = () => {
       setShowDocumentModal(false);
       setModalStudentName('');
       setModalStudentDocuments([]);
       setModalDocumentError(null);
   };

  // Handle clicking "Редактировать" for a user (Student or Curator)
  const handleEditUser = async (userId) => {
    console.log(`Calling handleEditUser for ID: ${userId}`);
    setSelectedUserForEdit(null);
    setEditUserError(null);
    setLoadingUserForEdit(true);
    setShowEditUserModal(true); // Show modal shell immediately

    try {
        // *** ЭТОТ GET-ЗАПРОС ВЫЗЫВАЕТ ОШИБКУ 404, ПОТОМУ ЧТО НА БЭКЕНДЕ НЕТ МАРШРУТА GET /api/users/:id ***
        // Убедитесь, что на бэкенде есть маршрут GET /api/users/:id, который работает (код был предоставлен в предыдущем ответе)
        const response = await axios.get(`/api/users/${userId}`);
        console.log("Fetched user data for edit:", response.data); // Log fetched data

        if (response.data) {
             // Assuming backend returns user details including role for modal logic
            setSelectedUserForEdit(response.data);
        } else {
            console.error(`Error fetching user ${userId} for edit: Invalid data format`, response.data);
            setSelectedUserForEdit(null);
             setEditUserError('Не удалось загрузить данные пользователя для редактирования: Неверный формат ответа.');
        }
    } catch (error) {
        console.error(`Error fetching user ${userId} for edit:`, error);
         // Улучшенное сообщение об ошибке при 404
         if (error.response && error.response.status === 404) {
             setEditUserError('Пользователь не найден (ошибка 404). Возможно, у вас нет прав доступа или пользователь не существует.');
         } else {
             const errorMessage = error.response?.data?.message || `Не удалось загрузить данные пользователя ${userId} для редактирования.`;
             setEditUserError(errorMessage);
         }
        setSelectedUserForEdit(null); // Clear user data on error
    } finally {
        setLoadingUserForEdit(false);
    }
  };

  // Handler for saving the edited user data
  const handleSaveUser = (updatedUser) => {
      console.log("User data saved (callback received):", updatedUser);
      // Refresh the relevant list after successful save
       if (activeTab === 'students') {
           fetchStudents(selectedGroupFilter, debouncedSearchTerm); // Re-fetch students
       } else if (activeTab === 'groups') {
           // If a curator was edited, re-fetch groups to update name display if necessary
            fetchGroups();
       }
      // Modal closing is handled by EditUserModal itself after successful save
  };

  const handleCloseEditUserModal = () => {
      setShowEditUserModal(false);
      setSelectedUserForEdit(null); // Clear selected user data
      setEditUserError(null); // Clear any loading error
  };


  // TODO: Implement handleCreateUser
  const handleCreateUser = () => {
      console.log("TODO: Open create user dialog");
      alert("Создание пользователя в разработке.");
  };

  // TODO: Implement handleCreateGroup
  const handleCreateGroup = () => {
      console.log("TODO: Open create group dialog");
      alert("Создание группы в разработке.");
  }


  // Handle viewing a specific document file (PDF viewer or Download)
  const handleViewSpecificDocumentFile = async (documentId, documentName, contentType) => {
      setLoadingPdfViewer(true);
      setPdfModalUrl('');
      setPdfModalTitle(documentName || 'Документ');
      setPdfModalError(null);
      // Show the PDF modal shell immediately if it's likely a PDF based on contentType
      if (contentType?.includes('pdf')) {
         setShowPdfViewerModal(true);
      }


      try {
          const fileResponse = await axios.get(`/api/documents/${documentId}/download`, {
              responseType: 'blob'
          });
          const fileBlob = fileResponse.data;

          if (!(fileBlob instanceof Blob)) {
              throw new Error("Получены некорректные данные файла.");
          }

          // Check if it's a PDF based on contentType or Blob type
          if (contentType?.includes('pdf') || fileBlob.type === 'application/pdf') {
               // It's a PDF, open in the viewer modal
              const blobUrl = URL.createObjectURL(fileBlob);
              setPdfModalUrl(blobUrl);
              setShowPdfViewerModal(true); // Ensure modal is shown
          } else {
              // Not a PDF, trigger download
              console.log(`Triggering download for file ${documentId}, type ${contentType || fileBlob.type}`);
              const downloadUrl = URL.createObjectURL(fileBlob);
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = documentName || `document_${documentId}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(downloadUrl);
               // If it wasn't a PDF, ensure the PDF viewer modal is closed
              setShowPdfViewerModal(false); // Explicitly close PDF modal if it was mistakenly opened or is not PDF
          }

      } catch (error) {
          console.error(`Error handling document file ${documentId}:`, error);
          const errorMessage = error.response?.data?.message || 'Не удалось загрузить или скачать файл.';
           // If it was intended as PDF or error message suggests PDF issue, show error in PDF modal
          if (contentType?.includes('pdf') || (error.response?.data?.message || '').includes('PDF') || (error.message || '').includes('PDF')) {
               setPdfModalError(errorMessage);
               setShowPdfViewerModal(true); // Ensure modal is shown to display error
          } else {
               // Otherwise, show error in the document list modal (or as a toast)
               setModalDocumentError(errorMessage);
               setShowPdfViewerModal(false); // Ensure PDF modal is closed
          }
      } finally {
          setLoadingPdfViewer(false);
      }
  };

  // Handle closing the PDF viewer modal
  const handleClosePdfViewerModal = () => {
    setShowPdfViewerModal(false);
    setPdfModalError(null);
    if (pdfModalUrl) {
        URL.revokeObjectURL(pdfModalUrl);
        setPdfModalUrl('');
    }
    setPdfModalTitle('');
  };


  // --- Component Rendering ---

  return (
    <SidebarLayout>
      <div className={styles.groupsContainer}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Группы и Пользователи</h2>
            <p className={styles.pageDescription}>Управление группами, студентами и другими пользователями</p>
          </div>
           {activeTab === 'groups' && (user?.role === 'admin' || user?.role === 'curator') && (
             <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleCreateGroup} disabled={loading}>
               <Plus style={{width: '1em', height: '1em', marginRight: '8px'}} />
               Создать группу
             </button>
           )}
            {activeTab === 'students' && (user?.role === 'admin' || user?.role === 'curator') && (
                 <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleCreateUser} disabled={loading}>
                   <Plus style={{width: '1em', height: '1em', marginRight: '8px'}} />
                   Создать пользователя
                 </button>
           )}
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'groups' ? styles.active : ''}`}
              onClick={() => handleTabChange('groups')}
               disabled={loading}
            >
              Группы
            </button>
            <button
              className={`${styles.tabsTrigger} ${activeTab === 'students' ? styles.active : ''}`}
              onClick={() => handleTabChange('students')}
               disabled={loading}
            >
              Студенты
            </button>
          </div>

          {loading && <p style={{marginTop: '15px', textAlign: 'center'}}><Loader2 className={styles.loaderIcon} /> Загрузка данных...</p>}
          {!loading && error && <p style={{ color: 'red', marginTop: '15px', textAlign: 'center' }}>{error}</p>}

          {!loading && !error && (
            <>
              {activeTab === 'groups' && (
                <div className={styles.tabContent}>
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>Список групп</h3>
                      <p className={styles.cardDescription}>Просмотр и управление группами</p>
                    </div>
                    <div className={styles.cardContent}>
                      {/* TODO: Implement search and filter for groups list */}
                      <div className={styles.searchContainer}>
                        <div className={styles.searchInputContainer}>
                          <Search style={{width: '1.1em', height: '1.1em', color: '#888'}} className={styles.searchIcon} />
                          <input type="text" placeholder="Поиск по группам..." className={styles.searchInput} disabled={loading} />
                        </div>
                        <button className={`${styles.button} ${styles.buttonOutline}`} disabled={loading}>
                            <Filter style={{width: '1em', height: '1em', marginRight: '8px'}} /> Фильтры
                        </button>
                      </div>

                       {groupsList.length === 0 ? (
                           <div className={styles.emptyStateText} style={{marginTop: '20px', textAlign: 'center'}}>Нет групп для отображения.</div>
                       ) : (
                            <div className={styles.tableContainer}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                          <th>Группа</th>
                                          <th>Куратор</th>
                                          <th>Студенты</th>
                                          <th>Документы</th> {/* ИЗМЕНЕНО: Название колонки */}
                                          <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupsList.map((group) => (
                                          <tr key={group.id}>
                                            <td className={styles.groupName}>
                                              <UsersIcon style={{width: '1.1em', height: '1.1em', marginRight: '8px'}} />
                                              {/* ИЗМЕНЕНО: Проверка на group.name */}
                                              Группа {group.name || 'Неизвестно'}
                                            </td>
                                            <td>{group.curator || 'Не назначен'}</td>
                                            <td>{group.studentCount} студентов</td>
                                            {/* ИЗМЕНЕНО: Удалены текстовые счетчики, оставлен только прогресс бар и процент */}
                                            <td>
                                                <div className={styles.docsContainer} style={{marginTop: '4px'}}>
                                                    <div className={styles.progressBar} style={{width: '100px'}}>
                                                      <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${group.onReviewPercentage || 0}%`, backgroundColor: '#ffc107' }}
                                                      ></div>
                                                    </div>
                                                     {/* ИЗМЕНЕНО: Вернут span с текстовым процентом */}
                                                    <span className={styles.progressText} style={{marginLeft: '8px'}}>
                                                        {group.docsTotal > 0 ? `${Math.round(group.onReviewPercentage || 0)}%` : '0%'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                              <div className={styles.actionsContainer}>
                                                <button
                                                     className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                     onClick={() => {
                                                         setSelectedGroupFilter(String(group.id));
                                                         setSearchInput(''); // Clear search input state
                                                         setDebouncedSearchTerm(''); // Clear debounced search term state
                                                         setActiveTab('students');
                                                     }}
                                                      title={`Просмотреть студентов группы ${group.name || 'Неизвестно'}`}
                                                >
                                                     <UsersIcon style={{width: '1em', height: '1em', marginRight: '4px'}} /> Студенты
                                                  </button>
                                                  {(user?.role === 'admin' || user?.role === 'curator') && (
                                                      <button
                                                         className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                         onClick={() => console.log(`TODO: Open edit dialog for group ${group.id}`)}
                                                          title="Редактировать группу"
                                                      >
                                                         <Edit style={{width: '1em', height: '1em', marginRight: '4px'}} /> Редактировать
                                                      </button>
                                                  )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
               )}

               {activeTab === 'students' && (
                   <div className={styles.tabContent}>
                       <div className={styles.card}>
                           <div className={styles.cardHeader}>
                               <div>
                                   <h3 className={styles.cardTitle}>Список студентов</h3>
                                   <p className={styles.cardDescription}>Просмотр документов и профилей студентов</p>
                               </div>
                           </div>
                           <div className={styles.cardContent}>
                               <div className={styles.searchContainer}>
                                  {(user?.role === 'admin' || user?.role === 'curator') && (
                                      <div className={styles.filterDropdownContainer}>
                                          <label htmlFor="group-filter" className={styles.formLabel} style={{marginRight: '8px'}}>Группа:</label>
                                          <select
                                                id="group-filter"
                                                className={`${styles.inputField} ${styles.selectTrigger}`}
                                                value={selectedGroupFilter}
                                                onChange={handleGroupFilterChange}
                                                disabled={loading || !availableGroupsForFilter.length}
                                          >
                                                {availableGroupsForFilter.map(group => (
                                                  <option key={group.id} value={group.id}>{group.name}</option>
                                                ))}
                                            </select>
                                      </div>
                                  )}

                                  <div className={styles.searchInputContainer}>
                                      <Search style={{width: '1.1em', height: '1.1em', color: '#888'}} className={styles.searchIcon} />
                                      <input
                                          type="text"
                                          placeholder="Поиск по имени или группе..."
                                          className={styles.searchInput}
                                          value={searchInput} // Связано с inputState
                                          onChange={handleSearchInputChange} // Обновляет inputState
                                          disabled={loading}
                                      />
                                  </div>
                              </div>

                               {studentsList.length === 0 ? (
                                    <div className={styles.emptyStateText} style={{marginTop: '20px', textAlign: 'center'}}>
                                         {debouncedSearchTerm || selectedGroupFilter ? (
                                            'Нет студентов, соответствующих критериям поиска/фильтрации.'
                                          ) : (
                                            'Нет студентов для отображения.'
                                          )}
                                    </div>
                                ) : (
                                     <div className={styles.tableContainer}>
                                         <table className={styles.dataTable}>
                                             <thead>
                                                 <tr>
                                                     <th>Студент</th>
                                                     <th>Группа</th>
                                                     <th>Родитель</th>
                                                     <th>Документы</th> {/* ИЗМЕНЕНО: Название колонки */}
                                                     <th>Действия</th>
                                                 </tr>
                                             </thead>
                                             <tbody>
                                                 {studentsList.map((student) => (
                                                     <tr key={student.id}>
                                                         <td className={styles.studentName}>
                                                             <UsersIcon style={{width: '1.1em', height: '1.1em', marginRight: '8px'}} />
                                                             {/* ИЗМЕНЕНО: Проверка на student.name */}
                                                             {student.name || 'Неизвестно'}
                                                         </td>
                                                         {/* ИЗМЕНЕНО: Проверка на student.group */}
                                                         <td>Группа {student.group || 'Неизвестно'}</td>
                                                         {/* ИЗМЕНЕНО: Проверка на student.parent */}
                                                         <td>{student.parent || 'Неизвестно'}</td>
                                                          {/* ИЗМЕНЕНО: Удалены текстовые счетчики, оставлен только прогресс бар и процент */}
                                                         <td>
                                                            <div className={styles.docsContainer} style={{marginTop: '4px'}}>
                                                                <div className={styles.progressBar} style={{width: '100px'}}>
                                                                  <div
                                                                    className={styles.progressFill}
                                                                     style={{ width: `${student.onReviewPercentage || 0}%`, backgroundColor: '#ffc107' }}
                                                                  ></div>
                                                                </div>
                                                                 {/* ИЗМЕНЕНО: Вернут span с текстовым процентом */}
                                                                <span className={styles.progressText} style={{marginLeft: '8px'}}>
                                                                    {student.docsTotal > 0 ? `${Math.round(student.onReviewPercentage || 0)}%` : '0%'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                         <td>
                                                             <div className={styles.actionsContainer}>
                                                                  <button
                                                                       className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                                       onClick={() => handleViewStudentDocuments(student.id, student.name)}
                                                                       title={`Просмотреть документы студента ${student.name || 'Неизвестно'}`}
                                                                  >
                                                                       <Eye style={{width: '1em', height: '1em', marginRight: '4px'}} /> Документы
                                                                   </button>
                                                                    {(user?.role === 'admin' || user?.role === 'curator') && (
                                                                         <button
                                                                            className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                                            onClick={() => handleEditUser(student.id)}
                                                                             title={`Редактировать студента ${student.name || 'Неизвестно'}`}
                                                                         >
                                                                            <Edit style={{width: '1em', height: '1em', marginRight: '4px'}} /> Редактировать
                                                                         </button>
                                                                      )}
                                                             </div>
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </div>
                                  )}
                       </div>
                   </div>
                </div>
               )}
            </>
          )}
        </div>

        {/* Student Document Viewing Modal */}
        {showDocumentModal && (
             <div className={styles.modalOverlay}>
                <div className={styles.modalContent} style={{width: '90%', maxWidth: '800px', height: '90%', display: 'flex', flexDirection: 'column'}}>
                    <div className={styles.modalHeader} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h3 className={styles.modalTitle}>Документы студента: {modalStudentName}</h3>
                        <button type="button" className={styles.closeButton} onClick={handleCloseDocumentModal} disabled={loadingDocumentModal || loadingPdfViewer}>
                             <XCircle style={{width: '1.5em', height: '1.5em'}} />
                         </button>
                     </div>
                     <div className={styles.modalBody} style={{flexGrow: 1, overflowY: 'auto'}}>
                         {loadingDocumentModal ? (
                              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                                  <Loader2 className={styles.loaderIcon} />
                                  <p style={{marginTop: '10px'}}>Загрузка списка документов...</p>
                              </div>
                          ) : modalDocumentError ? (
                                <p style={{color: 'red', textAlign: 'center'}}>{modalDocumentError}</p>
                           ) : modalStudentDocuments.length > 0 ? (
                              <ul className={styles.modalDocumentList}>
                                  {modalStudentDocuments.map(doc => (
                                      <li key={doc.id} className={styles.modalDocumentItem}>
                                          <div className={styles.modalDocumentInfo}>
                                              <span className={styles.modalDocumentTitle}>{doc.name || doc.title || 'Без названия'}</span>
                                                (<span className={styles.modalDocumentDate}>{doc.date}</span>) - <span className={styles.statusText} style={{ fontWeight: 'bold' }}>{doc.status}</span>
                                          </div>
                                          <div className={styles.modalDocumentActions}>
                                              {doc.file_url && (
                                                <button
                                                    className={`${styles.button} ${styles.buttonOutline} ${styles.buttonSmall}`}
                                                    onClick={() => {
                                                        handleViewSpecificDocumentFile(doc.id, doc.name || doc.title, doc.content_type);
                                                    }}
                                                    title={doc.content_type?.includes('pdf') ? 'Просмотреть PDF' : 'Скачать файл'}
                                                     disabled={loadingPdfViewer}
                                                >
                                                      {doc.content_type?.includes('pdf') ? <Eye style={{width: '1em', height: '1em', marginRight: '4px'}} /> : <Book style={{width: '1em', height: '1em', marginRight: '4px'}} />}
                                                    {doc.content_type?.includes('pdf') ? ' Просмотр' : ' Скачать'}
                                                </button>
                                              )}
                                          </div>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p style={{textAlign: 'center'}}>Документы для этого студента не найдены.</p>
                          )}
                     </div>
                    <div className={styles.modalFooter} style={{display: 'flex', justifyContent: 'flex-end', marginTop: '15px'}}>
                         <button type="button" className={styles.button} onClick={handleCloseDocumentModal} disabled={loadingDocumentModal || loadingPdfViewer}>Закрыть</button>
                     </div>
                 </div>
             </div>
         )}

        {/* Nested PDF Viewer Modal */}
        {showPdfViewerModal && (
          <div className={styles.modalOverlay} style={{marginLeft: '100px'}} onClick={handleClosePdfViewerModal}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{width: '90%', maxWidth: '900px', height: '95%', display: 'flex', flexDirection: 'column'}}>
                  <div className={styles.modalHeader} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h3 className={styles.modalTitle}>{pdfModalTitle || 'Просмотр документа'}</h3>
                      <button type="button" className={styles.closeButton} onClick={handleClosePdfViewerModal} disabled={loadingPdfViewer}>
                          <XCircle style={{width: '1.5em', height: '1.5em'}} />
                      </button>
                  </div>
                  <div className={styles.modalBody} style={{flexGrow: 1, overflowY: 'auto'}}>
                      {loadingPdfViewer ? (
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                              <Loader2 className={styles.loaderIcon} />
                              <p style={{marginTop: '10px'}}>Загрузка PDF...</p>
                          </div>
                      ) : pdfModalError ? (
                           <p style={{color: 'red', textAlign: 'center'}}>{pdfModalError}</p>
                       ) : pdfModalUrl ? (
                          <iframe
                              src={pdfModalUrl}
                              title={pdfModalTitle || 'Просмотр PDF'}
                              style={{width: '100%', height: '100%', border: 'none'}}
                              allowFullScreen
                          >
                              Ваш браузер не поддерживает просмотр PDF через iframe.
                          </iframe>
                      ) : (
                           <p style={{textAlign: 'center'}}>Не удалось загрузить PDF.</p>
                      )}
                  </div>
              </div>
          </div>
        )}

        {/* Edit User Dialog (Modal) */}
        {showEditUserModal && (
             <EditUserModal
                 user={selectedUserForEdit}
                 onClose={handleCloseEditUserModal}
                 onSave={handleSaveUser}
                 loading={loadingUserForEdit}
                 error={editUserError}
                 userRole={user?.role} // Pass the user's role to the modal
             />
         )}

      </div>
    </SidebarLayout>
  );
};

export default Groups;