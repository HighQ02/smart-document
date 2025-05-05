# main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
import io
import uuid
import os # Импорт для работы с файловой системой
import aiofiles # Импорт для асинхронной работы с файлами
from pathlib import Path # Импорт для работы с путями файлов

app = FastAPI()

# Директория для сохранения загруженных документов
UPLOAD_DIR = Path("uploaded_files")
UPLOAD_DIR.mkdir(exist_ok=True)

# Директория для сохранения изображений подписей
SIGNATURES_UPLOAD_DIR = Path("signatures")
SIGNATURES_UPLOAD_DIR.mkdir(exist_ok=True)


# Пример простого корневого маршрута
@app.get("/")
async def read_root():
    return {"Hello": "World"}

# Маршрут для загрузки файла документа (PDF, DOCX и т.д.)
# Node.js вызывает этот маршрут для сохранения файла документа.
@app.post("/api/v1/upload_pdf/") # Обратите внимание на слэш в конце
async def upload_pdf(file: UploadFile = File(...)):
    file_uuid = uuid.uuid4() # Генерируем UUID для файла
    file_path = UPLOAD_DIR / str(file_uuid) # Путь для сохранения файла с именем UUID

    try:
        print(f"FastAPI: Uploading file to storage: {file.filename}, type: {file.content_type}")
        print(f"FastAPI: Saving file as: {file_path.resolve()}")

        # Сохраняем файл асинхронно
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024): # Читаем файл по частям (1MB)
                await out_file.write(content)

        print(f"FastAPI: File successfully saved as {file_uuid}")

        # Возвращаем UUID Node.js бэкенду
        return {"uuid": str(file_uuid)}

    except Exception as e:
        print(f"FastAPI: Error saving file to storage: {e}")
        # Попытка очистить частично сохраненный файл, если есть
        if file_path.exists():
             file_path.unlink() # Используем unlink() из pathlib
             print(f"FastAPI: Cleaned up partial file {file_path}")

        raise HTTPException(status_code=500, detail=f"Could not save file to storage: {e}")


# Маршрут для получения файла документа по UUID
# Node.js вызывает этот маршрут для скачивания файла документа.
@app.get("/api/v1/open_file/")
async def open_file(pdf_uuid: str):
    print(f"FastAPI: Attempting to retrieve file from storage with UUID: {pdf_uuid}")
    file_path = UPLOAD_DIR / pdf_uuid # Путь к сохраненному файлу (имя файла на диске - это UUID)

    # Проверка UUID и существования файла на диске
    try:
        uuid.UUID(pdf_uuid) # Просто валидация формата UUID
        if not file_path.exists():
            print(f"FastAPI: File not found on disk at {file_path} for UUID {pdf_uuid}")
            raise HTTPException(status_code=404, detail="File not found in storage.")
    except ValueError:
        print(f"FastAPI: Invalid UUID format requested: {pdf_uuid}")
        raise HTTPException(status_code=400, detail="Invalid UUID format.")

    print(f"FastAPI: Found file on disk: {file_path}")

    # Функция-итератор для потоковой передачи файла
    async def file_iterator():
        async with aiofiles.open(file_path, 'rb') as file_like:
            while chunk := await file_like.read(1024 * 1024): # Читаем по 1MB
                yield chunk

    # FastAPI просто отдает байты. Node.js установит правильные заголовки (Content-Type, Content-Disposition).
    # Используем общий Content-Type. Node.js заменит его на правильный, взятый из своей БД.
    # НЕ устанавливаем здесь Content-Disposition. Node.js его установит.
    return StreamingResponse(file_iterator(), media_type="application/octet-stream")


# Маршрут для загрузки изображения подписи
# Node.js вызывает этот маршрут для сохранения файла подписи.
@app.post("/api/v1/upload_signature")
async def upload_signature(file: UploadFile = File(...)):
    # Опционально: Добавить базовую валидацию типа файла
    # if file.content_type not in ["image/png", "image/jpeg", "image/svg+xml"]:
    #     raise HTTPException(status_code=400, detail=f"Invalid image format: {file.content_type}. Only PNG, JPEG, SVG are allowed.")

    signature_uuid = uuid.uuid4() # Генерируем UUID для файла подписи
    file_path = SIGNATURES_UPLOAD_DIR / str(signature_uuid) # Путь для сохранения файла в папку signatures


    try:
        print(f"FastAPI: Uploading signature image, type: {file.content_type}")
        print(f"FastAPI: Saving signature as: {file_path.resolve()}")

        # Сохраняем файл асинхронно
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024): # Читаем по частям
                await out_file.write(content)

        print(f"FastAPI: Signature image successfully saved as {signature_uuid}")

        # Возвращаем UUID сохраненного изображения
        return {"uuid": str(signature_uuid)}

    except Exception as e:
        print(f"FastAPI: Error saving signature image: {e}")
        # Попытка очистить частично сохраненный файл, если есть
        if file_path.exists():
             file_path.unlink() # Используем unlink() из pathlib
             print(f"FastAPI: Cleaned up partial file {file_path}")

        raise HTTPException(status_code=500, detail=f"Could not save signature image: {e}")


# Маршрут для получения изображения подписи по UUID
# Node.js вызывает этот маршрут для отображения подписи на фронтенде.
@app.get("/api/v1/open_signature/{signature_uuid}") # <-- Реализуем этот маршрут
async def open_signature(signature_uuid: str):
     print(f"FastAPI: Attempting to retrieve signature image with UUID: {signature_uuid}")
     file_path = SIGNATURES_UPLOAD_DIR / signature_uuid # Путь к сохраненному файлу в директории signatures

     try:
        uuid.UUID(signature_uuid) # Просто валидация формата UUID
        if not file_path.exists():
            print(f"FastAPI: Signature image not found on disk at {file_path} for UUID {signature_uuid}")
            raise HTTPException(status_code=404, detail="Signature image not found in storage.")
     except ValueError:
        print(f"FastAPI: Invalid UUID format requested: {signature_uuid}")
        raise HTTPException(status_code=400, detail="Invalid UUID format.")

     # TODO: В идеале, получить Content-Type изображения из места, где он был сохранен при загрузке.
     # Если не сохраняли, можно попытаться угадать по расширению (если оно есть) или по содержимому.
     # Для простоты, предположим, что все подписи сохраняются как PNG.
     content_type = "image/png"

     async def file_iterator():
        async with aiofiles.open(file_path, 'rb') as file_like:
            while chunk := await file_like.read(1024 * 1024): # Читаем по частям
                yield chunk

     # Возвращаем изображение в потоке с правильным Content-Type.
     # Не устанавливаем Content-Disposition: attachment.
     return StreamingResponse(file_iterator(), media_type=content_type)