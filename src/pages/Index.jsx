import React from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './../styles/Index.module.css';

const Index = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className={styles.landingPage}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.mainTitle}>
            SmartNation College
          </h1>
          <p className={styles.subtitle}>
            Система управления документооборотом
          </p>
        </header>

        <div className={styles.content}>
          <div className={styles.infoSection}>
            <h2 className={styles.sectionTitle}>
              Эффективный документооборот для вашего учебного заведения
            </h2>
            <div className={styles.features}>
              <p className={styles.featureIntro}>
                SmartNation College предлагает современную систему документооборота,
                разработанную специально для учебных заведений.
              </p>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.checkMark}>✓</span>
                  <span>Удобное управление документами</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkMark}>✓</span>
                  <span>Онлайн-взаимодействие между кураторами и родителями</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkMark}>✓</span>
                  <span>Электронное оформление и подписание документов</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkMark}>✓</span>
                  <span>Безопасное хранение и быстрый доступ к информации</span>
                </li>
              </ul>
            </div>
            <button onClick={handleLogin} className={`${styles.btn} ${styles.btnLogin}`}>
              <span className={styles.icon}>→</span>
              Войти в систему
            </button>
          </div>
          <div className={styles.cardSection}>
            <div className={styles.infoCard}>
              <div className={`${styles.cardItem} ${styles.cardItemAdmin}`}> {/* Объединяем базовый класс и модификатор */}
                <h3 className={styles.cardItemTitle}>Для администраторов</h3>
                <p className={styles.cardItemDescription}>
                  Полный контроль над документами, группами и расписанием
                </p>
              </div>
              <div className={`${styles.cardItem} ${styles.cardItemCurator}`}>
                <h3 className={styles.cardItemTitle}>Для кураторов</h3>
                <p className={styles.cardItemDescription}>
                  Удобный доступ к документам студентов и взаимодействие с родителями
                </p>
              </div>
              <div className={`${styles.cardItem} ${styles.cardItemParent}`}>
                <h3 className={styles.cardItemTitle}>Для родителей</h3>
                <p className={styles.cardItemDescription}>
                  Прозрачный мониторинг успеваемости и быстрое оформление документов
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;