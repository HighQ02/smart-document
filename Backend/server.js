const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path'); // Используем для работы с путями
const qrcode = require('qrcode'); // Импорт библиотеки для QR-кодов
const { Buffer } = require('buffer'); // Buffer доступен глобально, но импорт для ясности


const app = express();
const port = 7000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'CollegeDB',
  password: '1234',
  port: 5432,
});

const JWT_SECRET = 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBUSgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsZZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==';
const FRONTEND_BASE_URL = 'http://172.20.10.3:3000';
const FASTAPI_STORAGE_URL = 'http://172.20.10.3:8000/api/v1';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Отсутствует токен авторизации' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Недействительный или истекший токен' });
    }
    req.user = user;
    next();
  });
};


// --- Маршруты Аутентификации ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email и пароль обязательны' });
    }

    const result = await pool.query(
      'SELECT id, full_name, email, password_hash, role, avatar_url, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Учетная запись заблокирована' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Note: req.ip might need configuration if behind a proxy (e.g., Nginx, API Gateway)
    // Consider using libraries like 'request-ip' for more reliable IP detection.
    await pool.query(
      'INSERT INTO user_activity (user_id, activity_type, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [user.id, 'login', req.ip, req.headers['user-agent']]
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        avatar: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Ошибка сервера при авторизации' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO user_activity (user_id, activity_type, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'logout', req.ip, req.headers['user-agent']]
    );

    res.json({ message: 'Выход выполнен успешно' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Ошибка сервера при выходе из системы' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, avatar_url, is_active FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      // This case should ideally not happen if authenticateToken is correct,
      // but good for robustness.
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Учетная запись заблокирована' });
    }

    res.json({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      avatar: user.avatar_url
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Ошибка при получении данных пользователя' });
  }
});

// --- Маршруты Пользователей ---
// Исправленный маршрут GET /api/users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Проверяем права доступа - просматривать список пользователей могут админ и куратор
    if (!['admin', 'curator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { role, curator_id } = req.query;
    let query = 'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users';
    const params = []; // Параметры для SQL запроса
    const conditions = []; // Условия для части WHERE

    // Добавляем условие по роли, если указано
    if (role) {
      conditions.push('role = $' + (conditions.length + 1));
      params.push(role);
    }

    // Если запрашивают студентов и указан curator_id
    if (role === 'student' && curator_id) {
        // Проверка прав: Куратор может запрашивать только своих студентов, Админ - студентов любого куратора
        if (req.user.role === 'curator' && req.user.id.toString() !== curator_id.toString()) {
             return res.status(403).json({ message: 'Недостаточно прав для запроса студентов других кураторов' });
        }
        // Добавляем условие: ID студента должен быть в группе, которую курирует curator_id
        conditions.push('id IN (SELECT student_id FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE g.curator_id = $' + (conditions.length + 1) + ')');
        params.push(curator_id);
    }

    // Если есть условия, формируем WHERE часть запроса
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    // Добавляем сортировку
    query += ' ORDER BY full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
  }
});


// API для получения студентов в группе (для куратора/админа)
app.get('/api/groups/:groupId/students', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    if (req.user.role === 'curator') {
      const curatorCheck = await pool.query(
        'SELECT id FROM groups WHERE id = $1 AND curator_id = $2',
        [groupId, req.user.id]
      );

      if (curatorCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Вы не являетесь куратором этой группы' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const students = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active
       FROM users u
       JOIN student_groups sg ON u.id = sg.student_id
       WHERE sg.group_id = $1
       ORDER BY u.full_name`,
      [groupId]
    );

    res.json(students.rows);
  } catch (error) {
    console.error('Get group students error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка студентов группы' });
  }
});

// API для родителя - получения списка своих детей
app.get('/api/parent/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const students = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url,
              g.id as group_id, g.name as group_name,
              ps.relationship
       FROM users u
       JOIN parent_students ps ON u.id = ps.student_id
       LEFT JOIN student_groups sg ON u.id = sg.student_id
       LEFT JOIN groups g ON sg.group_id = g.id
       WHERE ps.parent_id = $1
       ORDER BY u.full_name`,
      [req.user.id]
    );

    res.json(students.rows);
  } catch (error) {
    console.error('Get parent students error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка студентов' });
  }
});

// --- Маршруты Документов ---
app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const { status, studentId, limit, offset } = req.query;
    let query = `
      SELECT d.id, d.title, d.status, d.created_at, d.updated_at, d.file_url,
             d.original_filename, d.content_type, -- Добавлено
             u1.full_name as student_name, u1.id as student_id,
             u2.full_name as submitted_by_name,
             g.name as group_name,
             dt.name as template_name
      FROM documents d
      LEFT JOIN users u1 ON d.student_id = u1.id
      LEFT JOIN users u2 ON d.submitted_by = u2.id
      LEFT JOIN groups g ON d.group_id = g.id
      LEFT JOIN document_templates dt ON d.template_id = dt.id
      WHERE 1=1
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM documents d
      LEFT JOIN users u1 ON d.student_id = u1.id
      LEFT JOIN groups g ON d.group_id = g.id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      countQuery += ` AND d.status = $${paramIndex}`;
      params.push(status);
      countParams.push(status);
      paramIndex++;
    }

    if (req.user.role === 'student') {
      query += ` AND d.student_id = $${paramIndex}`;
      countQuery += ` AND d.student_id = $${paramIndex}`;
      params.push(req.user.id);
      countParams.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'parent') {
      query += ` AND d.student_id IN (
        SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex}
      )`;
      countQuery += ` AND d.student_id IN (
        SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex}
      )`;
      params.push(req.user.id);
      countParams.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'curator') {
      query += ` AND (d.group_id IN (
        SELECT id FROM groups WHERE curator_id = $${paramIndex}
      ) OR d.submitted_by = $${paramIndex})`;
      countQuery += ` AND (d.group_id IN (
        SELECT id FROM groups WHERE curator_id = $${paramIndex}
      ) OR d.submitted_by = $${paramIndex})`;
      params.push(req.user.id);
      countParams.push(req.user.id);
      paramIndex++;
    }

    if (studentId && ['admin', 'curator'].includes(req.user.role)) {
      if (studentId !== undefined) {
         query += ` AND d.student_id = $${paramIndex}`;
         countQuery += ` AND d.student_id = $${paramIndex}`;
         params.push(studentId);
         countParams.push(studentId);
         paramIndex++;
      }
    }

    query += ' ORDER BY d.created_at DESC';

    if (limit !== undefined && offset !== undefined) {
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        paramIndex += 2;
    }

    const [documentsResult, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, countParams)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const formattedDocuments = documentsResult.rows.map((doc) => ({
        id: doc.id,
        name: doc.title || doc.original_filename || 'Без названия', // Используем original_filename если нет title
        type: doc.content_type ? doc.content_type.split('/')[1].toUpperCase() : (doc.original_filename ? path.extname(doc.original_filename).slice(1).toUpperCase() || 'Файл' : 'Файл'), // Определяем тип из content_type или расширения original_filename
        status: doc.status,
        date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна',
        student_id: doc.student_id,
        student_name: doc.student_name || 'Неизвестно',
        file_url: doc.file_url,
        original_filename: doc.original_filename, // Включаем для фронтенда, если нужно
        content_type: doc.content_type, // Включаем для фронтенда, если нужно
        group_name: doc.group_name,
        template_name: doc.template_name,
        submitted_by_name: doc.submitted_by_name,
    }));

    res.json({
        items: formattedDocuments,
        total: total,
        limit: parseInt(limit, 10) || 10,
        offset: parseInt(offset, 10) || 0,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка документов' });
  }
});


// --- Маршрут для обновления статуса документа (Одобрить, Отклонить, Архивировать) ---
app.put('/api/documents/:id/status', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    const { status, review_comment } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    if (!['admin', 'curator'].includes(userRole)) {
        return res.status(403).json({ message: 'Недостаточно прав для изменения статуса документа' });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'archived', 'new', 'draft', 'submitted']; // Добавим все возможные статусы
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Недопустимый статус документа' });
    }

     if (userRole === 'curator') {
         try {
             const docCheck = await pool.query(
                 `SELECT d.id
                  FROM documents d
                  LEFT JOIN groups g ON d.group_id = g.id
                  WHERE d.id = $1 AND g.curator_id = $2`,
                 [documentId, reviewerId]
             );

             if (docCheck.rows.length === 0) {
                  const submittedByCheck = await pool.query(
                     `SELECT id FROM documents WHERE id = $1 AND submitted_by = $2`,
                     [documentId, reviewerId]
                 );
                 if (submittedByCheck.rows.length === 0) {
                     return res.status(403).json({ message: 'Вы не являетесь куратором группы, к которой относится этот документ, и не загружали его.' });
                 }
             }
         } catch (error) {
             console.error('Error checking curator permissions for document status update:', error);
             return res.status(500).json({ message: 'Ошибка при проверке прав доступа.' });
         }
     }

    let query = `
        UPDATE documents
        SET status = $1, updated_at = CURRENT_TIMESTAMP, reviewed_by = $2
    `;
    const params = [status, reviewerId, documentId];
    let paramIndex = 3;

    if (status === 'rejected') {
        if (!review_comment || review_comment.trim() === '') {
            return res.status(400).json({ message: 'Причина отклонения обязательна' });
        }
        query += `, review_comment = $${paramIndex}`;
        params.splice(paramIndex - 1, 0, review_comment.trim());
        paramIndex++;
    } else {
         query += `, review_comment = NULL`;
    }

    query += ` WHERE id = $${paramIndex}`;

    try {
        const result = await pool.query(query, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Документ не найден' });
        }

        res.status(200).json({ message: `Статус документа успешно обновлен на "${status}"` });

    } catch (error) {
        console.error('Error updating document status:', error);
        res.status(500).json({ message: 'Ошибка сервера при обновлении статуса документа' });
    }
});


// --- Маршрут для скачивания документа ---
app.get('/api/documents/:id/download', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const fastapiServiceUrl = 'http://127.0.0.1:8000/api/v1/open_file/'; // URL FastAPI сервиса

    try {
        // 1. Получить информацию о документе из БД (UUID, original_filename, content_type)
        const docResult = await pool.query(
            'SELECT id, title, file_url, student_id, original_filename, content_type FROM documents WHERE id = $1',
            [documentId]
        );

        const document = docResult.rows[0];

        if (!document) {
            return res.status(404).json({ message: 'Документ не найден' });
        }

        if (!document.file_url) {
             return res.status(404).json({ message: 'Файл для этого документа не прикреплен' });
        }

        const fileUuid = document.file_url;
        const originalFilename = document.original_filename || 'document'; // Получаем оригинальное имя из БД
        const contentType = document.content_type || 'application/octet-stream'; // Получаем тип из БД


        // 2. Проверка прав доступа к скачиванию (логика остается такой же)
        let isAuthorized = false;
        if (['admin', 'curator'].includes(userRole)) {
            isAuthorized = true;
        } else if (userRole === 'parent') {
             const parentCheck = await pool.query(
                'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
                [userId, document.student_id]
            );
            if (parentCheck.rows.length > 0) {
                isAuthorized = true;
            }
        } else if (userRole === 'student' && document.student_id === userId) {
             isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Недостаточно прав для скачивания этого документа' });
        }


        // 3. Запросить только байты файла из FastAPI сервиса по UUID
        try {
            const fastapiResponse = await axios.get(`${fastapiServiceUrl}?pdf_uuid=${fileUuid}`, {
                responseType: 'stream', // Получаем данные в виде потока
                // ВАЖНО: Не ожидаем от FastAPI заголовков Content-Type/Content-Disposition
                // Мы установим их сами на основе данных из нашей БД
            });

            // 4. Установить ЗАГОЛОВКИ ДЛЯ ОТВЕТА Node.js, используя метаданные из нашей БД
            res.setHeader('Content-Type', contentType); // Используем тип из нашей БД
            // Устанавливаем имя файла для скачивания, используя имя из нашей БД
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);


            // 5. Перенаправить поток данных из FastAPI в ответ Node.js
            fastapiResponse.data.pipe(res);

        } catch (fastapiError) {
            console.error('Error requesting file from FastAPI service:', fastapiError.message);
             if (fastapiError.response) {
                 if (fastapiError.response.status === 404) {
                    return res.status(404).json({ message: 'Файл не найден во внешнем хранилище.' });
                }
                 // Логируем другие ошибки от FastAPI
                 console.error('FastAPI response status:', fastapiError.response.status);
                 console.error('FastAPI response data:', fastapiError.response.data);
            } else {
                // Логируем ошибки, не связанные с ответом (например, ошибка сети)
                console.error('FastAPI request error:', fastapiError.request);
            }
            res.status(500).json({ message: 'Ошибка при получении файла из хранилища.' });
        }

    } catch (error) {
        console.error('Error in download document backend route (DB query or permission):', error);
        res.status(500).json({ message: 'Ошибка сервера при подготовке документа к скачиванию.' });
    }
});



app.get('/api/document-templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, template_fields, required_signatures
       FROM document_templates
       WHERE is_active = true
       ORDER BY name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({ message: 'Ошибка при получении шаблонов документов' });
  }
});


app.post('/api/documents', authenticateToken, async (req, res) => {
  try {
    const { title, template_id, content, status, student_id, group_id, file_url, submitted_by } = req.body;

     if (req.user.role !== 'admin' && req.user.id.toString() !== submitted_by.toString()) {
         return res.status(403).json({ message: 'Недостаточно прав для создания документа от имени другого пользователя' });
     }

    const result = await pool.query(
      `INSERT INTO documents
       (title, template_id, content, status, student_id, group_id, file_url, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [title, template_id, content, status, student_id, group_id, file_url, submitted_by]
    );

    res.status(201).json({
      message: 'Документ успешно создан',
      documentId: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Ошибка при создании документа' });
  }
});



// --- Новый маршрут API для загрузки документов через внешний сервис ---
// Принимает файл от фронтенда и перенаправляет его в FastAPI сервис хранения
app.post('/api/documents/upload', authenticateToken, upload.single('document'), async (req, res) => {
  try {
      const uploadedFile = req.file;
      const { name, student_id, status, submitted_by } = req.body;

      if (!uploadedFile || !student_id || !submitted_by) {
          return res.status(400).json({ message: 'Файл, студент и загрузивший пользователь обязательны для загрузки' });
      }

      let isAuthorized = false;
      if (req.user.role === 'admin') {
          isAuthorized = true;
      } else if (req.user.role === 'parent') {
          const parentCheck = await pool.query(
              'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
              [req.user.id, student_id]
          );
          if (parentCheck.rows.length > 0) {
              isAuthorized = true;
          } else {
              return res.status(403).json({ message: 'Недостаточно прав для загрузки документа для этого студента' });
          }
      } else if (req.user.role === 'curator') {
           const curatorCheck = await pool.query(
               `SELECT 1 FROM student_groups sg
                JOIN groups g ON sg.group_id = g.id
                WHERE sg.student_id = $1 AND g.curator_id = $2`,
               [student_id, req.user.id]
           );
           if (curatorCheck.rows.length > 0) {
               isAuthorized = true;
           } else {
              return res.status(403).json({ message: 'Недостаточно прав для загрузки документа для этого студента' });
           }
      } else if (req.user.role === 'student' && req.user.id.toString() === student_id.toString()) {
           isAuthorized = true;
      }

      if (!isAuthorized) {
          return res.status(403).json({ message: 'Ваша роль не позволяет загружать документы для этого студента' });
      }

      if (req.user.id.toString() !== submitted_by.toString() && req.user.role !== 'admin') {
           return res.status(403).json({ message: 'Недостаточно прав для загрузки документа от имени другого пользователя' });
      }

      // --- Перенаправление файла в FastAPI сервис ---
      const fastapiServiceUrl = 'http://127.0.0.1:8000/api/v1/upload_pdf/';
      const formData = new FormData();

      formData.append('file', uploadedFile.buffer, uploadedFile.originalname);
      // Можно убрать student_id и uploaded_by из formData, если FastAPI ими не пользуется для сохранения файла
      // formData.append('student_id', student_id);
      // formData.append('uploaded_by', submitted_by);

      try {
          // Отправляем файл в FastAPI
          const fastapiResponse = await axios.post(fastapiServiceUrl, formData, {
              headers: {
                   ...formData.getHeaders()
                   // Возможно, нужно удалить Content-Length или позволить axios его установить
                   // https://github.com/axios/axios/issues/1008
                   // 'Content-Length': undefined
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
          });

          const fileUuid = fastapiResponse.data?.uuid;

          if (!fileUuid) {
               if (fastapiResponse.status >= 400) {
                    const fastapiErrorMessage = fastapiResponse.data?.detail || `Сервис хранения вернул ошибку ${fastapiResponse.status}`;
                    return res.status(fastapiResponse.status).json({ message: `Ошибка сервиса хранения: ${fastapiErrorMessage}` });
               }
              return res.status(500).json({ message: 'Сервис хранения не вернул идентификатор файла.' });
          }

          // --- Сохранение метаданных документа (включая оригинальное имя и тип) в PostgreSQL ---
          // Находим группу студента, если есть
           const groupResult = await pool.query(
              'SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = true',
              [student_id]
           );
           const group_id = groupResult.rows[0]?.group_id || null;

           const initialStatus = status || 'pending'; // Используем статус из тела запроса или 'pending'

           // **ВАЖНО:** Сохраняем originalname и mimetype в БД
          const result = await pool.query(
            `INSERT INTO documents
             (title, status, student_id, group_id, file_url, submitted_by, original_filename, content_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, created_at`,
            [name || uploadedFile.originalname, initialStatus, student_id, group_id, fileUuid, submitted_by, uploadedFile.originalname, uploadedFile.mimetype]
          );

          res.status(201).json({
            message: 'Документ успешно загружен и зарегистрирован',
            documentId: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            fileUuid: fileUuid // UUID файла в хранилище
          });

      } catch (fastapiError) {
          console.error('Error forwarding file to FastAPI service:', fastapiError.message);
          if (fastapiError.response) {
             const fastapiErrorMessage = fastapiError.response.data?.detail || `Сервис хранения вернул ошибку ${fastapiError.response.status}`;
             return res.status(fastapiError.response.status >= 400 ? fastapiError.response.status : 500).json({ message: `Ошибка сервиса хранения: ${fastapiErrorMessage}` });
          }
          res.status(500).json({ message: `Ошибка связи с сервисом хранения: ${fastapiError.message}` });
      }

  } catch (error) {
    console.error('Upload document (Node.js handler) error:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке документа.' });
  }
});


// --- Маршруты Запросов (предполагается, что запросы - это тоже тип документов или отдельная сущность) ---
// Если запросы - это отдельная сущность, эти маршруты остаются как есть.
// Если "запросы" будут реализованы как документы с определенным template_id или типом,
// то эти маршруты могут быть переработаны или удалены в пользу маршрутов /api/documents.
// Например, запрос может быть документом с template_id = 'request' и статусом 'new'.
// Текущая реализация предполагает отдельную таблицу 'requests'.

app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { title, description, type, status, urgency, student_id, document_id, assigned_to } = req.body; // created_by берем из токена

     // Проверка прав: кто может создавать запросы?
     // Например: студент для себя, родитель для своего ребенка, куратор для своих групп, админ.
     let canCreate = false;
     if (req.user.role === 'admin') {
         canCreate = true;
     } else if (req.user.role === 'student' && student_id.toString() === req.user.id.toString()) {
         canCreate = true;
     } else if (req.user.role === 'parent') {
         const parentCheck = await pool.query(
             'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
             [req.user.id, student_id]
         );
         if (parentCheck.rows.length > 0) {
             canCreate = true;
         }
     } else if (req.user.role === 'curator') {
          const curatorCheck = await pool.query(
              `SELECT 1 FROM student_groups sg
               JOIN groups g ON sg.group_id = g.id
               WHERE sg.student_id = $1 AND g.curator_id = $2`,
              [student_id, req.user.id]
          );
          if (curatorCheck.rows.length > 0) {
              canCreate = true;
          }
     }

     if (!canCreate) {
          return res.status(403).json({ message: 'Недостаточно прав для создания запроса для этого студента' });
     }


    const result = await pool.query(
      `INSERT INTO requests
       (title, description, type, status, urgency, student_id, document_id, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [title, description, type, status || 'new', urgency || 'normal', student_id, document_id, assigned_to, req.user.id] // Устанавливаем created_by из токена
    );

    res.status(201).json({
      message: 'Запрос успешно создан',
      requestId: result.rows[0].id
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Ошибка при создании запроса' });
  }
});

app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { status, studentId } = req.query;

    let query = `
      SELECT r.id, r.title, r.description, r.type, r.status, r.urgency,
             r.created_at, r.updated_at, r.document_id,
             u1.full_name as student_name, u1.id as student_id,
             u2.full_name as created_by_name, u2.id as created_by_id,
             u3.full_name as assigned_to_name, u3.id as assigned_to_id
      FROM requests r
      LEFT JOIN users u1 ON r.student_id = u1.id
      LEFT JOIN users u2 ON r.created_by = u2.id
      LEFT JOIN users u3 ON r.assigned_to = u3.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Фильтрация по ролям
    if (req.user.role === 'student') {
        // Студент видит только свои запросы
        query += ` AND r.student_id = $${paramIndex}`;
        params.push(req.user.id);
        paramIndex++;
    } else if (req.user.role === 'parent') {
         // Родитель видит запросы своих детей
         query += ` AND r.student_id IN (SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex})`;
         params.push(req.user.id);
         paramIndex++;
    } else if (req.user.role === 'curator') {
         // Куратор видит запросы студентов своих групп И запросы, назначенные ему
         query += ` AND (r.student_id IN (SELECT sg.student_id FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE g.curator_id = $${paramIndex}) OR r.assigned_to = $${paramIndex})`;
         params.push(req.user.id, req.user.id);
         paramIndex += 2; // Использовали два параметра
    }
    // Админ видит все запросы (без фильтрации по роли)

    // Если studentId указан (и пользователь имеет права его использовать, проверено выше)
    if (studentId && ['admin', 'curator', 'parent'].includes(req.user.role)) { // Добавляем parent сюда, т.к. он может смотреть запросы только своих детей
         // Если роль куратора уже добавила условие по студентам своей группы, это условие может быть избыточным,
         // но для простоты оставим его, оно сработает как дополнительный фильтр.
         query += ` AND r.student_id = $${paramIndex}`;
         params.push(studentId);
         paramIndex++;
    }


    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка запросов' });
  }
});


// --- Маршруты AI Ассистента ---

// Убедитесь, что API ключ правильно загружается из .env
const GOOGLE_AI_API_KEY = 'AIzaSyBChhrfQTXMPXYNLRmmlZnRJaJkWgvARD4'; // Читаем из .env

if (!GOOGLE_AI_API_KEY) {
  console.error("FATAL ERROR: GOOGLE_AI_API_KEY is not defined in environment variables.");
}

const genAI = GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(GOOGLE_AI_API_KEY) : null;

app.post('/api/chat-with-ai', authenticateToken, async (req, res) => { // Добавим authenticateToken, если чат доступен только авторизованным
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!genAI) {
         console.error("Google Generative AI not initialized due to missing API key.");
         return res.status(500).json({ error: 'AI service is not available (missing API key)' });
    }

    // Можно добавить проверку роли, если AI ассистент не для всех
    // if (!['admin', 'curator', 'student', 'parent'].includes(req.user.role)) {
    //      return res.status(403).json({ message: 'Ваша роль не позволяет использовать AI ассистента.' });
    // }


    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Опционально: можно добавить системную инструкцию для AI,
    // чтобы он вел себя как ассистент колледжа.
    // const chat = model.startChat({ history: /*... история чата ...*/ });
    // const result = await chat.sendMessage(userMessage);

    const result = await model.generateContent(userMessage);
    const response = await result.response;
    const text = response.text();

    // TODO: Сохранение истории чата в БД, если требуется

    res.json({ reply: text });

  } catch (error) {
    console.error('Error calling Google AI API from backend:', error);
    if (error.response) {
       console.error("Google AI API response error data:", error.response.data);
       console.error("Google AI API response status:", error.response.status);
    }
    res.status(500).json({ error: 'Не удалось получить ответ от AI ассистента' });
  }
});


// --- Маршруты Шаблонов ---
app.get('/api/document-templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, template_fields, required_signatures
       FROM document_templates
       WHERE is_active = true
       ORDER BY name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({ message: 'Ошибка при получении шаблонов документов' });
  }
});


// --- Маршруты Подписей (QR-код) ---

// Маршрут для генерации URL/токена для страницы подписи
// authenticateToken: Требует, чтобы пользователь был авторизован для запроса QR.
app.get('/api/documents/:documentId/generate-signature-url/:slotName', authenticateToken, async (req, res) => {
  const { documentId, slotName } = req.params;
  const userId = req.user.id; // Пользователь, который запрашивает QR
  const userRole = req.user.role; // Роль пользователя, который запрашивает QR

  try {
      const docResult = await pool.query(
          'SELECT d.id, d.template_id, dt.required_signatures, d.student_id, dt.name as template_name FROM documents d LEFT JOIN document_templates dt ON d.template_id = dt.id WHERE d.id = $1',
          [documentId]
      );
      const document = docResult.rows[0];
      if (!document) { return res.status(404).json({ message: 'Документ или шаблон не найден' }); }
      const requiredSignatures = document.required_signatures;
      const requestedSlotExistsInTemplate = requiredSignatures && Array.isArray(requiredSignatures) && requiredSignatures.some(sig => sig.role === slotName);
      if (!requestedSlotExistsInTemplate) { return res.status(400).json({ message: `Слот подписи "${slotName}" не найден в шаблоне документа.` }); }

      // 2. Проверка прав пользователя на генерацию ссылки для ЭТОГО слота ЭТОГО документа
      let canGenerate = false;
      const digitalSignerRoles = ['admin', 'curator', 'dean'];
      const isRequestedSlotDigital = digitalSignerRoles.includes(slotName);

      if (isRequestedSlotDigital) {
           if (userRole === 'admin') { canGenerate = true; }
           else if (userRole === slotName) { // Если роль пользователя совпадает с именем запрашиваемого слота
               if (userRole === 'curator') { // Для куратора дополнительно проверяем группу
                   const curatorCheck = await pool.query(`SELECT 1 FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE sg.student_id = $1 AND g.curator_id = $2`, [document.student_id, userId]);
                   if (curatorCheck.rows.length > 0) canGenerate = true;
               } else { canGenerate = true; }
           }
      }

       if (!canGenerate) { return res.status(403).json({ message: `Недостаточно прав для генерации ссылки на подпись для слота "${slotName}".` }); }

       // 3. Проверка, не подписан ли уже этот слот
       const existingSignature = await pool.query(
           'SELECT id FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
           [documentId, slotName]
       );
       if (existingSignature.rows.length > 0) { return res.status(400).json({ message: `Слот подписи "${slotName}" для этого документа уже подписан.` }); }

      // 4. Генерируем токен
      // Токен содержит данные для страницы подписи
      const payload = {
          docId: documentId,
          slot: slotName,
          // signerUserId: userId, // ID пользователя, который ГЕНЕРИРУЕТ ссылку (Предполагается, он же и подпишет)
          // signerName: req.user.name, // Имя пользователя, который ГЕНЕРИРУЕТ
          // Передаем информацию о том, кто ДОЛЖЕН подписать, из БД users по signerUserId
          // Это будет определено на стороне SignatureCanvasPage после валидации токена на бэкенде (см. validate-signature-token)
      };

      // Получаем имя подписанта из БД users для signerUserId, который инициировал QR
      let signerNameFromDb = req.user.name; // По умолчанию имя текущего пользователя
      try {
          const signerUserResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
          if(signerUserResult.rows.length > 0) {
              signerNameFromDb = signerUserResult.rows[0].full_name;
          }
      } catch(nameError) {
           console.error('Error fetching signer name for token payload:', nameError);
      }


      const tokenPayload = {
           docId: documentId,
           slot: slotName,
           signerUserId: userId, // Передаем ID пользователя, который ГЕНЕРИРУЕТ QR
           signerName: signerNameFromDb, // Передаем имя пользователя, который ГЕНЕРИРУЕТ
           documentTitle: document.template_name || 'Документ', // Передаем название шаблона/документа
      };


      const token = jwt.sign(tokenPayload, JWT_SECRET); //, { expiresIn: '3h' });

      console.log("DEBUG: JWT_SECRET used for SIGNING:", JWT_SECRET);

      // TODO: Надежное управление токенами в БД: сохранение, проверка использования, инвалидация.
      // CREATE TABLE signature_tokens (token VARCHAR(255) PRIMARY KEY, document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE, signature_slot_name VARCHAR(100), signer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, expires_at TIMESTAMP WITH TIME ZONE, is_used BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
      // INSERT INTO signature_tokens (token, document_id, signature_slot_name, signer_user_id, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '3 hour')
      // При получении подписи: SELECT ... WHERE token = $1 AND expires_at > NOW() AND is_used = FALSE; UPDATE ... SET is_used = TRUE;


      // 5. Формируем URL страницы подписи на фронтенде
      const signaturePageUrl = `${FRONTEND_BASE_URL}/sign?token=${token}`;

      res.json({ signatureUrl: signaturePageUrl });

  } catch (error) { console.error('Error generating signature URL:', error); res.status(500).json({ message: 'Ошибка при генерации ссылки для подписи.' }); }
});


// Маршрут для получения данных о документе/подписанте по токену подписи (для SignatureCanvasPage)
// Не требует авторизации в основной системе.
app.get('/api/signatures/validate-token', async (req, res) => {
  const token = req.query.token;

  if (!token) { return res.status(400).json({ message: 'Отсутствует токен подписи.' }); }

  try {
      console.log("DEBUG: JWT_SECRET used for VALIDATING (validate-token):", JWT_SECRET);
      const decodedPayload = jwt.verify(token, JWT_SECRET);

      // TODO: Проверка токена в БД (signature_tokens): существует, не просрочен, не использован
      // Это критически важно для безопасности.

      const { docId, slot, signerUserId } = decodedPayload;

      const docResult = await pool.query(
          'SELECT d.id, d.title, dt.required_signatures, dt.name as template_name FROM documents d LEFT JOIN document_templates dt ON d.template_id = dt.id WHERE d.id = $1',
          [docId]
      );
      const document = docResult.rows[0];
      if (!document) { throw new Error('Document not found for token.'); }
      const requiredSignatures = document.required_signatures;
      const slotExistsInTemplate = requiredSignatures && Array.isArray(requiredSignatures) && requiredSignatures.some(sig => sig.role === slot);
      if (!slotExistsInTemplate) { throw new Error(`Slot "${slot}" not found in document template.`); }

       let signerName = 'Неизвестный подписант';
       if (signerUserId) {
           const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [signerUserId]);
           if (userResult.rows.length > 0) { signerName = userResult.rows[0].full_name; }
       }

      res.json({
          documentId: docId, slotName: slot, signerUserId: signerUserId,
          signerName: signerName,
          documentTitle: document.title || document.template_name || 'Документ',
      });

  } catch (err) {
      console.error('Token validation failed on /validate-token:', err.message);
      res.status(401).json({ message: 'Недействительный, просроченный или некорректный токен подписи.' });
  }
});


// Маршрут для приема данных подписи (ожидает JSON с полями 'token' и 'imageData')
// Доступен без авторизации в основной системе.
app.post('/api/signatures/upload', async (req, res) => {
    const { token, imageData } = req.body;
    if (!token || !imageData) { return res.status(400).json({ message: 'Отсутствует токен или данные изображения.' }); }

    // 1. Валидация токена и проверка его использования в БД
    let decodedPayload;
    try {
        console.log("DEBUG: JWT_SECRET used for VALIDATING (upload):", JWT_SECRET);
        decodedPayload = jwt.verify(token, JWT_SECRET);
        // TODO: Проверка токена в БД (signature_tokens): существует, не просрочен, не использован. Пометить как использованный.
        // Это критически важно для безопасности.
    } catch (err) { console.error('Token validation failed on /signatures/upload:', err.message); return res.status(401).json({ message: 'Недействительный или просроченный токен подписи.' }); }

    const { docId, slot, signerUserId } = decodedPayload;
    let signedAsName = decodedPayload.signerName || 'Неизвестный подписант';
     if (signerUserId && !decodedPayload.signerName) {
         try { const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [signerUserId]); if(userResult.rows.length > 0) { signedAsName = userResult.rows[0].full_name; } } catch(nameError) { console.error('Error fetching signer name for DB save:', nameError); }
    }


    try {
         // 2. Проверка, не подписан ли уже этот слот
         const existingSignature = await pool.query(
             'SELECT id FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
             [docId, slot]
         );
         if (existingSignature.rows.length > 0) { return res.status(200).json({ message: `Слот подписи "${slot}" для этого документа уже был подписан.`, signatureId: existingSignature.rows[0].id }); }

        // 3. Декодирование Base64
        const base64Parts = imageData.split(';base64,'); if (base64Parts.length !== 2) { return res.status(400).json({ message: 'Некорректный формат данных изображения (ожидается Base64 Data URL).' }); }
        const imageType = base64Parts[0].split(':')[1]; const base64Data = base64Parts[1]; let imageBuffer; try { imageBuffer = Buffer.from(base64Data, 'base64'); } catch (e) { console.error('Base64 decoding failed:', e); return res.status(400).json({ message: 'Некорректные данные Base64 изображения.' }); }

        // 4. Отправка в FastAPI
        const uploadSignatureUrl = `${FASTAPI_STORAGE_URL}/upload_signature`; const formData = new FormData(); const fileExtension = imageType.split('/')[1] || 'png'; const filename = `signature_${docId}_${slot}_${Date.now()}.${fileExtension}`; formData.append('file', imageBuffer, { filename: filename, contentType: imageType });
         const fastapiResponse = await axios.post(uploadSignatureUrl, formData, { headers: { ...formData.getHeaders() }, maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 10000 }); const signatureImageUuid = fastapiResponse.data?.uuid;
        if (!signatureImageUuid) { console.error('FastApi did not return signature UUID:', fastapiResponse.data); return res.status(500).json({ message: 'Ошибка сервиса хранения подписи: UUID не получен от хранилища.' }); }

        // 5. Сохранение в БД (document_signatures)
        const result = await pool.query(
            `INSERT INTO document_signatures (document_id, signature_slot_name, signed_by_user_id, signature_image_uuid, signed_as_name, status, signed_at)
             VALUES ($1, $2, $3, $4, $5, 'signed', CURRENT_TIMESTAMP) RETURNING id`,
            [docId, slot, signerUserId, signatureImageUuid, signedAsName]
        ); const newSignatureId = result.rows[0].id; console.log(`Signature saved for document ${docId}, slot ${slot}, signature_id ${newSignatureId}`);

        // 6. TODO: Обновление статуса документа (если все требуемые подписи собраны).
        // Это комплексная логика, требующая сравнения document_signatures с document_templates.required_signatures.


        // 7. TODO: Уведомить фронтенд (страницу создания/просмотра) о завершении подписи (через WS/Polling).


        res.status(200).json({ message: 'Подпись успешно сохранена.', signatureId: newSignatureId });

    } catch (error) { console.error('Error saving signature:', error); if (error.response) { console.error('Fastapi/other response data:', error.response.data); console.error('Fastapi/other response status:', error.response.status); } else if (error.request) { console.error('Fastapi/other request error:', error.request); } res.status(500).json({ message: 'Ошибка при сохранении подписи.' }); }
});


// Маршрут для получения статуса подписи для конкретного слота документа (для опроса с фронтенда)
// Доступен без авторизации в основной системе, по documentId и slotName.
// TODO: Добавить ограничение доступа к этому маршруту (например, только авторизованным пользователям, связанным с документом)
app.get('/api/documents/:documentId/signature-status/:slotName', async (req, res) => {
    const { documentId, slotName } = req.params;
    try {
        const result = await pool.query(
            'SELECT status, signed_at, signed_as_name FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
            [documentId, slotName]
        );
        if (result.rows.length === 0) { return res.status(200).json({ status: 'pending', message: 'Подпись для слота не найдена.' }); }
        const signatureStatus = result.rows[0];
        res.status(200).json({ status: signatureStatus.status, signedAt: signatureStatus.signed_at, signedByName: signatureStatus.signed_as_name, message: `Статус подписи: ${signatureStatus.status}` });
    } catch (error) { console.error('Error fetching signature status:', error); res.status(500).json({ message: 'Ошибка при получении статуса подписи.' }); }
});




// --- Запуск сервера ---
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});