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
const path = require('path');
const qrcode = require('qrcode');
const { Buffer } = require('buffer');


const app = express();
const port = 7000;

app.use((req, res, next) => {
  console.log(`DEBUG: --> Received Request: ${req.method} ${req.originalUrl || req.url}`);
  next();
});

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

// Добавьте проверку, что JWT_SECRET загружен
const JWT_SECRET = process.env.JWT_SECRET || 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBUSgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsZZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==';
if (JWT_SECRET === 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBUSgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsZZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==') {
    console.warn("WARNING: JWT_SECRET is using a default placeholder. Please set JWT_SECRET in your .env file for production!");
}

// Убедитесь, что эти URL загружаются из .env или конфигурации
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://192.168.0.104:3000';
const FASTAPI_STORAGE_URL = process.env.FASTAPI_STORAGE_URL || 'http://192.168.0.104:8000/api/v1';

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
    // payload токена доступен в req.user
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
        role: user.role,
        full_name: user.full_name // Добавляем full_name в токен для удобства
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
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'curator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { role, curator_id } = req.query;
    let query = 'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users';
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push('role = $' + (conditions.length + 1));
      params.push(role);
    }

    if (role === 'student' && curator_id) {
        if (req.user.role === 'curator' && req.user.id.toString() !== curator_id.toString()) {
             return res.status(403).json({ message: 'Недостаточно прав для запроса студентов других кураторов' });
        }
        conditions.push('id IN (SELECT student_id FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE g.curator_id = $' + (conditions.length + 1) + ')');
        params.push(curator_id);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
  }
});


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
       LEFT JOIN student_groups sg ON u.id = sg.student_id AND sg.is_active = true
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
             d.original_filename, d.content_type,
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
        name: doc.title || doc.original_filename || 'Без названия',
        type: doc.content_type ? doc.content_type.split('/')[1].toUpperCase() : (doc.original_filename ? path.extname(doc.original_filename).slice(1).toUpperCase() || 'Файл' : 'Файл'),
        status: doc.status,
        date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна',
        student_id: doc.student_id,
        student_name: doc.student_name || 'Неизвестно',
        file_url: doc.file_url,
        original_filename: doc.original_filename,
        content_type: doc.content_type,
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


app.put('/api/documents/:id/status', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    const { status, review_comment } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    if (!['admin', 'curator'].includes(userRole)) {
        return res.status(403).json({ message: 'Недостаточно прав для изменения статуса документа' });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'archived', 'new', 'draft', 'submitted'];
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

        // TODO: Добавить логику создания уведомления при изменении статуса документа.
        // Например, уведомить студента и родителя, если статус стал 'approved' или 'rejected'.
        // Пример:
        // if (status === 'approved' || status === 'rejected') {
        //      const docOwnerResult = await pool.query('SELECT student_id FROM documents WHERE id = $1', [documentId]);
        //      const studentId = docOwnerResult.rows[0]?.student_id;
        //      if (studentId) {
        //          // Найти родителей студента
        //          const parentIdsResult = await pool.query('SELECT parent_id FROM parent_students WHERE student_id = $1', [studentId]);
        //          const recipientUserIds = [studentId, ...parentIdsResult.rows.map(row => row.parent_id)];
        //          const notificationTitle = `Документ "${document.title}" ${status === 'approved' ? 'одобрен' : 'отклонен'}`;
        //          const notificationMessage = review_comment ? `Комментарий: ${review_comment}` : '';
        //          // Вызвать функцию создания уведомлений для recipientUserIds
        //          // await createNotificationsForUsers(recipientUserIds, notificationTitle, notificationMessage, 'document', documentId);
        //      }
        // }


        res.status(200).json({ message: `Статус документа успешно обновлен на "${status}"` });

    } catch (error) {
        console.error('Error updating document status:', error);
        res.status(500).json({ message: 'Ошибка сервера при обновлении статуса документа' });
    }
});


app.get('/api/documents/:id/download', authenticateToken, async (req, res) => {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const fastapiServiceUrl = `${FASTAPI_STORAGE_URL}/open_file/`;

    try {
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
        const originalFilename = document.original_filename || 'document';
        const contentType = document.content_type || 'application/octet-stream';


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


        try {
            const fastapiResponse = await axios.get(`${fastapiServiceUrl}?pdf_uuid=${fileUuid}`, {
                responseType: 'stream',
            });

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);

            fastapiResponse.data.pipe(res);

        } catch (fastapiError) {
            console.error('Error requesting file from FastAPI service:', fastapiError.message);
             if (fastapiError.response) {
                 if (fastapiError.response.status === 404) {
                    return res.status(404).json({ message: 'Файл не найден во внешнем хранилище.' });
                }
                 console.error('FastAPI response status:', fastapiError.response.status);
                 console.error('FastAPI response data:', fastapiError.response.data);
            } else {
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
      `SELECT id, name, description, template_fields, required_signatures, html_template
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

    if (!file_url && !template_id && !req.body.uploaded_file_details) {
         return res.status(400).json({ message: 'Для создания документа требуется либо URL файла, либо данные загруженного файла, либо шаблон.' });
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
    if (error.code === '23503') {
        return res.status(400).json({ message: 'Указаны неверные данные студента или шаблона.' });
    }
    res.status(500).json({ message: 'Ошибка при создании документа.' });
  }
});



app.post('/api/documents/upload', authenticateToken, upload.single('document'), async (req, res) => {
  try {
      const uploadedFile = req.file;
      const { name, student_id, status, submitted_by, template_id, content } = req.body;

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


      const fastapiServiceUrl = `${FASTAPI_STORAGE_URL}/upload_pdf/`;
      const formDataFastAPI = new FormData();

      formDataFastAPI.append('file', uploadedFile.buffer, uploadedFile.originalname);

      try {
          const fastapiResponse = await axios.post(fastapiServiceUrl, formDataFastAPI, {
              headers: {
                   ...formDataFastAPI.getHeaders()
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 60000
          });

          const fileUuid = fastapiResponse.data?.uuid;

          if (!fileUuid) {
               console.error('FastAPI did not return file UUID:', fastapiResponse.data);
               if (fastapiResponse.status >= 400) {
                    const fastapiErrorMessage = fastapiResponse.data?.detail || `Сервис хранения вернул ошибку ${fastapiResponse.status}`;
                    return res.status(fastapiResponse.status).json({ message: `Ошибка сервиса хранения: ${fastapiErrorMessage}` });
               }
              return res.status(500).json({ message: 'Сервис хранения не вернул идентификатор файла.' });
          }
           console.log(`File uploaded to FastAPI, UUID: ${fileUuid}`);


           const groupResult = await pool.query(
              'SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = true',
              [student_id]
           );
           const group_id = groupResult.rows[0]?.group_id || null;

           const initialStatus = status || 'pending';


          const result = await pool.query(
            `INSERT INTO documents
             (title, status, student_id, group_id, file_url, submitted_by, original_filename, content_type, template_id, content)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, created_at`,
            [
                name || uploadedFile.originalname,
                initialStatus,
                student_id,
                group_id,
                fileUuid,
                submitted_by,
                uploadedFile.originalname,
                uploadedFile.mimetype,
                template_id || null,
                content || null
            ]
          );

          console.log(`Document entry created in DB with ID: ${result.rows[0].id}`);

          res.status(201).json({
            message: 'Документ успешно загружен и зарегистрирован',
            documentId: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            fileUuid: fileUuid
          });

      } catch (fastapiError) {
          console.error('Error forwarding file to FastAPI service or creating DB entry:', fastapiError);
          if (fastapiError.response) {
             const fastapiErrorMessage = fastapiError.response.data?.detail || `Сервис хранения вернул ошибку ${fastapiError.response.status}`;
             return res.status(fastapiError.response.status >= 400 ? fastapiError.response.status : 500).json({ message: `Ошибка сервиса хранения: ${fastapiErrorMessage}` });
          } else if (fastapiError.request) {
              console.error('FastAPI request error:', fastapiError.request);
               return res.status(500).json({ message: `Ошибка связи с сервисом хранения: ${fastapiError.message}` });
          }
          res.status(500).json({ message: `Ошибка сервера при обработке загрузки документа: ${fastapiError.message}` });

      }
  } catch (error) {
    console.error('Upload document (Node.js handler) initial error:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке документа.' });
  }
});


// --- Маршруты Запросов ---
app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { title, description, type, status, urgency, student_id, document_id, assigned_to } = req.body;

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
      [title, description, type, status || 'new', urgency || 'normal', student_id, document_id, assigned_to, req.user.id]
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

    if (req.user.role === 'student') {
        query += ` AND r.student_id = $${paramIndex}`;
        params.push(req.user.id);
        paramIndex++;
    } else if (req.user.role === 'parent') {
         query += ` AND r.student_id IN (SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex})`;
         params.push(req.user.id);
         paramIndex++;
    } else if (req.user.role === 'curator') {
         query += ` AND (r.student_id IN (SELECT sg.student_id FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE g.curator_id = $${paramIndex}) OR r.assigned_to = $${paramIndex})`;
         params.push(req.user.id, req.user.id);
         paramIndex += 2;
    }

    if (studentId && ['admin', 'curator', 'parent'].includes(req.user.role)) {
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

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || 'AIzaSyBChhrfQTXMPXYNLRmmlZnRJaJkWgvARD4';

if (!GOOGLE_AI_API_KEY || GOOGLE_AI_API_KEY === 'AIzaSyBChhrfQTXMPXYNLRmmlZnRJaJkWgvARD4') {
  console.warn("WARNING: GOOGLE_AI_API_KEY is missing or using a default placeholder. AI functionality may not work.");
}

const genAI = GOOGLE_AI_API_KEY && GOOGLE_AI_API_KEY !== 'AIzaSyBChhrfQTXMPXYNLRmmlZnRJaJkWgvARD4' ? new GoogleGenerativeAI(GOOGLE_AI_API_KEY) : null;


app.post('/api/chat-with-ai', authenticateToken, async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!genAI) {
         console.error("Google Generative AI not initialized due to missing or default API key.");
         return res.status(500).json({ error: 'AI service is not available (missing API key)' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


    const result = await model.generateContent(userMessage);
    const response = await result.response;
    const text = response.text();

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
      `SELECT id, name, description, template_fields, required_signatures, html_template
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

app.get('/api/documents/:documentId/generate-signature-url/:slotName', authenticateToken, async (req, res) => {
  const { documentId, slotName } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
      const docResult = await pool.query(
          'SELECT d.id, d.template_id, d.student_id FROM documents d WHERE d.id = $1',
          [documentId]
      );
      const document = docResult.rows[0];
      if (!document) {
          return res.status(404).json({ message: 'Документ не найден' });
      }

      if (!document.template_id) {
          return res.status(400).json({ message: `Документ ID ${documentId} не связан с шаблоном. Невозможно сгенерировать ссылку подписи.` });
      }

      const templateResult = await pool.query(
          'SELECT required_signatures, name as template_name FROM document_templates WHERE id = $1',
          [document.template_id]
      );
      const template = templateResult.rows[0];

      const requiredSignatures = template.required_signatures;
       const requestedSlotExistsInTemplate = requiredSignatures && Array.isArray(requiredSignatures) && requiredSignatures.some(sig => {
           return sig.role === slotName;
       });
       if (!requestedSlotExistsInTemplate) {
           return res.status(400).json({ message: `Слот подписи "${slotName}" не найден в шаблоне документа.` });
       }

      let userCanGenerate = false;
      const digitalSignerRoles = ['admin', 'curator', 'dean'];
      const isRequestedSlotDigital = digitalSignerRoles.includes(slotName);

      if (isRequestedSlotDigital) {
           const isAdminGenerating = (userRole === 'admin');
           if (isAdminGenerating) {
                userCanGenerate = true;
           } else {
               let isRoleMatchingGenerating = false;
               if (userRole === slotName) {
                   if (userRole === 'curator') {
                       const curatorCheck = await pool.query(`SELECT 1 FROM student_groups sg JOIN groups g ON sg.group_id = g.id WHERE sg.student_id = $1 AND g.curator_id = $2`, [document.student_id, userId]);
                       isRoleMatchingGenerating = curatorCheck.rows.length > 0;
                   } else {
                       isRoleMatchingGenerating = true;
                   }

                   if (isRoleMatchingGenerating) {
                        userCanGenerate = true;
                   }
               }
           }
      }

   if (!userCanGenerate) {
       return res.status(403).json({ message: `Недостаточно прав для генерации ссылки на подпись для слота "${slotName}".` });
   }

   const existingSignature = await pool.query(
       'SELECT id FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
       [documentId, slotName]
   );
   if (existingSignature.rows.length > 0) {
       return res.status(400).json({ message: `Слот подписи "${slotName}" для этого документа уже был подписан.` });
   }

   const signerNameFromDb = req.user.full_name || req.user.name;
   const tokenPayload = {
        docId: documentId,
        slot: slotName,
        signerUserId: userId,
        signerName: signerNameFromDb,
        documentTitle: template.template_name || 'Документ',
   };

   const token = jwt.sign(tokenPayload, JWT_SECRET);
   const signaturePageUrl = `${FRONTEND_BASE_URL}/sign?token=${token}`;

   res.json({ signatureUrl: signaturePageUrl });


  } catch (error) {
      console.error('Error generating signature URL:', error);
      res.status(500).json({ message: 'Ошибка при генерации ссылки для подписи.' });
  }
});


app.get('/api/signatures/validate-token', async (req, res) => {
  const token = req.query.token;

  if (!token) { return res.status(400).json({ message: 'Отсутствует токен подписи.' }); }

  try {
      const decodedPayload = jwt.verify(token, JWT_SECRET);

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

       let signerName = decodedPayload.signerName || 'Неизвестный подписант'; // Use name from token payload first
       if (signerUserId) {
           const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [signerUserId]);
           if (userResult.rows.length > 0) { signerName = userResult.rows[0].full_name; } // Override if user found
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


app.get('/api/signatures/:signatureUuid/image', async (req, res) => {
  const { signatureUuid } = req.params;
  try {
      const fastapiImageUrl = `${FASTAPI_STORAGE_URL}/open_signature/${signatureUuid}`;

      const fastapiResponse = await axios.get(fastapiImageUrl, {
          responseType: 'stream',
          timeout: 10000
      });

      const contentType = fastapiResponse.headers['content-type'] || 'image/png';
      res.setHeader('Content-Type', contentType);
      fastapiResponse.data.pipe(res);

  } catch (error) {
      console.error('Error fetching signature image from FastAPI:', error);
       if (error.response) {
           console.error('FastAPI response status:', error.response.status);
           console.error('FastAPI response data:', error.response.data);
       } else if (error.request) {
           console.error('FastAPI request error:', error.request);
       }
      if (!res.headersSent) {
         res.status(500).json({ message: 'Ошибка при получении изображения подписи.' });
      }
  }
});



app.post('/api/signatures/upload', async (req, res) => {
    const { token, imageData, signerName: nameFromBody } = req.body;
    if (!token || !imageData) { return res.status(400).json({ message: 'Отсутствует токен или данные изображения.' }); }

    const client = await pool.connect();
    let decodedPayload;
    try {
        await client.query('BEGIN');

        decodedPayload = jwt.verify(token, JWT_SECRET);

        const { docId, slot, signerUserId } = decodedPayload;

        // Determine signedAsName
        let signedAsName = decodedPayload.signerName || nameFromBody || 'Неизвестный подписант';
         if (signerUserId) {
             try {
                 const userResult = await client.query('SELECT full_name FROM users WHERE id = $1', [signerUserId]);
                 if (userResult.rows.length > 0) {
                     signedAsName = userResult.rows[0].full_name;
                 }
             } catch(nameError) { console.error('Error fetching signer name for DB save:', nameError); }
        }

         const existingSignature = await client.query(
             'SELECT id FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
             [docId, slot]
         );
         if (existingSignature.rows.length > 0) {
              await client.query('ROLLBACK');
              return res.status(200).json({ message: `Слот подписи "${slot}" для этого документа уже был подписан.`, signatureId: existingSignature.rows[0].id });
         }

        const base64Parts = imageData.split(';base64,'); if (base64Parts.length !== 2) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Некорректный формат данных изображения (ожидается Base64 Data URL).' }); }
        const imageType = base64Parts[0].split(':')[1]; const base64Data = base64Parts[1]; let imageBuffer; try { imageBuffer = Buffer.from(base64Data, 'base64'); } catch (e) { console.error('Base64 decoding failed:', e); await client.query('ROLLBACK'); return res.status(400).json({ message: 'Некорректные данные Base64 изображения.' }); }

        const uploadSignatureUrl = `${FASTAPI_STORAGE_URL}/upload_signature`;
        const formData = new FormData();
        const fileExtension = imageType.split('/')[1] || 'png';
        const filename = `signature_${docId}_${slot}_${Date.now()}.${fileExtension}`;
        formData.append('file', imageBuffer, { filename: filename, contentType: imageType });

         const fastapiResponse = await axios.post(uploadSignatureUrl, formData, {
             headers: { ...formData.getHeaders() },
             maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 10000
         });
        const signatureImageUuid = fastapiResponse.data?.uuid;
        if (!signatureImageUuid) {
             console.error('FastAPI did not return signature UUID:', fastapiResponse.data);
             await client.query('ROLLBACK');
             return res.status(500).json({ message: 'Ошибка сервиса хранения подписи: UUID не получен от хранилища.' });
        }

        const result = await client.query(
            `INSERT INTO document_signatures (document_id, signature_slot_name, signed_by_user_id, signature_image_uuid, signed_as_name, status, signed_at)
             VALUES ($1, $2, $3, $4, $5, 'signed', CURRENT_TIMESTAMP) RETURNING id`,
            [docId, slot, signerUserId, signatureImageUuid, signedAsName]
        );
        const newSignatureId = result.rows[0].id;

        // TODO: Logic to check if all required signatures are gathered and update document status
        // This involves querying document_templates and document_signatures within the transaction.
        // Example (Simplified):
        // const docTemplateResult = await client.query('SELECT dt.required_signatures FROM documents d JOIN document_templates dt ON d.template_id = dt.id WHERE d.id = $1', [docId]);
        // const requiredDigitalRoles = docTemplateResult.rows[0]?.required_signatures.filter(sig => ['admin', 'curator', 'dean'].includes(sig.role)).map(sig => sig.role) || [];
        // if (requiredDigitalRoles.length > 0) {
        //     const signedSlotsResult = await client.query('SELECT signature_slot_name FROM document_signatures WHERE document_id = $1 AND status = \'signed\'', [docId]);
        //     const signedSlots = signedSlotsResult.rows.map(row => row.signature_slot_name);
        //     const allRequiredSigned = requiredDigitalRoles.every(role => signedSlots.includes(role));
        //     if (allRequiredSigned) {
        //         await client.query('UPDATE documents SET status = \'approved\' WHERE id = $1', [docId]);
        //         console.log(`Document ${docId} status updated to 'approved' as all required signatures are gathered.`);
        //     }
        // }


        await client.query('COMMIT');

        // TODO: Notify relevant parties (e.g., student, curator) about the signature

        res.status(200).json({ message: 'Подпись успешно сохранена.', signatureId: newSignatureId, signatureImageUuid: signatureImageUuid });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving signature (transaction rolled back):', error);
         if (error.response) { console.error('FastAPI/other response data:', error.response.data); console.error('FastAPI/other response status:', error.response.status); }
         else if (error.request) { console.error('FastAPI/other request error:', error.request); }
        res.status(500).json({ message: 'Ошибка при сохранении подписи.' });
    } finally {
        client.release();
    }
});


app.get('/api/documents/:documentId/signature-status/:slotName', async (req, res) => {
  const { documentId, slotName } = req.params;
  try {
      const result = await pool.query(
          'SELECT status, signed_at, signed_as_name, signature_image_uuid FROM document_signatures WHERE document_id = $1 AND signature_slot_name = $2',
          [documentId, slotName]
      );

      if (result.rows.length === 0) {
          return res.status(200).json({ status: 'pending', message: 'Подпись для слота не найдена.' });
      }

      const signatureStatus = result.rows[0];
      res.status(200).json({
           status: signatureStatus.status,
           signedAt: signatureStatus.signed_at,
           signedByName: signatureStatus.signed_as_name,
           signatureImageUuid: signatureStatus.signature_image_uuid,
           message: `Статус подписи: ${signatureStatus.status}`
      });

  } catch (error) { console.error('Error fetching signature status:', error); res.status(500).json({ message: 'Ошибка при получении статуса подписи.' }); }
});


// --- НОВЫЕ МАРШРУТЫ УВЕДОМЛЕНИЙ ---

// GET /api/notifications - Получить уведомления для текущего пользователя
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit, offset } = req.query; // status: 'all', 'read', 'unread'

        let query = `
            SELECT id, title, message, type, is_read, created_at
            FROM notifications
            WHERE user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2;

        if (status === 'read') {
            query += ` AND is_read = TRUE`;
        } else if (status === 'unread') {
            query += ` AND is_read = FALSE`;
        }
        // Если status не указан или 'all', фильтрация по is_read не добавляется

        query += ` ORDER BY created_at DESC`;

        if (limit !== undefined && offset !== undefined) {
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            // paramIndex += 2; // Не нужно увеличивать paramIndex после LIMIT/OFFSET
        }


        const result = await pool.query(query, params);

        // Форматируем дату и, возможно, добавляем иконки (хотя иконки лучше на фронте)
        const formattedNotifications = result.rows.map(notif => ({
            ...notif,
            date: notif.created_at.toISOString(), // Отправляем в ISO формате, фронтенд отформатирует
            read: notif.is_read, // Переименовываем is_read в read для соответствия фронтенду
        }));

        // TODO: Добавить подсчет общего количества уведомлений (для пагинации)
        // const countQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1 ${status === 'read' ? 'AND is_read = TRUE' : status === 'unread' ? 'AND is_read = FALSE' : ''}`;
        // const countResult = await pool.query(countQuery, [userId]);
        // const total = parseInt(countResult.rows[0].count, 10);


        res.json({
             items: formattedNotifications,
             // total: total, // Включить после реализации countQuery
             // limit: parseInt(limit, 10) || undefined, // Включить после реализации countQuery
             // offset: parseInt(offset, 10) || 0, // Включить после реализации countQuery
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Ошибка при получении уведомлений.' });
    }
});


// PUT /api/notifications/:id/read - Отметить конкретное уведомление как прочитанное
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING id`, // Возвращаем id обновленной записи
            [notificationId, userId]
        );

        if (result.rowCount === 0) {
            // Уведомление не найдено или не принадлежит текущему пользователю
            return res.status(404).json({ message: 'Уведомление не найдено или у вас нет прав на его изменение.' });
        }

        res.status(200).json({ message: 'Уведомление отмечено как прочитанное.', notificationId: notificationId });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Ошибка при отметке уведомления как прочитанного.' });
    }
});


// PUT /api/notifications/mark-all-read - Отметить все непрочитанные уведомления как прочитанные
app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );

        // Возвращаем количество обновленных записей
        res.status(200).json({ message: `Отмечено как прочитанное ${result.rowCount} уведомлений.`, updatedCount: result.rowCount });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Ошибка при отметке всех уведомлений как прочитанных.' });
    }
});


// Helper function to resolve recipient criteria into a list of user IDs
// Handles roles, groups, 'all_users', and potentially individual user IDs
const resolveRecipients = async (recipientCriteria) => {
    const client = await pool.connect(); // Используем клиента из пула
    const userIds = new Set(); // Используем Set для автоматического удаления дубликатов

    try {
        for (const criteria of recipientCriteria) {
            if (criteria === 'all_users') {
                const result = await client.query('SELECT id FROM users WHERE is_active = TRUE');
                result.rows.forEach(row => userIds.add(row.id));
            } else if (['admin', 'curator', 'parent', 'student'].includes(criteria)) {
                const result = await client.query('SELECT id FROM users WHERE role = $1 AND is_active = TRUE', [criteria]);
                result.rows.forEach(row => userIds.add(row.id));
            } else if (criteria.startsWith('group:')) {
                const groupName = criteria.substring('group:'.length);
                const groupResult = await client.query('SELECT id FROM groups WHERE name = $1 AND is_active = TRUE', [groupName]);
                if (groupResult.rows.length > 0) {
                    const groupId = groupResult.rows[0].id;
                    // Получаем студентов группы
                    const studentResult = await client.query('SELECT student_id FROM student_groups WHERE group_id = $1 AND is_active = TRUE', [groupId]);
                    studentResult.rows.forEach(row => userIds.add(row.student_id));
                    // TODO: Возможно, добавить куратора группы и родителей студентов группы
                    // const curatorResult = await client.query('SELECT curator_id FROM groups WHERE id = $1', [groupId]);
                    // if (curatorResult.rows[0]?.curator_id) userIds.add(curatorResult.rows[0].curator_id);
                    // const studentIdsInGroup = studentResult.rows.map(row => row.student_id);
                    // if (studentIdsInGroup.length > 0) {
                    //     const parentResult = await client.query('SELECT parent_id FROM parent_students WHERE student_id = ANY($1::int[])', [studentIdsInGroup]);
                    //     parentResult.rows.forEach(row => userIds.add(row.parent_id));
                    // }
                }
            }
             // TODO: Добавить обработку 'user:userId' для отправки конкретному пользователю
            // else if (criteria.startsWith('user:')) {
            //     const targetUserId = parseInt(criteria.substring('user:'.length), 10);
            //     if (!isNaN(targetUserId)) {
            //          const userCheck = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [targetUserId]);
            //          if (userCheck.rows.length > 0) {
            //             userIds.add(targetUserId);
            //          }
            //     }
            // }
            else {
                console.warn(`Unknown recipient criteria: ${criteria}`);
            }
        }
    } catch (error) {
        console.error('Error in resolveRecipients:', error);
        throw error; // Пробрасываем ошибку выше
    } finally {
        client.release(); // Возвращаем клиента в пул
    }

    return Array.from(userIds); // Преобразуем Set обратно в массив
};


// POST /api/notifications - Создать новое уведомление (только для админа)
app.post('/api/notifications', authenticateToken, async (req, res) => {
    // Проверка, что пользователь является администратором
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав для создания уведомлений.' });
    }

    const { title, message, type, recipients } = req.body; // recipients - массив строк, e.g. ['curator', 'group:ПО2301']

    // Базовая валидация
    if (!title || !message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ message: 'Заголовок, сообщение и хотя бы один получатель обязательны.' });
    }

    const client = await pool.connect(); // Получаем клиента из пула
    try {
        await client.query('BEGIN'); // Начинаем транзакцию

        // Определяем финальный список user_id на основе recipientCriteria
        const recipientUserIds = await resolveRecipients(recipients);

        if (recipientUserIds.length === 0) {
             await client.query('ROLLBACK'); // Откатываем, если нет получателей
             return res.status(400).json({ message: 'Не удалось определить получателей на основе предоставленных критериев.' });
        }

        // Вставляем уведомления для каждого пользователя
        const insertQuery = `
            INSERT INTO notifications (title, message, type, user_id, is_read, created_at)
            VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)
        `;

        for (const userId of recipientUserIds) {
            await client.query(insertQuery, [title, message, type || 'general', userId]);
        }

        await client.query('COMMIT'); // Коммитим транзакцию

        res.status(201).json({
            message: `Уведомление успешно создано для ${recipientUserIds.length} пользователей.`,
            createdCount: recipientUserIds.length
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Откатываем транзакцию в случае любой ошибки
        console.error('Error creating notifications (transaction rolled back):', error);
        res.status(500).json({ message: 'Ошибка при создании уведомлений.' });
    } finally {
        client.release(); // Возвращаем клиента в пул
    }
});


// --- Запуск сервера ---
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});