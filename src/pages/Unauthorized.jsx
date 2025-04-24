import React from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './../styles/Unauthorized.module.css';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.unauthorizedContainer}>
      <div className={styles.unauthorizedContent}>
        <h1 className={styles.unauthorizedTitle}>Access Denied</h1>
        <p className={styles.unauthorizedMessage}>You don't have permission to access this page.</p>
        <button type="button" className={styles.button} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;