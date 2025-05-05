// SignatureCanvasPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SignaturePad from 'react-signature-canvas';
import { jwtDecode } from 'jwt-decode';
import { Loader2 } from 'lucide-react';

const SignatureCanvasPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [documentInfo, setDocumentInfo] = useState(null);
    const signaturePadRef = useRef(null);
    const [isSavingSignature, setIsSavingSignature] = useState(false);
    const [savedSignatureUuid, setSavedSignatureUuid] = useState(null);
    const [isSignatureSavedSuccessfully, setIsSignatureSavedSuccessfully] = useState(false);
    const [imageUrl, setImageUrl] = useState(null);

    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setError("Отсутствует токен подписи. Невозможно загрузить страницу.");
            setLoading(false);
            return;
        }

        const validateTokenAndFetchInfo = async () => {
            try {
                const response = await axios.get(`/api/signatures/validate-token?token=${token}`);

                if (!response.data?.documentId || !response.data?.slotName || !response.data?.signerName) {
                    throw new Error("Backend вернул недостаточно данных.");
                }

                setDocumentInfo(response.data);
                setError(null);

                if (response.data.signatureExists && response.data.existingSignatureUuid) {
                    const uuid = response.data.existingSignatureUuid;
                    setSavedSignatureUuid(uuid);
                    setIsSignatureSavedSuccessfully(true);
                }
            } catch (err) {
                console.error("Ошибка при валидации токена:", err);
                setError(err.response?.data?.message || "Ошибка загрузки данных.");
                setDocumentInfo(null);
            } finally {
                setLoading(false);
            }
        };

        validateTokenAndFetchInfo();
    }, [token]);

    useEffect(() => {
        const fetchImage = async () => {
            if (!savedSignatureUuid) return;

            try {
                const response = await axios.get(`/api/signatures/${savedSignatureUuid}/image`, {
                    responseType: 'blob',
                    timeout: 10000
                });

                if (response.data instanceof Blob && response.data.type.startsWith('image/')) {
                    const url = URL.createObjectURL(response.data);
                    setImageUrl(url);
                } else {
                    throw new Error("Сервер вернул не изображение.");
                }
            } catch (err) {
                console.error("Ошибка загрузки изображения:", err);
                setImageUrl(null);
            }
        };

        fetchImage();
    }, [savedSignatureUuid]);

    const handleClearSignature = () => {
        signaturePadRef.current?.clear();
        setIsSignatureSavedSuccessfully(false);
        setImageUrl(null);
    };

    const handleSaveSignature = async () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
            alert("Пожалуйста, нарисуйте подпись перед сохранением.");
            return;
        }

        const imageDataUrl = signaturePadRef.current.getCanvas().toDataURL('image/png');
        const uploadData = { token: token, imageData: imageDataUrl };

        setIsSavingSignature(true);
        setError(null);
        setIsSignatureSavedSuccessfully(false);
        setImageUrl(null);

        try {
            const response = await axios.post('/api/signatures/upload', uploadData);

            if (response.status === 200 && response.data?.signatureImageUuid) {
                setSavedSignatureUuid(response.data.signatureImageUuid);
                setIsSignatureSavedSuccessfully(true);
                alert(response.data?.message || "Подпись успешно сохранена!");
            } else {
                throw new Error("Неожиданный ответ от сервера.");
            }
        } catch (uploadError) {
            console.error("Ошибка при сохранении подписи:", uploadError);
            setError(uploadError.response?.data?.message || "Ошибка при сохранении подписи.");
            alert("Ошибка сохранения: " + (uploadError.response?.data?.message || uploadError.message || uploadError));
        } finally {
            setIsSavingSignature(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Загрузка страницы подписи...</h2>
                <Loader2 style={{ margin: '20px auto', display: 'block', width: '4em', height: '4em' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                <h2>Ошибка</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>Подписание документа</h2>
            <p>Документ: {documentInfo?.documentId}</p>
            <p>Слот: {documentInfo?.slotName}</p>
            <p>Подписант: {documentInfo?.signerName}</p>

            {!isSignatureSavedSuccessfully && (
                <>
                    <SignaturePad
                        ref={signaturePadRef}
                        canvasProps={{
                            width: 500,
                            height: 200,
                            style: { border: '1px solid black' }
                        }}
                    />
                    <div style={{ marginTop: '10px' }}>
                        <button onClick={handleClearSignature}>Очистить</button>
                        <button onClick={handleSaveSignature} disabled={isSavingSignature} style={{ marginLeft: '10px' }}>
                            {isSavingSignature ? 'Сохранение...' : 'Сохранить подпись'}
                        </button>
                    </div>
                </>
            )}

            {imageUrl && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Сохранённая подпись:</h3>
                    <img
                        src={imageUrl}
                        alt="Сохраненная подпись"
                        style={{
                            border: '1px solid #000',
                            margin: '20px auto',
                            maxWidth: '95%',
                            height: 'auto',
                            maxHeight: '200px',
                            display: 'block'
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default SignatureCanvasPage;
