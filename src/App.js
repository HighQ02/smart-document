import React, { useEffect, useState } from "react";
import axios from "axios"; // Импортируем axios
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import CreateDocument from "./pages/CreateDocument";
import Notifications from "./pages/Notifications";
import Requests from "./pages/Requests";
import Schedule from "./pages/Schedule";
import Groups from "./pages/Groups";
import Students from "./pages/Students";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import SignatureCanvasPage from './pages/SignatureCanvasPage';

// AI Assistant
import AIAssistant from "./components/AIAssistant";

// Стиль для уведомлений (альтернатива Toaster и Sonner)
import './styles.css';

const queryClient = new QueryClient();

// Настройка глобальных параметров axios
axios.defaults.baseURL = 'http://172.20.10.3:7000/'; // Обновлено на порт 7000
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Добавляем перехватчик для автоматического добавления токена авторизации
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Обработка ошибок авторизации (401/403)
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Если сервер вернул 401 или 403, перенаправляем на страницу логина
      if (error.response.status === 401 || error.response.status === 403) {
        // Сохраняем сообщение об ошибке
        localStorage.setItem('authError', error.response.data.message || 'Ошибка авторизации');
        // Очищаем токен
        localStorage.removeItem('authToken');
        // Перенаправляем пользователя, если не находимся уже на странице логина
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Создаем сервис для работы с API на основе server.js
export const api = {
  // Аутентификация
  auth: {
    login: (credentials) => axios.post('/auth/login', credentials),
    logout: () => axios.post('/auth/logout'),
    getCurrentUser: () => axios.get('/users/me')
  },
  
  // Пользователи
  users: {
    getAll: (role) => axios.get('/users', { params: { role } }),
    create: (userData) => axios.post('/users', userData),
    getMe: () => axios.get('/users/me')
  },
  
  // Документы
  documents: {
    getAll: (params) => axios.get('/documents', { params }),
    getTemplates: () => axios.get('/document-templates'),
    generateSignatureUrl: (docId, slotName) => axios.get(`/documents/${docId}/generate-signature-url/${slotName}`),
  },

  // Подписи
  signatures: {
     upload: (signatureData) => axios.post('/signatures/upload', signatureData), // Ожидает { token, imageData } JSON
     getSignatureImage: (signatureUuid) => axios.get(`/signatures/${signatureUuid}/download`, { responseType: 'blob' }), // Если нужен маршрут для отображения подписи
  },
  
  // Группы
  groups: {
    getStudents: (groupId) => axios.get(`/groups/${groupId}/students`)
  },
  
  // Родительский доступ
  parent: {
    getStudents: () => axios.get('/parent/students')
  },
  
  // Запросы
  requests: {
    getAll: (params) => axios.get('/requests', { params }),
    create: (requestData) => axios.post('/requests', requestData)
  }
};

const App = () => {
  useEffect(() => {
    document.title = "SmartNation College";
  }, []);

  const [notification, setNotification] = useState("");

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 5000); // Убираем уведомление через 5 секунд
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {/* Уведомления */}
          {notification && <div className="notification">{notification}</div>}

          <Routes>
            {/* Корневой редирект */}
            <Route path="/" element={<Index />} />
            
            {/* Публичные маршруты */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/sign" element={<SignatureCanvasPage />} /> {/* <-- ДОБАВЛЯЕМ ЗДЕСЬ */}

            {/* Защищённые маршруты */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-document"
              element={
                <ProtectedRoute>
                  <CreateDocument />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute allowedRoles={['admin', 'curator']}>
                  <Requests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Schedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute allowedRoles={['admin', 'curator']}>
                  <Groups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students"
              element={
                <ProtectedRoute allowedRoles={['curator', 'parent']}>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            {/* Страница не найдена */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Кнопка AI помощника (видна всегда) */}
          <AIAssistant />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
