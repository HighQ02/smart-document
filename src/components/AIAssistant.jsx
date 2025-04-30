import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useAuth } from './../contexts/AuthContext';
import axios from 'axios';

import styles from './../styles/AIAssistant.module.css';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Здравствуйте! Я ваш виртуальный помощент SmartNation College. Чем могу помочь?' }
  ]);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const [isSending, setIsSending] = useState(false); // Состояние отправки

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isSending) return; // Отключаем отправку, если пусто или уже отправляем

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsSending(true); // Устанавливаем флаг отправки


    try {
        // Вызываем новый endpoint на вашем бэкенде
        const backendApiUrl = '/api/chat-with-ai'; // Убедитесь, что путь совпадает с бэкендом

        const apiResponse = await axios.post(backendApiUrl, {
            message: userMessage // Отправляем только сообщение пользователя на бэкенд
        });

        // Ожидаем, что бэкенд вернет ответ в формате { reply: "..." }
        const assistantResponse = apiResponse.data?.reply || 'Извините, я не смог сгенерировать ответ.';

        setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: assistantResponse }]);

    } catch (error) {
        console.error('Error calling backend AI proxy:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Произошла ошибка при получении ответа от AI.';
        setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: `Ошибка: ${errorMessage}` }]);
    } finally {
        setIsSending(false); // Сбрасываем флаг отправки после получения ответа или ошибки
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.aiButton}
        aria-label="Открыть AI-ассистент"
      >
        <MessageSquare size={24} />
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
                 <div ref={messagesEndRef} />
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
                  disabled={isSending} // Отключаем поле ввода во время отправки
                />
                <button type="submit" className={styles.sendButton} disabled={!input.trim() || isSending}> {/* Отключаем кнопку */}
                  <Send size={20} />
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