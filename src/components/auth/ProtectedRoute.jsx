import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './../../contexts/AuthContext';

import styles from './../../styles/ProtectedRoute.module.css';

const ProtectedRoute = ({
  children,
  allowedRoles = ['admin', 'curator', 'parent', 'student']
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;