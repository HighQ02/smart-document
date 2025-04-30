# main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
import io
import uuid
import os
import aiofiles
from pathlib import Path
# Убираем импорты asyncpg и json

app = FastAPI()

UPLOAD_DIR = Path("uploaded_files")
UPLOAD_DIR.mkdir(exist_ok=True)

# Убираем словарь file_metadata_storage
# Убираем функции startup_db_pool и shutdown_db_pool

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.post("/api/v1/upload_pdf/")
async def upload_pdf(file: UploadFile = File(...)): # Убираем student_id и uploaded_by, если FastAPI их не использует
    file_uuid = uuid.uuid4()
    file_path = UPLOAD_DIR / str(file_uuid) # Сохраняем файл с именем UUID

    try:
        print(f"Uploading file to storage: {file.filename}, type: {file.content_type}")
        print(f"Saving as: {file_path.resolve()}")

        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):
                await out_file.write(content)

        print(f"File {file.filename} successfully saved as {file_uuid}")

        # Возвращаем только UUID, Node.js сохранит метаданные в свою БД
        return {"uuid": str(file_uuid)}

    except Exception as e:
        print(f"Error saving file to storage: {e}")
        if file_path.exists():
             file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Could not save file to storage: {e}")


@app.get("/api/v1/open_file/")
async def open_file(pdf_uuid: str):
    print(f"Attempting to retrieve file from storage with UUID: {pdf_uuid}")
    file_path = UPLOAD_DIR / pdf_uuid # Путь к сохраненному файлу (имя файла на диске - это UUID)

    # Проверка UUID и существования файла на диске
    try:
        uuid.UUID(pdf_uuid) # Просто валидация формата UUID
        if not file_path.exists():
            print(f"File not found on disk at {file_path} for UUID {pdf_uuid}")
            raise HTTPException(status_code=404, detail="File not found in storage.")
    except ValueError:
        print(f"Invalid UUID format requested: {pdf_uuid}")
        raise HTTPException(status_code=400, detail="Invalid UUID format.")

    print(f"Found file on disk: {file_path}")

    async def file_iterator():
        async with aiofiles.open(file_path, 'rb') as file_like:
            while chunk := await file_like.read(1024 * 1024):
                yield chunk

    # FastAPI просто отдает байты. Node.js установит правильные заголовки.
    # Используем общий Content-Type. Node.js заменит его на правильный.
    # НЕ устанавливаем здесь Content-Disposition. Node.js его установит.
    return StreamingResponse(file_iterator(), media_type="application/octet-stream")


# ... (ваши другие маршруты, если есть) ...