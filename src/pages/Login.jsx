import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './../contexts/AuthContext';
import LoginForm from './../components/auth/LoginForm';

import styles from './../styles/Login.module.css';

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.loginHeader}>
          <h1>SmartDocuments</h1>
          <p>Система управления документооборотом</p>
        </div>

        <LoginForm />

        <div className={styles.backLink}>
          <Link to="/" className={styles.backButton}>
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;