import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';

import styles from './../styles/AIAssistant.module.css';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Здравствуйте! Я ваш виртуальный помощник SmartNation College. Чем могу помочь?' }
  ]);
  const { user } = useAuth();

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setTimeout(() => {
      let response = '';
      if (input.toLowerCase().includes('документ')) {
        if (user?.role === 'admin') {
          response = 'В разделе "Документы" вы можете управлять всеми документами, создавать шаблоны и настраивать процессы документооборота.';
        } else if (user?.role === 'curator') {
          response = 'В разделе "Документы" вы можете просматривать и проверять документы студентов в ваших группах.';
        } else {
          response = 'В разделе "Документы" вы можете загружать необходимые документы для вашего ребенка и отслеживать их статус.';
        }
      } else if (input.toLowerCase().includes('расписание') || input.toLowerCase().includes('дедлайн')) {
        response = 'Информация о сроках сдачи документов и важных датах доступна в разделе "Расписание".';
      } else if (input.toLowerCase().includes('запрос')) {
        response = 'Вы можете создать новый запрос в разделе "Запросы".';
      } else if (input.toLowerCase().includes('профиль') || input.toLowerCase().includes('настройки')) {
        response = 'Управление своим профилем и настройками доступно в разделе "Личный кабинет".';
      } else {
        response = 'Я могу помочь с вопросами по документам, расписанию, запросам и навигации. Уточните ваш вопрос.';
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    }, 850);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.aiButton}
        aria-label="AI-ассистент"
      >
        <MessageSquare />
      </button>

      {isOpen && (
        <div className={styles.chatModalOverlay} onClick={() => setIsOpen(false)}>
          <div className={styles.chatModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.chatModalHeader}>
              <h3 className={styles.chatModalTitle}>Виртуальный помощник</h3>
              <p className={styles.chatModalDescription}>
                Задайте вопрос — я помогу вам по работе с платформой
              </p>
            </div>
            <div className={styles.chatMessagesArea}>
              <div className={styles.messagesList}>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.messageRow} ${
                      message.role === 'user' ? styles.user : styles.assistant
                    }`}
                  >
                    <div className={`${styles.messageBubble} ${
                        message.role === 'user'
                          ? styles.user
                          : styles.assistant
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.chatModalFooter}>
              <form onSubmit={handleSendMessage} className={styles.chatInputForm}>
                <input
                  type="text"
                  placeholder="Введите ваш вопрос..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className={styles.chatInput}
                />
                <button type="submit" className={styles.sendButton}>
                  <Send />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;