-- Таблица пользователей (users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'curator', 'parent', 'student')),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица групп (groups)
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    curator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица связи студент-группа (student_groups)
CREATE TABLE student_groups (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (student_id, group_id, is_active) 
    -- Ограничение, чтобы у студента была только одна активная группа
);

-- Таблица истории перемещений студентов по группам
CREATE TABLE student_group_history (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    from_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    to_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    moved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    moved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT
);

-- Таблица связи родитель-студент (parent_students)
CREATE TABLE parent_students (
    parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    relationship VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (parent_id, student_id)
);

-- Таблица шаблонов документов (document_templates)
CREATE TABLE document_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    template_fields JSONB,
    file_url VARCHAR(255),
    required_signatures JSONB,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE document_templates
ADD COLUMN html_template TEXT;

-- Таблица документов (documents)
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    template_id INTEGER REFERENCES document_templates(id) ON DELETE SET NULL, -- Новое поле, ссылается на шаблон
    content TEXT, -- Поле для текстового содержимого или данных документа
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    student_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL, -- Предполагается, что группа документа (например, группа студента)
    file_url VARCHAR(255), -- URL или UUID файла во внешнем хранилище
    submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Кто загрузил/создал документ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id), -- Кто ПОСЛЕДНИЙ раз рецензировал (одобрил/отклонил/архивировал)
    review_comment TEXT, -- Комментарий рецензента (при отклонении)
    original_filename VARCHAR(255), -- Оригинальное имя файла при загрузке
    content_type VARCHAR(100) -- Content-Type файла при загрузке
);

-- CHECK ограничение на статус
ALTER TABLE documents
ADD CONSTRAINT documents_status_check CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'archived', 'pending'));

-- Таблица подписей документов (document_signatures)
CREATE TABLE document_signatures (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE, -- Ссылка на документ, который подписали
    signature_slot_name VARCHAR(100), -- Имя слота подписи из шаблона (например, 'student', 'curator', 'doctor')
    signed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Кто подписал (если это пользователь системы, например, куратор)
    signed_as_name VARCHAR(255), -- Имя, под которым поставлена подпись (если подписант не пользователь системы, например, внешний врач)
    signature_image_uuid UUID, -- UUID файла изображения подписи в хранилище (FastAPI)
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Время подписи
    status VARCHAR(50) DEFAULT 'signed' CHECK (status IN ('pending', 'signed', 'rejected')), -- Статус подписи (например, подписано, отклонено)
    -- Дополнительно можно добавить поля для координат подписи на документе, если это нужно для отображения поверх PDF
    UNIQUE (document_id, signature_slot_name) -- Убедиться, что один слот подписи может быть подписан только один раз для данного документа
);

-- Таблица запросов (requests)
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) CHECK (type IN ('document', 'permission', 'absence', 'assistance', 'other')),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'rejected')),
    urgency VARCHAR(50) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
    student_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расписания (schedule)
CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    location VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица уведомлений (notifications)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('system', 'document', 'request', 'deadline', 'general')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    related_entity_type VARCHAR(50),
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица настроек уведомлений (notification_settings)
CREATE TABLE notification_settings (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) CHECK (channel IN ('in_app', 'email', 'telegram')),
    notification_type VARCHAR(50) CHECK (notification_type IN ('document', 'request', 'system', 'deadline', 'news')),
    is_enabled BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, channel, notification_type)
);

-- Таблица активности пользователей (user_activity)
CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



-- Сначала удаляем таблицы, которые ссылаются на другие
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_activity CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS document_signatures CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;
DROP TABLE IF EXISTS parent_students CASCADE;
DROP TABLE IF EXISTS student_group_history CASCADE;
DROP TABLE IF EXISTS student_groups CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS file_storage_metadata CASCADE;



SELECT * FROM users
SELECT * FROM groups
SELECT * FROM documents
SELECT * FROM document_templates
SELECT * FROM document_signatures
SELECT template_id FROM documents WHERE id = 10;




-- Вставка всех пользователей (изначальные + новые кураторы, студенты, родители)
-- ID будут присвоены автоматически, начиная с 1
INSERT INTO users (full_name, role, email, password_hash, phone, avatar_url, is_active) VALUES
-- Изначальные пользователи (получат ID 1, 2, 3)
('Биржанов Арлан', 'admin', 'arlan@example.com', '$2a$10$t0WYMMu6PkgXpLVFlIrmluBR35e61oGl1Pe.63bSoaGX4K9EGpZPy', '+79011234567', 'https://randomuser.me/api/portraits/men/1.jpg', true),
('Ермек Ахмед', 'curator', 'ahmed@example.com', '$2a$10$F0TMGQVukvfgQTiTQ4OXoOARrwYdnjyep4abn6oNZrsMY1PJV5/cO', '+79031234567', 'https://randomuser.me/api/portraits/men/3.jpg', true),
('Тойшыбаев Жаслан', 'parent', 'jaslan@example.com', '$2a$10$iIGfib7Ld938EPY6K.1PQ.hpKR6VlCAaWRiOdiHcX.4Jffw.LP8VO', '+79051234567', 'https://randomuser.me/api/portraits/men/5.jpg', true),

-- Новые кураторы (получат ID 4, 5, 6)
('Иванов Петр', 'curator', 'ivanov.p@example.com', '$2a$10$DUMMYHASHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', null, null, true),
('Сидорова Анна', 'curator', 'sidorova.a@example.com', '$2a$10$DUMMYHASHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', null, null, true),
('Ковалев Сергей', 'curator', 'kovalev.s@example.com', '$2a$10$DUMMYHASHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', null, null, true),

-- Студенты (получат ID с 7 по 36)
('Студент 1', 'student', 'student1@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..6.Dfra2prGZ/auLyLevvMbt3KoJkxKe', null, null, true), -- ID 7
('Студент 2', 'student', 'student2@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..zoKB70evclup1etPucVz7v7ElEo7jAK', null, null, true), -- ID 8
('Студент 3', 'student', 'student3@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..wAUF5BITHHM6n3B.lk6ORSYTOeepWtS', null, null, true), -- ID 9
('Студент 4', 'student', 'student4@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..w2VTdQ9tQKHxdb3MOR6O1vc4gnHwC.2', null, null, true), -- ID 10
('Студент 5', 'student', 'student5@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..OXc0HNTaVkJsoEiTof725Tg0oLPJzsG', null, null, true), -- ID 11
('Студент 6', 'student', 'student6@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..vGfbj8gG6i44QVjKpo4.7OOG99Ezt2q', null, null, true), -- ID 12
('Студент 7', 'student', 'student7@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..CIjx5sIXIGpeD0glcaN6ARahndggKcu', null, null, true), -- ID 13
('Студент 8', 'student', 'student8@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..wFV6J1XrOe0meukJGLwlO3f1ukqBKAO', null, null, true), -- ID 14
('Студент 9', 'student', 'student9@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..uVzpU5d2p0Su0QmDmYNd7Y1.oC1aigO', null, null, true), -- ID 15
('Студент 10', 'student', 'student10@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..kVMacEYTBPl2bC.f1rgNVpWvS3Vw/Zi', null, null, true), -- ID 16
('Студент 11', 'student', 'student11@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..90aoa93r4upMEu2gIB8LkShiTX6xNH2', null, null, true), -- ID 17
('Студент 12', 'student', 'student12@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..M1ovqc1a0.4/vqIWLQ.AL7bgKusLeUa', null, null, true), -- ID 18
('Студент 13', 'student', 'student13@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..5mjMc7zMbjz8hS46yMTYn9wBy0uXx9G', null, null, true), -- ID 19
('Студент 14', 'student', 'student14@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..C/jkt.Mc5sgjAdMiqZf8oS4pVnE7E.2', null, null, true), -- ID 20
('Студент 15', 'student', 'student15@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..JvPObeIrAmXs0g/Qq8kvePhFBK1h/yK', null, null, true), -- ID 21
('Студент 16', 'student', 'student16@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..20KuoWIM2TluDAHwJYEEpzEZVkbf3zy', null, null, true), -- ID 22
('Студент 17', 'student', 'student17@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..TFeqLRkOvniMNEZNhgN3KFy82Odd0Zy', null, null, true), -- ID 23
('Студент 18', 'student', 'student18@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..M6zSbdJIBzTqPfhhPV1XFMiE..yuY82', null, null, true), -- ID 24
('Студент 19', 'student', 'student19@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..qSta7f7DwiqD0YJKnyiV8GPD8dqD/l2', null, null, true), -- ID 25
('Студент 20', 'student', 'student20@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz...DpswsWBoeGBfGIWFKg36OCXFNGG6c2', null, null, true), -- ID 26
('Студент 21', 'student', 'student21@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..gdRbIRpBzpQjy19W97VWpwF0vFrYKG.', null, null, true), -- ID 27
('Студент 22', 'student', 'student22@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..bnDvKx3.z5YFylRRuNihSuDxeRKWxr.', null, null, true), -- ID 28
('Студент 23', 'student', 'student23@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..Vr0hXwRttSHkhRYkMZPlow0ZAzw8aZS', null, null, true), -- ID 29
('Студент 24', 'student', 'student24@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..kGIFG8A5Gea3k7iLRDE0Fb5dm/YFwAO', null, null, true), -- ID 30
('Студент 25', 'student', 'student25@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..q6H4hPK129asL03hpURAitmysaMo0um', null, null, true), -- ID 31
('Студент 26', 'student', 'student26@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..xHrlA5FYKKhINvk0o5ENH9NJBOG2q12', null, null, true), -- ID 32
('Студент 27', 'student', 'student27@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..oWNMmV.wQYfLWCNjVphLYGhgq0Qbwz6', null, null, true), -- ID 33
('Студент 28', 'student', 'student28@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..t9jzfEdZZ3H22C7wc96FP7TXuJ5m21.', null, null, true), -- ID 34
('Студент 29', 'student', 'student29@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..zUMdQkOeNoV5x18rYBycg8CYN6XxZZC', null, null, true), -- ID 35
('Студент 30', 'student', 'student30@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..wmR1AVXXpmJMafUHWil8xMMx.lxKKK2', null, null, true), -- ID 36

-- Родители (получат ID с 37 по 66)
('Родитель 1', 'parent', 'parent1@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..aBobNEZCEZ4Z/8X/55A1OmBpNaNutuW', null, null, true), -- ID 37
('Родитель 2', 'parent', 'parent2@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..OKZN/FM7Bo.VH1F5xgz4ogU76YnDmL2', null, null, true), -- ID 38
('Родитель 3', 'parent', 'parent3@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..DzU9Y9ZTsIR/M0NBEwJUd./P.rI9DPW', null, null, true), -- ID 39
('Родитель 4', 'parent', 'parent4@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..quLJbVVZGzco.ISPE1pwf6KPrxloxS6', null, null, true), -- ID 40
('Родитель 5', 'parent', 'parent5@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..gnp5LFVQT/3oXhuzutYTZky/vslUgmW', null, null, true), -- ID 41
('Родитель 6', 'parent', 'parent6@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..6s4evNsmnAEfrwFivmCo1VNbGnYaGWS', null, null, true), -- ID 42
('Родитель 7', 'parent', 'parent7@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..UkUculN9aPMBv0IajNS69wdwRLUcsMO', null, null, true), -- ID 43
('Родитель 8', 'parent', 'parent8@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..LWKehwsBGdG.Q.wuUF7ymhTOxlALIoC', null, null, true), -- ID 44
('Родитель 9', 'parent', 'parent9@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..UAxkinX.nuhQUgaEJFhvuhCh5ZgtbCO', null, null, true), -- ID 45
('Родитель 10', 'parent', 'parent10@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..pCzjHOZfXLoVhkAuyzExHyi1bKpyZFy', null, null, true), -- ID 46
('Родитель 11', 'parent', 'parent11@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz...dtZ/mjlQ9G42xTxZ7KmP4zfWiJwFeq', null, null, true), -- ID 47
('Родитель 12', 'parent', 'parent12@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..s/GF8bIIGqMUlbC3gdeaedTfnDGosMG', null, null, true), -- ID 48
('Родитель 13', 'parent', 'parent13@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..6EqAxTZyeUmB8vQZBKsgUjMUdgZnZRy', null, null, true), -- ID 49
('Родитель 14', 'parent', 'parent14@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..9el30b20LyxO9mifftJoyFIxE5UV5sy', null, null, true), -- ID 50
('Родитель 15', 'parent', 'parent15@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..Oea21bcUp63hcFHphWJADyQoBnB/Y9u', null, null, true), -- ID 51
('Родитель 16', 'parent', 'parent16@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..y5DUpUc.89aKCwUZwQaZ0z/ArvSN6b6', null, null, true), -- ID 52
('Родитель 17', 'parent', 'parent17@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..9Oq9YYdrIziZ24uEnqyR9ntH8aaZVk.', null, null, true), -- ID 53
('Родитель 18', 'parent', 'parent18@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..ZXAw3TzDCMGWGoRUH.qgsUqZ5gcWF/6', null, null, true), -- ID 54
('Родитель 19', 'parent', 'parent19@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..ypzZc0B80O54dUpBbXO76VzgwFeyraW', null, null, true), -- ID 55
('Родитель 20', 'parent', 'parent20@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..2H8tAe93WYubIx2/5./ggAS2Hm2A05i', null, null, true), -- ID 56
('Родитель 21', 'parent', 'parent21@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..YKTq6f9KYGR4y/P1xQ0U7eNX5H9dwau', null, null, true), -- ID 57
('Родитель 22', 'parent', 'parent22@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..23VUNJTF3NozGOhnLtk.7dyy7qFOVY2', null, null, true), -- ID 58
('Родитель 23', 'parent', 'parent23@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..SYg9HNN9A8ZS4iDEwMwxrBGelrxjVou', null, null, true), -- ID 59
('Родитель 24', 'parent', 'parent24@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..S3eceb3DlltjYGZ3H89IEDpfveo8IWK', null, null, true), -- ID 60
('Родитель 25', 'parent', 'parent25@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..RnKXuGlYfr3cRRtSDBM5emuFW4d.8ti', null, null, true), -- ID 61
('Родитель 26', 'parent', 'parent26@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..bP7CeiHlu3aN3OlMASiq.o7OQlYEoaa', null, null, true), -- ID 62
('Родитель 27', 'parent', 'parent27@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..IONEqiYyG9fVw6jgiMB3x83ml0my/V.', null, null, true), -- ID 63
('Родитель 28', 'parent', 'parent28@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..es7UECAgjBlEJEnEURC8pbE7PrVzqDG', null, null, true), -- ID 64
('Родитель 29', 'parent', 'parent29@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..VkQYoF5rlLjBFga2NWIEGsJ1VcQq5Ka', null, null, true), -- ID 65
('Родитель 30', 'parent', 'parent30@example.com', '$2b$10$yRNt6Q6oM9Iup9WMUAnz..iY..klIg.Vc5ANR6oN2glM3G9sLVTRK', null, null, true); -- ID 66


-- Вставка новых групп (получат ID 1, 2, 3)
-- Используем ID новых кураторов (4, 5, 6)
INSERT INTO groups (name, description, curator_id, is_active) VALUES
('ПО2301', 'Программное обеспечение 2023 года, группа 1', 4, true), -- Куратор ID 4
('ПО2302', 'Программное обеспечение 2023 года, группа 2', 5, true), -- Куратор ID 5
('ПО2303', 'Программное обеспечение 2023 года, группа 3', 6, true); -- Куратор ID 6


-- Привязка студентов к группам (10 студентов к каждой из новых групп)
-- Используем ID студентов (7-36) и ID групп (1, 2, 3)
INSERT INTO student_groups (student_id, group_id, is_active) VALUES
(7, 1, true), (8, 1, true), (9, 1, true), (10, 1, true), (11, 1, true), (12, 1, true), (13, 1, true), (14, 1, true), (15, 1, true), (16, 1, true), -- ПО2301 (ID 1)
(17, 2, true), (18, 2, true), (19, 2, true), (20, 2, true), (21, 2, true), (22, 2, true), (23, 2, true), (24, 2, true), (25, 2, true), (26, 2, true), -- ПО2302 (ID 2)
(27, 3, true), (28, 3, true), (29, 3, true), (30, 3, true), (31, 3, true), (32, 3, true), (33, 3, true), (34, 3, true), (35, 3, true), (36, 3, true); -- ПО2303 (ID 3)


-- Привязка родителей к студентам (один родитель на студента)
-- Используем ID родителей (37-66) и ID студентов (7-36)
INSERT INTO parent_students (parent_id, student_id, relationship, is_primary) VALUES
(37, 7, 'Родитель', true), (38, 8, 'Родитель', true), (39, 9, 'Родитель', true), (40, 10, 'Родитель', true), (41, 11, 'Родитель', true),
(42, 12, 'Родитель', true), (43, 13, 'Родитель', true), (44, 14, 'Родитель', true), (45, 15, 'Родитель', true), (46, 16, 'Родитель', true),
(47, 17, 'Родитель', true), (48, 18, 'Родитель', true), (49, 19, 'Родитель', true), (50, 20, 'Родитель', true), (51, 21, 'Родитель', true),
(52, 22, 'Родитель', true), (53, 23, 'Родитель', true), (54, 24, 'Родитель', true), (55, 25, 'Родитель', true), (56, 26, 'Родитель', true),
(57, 27, 'Родитель', true), (58, 28, 'Родитель', true), (59, 29, 'Родитель', true), (60, 30, 'Родитель', true), (61, 31, 'Родитель', true),
(62, 32, 'Родитель', true), (63, 33, 'Родитель', true), (64, 34, 'Родитель', true), (65, 35, 'Родитель', true), (66, 36, 'Родитель', true);





-- Вставка шаблона "Справка о заболевании"
-- Вставка обновленного шаблона "Справка о заболевании"
INSERT INTO document_templates (name, description, template_fields, required_signatures)
VALUES (
    'Справка о заболевании',
    'Шаблон для оформления справки, подтверждающей временную нетрудоспособность студента по болезни. Требует цифровой подписи куратора после предоставления бумажной копии справки.',
    '[
      { "name": "illness_start_date", "label": "Дата начала отсутствия", "type": "date", "required": true },
      { "name": "illness_end_date", "label": "Дата окончания отсутствия", "type": "date", "required": true },
      { "name": "diagnosis", "label": "По какой причине отсутствовал (Диагноз)", "type": "textarea", "required": true },
      { "name": "issuing_institution", "label": "Наименование медицинского учреждения", "type": "text", "required": true },
      { "name": "issue_date", "label": "Дата выдачи справки", "type": "date", "required": true },
      { "name": "notes", "label": "Примечания (опционально)", "type": "textarea", "required": false }
    ]',
    '[
      { "role": "curator", "title": "Проверено куратором" },
	  { "role": "admin", "title": "Проверено администратором" }
    ]'
);
-- Только цифровая подпись куратора

-- Вставка обновленного шаблона "Заявление на академический отпуск"
INSERT INTO document_templates (name, description, template_fields, required_signatures)
VALUES (
    'Заявление на академический отпуск',
    'Шаблон заявления на предоставление академического отпуска студенту. Требует цифровых подписей куратора и декана.',
    '[
      { "name": "leave_reason_type", "label": "Тип причины академического отпуска", "type": "select", "required": true, "options": [ {"value": "medical", "label": "По медицинским показаниям"}, {"value": "family", "label": "По семейным обстоятельствам"}, {"value": "other", "label": "Иная причина"} ] },
      { "name": "leave_reason_details", "label": "По какой причине берется академический отпуск", "type": "textarea", "required": true, "placeholder": "Укажите подробности причины академического отпуска" },
      { "name": "leave_start_date", "label": "Предполагаемая дата начала отпуска", "type": "date", "required": true },
      { "name": "leave_end_date", "label": "Предполагаемая дата окончания отпуска", "type": "date", "required": true }
    ]',
    '[
      { "role": "curator", "title": "Согласовано куратором" },
      { "role": "dean", "title": "Утверждено деканом" },
	  { "role": "admin", "title": "Утверждено администратором" }
    ]'
);
-- Цифровая подпись администратора
-- Цифровая подпись куратора
-- Цифровая подпись декана

-- Обновление шаблона "Справка о заболевании"
UPDATE document_templates
SET html_template = '
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Справка о заболевании</title>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.5; margin: 30mm 20mm; font-size: 11pt; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .underline { text-decoration: underline; }
  .margin-top { margin-top: 15px; }
  .margin-bottom { margin-bottom: 15px; }
  .indent { text-indent: 20mm; }
  .signature-line { display: inline-block; min-width: 120px; border-bottom: 1px solid #000; height: 1.2em; vertical-align: bottom; margin: 0 10px; }
  .stamp-placeholder { display: inline-block; width: 80px; height: 80px; border: 2px dashed #ccc; text-align: center; line-height: 80px; vertical-align: middle; font-size: 10pt; color: #888;}
    /* Стили для блока цифровой подписи, если он будет добавлен */
  .digital-signature-block {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px dashed #ccc; /* Легкая граница для отделения */
      font-size: 10pt;
      color: #555;
  }
   .digital-signature-block .signatureRole { font-weight: bold; margin-bottom: 2px; }
   .digital-signature-block .signatureName { font-style: italic; margin-bottom: 2px; }
   /* Обратите внимание: стиль для img tag задан инлайн при его генерации во фронтенде */
</style>
</head>
<body>

<div class="center margin-bottom">
  <span class="bold">СПРАВКА</span><br>
  <span class="bold">о временной нетрудоспособности студента</span><br>
  <span class="underline">{{naimenovanie_uchebnogo_zavedeniya}}</span> </div>

<div class="margin-top">
  <p>Выдана: <span class="underline">{{student_name}}</span></p>
  <p>студенту {{student_course}} курса группы № {{student_group}}</p>
</div>

<div class="margin-top">
  <p>Освобождается от учебных занятий по болезни</p>
  <p>с <span class="underline">{{illness_start_date}}</span> по <span class="underline">{{illness_end_date}}</span> включительно.</p>
  <p>Диагноз: {{diagnosis}}</p>
  <p>Примечания: {{notes}}</p>
</div>

<div class="margin-top">
  <p>Врач: _________________________</p>
</div>

<div class="margin-top">
  <p>Дата выдачи справки: <span class="underline">{{issue_date}}</span></p>
</div>

<div class="margin-top">
    <p>Подпись врача: <span class="signature-line"></span></p>
    <p style="display: inline-block; vertical-align: top; margin-left: 50px;">
        Место печати<br>
        <span class="stamp-placeholder">Печать</span>
    </p>
</div>

<div class="digital-signature-block">
   Подписано ({{digital_signature_role}}): {{digital_signature_name}}
   <br>
   {{digital_signature_image_html}}
   <br>
   </div>


</body>
</html>
</textarea>
'
WHERE id = 1; -- Замените ИД_СПРАВКИ на реальный ID из вашей БД

-- Обновление шаблона "Заявление на академический отпуск"
UPDATE document_templates
SET html_template = '
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Заявление на академический отпуск</title>
<style>
  body { font-family: "Times New Roman", Times, serif; line-height: 1.5; margin: 40mm 20mm; font-size: 12pt; }
  .align-right { text-align: right; }
  .align-left { text-align: left; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .underline { text-decoration: underline; }
  .margin-top { margin-top: 20px; }
  .margin-bottom { margin-bottom: 20px; }
  .indent { text-indent: 30mm; } /* Абзацный отступ */
  .signature-line { display: inline-block; min-width: 150px; border-bottom: 1px solid #000; height: 1.2em; vertical-align: bottom; margin: 0 10px; }
  /* Стили для блока цифровой подписи, если он будет добавлен */
  .digital-signature-block {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px dashed #ccc; /* Легкая граница для отделения */
      font-size: 10pt;
      color: #555;
  }
   .digital-signature-block .signatureRole { font-weight: bold; margin-bottom: 2px; }
   .digital-signature-block .signatureName { font-style: italic; margin-bottom: 2px; }
   /* Обратите внимание: стиль для img tag задан инлайн при его генерации во фронтенде */
</style>
</head>
<body>

<div class="align-right">
  Ректору<br>
  <span class="underline">{{naimenovanie_uchebnogo_zavedeniya}}</span><br>
  ____________________________<br>
  от студента {{student_course}} курса группы {{student_group}}<br>
  ФИО: {{student_name}}<br>
  ____________________________
</div>

<div class="center margin-top margin-bottom">
  <span class="bold">ЗАЯВЛЕНИЕ</span>
</div>

<div>
  <p class="indent">Прошу предоставить мне академический отпуск</p>
  <p class="indent">по причине <span class="underline">{{leave_reason_type_translated}}</span> - {{leave_reason_details}}</p>
  <p class="indent">с <span class="underline">{{leave_start_date}}</span> по <span class="underline">{{leave_end_date}}</span>.</p>
</div>

<div class="margin-top">
  <p>Дата: {{data_segodnya}}</p>
</div>

<div class="margin-top">
  <p>Подпись студента: <span class="signature-line"></span></p>
</div>

<div class="digital-signature-block">
   Подписано ({{digital_signature_role}}): {{digital_signature_name}}
   <br>
   {{digital_signature_image_html}}
   <br>
   </div>

</body>
</html>
</textarea>
'
WHERE id = 2; -- Замените ИД_ЗАЯВЛЕНИЯ на реальный ID из вашей БД


CREATE TABLE file_storage_metadata (
    uuid UUID PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

