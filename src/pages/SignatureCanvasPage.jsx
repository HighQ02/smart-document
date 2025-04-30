// src/pages/SignatureCanvasPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
// Импортируем библиотеку для холста
import SignaturePad from 'react-signature-canvas';
// Импортируем JWT декодер для фронтенда (только для чтения данных, не валидации)
import { jwtDecode } from 'jwt-decode';
// TODO: Создать и импортировать стили для этой страницы
// import styles from './SignatureCanvasPage.module.css';
// Импортируем спиннер, если используется в стилях
import { Loader2 } from 'lucide-react';


const SignatureCanvasPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [documentInfo, setDocumentInfo] = useState(null);
    // ref для компонента SignaturePad
    const signaturePadRef = useRef(null);
    const [isSavingSignature, setIsSavingSignature] = useState(false);


    // 1. Получаем токен из URL
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');


    useEffect(() => {
        // Реализация: API запрос на бэкенд (/api/signatures/validate-token?token=...)
        // Бэкенд проверит токен, срок действия, не использован ли он, и вернет { documentId, slotName, signerUserId, signerName, documentTitle }.

        if (!token) {
            setError("Отсутствует токен подписи. Невозможно загрузить страницу.");
            setLoading(false);
            return;
        }

        const validateTokenAndFetchInfo = async () => {
            try {
                // Этот маршрут на бэкенде (/api/signatures/validate-token) создан,
                // он примет токен, проверит его (JWT) и вернет данные о документе и подписанте.
                // TODO: В бэкенде /api/signatures/validate-token нужно добавить проверку токена в БД signature_tokens (существует, не просрочен, не использован).
                const response = await axios.get(`/api/signatures/validate-token?token=${token}`);

                // Проверяем, что бэкенд вернул необходимые данные
                if (!response.data?.documentId || !response.data?.slotName || !response.data?.signerName) {
                     throw new Error("Backend returned insufficient data for signature.");
                }

                setDocumentInfo(response.data); // Сохраняем полученные данные
                setError(null); // Очищаем предыдущие ошибки
            } catch (err) {
                console.error("Token validation/fetch failed:", err);
                setError(err.response?.data?.message || "Недействительный или просроченный токен подписи, или ошибка загрузки данных.");
                setDocumentInfo(null); // Очищаем инфо при ошибке
            } finally {
                setLoading(false); // Скрываем загрузку после попытки
            }
        };

        validateTokenAndFetchInfo();

        // TODO: В реальной системе, после успешной отправки подписи (handleSaveSignature),
        // возможно, нужно будет перенаправить пользователя или показать страницу успеха/закрыть вкладку.

    }, [token, location, navigate]); // Зависимости: токен, location (если нужно реагировать на его изменения), navigate


    // Функция очистки холста
    const handleClearSignature = () => {
        signaturePadRef.current?.clear(); // Используем .current для доступа к экземпляру SignaturePad
    };

    // Функция сохранения и отправки подписи
    const handleSaveSignature = async () => {
        // Проверка, что холст не пустой
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            alert("Пожалуйста, нарисуйте подпись перед сохранением.");
            return;
        }

        // 1. Получить данные подписи с холста как Base64
        // Используем метод getCanvas().toDataURL()
        const imageDataUrl = signaturePadRef.current.getCanvas().toDataURL('image/png'); // Получаем Base64 в формате PNG

        // 2. Подготовить данные для отправки на бэкенд
        const uploadData = {
            token: token, // Токен из URL
            imageData: imageDataUrl, // Base64 строка изображения
        };

        // 3. Отправить данные на бэкенд (/api/signatures/upload)
        setIsSavingSignature(true); // Показать индикатор отправки
        setError(null); // Сброс предыдущих ошибок

        try {
            const response = await axios.post('/api/signatures/upload', uploadData); // Отправляем JSON

            // TODO: Показать сообщение об успехе (используя состояние)
            console.log("Signature upload success:", response.data);
            alert(response.data?.message || "Подпись успешно сохранена!"); // Простая заглушка

            // TODO: Возможно, перенаправить пользователя или закрыть окно/вкладку после успеха
            // window.close(); // Закрыть текущую вкладку/окно
            // navigate('/signature-success'); // Перенаправить на страницу успеха

        } catch (uploadError) {
             console.error("Signature upload failed:", uploadError);
             // TODO: Показать сообщение об ошибке отправки (используя состояние)
             setError(uploadError.response?.data?.message || "Ошибка при сохранении подписи.");
             alert("Ошибка сохранения: " + (uploadError.response?.data?.message || uploadError.message)); // Простая заглушка
        } finally {
            setIsSavingSignature(false); // Скрыть индикатор отправки
        }
    };


    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Загрузка страницы подписи...</h2>
                {/* Спиннер загрузки */}
                 <Loader2 style={{ margin: '20px auto', display: 'block', width: '4em', height: '4em' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                <h2>Ошибка</h2>
                <p>{error}</p>
                {/* TODO: Добавить кнопку "Закрыть" */}
            </div>
        );
    }

    // Страница после успешной загрузки данных
    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>Подпись документа</h2>
            {documentInfo && (
                <div>
                    <p>Документ: <strong>{documentInfo.documentTitle || 'Без названия'}</strong></p>
                    <p>Слот подписи: <strong>{documentInfo.slotName}</strong></p>
                    {documentInfo.signerName && <p>Подписывает: <strong>{documentInfo.signerName}</strong></p>}
                    {documentInfo.signerUserId && <p>ID Подписанта: <strong>{documentInfo.signerUserId}</strong></p>}


                    {/* Отобразить компонент холста подписи */}
                    <SignaturePad
                        ref={signaturePadRef} // Привязываем ref
                        canvasProps={{ width: 500, height: 200, className: 'signatureCanvas', style: { border: '1px solid #000', margin: '20px auto', maxWidth: '95%', touchAction: 'none' } }} // touchAction: 'none' может помочь на мобильных
                    />

                    {/* Кнопки управления холстом и отправки */}
                    <div style={{ margin: '20px' }}>
                        <button onClick={handleClearSignature} disabled={isSavingSignature} style={{ marginRight: '10px' }}>Очистить</button>
                        <button onClick={handleSaveSignature} disabled={isSavingSignature}>
                            {isSavingSignature ? ( <Loader2 style={{ display: 'inline-block', width: '1.5em', height: '1.5em', verticalAlign: 'middle' }} /> ) : 'Сохранить подпись'}
                        </button>
                    </div>


                </div>
            )}
        </div>
    );
};

export default SignatureCanvasPage;