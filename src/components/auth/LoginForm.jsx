import React, { useState } from 'react';
import { useAuth } from './../../contexts/AuthContext';
import { LogIn } from 'lucide-react';

import styles from './../../styles/LoginForm.module.css';

const LoginForm = () => {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginCardHeader}>
          <h2 className={styles.loginCardTitle}>Вход в систему</h2>
          <p className={styles.loginCardDescription}>
            Введите данные для доступа к вашему аккаунту
          </p>
        </div>
        <div className={styles.loginCardContent}>
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <p className={styles.alertDescription}>{error}</p>
              </div>
            )}
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.formLabel}>Email</label>
              <input
                id="email"
                type="email"
                className={styles.inputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                disabled={isLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.formLabel}>Пароль</label>
              <input
                id="password"
                type="password"
                className={styles.inputField}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonFullWidth}`}
              disabled={isLoading}
            >
              {isLoading ? 'Вход...' : (
                <>
                  <LogIn style={{width: '1.2em', height: '1.2em', marginRight: '8px'}} />
                  Войти
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;