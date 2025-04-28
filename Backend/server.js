const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = 7000;

app.use(cors());
app.use(express.json());

// Подключение к базе данных
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'CollegeDB',
  password: '12345',
  port: 5432,
});

// Секретный ключ для JWT (в продакшене должен быть в .env)
const JWT_SECRET = process.env.JWT_SECRET || 'S5Eh+qExOmQm6MTIhLAzdYNOyz9Q9yPBAxy8NY2spkngDTQN189473Br0M134B7f8C6TTYcOhRovTbijiQDiLkkRQXZb2e+Q7nFMFuX+ybOwW6xbQoHMqmQ0zXgVI5owIqDXBhP2bWyeqoKdQA7uLqi8BQFs4SgZ6dU/BuH95xCHo0E/01PZ5+Oz+i3vnkNk0Oo86Q0X+Ow31i+saVTbZKsU/bizpvcR/C5SImW/Tby//kcTrDT2bbhdWRmHrMZe9RgCBWUgMoq/fehyP9w5tKCeJnM1L7thk9vSNJYykPVWbjU+lHcBsjZB1G4furxpCsZKeSHeboH6jbJ1X96IKA==';

// Middleware для проверки авторизации
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
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

// Роут для входа в систему
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверяем, что email и пароль предоставлены
    if (!email || !password) {
      return res.status(400).json({ message: 'Email и пароль обязательны' });
    }

    // Ищем пользователя в базе данных
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash, role, avatar_url, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    // Проверяем, существует ли пользователь
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Проверяем, активен ли пользователь
    if (!user.is_active) {
      return res.status(403).json({ message: 'Учетная запись заблокирована' });
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      }, 
      JWT_SECRET,
      { expiresIn: '24h' } // Токен действителен 24 часа
    );

    // Обновляем время последнего входа
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Записываем активность пользователя
    await pool.query(
      'INSERT INTO user_activity (user_id, activity_type, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [user.id, 'login', req.ip, req.headers['user-agent']]
    );

    // Возвращаем данные пользователя и токен
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

// Роут для выхода из системы
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // Записываем активность пользователя
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

// Роут для получения данных текущего пользователя
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    // Получаем данные пользователя из базы
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

    // Возвращаем данные пользователя
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

// API для создания пользователя (только для админа)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    // Проверяем права доступа - создавать пользователей может только админ
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { full_name, email, password, role, phone } = req.body;

    // Проверяем обязательные поля
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
    }

    // Проверяем, что роль допустима
    const allowedRoles = ['admin', 'curator', 'parent', 'student'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Недопустимая роль пользователя' });
    }

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [full_name, email, passwordHash, role, phone]
    );

    res.status(201).json({ 
      message: 'Пользователь успешно создан', 
      userId: result.rows[0].id 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Ошибка при создании пользователя' });
  }
});

// API для получения списка пользователей (с фильтрацией по роли)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Проверяем права доступа - просматривать список пользователей могут админ и куратор
    if (!['admin', 'curator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    const { role } = req.query;
    let query = 'SELECT id, full_name, email, role, phone, avatar_url, is_active FROM users';
    const params = [];

    // Если указана роль, фильтруем по ней
    if (role) {
      query += ' WHERE role = $1';
      params.push(role);
    }

    // Сортируем по имени
    query += ' ORDER BY full_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
  }
});

// API для получения студентов в группе (для куратора)
app.get('/api/groups/:groupId/students', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Куратор может видеть только студентов своей группы
    if (req.user.role === 'curator') {
      // Проверяем, является ли пользователь куратором этой группы
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

    // Получаем список студентов группы
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

// API для родителя - получение списка своих детей
app.get('/api/parent/students', authenticateToken, async (req, res) => {
  try {
    // Только родитель может использовать этот API
    if (req.user.role !== 'parent') {
      return res.status(403).json({ message: 'Недостаточно прав для выполнения операции' });
    }

    // Получаем список детей родителя
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

// API для получения списка документов
app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const { status, studentId } = req.query;
    let query = `
      SELECT d.id, d.title, d.status, d.created_at, d.updated_at,
             u1.full_name as student_name,
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
    
    const params = [];
    let paramIndex = 1;

    // Фильтр по статусу
    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Фильтрация в зависимости от роли
    if (req.user.role === 'student') {
      // Студент видит только свои документы
      query += ` AND d.student_id = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'parent') {
      // Родитель видит документы своих детей
      query += ` AND d.student_id IN (
        SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex}
      )`;
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'curator') {
      // Куратор видит документы студентов своих групп
      query += ` AND d.group_id IN (
        SELECT id FROM groups WHERE curator_id = $${paramIndex}
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    // Дополнительный фильтр по студенту (для админа/куратора)
    if (studentId && ['admin', 'curator'].includes(req.user.role)) {
      query += ` AND d.student_id = $${paramIndex}`;
      params.push(studentId);
      paramIndex++;
    }

    // Сортировка
    query += ' ORDER BY d.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка документов' });
  }
});

// API для получения шаблонов документов
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

// API для создания запроса
app.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { title, description, type, documentId } = req.body;
    
    // Проверяем обязательные поля
    if (!title || !type) {
      return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
    }

    // Определяем ID студента в зависимости от роли
    let studentId = null;
    if (req.user.role === 'student') {
      studentId = req.user.id;
    }

    // Создаем запрос
    const result = await pool.query(
      `INSERT INTO requests 
       (title, description, type, student_id, document_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'new')
       RETURNING id`,
      [title, description, type, studentId, documentId, req.user.id]
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

// API для получения запросов
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT r.id, r.title, r.description, r.type, r.status, r.urgency, 
             r.created_at, r.updated_at,
             u1.full_name as student_name,
             u2.full_name as created_by_name,
             u3.full_name as assigned_to_name
      FROM requests r
      LEFT JOIN users u1 ON r.student_id = u1.id
      LEFT JOIN users u2 ON r.created_by = u2.id
      LEFT JOIN users u3 ON r.assigned_to = u3.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Фильтр по статусу
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Фильтрация в зависимости от роли
    if (req.user.role === 'student') {
      // Студент видит только свои запросы
      query += ` AND r.created_by = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'parent') {
      // Родитель видит запросы своих детей и свои
      query += ` AND (r.created_by = $${paramIndex} OR r.student_id IN (
        SELECT student_id FROM parent_students WHERE parent_id = $${paramIndex}
      ))`;
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'curator') {
      // Куратор видит запросы студентов своих групп и свои
      query += ` AND (r.created_by = $${paramIndex} OR r.student_id IN (
        SELECT sg.student_id 
        FROM student_groups sg
        JOIN groups g ON sg.group_id = g.id
        WHERE g.curator_id = $${paramIndex}
      ))`;
      params.push(req.user.id);
      paramIndex++;
    }

    // Сортировка
    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Ошибка при получении списка запросов' });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});