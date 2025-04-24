import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import axios from 'axios';

const initialState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // ИСПРАВЛЕННЫЙ URL для проверки текущего пользователя
          const response = await axios.get('/api/users/me');

          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: response.data,
          });
        } catch (error) {
          console.error('Auth check failed:', error);

          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          dispatch({ type: 'LOGOUT' });
        }
      }
    };

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      // ИСПРАВЛЕННЫЙ URL для входа
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      const { token, user } = response.data;

      localStorage.setItem('token', token);
      setToken(token);

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: user,
      });
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage = 'Ошибка при входе';

      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Неверный email или пароль';
        } else if (error.response.status === 403) {
          errorMessage = 'Учетная запись заблокирована';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        } else { // Добавим обработку других ошибок, если статус не 401/403
           errorMessage = error.message || 'Неизвестная ошибка при входе';
        }
      } else if (error.request) {
         // Ошибка запроса (сервер не ответил)
         errorMessage = 'Ошибка соединения с сервером';
      } else {
         // Что-то пошло не так при настройке запроса
         errorMessage = error.message || 'Неизвестная ошибка запроса';
      }


      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage,
      });
    }
  };

  const logout = async () => {
    try {
      // ИСПРАВЛЕННЫЙ URL для выхода
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setToken(null);

      dispatch({ type: 'LOGOUT' });
    }
  };

  const value = {
    ...state,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};