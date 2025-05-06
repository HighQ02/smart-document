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
const { startOfMonth, endOfMonth, addDays, isValid, parseISO } = require('date-fns');

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
const JWT_SECRET = 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBUSgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsZZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==';
if (JWT_SECRET === 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBUSgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsZZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==') {
    console.warn("WARNING: JWT_SECRET is using a default placeholder. Please set JWT_SECRET in your .env file for production!");
}

// Убедитесь, что эти URL загружаются из .env или конфигурации
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
    // payload токена доступен в req.user
    req.user = user;
    next();
  });
};

// Функция для создания уведомлений для определенных пользователей
const createNotificationsForUsers = async (userIds, title, message, type, relatedEntityType = null, relatedEntityId = null, client = null) => {
  if (!userIds || userIds.length === 0) {
      console.warn("Attempted to create notifications but no userIds provided.");
      return 0;
  }
  if (!title || !message) {
       console.error("Attempted to create notification with missing title or message.");
       return 0;
  }

  // Use provided client if inside a transaction, otherwise get a new one
  const dbClient = client || await pool.connect();
  let createdCount = 0;
  let ownsClient = !client; // Flag to know if we need to release the client

  try {
      if (ownsClient) await dbClient.query('BEGIN'); // Start transaction if we got a new client

      const insertQuery = `
          INSERT INTO notifications (title, message, type, user_id, related_entity_type, related_entity_id, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP)
      `;

      // Use a Set to ensure uniqueness of recipients
      const uniqueUserIds = new Set(userIds.filter(id => id !== null && id !== undefined));

      for (const userId of uniqueUserIds) {
          try {
               // Проверяем, существует ли пользователь и активен ли он (опционально, но хорошая практика)
               // const userCheck = await dbClient.query('SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
               // if (userCheck.rows.length === 0) {
               //      console.warn(`Skipping notification for inactive or non-existent user ID: ${userId}`);
               //      continue; // Пропускаем пользователя, если не активен
               // }

              await dbClient.query(insertQuery, [title, message, type, userId, relatedEntityType, relatedEntityId]);
              createdCount++;
          } catch (insertError) {
              // Log the error but attempt to continue with other users in a broadcast
              console.error(`Failed to create notification for user ID ${userId}:`, insertError.message);
              // Depending on criticality, you might choose to throw here if even one fails
              // throw insertError; // uncomment to fail the whole operation if any insert fails
          }
      }

      if (ownsClient) await dbClient.query('COMMIT'); // Commit if we started the transaction
      console.log(`Successfully created ${createdCount} notifications.`);

  } catch (error) {
      if (ownsClient) await dbClient.query('ROLLBACK'); // Rollback if we started the transaction
      console.error('Transaction failed during notification creation:', error);
      throw error; // Rethrow to be caught by the caller's error handling
  } finally {
      if (ownsClient) dbClient.release(); // Release client if we got a new one
  }

  return createdCount;
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

// --- NEW ROUTE: GET /api/users/:id ---
// Get details for a specific user
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'Неверный формат ID пользователя' });
    }

    let client;
    try {
        client = await pool.connect();

        // Check authorization:
        // - Admin can view any user.
        // - User can view their own profile.
        // - Curator can view students and parents in their groups.
        // - Parent can view their children.
        let isAuthorized = false;
        if (requestingUserRole === 'admin') {
            isAuthorized = true;
        } else if (requestingUserId === targetUserId) {
            isAuthorized = true;
        } else if (requestingUserRole === 'curator') {
            // Check if target user is a student in the curator's group
            const studentInGroupCheck = await client.query(
                `SELECT 1 FROM student_groups sg
                 JOIN groups g ON sg.group_id = g.id
                 WHERE g.curator_id = $1 AND sg.student_id = $2`,
                [requestingUserId, targetUserId]
            );
            if (studentInGroupCheck.rows.length > 0) {
                isAuthorized = true;
            } else {
                // Check if target user is a parent of a student in the curator's group
                const parentOfStudentInGroupCheck = await client.query(
                    `SELECT 1 FROM parent_students ps
                     JOIN student_groups sg ON ps.student_id = sg.student_id
                     JOIN groups g ON sg.group_id = g.id
                     WHERE g.curator_id = $1 AND ps.parent_id = $2`,
                    [requestingUserId, targetUserId]
                );
                if (parentOfStudentInGroupCheck.rows.length > 0) {
                  isAuthorized = true;
                }
            }
        } else if (requestingUserRole === 'parent') {
            // Check if target user is a child of the parent
            const isMyChildCheck = await client.query(
                'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
                [requestingUserId, targetUserId]
            );
            if (isMyChildCheck.rows.length > 0) {
                isAuthorized = true;
            }
        }
        // Students cannot view arbitrary other users (handled by requestingUserId === targetUserId)


        if (!isAuthorized) {
            console.warn(`Authorization denied: User ${requestingUserId} (role: ${requestingUserRole}) attempted to view user ${targetUserId}`);
            return res.status(403).json({ message: 'Недостаточно прав для просмотра профиля этого пользователя' });
        }

        // Fetch user data (excluding sensitive fields like password hash)
        const result = await client.query(
            'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users WHERE id = $1',
            [targetUserId]
        );

        const user = result.rows[0];

        if (!user) {
            // This case should ideally not be reached if isAuthorized passed and targetUserId is valid
            // But as a safeguard, return 404 if user ID somehow doesn't exist
            console.warn(`User ${targetUserId} not found in DB after authorization check.`);
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Return user data
        res.json(user);

    } catch (error) {
        console.error(`Error fetching user ${targetUserId}:`, error);
        // Check for common DB errors like invalid ID format if not caught by isNaN
        if (error.code === '22P02') { // invalid text representation (e.g., non-numeric ID)
            return res.status(400).json({ message: 'Неверный формат ID пользователя.' });
        }
        res.status(500).json({ message: 'Ошибка сервера при получении данных пользователя' });
    } finally {
        if (client) client.release();
    }
});

// --- МАРШРУТ: PUT /api/users/:id ---
// Обновить данные для конкретного пользователя
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const { full_name, phone, role, is_active } = req.body; // Поля, разрешенные к обновлению через этот маршрут

    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'Неверный формат ID пользователя' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Начать транзакцию

        // 1. Получить существующие данные пользователя для проверок
        const existingUserResult = await client.query('SELECT id, role, is_active FROM users WHERE id = $1', [targetUserId]);
        const existingUser = existingUserResult.rows[0];

        if (!existingUser) {
            await client.query('ROLLBACK'); // Откатить транзакцию
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // 2. Проверки прав доступа: Кому разрешено редактировать ЭТОГО пользователя?
        let canEdit = false;
        let allowedFields = []; // Поля, которые разрешено редактировать

        // Пользователь может редактировать СВОЙ профиль (имя, телефон)
        if (requestingUserId === targetUserId) {
            canEdit = true;
            allowedFields = ['full_name', 'phone'];
        }
        // Админ может редактировать ЛЮБОГО (все поля)
        if (requestingUserRole === 'admin') {
            canEdit = true;
            allowedFields = ['full_name', 'phone', 'role', 'is_active'];
        }
        // Куратор может редактировать студентов и родителей в СВОИХ группах (ограниченные поля)
        if (requestingUserRole === 'curator') {
            // Проверка, является ли целевой пользователь студентом в группе куратора
            const studentInGroupCheck = await client.query(
                `SELECT 1 FROM student_groups sg
                 JOIN groups g ON sg.group_id = g.id
                 WHERE g.curator_id = $1 AND sg.student_id = $2`,
                [requestingUserId, targetUserId]
            );
            if (studentInGroupCheck.rows.length > 0) {
                canEdit = true;
                allowedFields = ['full_name', 'phone', 'is_active']; // Кураторы потенциально могут активировать/деактивировать своих студентов
            } else {
                // Проверка, является ли целевой пользователь родителем студента в группе куратора
                const parentOfStudentInGroupCheck = await client.query(
                    `SELECT 1 FROM parent_students ps
                     JOIN student_groups sg ON ps.student_id = sg.student_id
                     JOIN groups g ON sg.group_id = g.id
                     WHERE g.curator_id = $1 AND ps.parent_id = $2`,
                    [requestingUserId, targetUserId]
                );
                if (parentOfStudentInGroupCheck.rows.length > 0) {
                  canEdit = true;
                  allowedFields = ['full_name', 'phone']; // Кураторы могут редактировать имя/телефон родителей в своей группе
                }
            }
        }
        // Родитель может редактировать СВОИХ детей (ограниченные поля)
        if (requestingUserRole === 'parent') {
            // Проверка, является ли целевой пользователь ребенком текущего родителя
            const isMyChildCheck = await client.query(
                'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
                [requestingUserId, targetUserId]
            );
            if (isMyChildCheck.rows.length > 0) {
                canEdit = true;
                allowedFields = ['full_name', 'phone']; // Родители могут редактировать имя/телефон своих детей
            }
        }
        // Студенты не могут редактировать произвольных других пользователей (обработано requestingUserId === targetUserId)


        if (!canEdit) {
            await client.query('ROLLBACK'); // Откатить транзакцию
            console.warn(`Authorization denied: User ${requestingUserId} (role: ${requestingUserRole}) attempted to edit user ${targetUserId}`);
            return res.status(403).json({ message: 'Недостаточно прав для редактирования профиля этого пользователя' });
        }

        // 3. Валидация ввода и построение запроса UPDATE на основе разрешенных полей
        const updates = [];
        const queryParams = [targetUserId]; // Первый параметр для WHERE id = $1
        let paramIndex = 2; // Начинаем индексацию параметров для SET $2, $3, ...

        // Use the existing user data as a base and apply changes only for allowed fields
        // Note: Cloning existingUser here is not strictly necessary if we only update fields from req.body,
        // but useful if we needed to return the full updated object without another DB query.
        // The RETURNING clause handles getting the fresh data.


        // Проверяем, предоставлено ли поле в теле запроса (req.body) и разрешено ли его редактировать текущему пользователю
        // Используем 'in req.body' для проверки наличия поля, т.к. оно может быть null или пустым
        if ('full_name' in req.body && allowedFields.includes('full_name')) {
            // Дополнительная валидация: полное имя не должно быть пустым, если оно предоставлено
            if (typeof full_name === 'string' && full_name.trim().length === 0) {
                await client.query('ROLLBACK'); // Откатить транзакцию
                return res.status(400).json({ message: 'Полное имя не может быть пустым.' });
            }
            updates.push(`full_name = $${paramIndex}`);
            queryParams.push(full_name);
            paramIndex++;
        }

        if ('phone' in req.body && allowedFields.includes('phone')) {
            updates.push(`phone = $${paramIndex}`);
            queryParams.push(phone);
            paramIndex++;
        }

        // Роль может быть изменена только Админом
        // Проверяем, предоставлено ли поле 'role', является ли запрос от Админа И не пытается ли Админ изменить СВОЮ роль
        if ('role' in req.body && requestingUserRole === 'admin' && targetUserId !== requestingUserId) {
            // Валидация: роль должна быть одной из допустимых
            if (!['admin', 'curator', 'parent', 'student'].includes(role)) {
                await client.query('ROLLBACK'); // Откатить транзакцию
                return res.status(400).json({ message: 'Недопустимое значение роли' });
            }
            updates.push(`role = $${paramIndex}`);
            queryParams.push(role);
            paramIndex++;
        }

        // is_active может быть изменен только Админом или Куратором для их студентов
        // Проверяем, предоставлено ли поле 'is_active', является ли запрос от Админа ИЛИ (является ли запрос от Куратора И целевой пользователь Студент И поле is_active разрешено Куратору)
        if ('is_active' in req.body && (requestingUserRole === 'admin' || (requestingUserRole === 'curator' && existingUser.role === 'student' && allowedFields.includes('is_active')))) {
            // Запретить Админу деактивировать СЕБЯ
            if (targetUserId === requestingUserId && is_active === false) {
                await client.query('ROLLBACK'); // Откатить транзакцию
                return res.status(400).json({ message: 'Вы не можете деактивировать свою учетную запись через этот интерфейс.' });
            }
            updates.push(`is_active = $${paramIndex}`);
            queryParams.push(is_active);
            paramIndex++;
        }

        // Обновляем updated_at, только если есть что обновлять
        if (updates.length === 0) {
            await client.query('ROLLBACK'); // Откатить транзакцию
            return res.status(400).json({ message: 'Нет данных для обновления или недостаточно прав для изменения указанных полей.' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);


        // 4. Выполнить запрос UPDATE
        const updateQuery = `
          UPDATE users
          SET ${updates.join(', ')}
          WHERE id = $1
          RETURNING id, full_name, email, role, phone, avatar_url, is_active, created_at, updated_at
        `; // Возвращаем все основные поля обновленного пользователя

        // --- ДОБАВЛЕНО: Обрезка строки запроса перед выполнением ---
        const finalUpdateQuery = updateQuery.trim();

        // --- ДОБАВЛЕНО: Логирование обрезанной строки перед выполнением ---
        console.log("DEBUG: Trimmed Update User Query before execution:", finalUpdateQuery);
        console.log("DEBUG: Final Update User Params:", queryParams); // Параметры не меняются

        // Выполнить запрос с клиентом в транзакции
        // Убедитесь, что здесь используется finalUpdateQuery
        const result = await client.query(finalUpdateQuery, queryParams);

        if (result.rowCount === 0) {
            // Этого не должно произойти, если пользователь был найден изначально, но в качестве подстраховки
            await client.query('ROLLBACK'); // Откатить транзакцию
            return res.status(404).json({ message: 'Пользователь не найден или не был обновлен.' });
        }

        await client.query('COMMIT'); // Зафиксировать транзакцию

        // 5. Вернуть обновленные данные пользователя
        // Форматируем для соответствия ожидаемому фронтендом объекту пользователя
        const updatedUser = result.rows[0];
        res.status(200).json({
          id: updatedUser.id,
          name: updatedUser.full_name, // Возвращаем name для соответствия user объекту на фронтенде
          full_name: updatedUser.full_name, // Также возвращаем full_name
          email: updatedUser.email,
          role: updatedUser.role,
          avatar: updatedUser.avatar_url, // Возвращаем avatar для соответствия
          avatar_url: updatedUser.avatar_url, // Также возвращаем avatar_url
          phone: updatedUser.phone,
          is_active: updatedUser.is_active,
          updated_at: updatedUser.updated_at,
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Откатить транзакцию при ошибке
        console.error(`Error updating user ${targetUserId}:`, error);
        // Проверки на специфические ошибки БД
        if (error.code === '23505') { // unique_violation (например, email уже используется)
            return res.status(400).json({ message: 'Email уже используется другим пользователем.' });
        }
        // Если ошибка связана с правами (например, попытка Админа изменить СВОЮ роль)
        if (error.message && typeof error.message === 'string' && error.message.startsWith('Недостаточно прав')) {
            // Если ошибка пришла из наших проверок прав доступа, вернуть 403
            return res.status(403).json({ message: error.message });
        }
        if (error.message && typeof error.message === 'string' && error.message.startsWith('Вы не можете')) {
            // Если ошибка пришла из наших проверок на саморедактирование, вернуть 400
            return res.status(400).json({ message: error.message });
        }
        if (error.message && typeof error.message === 'string' && error.message.startsWith('Полное имя не может быть пустым')) {
            // Если ошибка пришла из нашей валидации имени, вернуть 400
            return res.status(400).json({ message: error.message });
        }


        res.status(500).json({ message: 'Ошибка сервера при обновлении данных пользователя.' });
    } finally {
        if (client) client.release(); // Вернуть клиента в пул
    }
});

// --- Маршруты Пользователей ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'curator', 'parent', 'student'].includes(req.user.role)) {
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


// GET /api/groups - Получить список активных групп
app.get('/api/groups', authenticateToken, async (req, res) => {
  // Ограничим доступ: список групп нужен администраторам (для создания уведомлений)
  // и кураторам (для управления своими группами или просмотра общего списка).
  if (!['admin', 'curator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для получения списка групп.' });
  }

  try {
      // Выбираем ID и имя всех активных групп, сортируем по имени
      const result = await pool.query(
          'SELECT id, name FROM groups WHERE is_active = TRUE ORDER BY name'
      );

      // Фронтенд ожидает массив объектов { id, name }
      res.json(result.rows);

  } catch (error) {
      console.error('Error fetching groups list:', error);
      res.status(500).json({ message: 'Ошибка при получении списка групп.' });
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

// Получение членов группы по ID
app.get('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  console.log('============================')
  const { groupId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const client = await pool.connect();
  try {
      // 1. Проверка прав доступа
      let canAccess = false;
      if (userRole === 'admin') {
          canAccess = true; // Админ может видеть всех
      } else if (userRole === 'curator') {
          // Куратор может видеть членов только своей группы
          const curatorCheck = await client.query(
              'SELECT id FROM groups WHERE id = $1 AND curator_id = $2',
              [groupId, userId]
          );
          if (curatorCheck.rows.length > 0) {
              canAccess = true;
          }
      }
      // Студенты и родители не могут запрашивать членов группы напрямую этим эндпоинтом

      if (!canAccess) {
          return res.status(403).json({ message: 'Недостаточно прав для просмотра членов этой группы.' });
      }

      // 2. Получение данных о членах группы
      const members = { curators: [], parents: [], students: [] };

      // Получить куратора группы (должен быть один)
      const curatorResult = await client.query(
          `SELECT u.id, u.full_name as name
           FROM users u
           JOIN groups g ON u.id = g.curator_id
           WHERE g.id = $1 AND u.is_active = TRUE`, // Учитываем, что куратор должен быть активен
          [groupId]
      );
      members.curators = curatorResult.rows;

      // Получить студентов группы и имя одного родителя (если есть)
      const studentsResult = await client.query(
          `SELECT u.id, u.full_name as name,
                  (SELECT p.full_name
                    FROM users p
                    JOIN parent_students ps ON p.id = ps.parent_id
                    WHERE ps.student_id = u.id AND p.is_active = TRUE
                    LIMIT 1) as parent_name
            FROM users u
            JOIN student_groups sg ON u.id = sg.student_id
            WHERE sg.group_id = $1 AND sg.is_active = TRUE AND u.is_active = TRUE
            ORDER BY u.full_name`,
          [groupId]
      );
      members.students = studentsResult.rows;

      // Получить родителей студентов группы и имя одного ребенка из этой группы
      // Используем DISTINCT ON (u.id) чтобы избежать дублирования родителей, если у них несколько детей в группе (хотя по текущей схеме студент в одной группе)
      // Учитываем только активных родителей и активных студентов в активных группах
      const parentsResult = await client.query(
          `SELECT DISTINCT ON (u.id) u.id, u.full_name as name,
                  (SELECT s.full_name
                    FROM users s
                    JOIN parent_students ps2 ON s.id = ps2.student_id
                    JOIN student_groups sg2 ON s.id = sg2.student_id
                    WHERE ps2.parent_id = u.id AND s.is_active = TRUE AND sg2.group_id = $1 AND sg2.is_active = TRUE
                    LIMIT 1) as student_name
            FROM users u
            JOIN parent_students ps ON u.id = ps.parent_id
            JOIN student_groups sg ON ps.student_id = sg.student_id
            WHERE sg.group_id = $1 AND sg.is_active = TRUE AND u.is_active = TRUE AND u.role = 'parent'
            ORDER BY u.id`,
          [groupId]
      );
      members.parents = parentsResult.rows;


      // 3. Отправка ответа
      res.json(members);

  } catch (error) {
      console.error(`Error fetching members for group ${groupId}:`, error);
      res.status(500).json({ message: 'Ошибка при получении членов группы.' });
  } finally {
      client.release(); // Возвращаем клиента в пул в любом случае
  }
});

// --- NEW ENDPOINT: Get summary list of groups ---
// GET /api/groups-summary - Returns list of active groups with curator name and student count
app.get('/api/groups-summary', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  // Access control check
  if (!['admin', 'curator'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для просмотра списка групп.' });
  }

  let client;
  try {
      client = await pool.connect();

      // Query to get group summary with aggregated counts via GROUP BY
       let query = `
          SELECT g.id, g.name, u.full_name as curator_name,
                  COUNT(DISTINCT sg.student_id) as student_count,
                  COUNT(CASE WHEN d.status IN ('pending', 'submitted') THEN d.id ELSE NULL END) as docs_on_review_count,
                  COUNT(d.id) as docs_total_count
          FROM groups g
          LEFT JOIN users u ON g.curator_id = u.id
          LEFT JOIN student_groups sg ON g.id = sg.group_id AND sg.is_active = TRUE
          LEFT JOIN documents d ON sg.student_id = d.student_id
          WHERE g.is_active = TRUE
       `;

      const params = [];
      let paramIndex = 1;

      // Curator filter
      if (userRole === 'curator') {
          query += ` AND g.curator_id = $${paramIndex}`;
          params.push(userId);
          paramIndex++;
      }

      query += ` GROUP BY g.id, g.name, u.full_name ORDER BY g.name`;


      const result = await client.query(query, params);

      const formattedResults = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          curator: row.curator_name || 'Не назначен',
          studentCount: parseInt(row.student_count, 10) || 0,
          // Document counts
          docsOnReview: parseInt(row.docs_on_review_count, 10) || 0,
          docsTotal: parseInt(row.docs_total_count, 10) || 0,
          // Percentage will be calculated on frontend
      }));


      res.json(formattedResults);

  } catch (error) {
      console.error('Error fetching group summaries:', error);
      res.status(500).json({ message: 'Ошибка при получении списка групп.' });
  } finally {
      if (client) client.release();
  }
});


// --- Modified ENDPOINT: Get list of students with group/parent info ---
// GET /api/students-list - Returns list of active students with group name, parent name, and document counts
app.get('/api/students-list', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { groupId, searchTerm } = req.query; // <-- Читаем groupId и searchTerm из query

    // Access control check - should be same as before
    if (!['admin', 'curator', 'parent', 'student'].includes(userRole)) {
        return res.status(403).json({ message: 'Недостаточно прав для просмотра списка студентов.' });
    }

    let client;
    let query; // Объявляем query вне блока try
    const params = []; // Объявляем params вне блока try
    let paramIndex = 1; // Объявляем paramIndex вне блока try


    try {
        client = await pool.connect();

        // Базовый SELECT запрос для студентов с джойнами для группы и родителя
        // ИЗМЕНЕНО: Список SELECT сделан более "плоским" внутри шаблонного литерала
        query = `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.is_active, g.name as group_name, (SELECT p.full_name FROM users p JOIN parent_students ps ON p.id = ps.parent_id WHERE ps.student_id = u.id AND p.is_active = TRUE LIMIT 1) as parent_name, (SELECT COUNT(*) FROM documents d WHERE d.student_id = u.id) as docs_total, (SELECT COUNT(*) FROM documents d WHERE d.student_id = u.id AND d.status IN ('pending', 'submitted')) as docs_on_review FROM users u LEFT JOIN student_groups sg ON u.id = sg.student_id AND sg.is_active = TRUE LEFT JOIN groups g ON sg.group_id = g.id`;


        const conditions = []; // Дополнительные условия WHERE для фильтрации (остается внутри)
        // params и paramIndex объявлены выше


        // --- Базовый фильтр: только активные студенты ---
        conditions.push('u.role = $1');
        params.push('student');
        paramIndex++;
        conditions.push('u.is_active = TRUE');
        // Не добавляем новый параметр для этого условия


        // --- Применяем Role-based фильтрацию ---
        if (userRole === 'curator') {
            conditions.push(`sg.group_id IN (SELECT id FROM groups WHERE curator_id = $${paramIndex})`);
            params.push(userId);
            paramIndex++;
        } else if (userRole === 'parent') {
            conditions.push(`u.id IN (SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex})`);
            params.push(userId);
            paramIndex++;
        } else if (userRole === 'student') {
            conditions.push(`u.id = $${paramIndex}`);
            params.push(userId);
            paramIndex++;
        }
        // Admin видит всех студентов (без дополнительного условия по роли)


        // --- Применяем опциональные фильтры (groupId, searchTerm) ---

        if (groupId) {
            const filterGroupIdNum = parseInt(groupId, 10);
            if (!isNaN(filterGroupIdNum)) {
                 conditions.push(`sg.group_id = $${paramIndex}`);
                 params.push(filterGroupIdNum);
                 paramIndex++;
            } else {
                console.warn(`Invalid groupId parameter received: ${groupId}`);
            }
        }

        if (searchTerm) {
            const lowerSearchTerm = `%${searchTerm.toLowerCase()}%`;
            conditions.push(`(LOWER(u.full_name) LIKE $${paramIndex} OR LOWER(g.name) LIKE $${paramIndex + 1})`);
            params.push(lowerSearchTerm, lowerSearchTerm);
            paramIndex += 2;
        }

        // --- Комбинируем все условия в WHERE clause ---
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY u.full_name`;

        // Явно обрезаем строку запроса перед выполнением
        query = query.trim();

        // УДАЛИТЬ ИЛИ ЗАКОММЕНТИРОВАТЬ ЭТО ДЛЯ ПРОДАКШЕНА!
        console.log("DEBUG: Final Students List Query:", query);
        console.log("DEBUG: Final Students List Params:", params);

        const result = await client.query(query, params); // Выполняем запрос с собранными параметрами

        console.log("DEBUG: Raw Students List Query Results:", result.rows);

        // Форматируем результат для фронтенда
        const formattedResults = result.rows.map(row => ({
            id: row.id,
            name: row.full_name || 'Неизвестно',
            group: row.group_name || 'Неизвестно',
            parent: row.parent_name || 'Неизвестно',
            // Document counts
            docsTotal: parseInt(row.docs_total, 10) || 0,
            docsOnReview: parseInt(row.docs_on_review, 10) || 0, // Count of pending/submitted docs
            // onReviewPercentage будет вычислен на фронтенде (уже есть в groups.jsx)
        }));

        console.log("DEBUG: Formatted Students List Results (backend):", formattedResults);

        res.json(formattedResults);

    } catch (error) {
        console.error('Error fetching students list:', error);
        // Логируем query и params, если query была присвоена
        if (typeof query !== 'undefined') {
          console.error('DEBUG: Failed Query:', query);
          console.error('DEBUG: Failed Params:', params);
        }
        if (error.code === '42601') {
           res.status(500).json({ message: 'Ошибка при формировании запроса к базе данных (синтаксическая ошибка). Пожалуйста, свяжитесь с администратором.' });
        } else {
            res.status(500).json({ message: 'Ошибка при получении списка студентов.' });
        }
    } finally {
        if (client) client.release();
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

    let countQuery = `
      SELECT COUNT(*)
      FROM documents d
      LEFT JOIN users u1 ON d.student_id = u1.id
      LEFT JOIN groups g ON d.group_id = g.id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];
    let paramIndex = 1;

    // --- СУЩЕСТВУЮЩАЯ ЛОГИКА ФИЛЬТРАЦИИ ПО РОЛИ/СТУДЕНТУ (Использует актуальный paramIndex) ---
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
      // Убедимся, что studentId валиден и не совпадает с уже добавленным (например, если user student)
      if (studentId !== undefined && params.indexOf(studentId) === -1) { // Проверка, что studentId еще не добавлен в params
         query += ` AND d.student_id = $${paramIndex}`;
         countQuery += ` AND d.student_id = $${paramIndex}`;
         params.push(studentId);
         countParams.push(studentId);
         paramIndex++;
      } else if (studentId !== undefined && params.indexOf(studentId) !== -1) {
          // Если studentId уже в params (например, user student), убедимся, что условие уже в query
          // (логика выше должна это обрабатывать, но можно добавить лог для отладки)
          console.log(`DEBUG: studentId ${studentId} already in params, skipping redundant filter add.`);
      }
    }
    // --- КОНЕЦ СУЩЕСТВУЮЩЕЙ ЛОГИКИ ФИЛЬТРАЦИИ ---


    query += ' ORDER BY d.created_at DESC';

    if (limit !== undefined && offset !== undefined) {
        // Убедимся, что limit и offset являются числами перед добавлением в params
        const numLimit = parseInt(limit, 10);
        const numOffset = parseInt(offset, 10);

        if (!isNaN(numLimit) && !isNaN(numOffset)) {
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(numLimit, numOffset);
            // paramIndex += 2; // Не нужно увеличивать paramIndex после LIMIT/OFFSET
        } else {
             console.warn(`DEBUG: Invalid limit (${limit}) or offset (${offset}) values received.`);
        }
    }

    const [documentsResult, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, countParams)
    ]);

    console.log("DEBUG: Before total");
    const total = countResult.rows.length > 0 ? parseInt(countResult.rows[0].count, 10) : 0; // Безопасное извлечение count
    console.log("DEBUG: After total, before map");

    const formattedDocuments = documentsResult.rows.map((doc) => {
        console.log("DEBUG: Inside map for doc ID:", doc.id);
        return ({
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
        });
    });

    console.log("DEBUG: After map");

    res.json({
        items: formattedDocuments,
        total: total,
        // Возвращаем фактические limit/offset, использованные в запросе
        limit: limit !== undefined && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : 10,
        offset: offset !== undefined && !isNaN(parseInt(offset, 10)) ? parseInt(offset, 10) : 0,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    // Проверяем, является ли ошибка ошибкой БД с кодом '42703' (несуществующая колонка)
     if (error.code === '42703') {
         res.status(400).json({ message: `Ошибка запроса к базе данных: Неизвестная колонка. Возможно, отсутствует колонка 'updated_at' или другая.` });
     } else {
        res.status(500).json({ message: 'Ошибка при получении списка документов' });
     }
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

  const client = await pool.connect(); // Получаем клиента для транзакции
  try {
      await client.query('BEGIN'); // Начинаем транзакцию

      // Fetch document details to get student_id, group_id, title etc.
      const docResult = await client.query( // Use client
          `SELECT id, title, student_id, group_id, status as old_status
           FROM documents WHERE id = $1`,
          [documentId]
      );
      const document = docResult.rows[0];

      if (!document) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Документ не найден' });
      }

      // Check curator permissions if necessary (using client)
       if (userRole === 'curator') {
           const curatorCheck = await client.query(
               `SELECT d.id
                FROM documents d
                LEFT JOIN groups g ON d.group_id = g.id
                WHERE d.id = $1 AND g.curator_id = $2`,
               [documentId, reviewerId]
           );
           if (curatorCheck.rows.length === 0) {
                const submittedByCheck = await client.query(
                   `SELECT id FROM documents WHERE id = $1 AND submitted_by = $2`,
                   [documentId, reviewerId]
               );
               if (submittedByCheck.rows.length === 0) {
                   await client.query('ROLLBACK');
                   return res.status(403).json({ message: 'Вы не являетесь куратором группы, к которой относится этот документ, и не загружали его.' });
               }
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
              await client.query('ROLLBACK');
              return res.status(400).json({ message: 'Причина отклонения обязательна' });
          }
          query += `, review_comment = $${paramIndex}`;
          params.splice(paramIndex - 1, 0, review_comment.trim());
          paramIndex++;
      } else {
           query += `, review_comment = NULL`;
      }

      query += ` WHERE id = $${paramIndex}`;

      const updateResult = await client.query(query, params); // Use client

      if (updateResult.rowCount === 0) {
          // This should not happen if document was found initially, but as a safeguard
           await client.query('ROLLBACK');
           return res.status(404).json({ message: 'Документ не найден или не был обновлен.' });
      }

      // --- НОВАЯ ЛОГИКА: Создание уведомлений при изменении статуса ---
      // Уведомляем только если статус действительно изменился и новый статус интересен для уведомления
      if (document.old_status !== status && ['approved', 'rejected', 'pending'].includes(status)) {
           const recipientsToNotify = new Set();
           recipientsToNotify.add(document.student_id); // Уведомить студента

           // Найти родителей студента
           const parentsResult = await client.query('SELECT parent_id FROM parent_students WHERE student_id = $1', [document.student_id]);
           parentsResult.rows.forEach(row => recipientsToNotify.add(row.parent_id));

           // Найти куратора группы студента (если студент в группе) - куратор может быть заинтересован в статусе документа
           if (document.group_id) {
               const curatorResult = await client.query('SELECT curator_id FROM groups WHERE id = $1', [document.group_id]);
               if (curatorResult.rows[0]?.curator_id) {
                   recipientsToNotify.add(curatorResult.rows[0].curator_id);
               }
           }

           // Исключить пользователя, который изменил статус (он сам это сделал)
           const usersToNotify = Array.from(recipientsToNotify).filter(id => id !== reviewerId);

           let notificationTitle = `Статус документа изменен: "${document.title}"`;
           let notificationMessage = `Новый статус: ${status}.`;
           if (status === 'rejected' && review_comment) {
               notificationMessage += ` Причина отклонения: ${review_comment}`;
           } else if (status === 'approved') {
               notificationMessage = `Ваш документ "${document.title}" одобрен.`;
           } else if (status === 'pending') {
               notificationMessage = `Статус документа "${document.title}" изменен на "Ожидает рассмотрения".`;
           }
           // Можно добавить, кто изменил статус: ` Изменен пользователем ID ${reviewerId}.`

           const notificationType = 'document';
           const relatedEntityType = 'document';
           const relatedEntityId = document.id;

           const notificationsCreatedCount = await createNotificationsForUsers(
               usersToNotify,
               notificationTitle,
               notificationMessage,
               notificationType,
               relatedEntityType,
               relatedEntityId,
               client // Передаем существующий клиент
           );
           console.log(`Triggered notification creation for document status change event, created ${notificationsCreatedCount} notifications.`);
      }
      // --- Конец новой логики создания уведомлений при изменении статуса ---


      await client.query('COMMIT'); // Коммитим транзакцию

      res.status(200).json({ message: `Статус документа успешно обновлен на "${status}"` });

  } catch (error) {
      await client.query('ROLLBACK'); // Откатываем транзакцию
      console.error('Error updating document status transaction:', error);
      const errorMessage = error.message || error.response?.data?.message || 'Ошибка сервера при обновлении статуса документа';
      res.status(error.response?.status >= 400 ? error.response.status : 500).json({ message: errorMessage });
  } finally {
      client.release(); // Возвращаем клиента в пул
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
  const client = await pool.connect(); // Получаем клиента для использования в транзакции
  try {
      await client.query('BEGIN'); // Начинаем транзакцию

      const uploadedFile = req.file;
      const { name, student_id, status, submitted_by, template_id, content } = req.body;

      if (!uploadedFile || !student_id || !submitted_by) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Файл, студент и загрузивший пользователь обязательны для загрузки' });
      }

      let isAuthorized = false;
      if (req.user.role === 'admin') {
          isAuthorized = true;
      } else if (req.user.role === 'parent') {
          const parentCheck = await client.query( // Use client
              'SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2',
              [req.user.id, student_id]
          );
          if (parentCheck.rows.length > 0) {
              isAuthorized = true;
          }
      } else if (req.user.role === 'curator') {
           const curatorCheck = await client.query( // Use client
               `SELECT 1 FROM student_groups sg
                JOIN groups g ON sg.group_id = g.id
                WHERE sg.student_id = $1 AND g.curator_id = $2`,
               [student_id, req.user.id]
           );
           if (curatorCheck.rows.length > 0) {
               isAuthorized = true;
           }
      } else if (req.user.role === 'student' && req.user.id.toString() === student_id.toString()) {
           isAuthorized = true;
      }

      if (!isAuthorized) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Ваша роль не позволяет загружать документы для этого студента' });
      }

      if (req.user.id.toString() !== submitted_by.toString() && req.user.role !== 'admin') {
           await client.query('ROLLBACK');
           return res.status(403).json({ message: 'Недостаточно прав для загрузки документа от имени другого пользователя' });
      }

      // --- Перенаправление файла в FastAPI сервис ---
      const fastapiServiceUrl = `${FASTAPI_STORAGE_URL}/upload_pdf/`;
      const formDataFastAPI = new FormData();
      formDataFastAPI.append('file', uploadedFile.buffer, uploadedFile.originalname);

      let fileUuid = null;
      try {
          const fastapiResponse = await axios.post(fastapiServiceUrl, formDataFastAPI, {
              headers: { ...formDataFastAPI.getHeaders() },
              maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 60000
          });
          fileUuid = fastapiResponse.data?.uuid;
          if (!fileUuid) {
               console.error('FastAPI did not return file UUID:', fastapiResponse.data);
               const fastapiErrorMessage = fastapiResponse.data?.detail || `Сервис хранения вернул ошибку ${fastapiResponse.status}`;
               throw new Error(`Ошибка сервиса хранения: ${fastapiErrorMessage}`); // Throw to catch block
          }
          console.log(`File uploaded to FastAPI, UUID: ${fileUuid}`);
      } catch (fastapiError) {
           console.error('Error forwarding file to FastAPI service:', fastapiError);
           // If FastAPI upload fails, we must rollback the transaction
           await client.query('ROLLBACK');
           // Respond with appropriate error, extracting message from FastAPI error if possible
           const errorMessage = fastapiError.message || fastapiError.response?.data?.detail || 'Ошибка связи с сервисом хранения.';
           return res.status(fastapiError.response?.status >= 400 ? fastapiError.response.status : 500).json({ message: errorMessage });
      }


      // --- Сохранение метаданных документа в PostgreSQL ---
      // Находим группу студента, если есть
       const groupResult = await client.query( // Use client
          'SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = true',
          [student_id]
       );
       const group_id = groupResult.rows[0]?.group_id || null;

       const initialStatus = status || 'pending';

      const insertDocResult = await client.query( // Use client
        `INSERT INTO documents
         (title, status, student_id, group_id, file_url, submitted_by, original_filename, content_type, template_id, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title, student_id, submitted_by, created_at`, // Возвращаем нужные поля
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

      const newDocument = insertDocResult.rows[0];
      console.log(`Document entry created in DB with ID: ${newDocument.id}`);


      // --- НОВАЯ ЛОГИКА: Создание уведомлений при создании документа ---
      // Определяем получателей уведомления: Студент, его родитель(и), куратор группы.
      const recipientsToNotify = new Set();
      recipientsToNotify.add(newDocument.student_id); // Уведомить студента

      // Найти родителей студента
      const parentsResult = await client.query('SELECT parent_id FROM parent_students WHERE student_id = $1', [newDocument.student_id]);
      parentsResult.rows.forEach(row => recipientsToNotify.add(row.parent_id));

      // Найти куратора группы студента (если студент в группе)
      if (newDocument.group_id) {
          const curatorResult = await client.query('SELECT curator_id FROM groups WHERE id = $1', [newDocument.group_id]);
          if (curatorResult.rows[0]?.curator_id) {
              recipientsToNotify.add(curatorResult.rows[0].curator_id);
          }
      }

      // Опционально: Уведомить того, кто загрузил, если это не студент
      if (newDocument.submitted_by !== newDocument.student_id) {
          recipientsToNotify.add(newDocument.submitted_by);
      }

      // Исключить пользователя, который инициировал событие, если он не должен получать уведомление о своем же действии
      // Например, если студент загрузил документ, ему не нужно уведомление "Новый документ создан".
      // Если куратор загрузил для студента, студент, родитель и сам куратор могут быть уведомлены.
      const usersToNotify = Array.from(recipientsToNotify).filter(id => id !== req.user.id); // Простой пример: не уведомлять самого себя


      const notificationTitle = `Создан новый документ: "${newDocument.title}"`;
      const notificationMessage = `Документ для студента ID ${newDocument.student_id}. Статус: ${initialStatus}.`;
      const notificationType = 'document'; // Тип уведомления 'document'
      const relatedEntityType = 'document';
      const relatedEntityId = newDocument.id;

      // Создаем уведомления, используя того же клиента для включения в текущую транзакцию
      const notificationsCreatedCount = await createNotificationsForUsers(
          usersToNotify,
          notificationTitle,
          notificationMessage,
          notificationType,
          relatedEntityType,
          relatedEntityId,
          client // Передаем существующий клиент
      );
      console.log(`Triggered notification creation for document event, created ${notificationsCreatedCount} notifications.`);
      // --- Конец новой логики создания уведомлений ---


      await client.query('COMMIT'); // Коммитим транзакцию

      res.status(201).json({
        message: 'Документ успешно загружен и зарегистрирован',
        documentId: newDocument.id,
        createdAt: newDocument.created_at,
        fileUuid: fileUuid,
        notificationsCreated: notificationsCreatedCount // Опционально, вернуть количество созданных уведомлений
      });

  } catch (error) {
      await client.query('ROLLBACK'); // Откатываем транзакцию в случае любой ошибки
      console.error('Error in document upload/creation transaction:', error);
      // Улучшенная обработка ошибок, чтобы вернуть сообщение об ошибке пользователю
      const errorMessage = error.message || error.response?.data?.message || 'Ошибка сервера при загрузке документа.';
      res.status(error.response?.status >= 400 ? error.response.status : 500).json({ message: errorMessage });
  } finally {
      client.release(); // Возвращаем клиента в пул
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

const GOOGLE_AI_API_KEY = 'AIzaSyBChhrfQTXMPXYNLRmmlZnRJaJkWgvARD4';

if (!GOOGLE_AI_API_KEY) {
  console.warn("WARNING: GOOGLE_AI_API_KEY is missing or using a default placeholder. AI functionality may not work.");
}

const genAI = GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(GOOGLE_AI_API_KEY) : null;


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

// NEW ENDPOINT: GET /api/notifications/count - Get notification count for the current user
app.get('/api/notifications/count', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query; // status: 'read', 'unread'

        let query = `
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = $1
        `;
        const params = [userId];
        let paramIndex = 2; // Start parameter index for optional conditions

        if (status === 'read') {
            query += ` AND is_read = TRUE`;
        } else if (status === 'unread') {
            query += ` AND is_read = FALSE`;
        }
        // If status is not specified or is 'all', no additional filtering on is_read is added.

        const result = await pool.query(query, params);

        const count = result.rows.length > 0 ? parseInt(result.rows[0].count, 10) : 0;

        res.json({ count: count });

    } catch (error) {
        console.error('Error fetching notifications count:', error);
        res.status(500).json({ message: 'Ошибка при получении количества уведомлений.' });
    }
});


// Helper function to resolve recipient criteria into a list of user IDs
// Handles roles, groups, 'all_users', and potentially individual user IDs
const resolveRecipients = async (recipientCriteria) => {
  const client = await pool.connect(); // Используем клиента из пула
  const userIds = new Set(); // Используем Set для автоматического удаления дубликатов

  try {
      const uniqueCriteria = new Set(recipientCriteria);

      for (const criteria of uniqueCriteria) {
          if (criteria === 'all_users') {
              const result = await client.query('SELECT id FROM users WHERE is_active = TRUE');
              result.rows.forEach(row => userIds.add(row.id));

          } else if (criteria.startsWith('role:')) {
              const roleName = criteria.substring('role:'.length);
              if (['admin', 'curator', 'parent', 'student'].includes(roleName)) {
                  const result = await client.query('SELECT id FROM users WHERE role = $1 AND is_active = TRUE', [roleName]);
                  result.rows.forEach(row => userIds.add(row.id));
              } else {
                  console.warn(`resolveRecipients: Unknown or invalid role name in criteria: ${criteria}`);
              }

          } else if (criteria.startsWith('group:')) {
              const parts = criteria.split(':');
              const groupId = parseInt(parts[1], 10);
              const roleTypeInGroup = parts[2];

              if (isNaN(groupId)) {
                  console.warn(`resolveRecipients: Invalid group ID in criteria: ${criteria}`);
                  continue;
              }

              const groupCheck = await client.query('SELECT id FROM groups WHERE id = $1 AND is_active = TRUE', [groupId]);
               if (groupCheck.rows.length === 0) {
                   console.warn(`resolveRecipients: Group ID ${groupId} not found or not active.`);
                   continue;
               }

              // Определяем, кого выбрать в рамках группы
              if (roleTypeInGroup === 'curators') {
                  const result = await client.query('SELECT curator_id FROM groups WHERE id = $1 AND curator_id IS NOT NULL', [groupId]);
                  if (result.rows.length > 0 && result.rows[0].curator_id) {
                       const curatorUser = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [result.rows[0].curator_id]);
                       if(curatorUser.rows.length > 0) {
                          userIds.add(curatorUser.rows[0].id);
                       } else {
                            console.warn(`resolveRecipients: Curator ID ${result.rows[0].curator_id} for group ${groupId} is not active.`);
                       }
                  } else {
                       console.warn(`resolveRecipients: No curator found for group ID ${groupId}.`);
                  }

              } else if (roleTypeInGroup === 'parents') {
                  const result = await client.query(
                      `SELECT DISTINCT ps.parent_id
                       FROM parent_students ps
                       JOIN student_groups sg ON ps.student_id = sg.student_id
                       JOIN users u ON ps.parent_id = u.id
                       WHERE sg.group_id = $1 AND sg.is_active = TRUE AND u.is_active = TRUE`,
                      [groupId]
                  );
                  result.rows.forEach(row => userIds.add(row.parent_id));

              } else if (roleTypeInGroup === 'students') {
                   const result = await client.query(
                       `SELECT sg.student_id
                        FROM student_groups sg
                        JOIN users u ON sg.student_id = u.id
                        WHERE sg.group_id = $1 AND sg.is_active = TRUE AND u.is_active = TRUE`,
                       [groupId]
                   );
                   result.rows.forEach(row => userIds.add(row.student_id));

              } else {
                  console.warn(`resolveRecipients: Unknown or missing role type for group criteria: ${criteria}. Skipping.`);
              }

          } else if (criteria.startsWith('user:')) { // НОВАЯ ОБРАБОТКА: user:userId
              const targetUserId = parseInt(criteria.substring('user:'.length), 10);
              if (!isNaN(targetUserId)) {
                   // Проверяем, существует ли пользователь с таким ID и активен ли он
                   const userCheck = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [targetUserId]);
                   if (userCheck.rows.length > 0) {
                      userIds.add(targetUserId); // Добавляем ID активного пользователя
                   } else {
                       console.warn(`resolveRecipients: Target user ID ${targetUserId} not found or not active for criteria: ${criteria}.`);
                   }
              } else {
                   console.warn(`resolveRecipients: Invalid target user ID format in criteria: ${criteria}`);
              }
          }
          else {
              console.warn(`resolveRecipients: Unknown recipient criteria format: ${criteria}`);
          }
      }
  } catch (error) {
      console.error('resolveRecipients: Error querying database:', error);
      throw error;
  } finally {
      client.release();
  }

  console.log(`resolveRecipients: Resolved criteria ${JSON.stringify(recipientCriteria)} to ${userIds.size} unique user IDs.`);
  return Array.from(userIds);
};


// POST /api/notifications - Создать новое уведомление (только для админа)
app.post('/api/notifications', authenticateToken, async (req, res) => {
  // Проверка, что пользователь является администратором
  if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Недостаточно прав для создания уведомлений.' });
  }

  const { title, message, type, recipients } = req.body; // recipients - теперь массив критериев (строк)

  // Базовая валидация
  if (!title || !message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: 'Заголовок, сообщение и хотя бы один получатель обязательны.' });
  }

  // Определяем финальный список user_id на основеrecipientCriteria
  // resolveRecipients теперь вызывается здесь один раз с массивом критериев
  try {
       const recipientUserIds = await resolveRecipients(recipients); // Получаем массив ID пользователей

       if (recipientUserIds.length === 0) {
           return res.status(400).json({ message: 'Не удалось определить получателей на основе предоставленных критериев.' });
       }

       // Используем новую функцию createNotificationsForUsers для вставки в БД в транзакции
       const notificationsCreatedCount = await createNotificationsForUsers(
           recipientUserIds,
           title,
           message,
           type || 'general', // Default type
           null, // related_entity_type
           null  // related_entity_id
           // client is not passed here, createNotificationsForUsers manages its own transaction
       );


      res.status(201).json({
          message: `Уведомление успешно создано для ${notificationsCreatedCount} пользователей.`,
          createdCount: notificationsCreatedCount
      });

  } catch (error) {
      console.error('Error creating notifications:', error);
      // Error handling is now mostly inside createNotificationsForUsers or resolveRecipients
      const errorMessage = error.message || 'Ошибка при создании уведомлений.';
      res.status(500).json({ message: errorMessage });
  }
});



// --- HELPER FUNCTION: Determine relevant group IDs for a user's role ---
// This function helps filter schedule items for GET requests
const getUserGroupIds = async (userId, userRole, client) => {
  const groups = new Set();
  if (!userId || !userRole) return Array.from(groups); // Return empty for unauthenticated

  try {
      if (userRole === 'admin') {
          // Admin sees all groups
          const result = await client.query('SELECT id FROM groups WHERE is_active = TRUE');
          result.rows.forEach(row => groups.add(row.id));
      } else if (userRole === 'curator') {
          // Curator sees groups they curate
          const result = await client.query('SELECT id FROM groups WHERE curator_id = $1 AND is_active = TRUE', [userId]);
          result.rows.forEach(row => groups.add(row.id));
      } else if (userRole === 'parent') {
          // Parent sees groups of their children
          const result = await client.query(
              `SELECT DISTINCT sg.group_id
               FROM student_groups sg
               JOIN parent_students ps ON sg.student_id = ps.student_id
               WHERE ps.parent_id = $1 AND sg.is_active = TRUE`,
              [userId]
          );
          result.rows.forEach(row => groups.add(row.group_id));
      } else if (userRole === 'student') {
          // Student sees their own groups
          const result = await client.query('SELECT group_id FROM student_groups WHERE student_id = $1 AND is_active = TRUE', [userId]);
          result.rows.forEach(row => groups.add(row.group_id));
      }

  } catch (error) {
      console.error(`Error fetching group IDs for user ${userId} role ${userRole}:`, error);
      // Depending on error handling, you might throw or return empty
  }

  return Array.from(groups); // Return array of group IDs
};


// --- SCHEDULE/DEADLINE ROUTES ---

// GET /api/schedule - Get schedule items relevant to the user
app.get('/api/schedule', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { month, year, upcoming_days, all_relevant } = req.query; // Filter parameters

  let client;
  try {
      client = await pool.connect();

      const conditions = []; // Conditions for the WHERE clause
      const params = []; // Parameters for the SQL query
      let paramIndex = 1;

      // --- Apply Role-Based Filtering (Crucial) ---
      // User should only see:
      // 1. Their personal deadlines (created_by = userId)
      // 2. Deadlines for groups they are associated with (student, parent, curator)
      // 3. General deadlines (group_id IS NULL) visible to their role (e.g., admin sees all general, others see some?)
      // For simplicity, let's assume general deadlines (group_id IS NULL) are visible to anyone authenticated for now.
      // Admin sees everything anyway.

      let roleClause = '';
      const userGroupIds = await getUserGroupIds(userId, userRole, client);

      // Admin sees all, no specific role filtering needed here
      if (userRole !== 'admin') {
           const userSpecificConditions = [];
           const userSpecificParams = [];

          // Condition 1: Items created by the user (personal or maybe some group items they created)
          userSpecificConditions.push(`s.created_by = $${paramIndex}`);
          userSpecificParams.push(userId);
          paramIndex++;

          // Condition 2: Items for groups the user is associated with
          if (userGroupIds.length > 0) {
              userSpecificConditions.push(`s.group_id IN (${userGroupIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`);
              userSpecificParams.push(...userGroupIds);
              paramIndex += userGroupIds.length;
          } else {
               // If user has no groups (e.g., new student, parent with no linked child in a group),
               // they still need to see their personal deadlines.
               // The IN clause above would be empty if userGroupIds is empty.
               // This needs careful handling to avoid WHERE ... IN () which is invalid SQL.
          }

          // Condition 3: General deadlines (group_id IS NULL)
          // For simplicity, let's assume general deadlines are viewable by any authenticated user.
          // A more granular approach might involve roles defined on the schedule item itself.
          userSpecificConditions.push(`s.group_id IS NULL`);
          // No parameters needed for IS NULL


           // Combine user-specific conditions: (Condition 1 OR Condition 2 OR Condition 3)
           if (userSpecificConditions.length > 0) {
              roleClause = ` AND (${userSpecificConditions.join(' OR ')})`;
              params.push(...userSpecificParams);
           } else {
               // If user has no groups AND no personal deadlines exist (shouldn't happen based on Condition 1),
               // this clause might restrict everything. Needs careful thought.
               // If user has no groups, they only see their personal items and general items.
               // The conditions need to be (s.created_by = $1 OR s.group_id IN (...) OR s.group_id IS NULL)
               // If userGroupIds is empty, the IN clause part becomes effectively false.
               // Let's rebuild the role clause based on whether user has groups or not.
               if (userGroupIds.length > 0) {
                    // User has groups: see personal OR group OR general
                    roleClause = ` AND (s.created_by = $${paramIndex} OR s.group_id IN (${userGroupIds.map((_, i) => `$${paramIndex + 1 + i}`).join(', ')}) OR s.group_id IS NULL)`;
                    params.push(userId, ...userGroupIds);
                    paramIndex += 1 + userGroupIds.length;
               } else {
                    // User has no groups: see personal OR general
                    roleClause = ` AND (s.created_by = $${paramIndex} OR s.group_id IS NULL)`;
                    params.push(userId);
                    paramIndex++;
               }
          }
      }


      // --- Apply Time/Date Filtering based on query parameters ---
      let dateClause = '';
      if (month && year) {
          // Filter by specific month and year (for calendar view)
          const start = startOfMonth(new Date(year, month - 1));
          const end = endOfMonth(new Date(year, month - 1));
          // end_date should be within the month
          dateClause = ` AND s.end_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          params.push(start.toISOString(), end.toISOString());
          paramIndex += 2;
      } else if (year) {
          // Filter by specific year (for list view, maybe)
          const start = new Date(year, 0, 1);
          const end = new Date(year, 11, 31, 23, 59, 59);
           dateClause = ` AND s.end_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
           params.push(start.toISOString(), end.toISOString());
           paramIndex += 2;
      } else if (upcoming_days) {
           // Filter by upcoming days (for burning deadlines)
           const numDays = parseInt(upcoming_days, 10);
           if (!isNaN(numDays) && numDays >= 0) {
               const start = new Date(); // Now
               const end = addDays(start, numDays); // Now + N days
                // end_date is between now and now + N days, and end_date is in the future
                dateClause = ` AND s.end_date BETWEEN NOW() AND $${paramIndex}`;
                params.push(end.toISOString());
                paramIndex++;
           } else {
                console.warn(`Invalid upcoming_days parameter: ${upcoming_days}`);
                // Return empty or handle error appropriately
           }
      }
      // If no date filter parameters, return all relevant items (within role scope)


      // --- Build Final Query ---
      const finalQuery = `
          SELECT s.id, s.title, s.description, s.end_date, s.priority, s.created_by, s.created_at,
                 s.group_id -- Include group_id to check if it's a group deadline
                 -- TODO: Join to get group name if group_id is not null
                 -- g.name as group_name
                 -- TODO: Join to get creator name if needed
                 -- u.full_name as created_by_name
                 -- TODO: Join to get user_id if used for personal deadlines
                 -- s.user_id
          FROM schedule s
          -- LEFT JOIN groups g ON s.group_id = g.id -- Optional join for group name
          -- LEFT JOIN users u ON s.created_by = u.id -- Optional join for creator name
          WHERE 1=1
          ${roleClause} -- Apply role filter
          ${dateClause} -- Apply date filter
          ORDER BY s.end_date
      `;

      // Execute the query
      const result = await client.query(finalQuery, params);

      // TODO: Adapt response format to match frontend expectations if necessary
      // Frontend expects objects like { id, title, description, due_date, groups, priority }
      // Need to map end_date to due_date, group_id to groups (array of strings/numbers)
      const formattedResults = result.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          due_date: item.end_date ? item.end_date.toISOString() : null, // Format date as ISO string
          // Convert group_id to groups array (if group_id is not null)
          groups: item.group_id ? [String(item.group_id)] : [], // Frontend expects array of strings/numbers
          priority: item.priority,
          created_by: item.created_by,
          created_at: item.created_at ? item.created_at.toISOString() : null,
          // TODO: Include group_name if joined
          // group_name: item.group_name
          // TODO: Include created_by_name if joined
          // created_by_name: item.created_by_name
           // TODO: Include user_id if used
           // user_id: item.user_id
      }));


      // Send the response
      res.json(formattedResults);

  } catch (error) {
      console.error('Error fetching schedule items:', error);
      // Return 500 status with error message
      res.status(500).json({ message: 'Ошибка при получении расписания.', error: error.message });
  } finally {
      if (client) client.release(); // Release client
  }
});


// POST /api/schedule - Create a new schedule item (deadline)
app.post('/api/schedule', authenticateToken, async (req, res) => {
  const userId = req.user.id; // Creator ID
  const userRole = req.user.role;
  const { title, description, end_date, priority, scope, groups } = req.body; // Payload from frontend

  console.log("DEBUG_BACKEND_SCHEDULE_POST: Received Payload:", req.body); // Логируем весь полученный payload
  console.log(`DEBUG_BACKEND_SCHEDULE_POST: Destructured: title='${title}', end_date='${end_date}', priority='${priority}', scope='${scope}', groups=`, groups); // Логируем извлеченные значения

  let client;
  try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // 1. Basic Validation (прошло успешно по предыдущим логам)
      console.log(`DEBUG_BACKEND_SCHEDULE_POST: Checking Validation 1: !title=${!title}, !end_date=${!end_date}, !priority=${!priority}, !scope=${!scope}`);
      if (!title || !end_date || !priority || !scope) {
           console.error("DEBUG_BACKEND_SCHEDULE_POST: Validation Check 1 FAILED.");
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Название, дата, приоритет и тип (личный/группа) обязательны.' });
      }

       console.log(`DEBUG_BACKEND_SCHEDULE_POST: Checking Validation 2: scope='${scope}', groups=${groups}, isArray=${Array.isArray(groups)}, length=${groups?.length}`);
       if (scope === 'groups' && (!groups || !Array.isArray(groups) || groups.length === 0)) {
           console.error("DEBUG_BACKEND_SCHEDULE_POST: Validation Check 2 FAILED.");
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Для дедлайна группы необходимо выбрать хотя бы одну группу.' });
       }

       console.log(`DEBUG_BACKEND_SCHEDULE_POST: Checking Validation 3: scope='${scope}'`);
       if (scope !== 'myself' && scope !== 'groups') {
           console.error("DEBUG_BACKEND_SCHEDULE_POST: Validation Check 3 FAILED.");
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Неверный тип дедлайна.' });
       }

      console.log("DEBUG_BACKEND_SCHEDULE_POST: Validation PASSED.");


      // 2. Access Control - Who can create for whom? (проверяется перед вставкой)
      if (scope === 'groups') {
          if (userRole !== 'admin' && userRole !== 'curator') {
              await client.query('ROLLBACK');
              return res.status(403).json({ message: 'Недостаточно прав для создания дедлайнов для групп.' });
          }
          if (userRole === 'curator') {
               const curatingGroups = await getUserGroupIds(userId, userRole, client); // Убедитесь, что getUserGroupIds доступна
               // Проверяем, что куратор курирует ВСЕ выбранные группы
               const canCreateForAllGroups = groups.every(groupId => curatingGroups.includes(Number(groupId)));
               if (!canCreateForAllGroups) {
                   await client.query('ROLLBACK');
                   return res.status(403).json({ message: 'Куратор может создавать дедлайны только для своих групп.' });
               }
          }
      } // Для scope === 'myself', проверка прав не требуется, любой авторизованный может создать для себя.


      // 3. Insertion Logic
      const createdItems = [];
      const commonFields = {
          title,
          description: description || null, // Use null if empty
          end_date: end_date, // Should be ISO string from frontend
          priority,
          created_by: userId, // Creator is the current user ID from token
      };

      // Base INSERT query string with all 7 columns and 7 placeholders
      const insertQueryBase = `
          INSERT INTO schedule (title, description, end_date, priority, created_by, group_id, user_id, start_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) -- <-- Added start_date column and placeholder $8
          RETURNING id, title, description, end_date, priority, created_by, created_at, group_id, user_id, start_date -- <-- Added start_date to RETURNING
      `;

      if (scope === 'myself') {
          // Parameters for personal deadline: [title, desc, end_date, priority, created_by, group_id (NULL), user_id, start_date (CURRENT_TIMESTAMP)]
          const params = [
              commonFields.title,       // $1
              commonFields.description, // $2
              commonFields.end_date,    // $3 (value from frontend)
              commonFields.priority,    // $4
              commonFields.created_by,  // $5
              null,                     // $6 (group_id = NULL)
              userId,                   // $7 (user_id = owner)
              new Date().toISOString()  // $8 (start_date = current timestamp as ISO string)
          ];
          // ... client.query(insertQueryBase, params); // execute query with 8 parameters

          const result = await client.query(insertQueryBase, params);
          createdItems.push(result.rows[0]);
      } else { // scope === 'groups'
          // Parameters for each group deadline: [title, desc, end_date, priority, created_by, group_id, user_id (NULL), start_date (CURRENT_TIMESTAMP)]
          const paramsBase = [
              commonFields.title,       // $1
              commonFields.description, // $2
              commonFields.end_date,    // $3 (value from frontend)
              commonFields.priority,    // $4
              commonFields.created_by,  // $5
              // $6 group_id will be added in loop
              // $7 user_id is NULL
              // $8 start_date will be added in loop
          ];

          for (const groupId of groups) {
              // Combine base params (5) + specific group_id (1) + NULL user_id (1) + start_date (1) = 8 parameters total
              const currentParams = [
                  ...paramsBase,
                  Number(groupId),          // $6
                  null,                     // $7 (user_id = NULL for group deadlines)
                  new Date().toISOString()  // $8 (start_date = current timestamp)
              ];
              console.log(`DEBUG_BACKEND_SCHEDULE_POST: Inserting for group ${groupId} with params:`, currentParams);
              // ... client.query(insertQueryBase, currentParams); // execute query with 8 parameters

              const result = await client.query(insertQueryBase, currentParams);
              createdItems.push(result.rows[0]);
          }
      }

      await client.query('COMMIT'); // Commit transaction

      // 4. Adapt response format to match frontend expectation
      console.log(`DEBUG_BACKEND_SCHEDULE_POST: Successfully created ${createdItems.length} items.`);
      const formattedCreatedItems = createdItems.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          due_date: item.end_date ? item.end_date.toISOString() : null, // Format date as ISO string
          // Convert group_id to groups array (if group_id is not null)
          // For the response, if creating multiple items for groups, we might want to return an array of created items.
          // Or if the frontend expects one item representing the logical deadline, it needs adapting.
          // Let's return an array of created items, and frontend can process it.
          groups: item.group_id ? [String(item.group_id)] : [], // Frontend expects array of strings/numbers
          priority: item.priority,
          created_by: item.created_by,
          created_at: item.created_at ? item.created_at.toISOString() : null,
           user_id: item.user_id, // Include if used
      }));


      // 5. Send response
      res.status(201).json(formattedCreatedItems); // Return array of created items

  } catch (error) {
      await client.query('ROLLBACK'); // Rollback on error
      console.error('Error creating schedule item(s):', error);
      // Return 500 status with error message
      res.status(500).json({ message: 'Ошибка при создании дедлайна(ов).', error: error.message });
  } finally {
      if (client) client.release(); // Release client
  }
});


// PUT /api/schedule/:id - Update a schedule item
app.put('/api/schedule/:id', authenticateToken, async (req, res) => {
  const scheduleItemId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { title, description, end_date, priority, scope, groups } = req.body; // Updated data

  let client;
  try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // 1. Get existing item(s) and check permissions
      // Need to fetch all items potentially linked by ID (if deleting/recreating for group change)
      // Or just the single item if it's a personal or single group item being updated in place.
      // Let's assume for simplicity that editing a group deadline means editing ONE specific entry for ONE group.
      // Changing scope (personal <=> group) or changing groups becomes a delete+create operation.
      const existingItemResult = await client.query('SELECT * FROM schedule WHERE id = $1', [scheduleItemId]);
      const existingItem = existingItemResult.rows[0];

      if (!existingItem) {
           await client.query('ROLLBACK');
           return res.status(404).json({ message: 'Дедлайн не найден.' });
      }

      // Check permissions: Admin OR creator OR curator of item's group OR (if personal) owner
      let canEdit = false;
      if (userRole === 'admin') {
          canEdit = true;
      } else if (existingItem.created_by === userId) { // Creator can always edit their own
           canEdit = true;
      } else if (userRole === 'curator' && existingItem.group_id) { // Curator might edit if it's for their group
           const curatingGroups = await getUserGroupIds(userId, userRole, client);
           if (curatingGroups.includes(existingItem.group_id)) {
                canEdit = true;
           }
      }
      // Parent/Student can only edit items where created_by === userId (handled above)

      if (!canEdit) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Недостаточно прав для редактирования этого дедлайна.' });
      }

      // 2. Update Logic - Handle scope and group changes
      const isExistingPersonal = existingItem.group_id === null;
      const isNewPersonal = scope === 'myself';

      if (isExistingPersonal && isNewPersonal) {
          // Case 1: Personal => Personal - Simple update
          const result = await client.query(
              `UPDATE schedule SET title = $1, description = $2, end_date = $3, priority = $4
               WHERE id = $5 RETURNING id, title, description, end_date, priority, created_by, created_at, group_id, user_id`,
              [title, description || null, end_date, priority, scheduleItemId]
          );
           await client.query('COMMIT');
           res.status(200).json(result.rows[0]); // Return the updated item
      } else if (!isExistingPersonal && !isNewPersonal) {
           // Case 2: Group => Group - Can be complex if changing groups/multiple entries.
           // For simplicity, assume editing ONE entry for ONE group.
           // If the user wants to change groups, it's treated as delete old + create new.
           // If just updating fields for the SAME group, update in place.

           // TODO: If changing groups or if using M2M, this needs complex logic (delete old links/entries, create new).
           // For now, let's just update fields if the group_id is NOT changing (or ignore group_ids in payload?).
           // A safer approach for scope change (Personal <=> Group) or group change is Delete + Create.
           // Let's simplify: PUT only updates fields for the given ID. If scope/groups change, frontend calls DELETE then POST.

           // Simple update of fields for an existing group deadline entry by its ID
           const result = await client.query(
               `UPDATE schedule SET title = $1, description = $2, end_date = $3, priority = $4
                WHERE id = $5 RETURNING id, title, description, end_date, priority, created_by, created_at, group_id, user_id`,
               [title, description || null, end_date, priority, scheduleItemId]
           );
            await client.query('COMMIT');
            res.status(200).json(result.rows[0]); // Return updated item

      } else if (isExistingPersonal && !isNewPersonal) {
           // Case 3: Personal => Group - Not allowed via PUT, needs Delete Personal + Create Group(s).
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Нельзя изменить личный дедлайн на дедлайн группы напрямую. Удалите личный и создайте дедлайн для групп.' });
      } else if (!isExistingPersonal && isNewPersonal) {
           // Case 4: Group => Personal - Not allowed via PUT, needs Delete Group(s) + Create Personal.
           await client.query('ROLLBACK');
           return res.status(400).json({ message: 'Нельзя изменить дедлайн группы на личный дедлайн напрямую. Удалите дедлайн группы и создайте личный.' });
      }


  } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating schedule item:', error);
      res.status(500).json({ message: 'Ошибка при обновлении дедлайна.', error: error.message });
  } finally {
      if (client) client.release();
  }
});


// DELETE /api/schedule/:id - Delete a schedule item
app.delete('/api/schedule/:id', authenticateToken, async (req, res) => {
  const scheduleItemId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  let client;
  try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // 1. Get existing item(s) to check permissions
      // Need to fetch details including created_by and group_id
      const existingItemResult = await client.query('SELECT id, created_by, group_id FROM schedule WHERE id = $1', [scheduleItemId]);
      const existingItem = existingItemResult.rows[0];

      if (!existingItem) {
           await client.query('ROLLBACK');
           return res.status(404).json({ message: 'Дедлайн не найден.' });
      }

      // Check permissions: Admin OR creator OR curator of item's group
      let canDelete = false;
      if (userRole === 'admin') {
          canDelete = true;
      } else if (existingItem.created_by === userId) { // Creator can delete their own
           canDelete = true;
      } else if (userRole === 'curator' && existingItem.group_id) { // Curator might delete if it's for their group
           const curatingGroups = await getUserGroupIds(userId, userRole, client);
           if (curatingGroups.includes(existingItem.group_id)) {
                canDelete = true;
           }
      }
      // Parent/Student can only delete items where created_by === userId (handled above)

      if (!canDelete) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Недостаточно прав для удаления этого дедлайна.' });
      }

      // 2. Deletion Logic
      // If using M2M table schedule_groups, need to delete from there first.
      // For creating multiple schedule entries per group, just delete by ID.

      // Delete the schedule item(s) by ID
      const result = await client.query('DELETE FROM schedule WHERE id = $1', [scheduleItemId]);

      if (result.rowCount === 0) {
           // Should not happen if item was found, but as a safeguard
           await client.query('ROLLBACK');
           return res.status(404).json({ message: 'Дедлайн не найден или уже удален.' });
      }

      await client.query('COMMIT'); // Commit transaction

      // 3. Send response
      res.status(200).json({ message: 'Дедлайн успешно удален.' }); // Or 204 No Content

  } catch (error) {
      await client.query('ROLLBACK'); // Rollback on error
      console.error('Error deleting schedule item:', error);
      res.status(500).json({ message: 'Ошибка при удалении дедлайна.', error: error.message });
  } finally {
      if (client) client.release(); // Release client
  }
});

// --- GET /api/schedule/upcoming - Get upcoming schedule items (Burning Deadlines) ---
app.get('/api/schedule/upcoming', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { days } = req.query; // Number of upcoming days

  const numDays = parseInt(days, 10);
  if (isNaN(numDays) || numDays < 0) {
      return res.status(400).json({ message: 'Неверный параметр "days".' });
  }

  let client;
  try {
      client = await pool.connect();

      // --- Apply Role-Based Filtering (Same logic as GET /api/schedule) ---
      let roleClause = '';
      const userGroupIds = await getUserGroupIds(userId, userRole, client);
      const roleParams = [];
      let paramIndex = 1;

      if (userRole !== 'admin') {
          if (userGroupIds.length > 0) {
              roleClause = ` AND (s.created_by = $${paramIndex} OR s.group_id IN (${userGroupIds.map((_, i) => `$${paramIndex + 1 + i}`).join(', ')}) OR s.group_id IS NULL)`;
              roleParams.push(userId, ...userGroupIds);
              paramIndex += 1 + userGroupIds.length;
          } else {
               roleClause = ` AND (s.created_by = $${paramIndex} OR s.group_id IS NULL)`;
               roleParams.push(userId);
               paramIndex++;
          }
      }
      // Admin sees all

      // --- Apply Upcoming Date Filtering ---
      const now = new Date();
      const endDate = addDays(now, numDays); // End date is now + N days

      // end_date is between now (inclusive) and endDate (inclusive) AND end_date is in the future (optional, but good)
      // Using >= NOW() ensures we don't show past deadlines that fall within the date range N days ago to N days from now.
      const dateClause = ` AND s.end_date BETWEEN NOW() AND $${paramIndex}`;
      const dateParams = [endDate.toISOString()];
      paramIndex++; // Consume parameter


      // --- Build Final Query ---
      const finalQuery = `
          SELECT s.id, s.title, s.description, s.end_date, s.priority, s.created_by, s.created_at, s.group_id
          FROM schedule s
          WHERE 1=1
          ${roleClause} -- Apply role filter
          ${dateClause} -- Apply upcoming date filter
          ORDER BY s.end_date
      `;

      // Execute the query
      const result = await client.query(finalQuery, [...roleParams, ...dateParams]); // Combine role and date parameters

      // Format results (same as GET /api/schedule)
      const formattedResults = result.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          due_date: item.end_date ? item.end_date.toISOString() : null,
          groups: item.group_id ? [String(item.group_id)] : [], // Adapt to frontend groups array format
          priority: item.priority,
          created_by: item.created_by,
          created_at: item.created_at ? item.created_at.toISOString() : null,
           user_id: item.user_id, // Include if used
      }));


      // Send the response
      res.json(formattedResults);

  } catch (error) {
      console.error('Error fetching upcoming schedule items:', error);
      res.status(500).json({ message: 'Ошибка при получении предстоящих дедлайнов.', error: error.message });
  } finally {
      if (client) client.release(); // Release client
  }
});


// --- Запуск сервера ---
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});