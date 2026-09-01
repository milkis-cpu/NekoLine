require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

console.log("URI з .env:", process.env.MONGO_URI);

// 1. СТВОРЮЄМО ЕКСПРЕС-ДОДАТОК
const app = express();

// 2. НАЛАШТУВАННЯ MIDDLEWARE (CORS + JSON)
app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 3. ПІДКТЮЧЕННЯ ДО БД
connectDB();

// ----------------------------------------------------
// СХЕМИ ТА МОДЕЛІ ДЛЯ MONGODB
// ----------------------------------------------------

// Схема користувача
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "https://i.ibb.co/default-avatar.png" },
    role: { type: String, default: "USER" },
    bio: { type: String, default: "" },
    favorites: [{ type: String }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Схема аніме з індексами для миттєвого пошуку та фільтрації
const animeSchema = new mongoose.Schema({
    shikimori_id: { type: Number, unique: true, index: true },
    title: { type: String, required: true },
    poster: String,
    description: String,
    rating: { type: Number, index: true },
    year: { type: Number, index: true },
    status: String,
    genres: { type: String, index: true }
});

// Складений індекс для правильного сортування за рейтингом усередині фільтрів
animeSchema.index({ rating: -1, year: -1 });

const Anime = mongoose.model('Anime', animeSchema);
// ----------------------------------------------------
// МАРШРУТИ (ROUTES)
// ----------------------------------------------------

// === РЕЄСТРАЦІЯ (POST /api/register) ===
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, avatar } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "Будь ласка, заповніть усі поля!" });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: "Користувач із такою поштою або нікнеймом уже існує!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            avatar: avatar || "https://i.ibb.co/default-avatar.png"
        });

        await newUser.save();

        const jwtSecret = process.env.JWT_SECRET || 'secretkey';
        const token = jwt.sign(
            { userId: newUser._id, role: newUser.role },
            jwtSecret,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: "Реєстрація успішна! 🎉",
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                avatar: newUser.avatar,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error("Помилка реєстрації:", error);
        res.status(500).json({ error: "Щось пішло не так на сервері..." });
    }
});

// === АВТОРИЗАЦІЯ (POST /api/login) ===
app.post('/api/login', async (req, res) => {
    try {
        const emailOrUsername = req.body.emailOrUsername || req.body.email || req.body.username;
        const password = req.body.password;

        if (!emailOrUsername || !password) {
            return res.status(400).json({ error: "Будь ласка, введіть логін/пошту та пароль!" });
        }

        // Шукаємо користувача за email або username
        const user = await User.findOne({
            $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
        });

        if (!user) {
            return res.status(400).json({ error: "Користувача з такими даними не знайдено" });
        }

        // Перевірка пароля (bcrypt + fallback для звичайного тексту)
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (e) {
            isMatch = false;
        }
        if (!isMatch && password === user.password) {
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(400).json({ error: "Невірний пароль" });
        }

        const jwtSecret = process.env.JWT_SECRET || 'secretkey';
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            jwtSecret, 
            { expiresIn: '7d' }
        );

        console.log(`🟢 Успішний вхід користувача: ${user.username} (${user._id})`);
        res.json({ token, user: { username: user.username, email: user.email } });

    } catch (error) {
        console.error("🔴 Помилка /api/login:", error);
        res.status(500).json({ error: "Помилка сервера при вході" });
    }
});

// === ОТРИМАННЯ ПРОФІЛЮ (GET /api/me) ===
app.get('/api/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Відсутній токен авторизації" });
        }

        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET || 'secretkey';
        const decoded = jwt.verify(token, jwtSecret);

        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            console.log("🔴 Користувача за таким ID не знайдено в БД!");
            return res.status(404).json({ error: "Користувача не знайдено" });
        }

        res.json({ user });
    } catch (error) {
        console.error("🔴 Помилка GET /api/me:", error.message);
        res.status(401).json({ error: "Недійсний або застарілий токен" });
    }
});

// === ОНОВЛЕННЯ ПРОФІЛЮ (PUT /api/me) ===
app.put('/api/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Відсутній токен авторизації" });
        }

        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET || 'secretkey';
        const decoded = jwt.verify(token, jwtSecret);

        const { avatar, bio } = req.body;
        const updateFields = {};
        if (avatar) updateFields.avatar = avatar;
        if (bio) updateFields.bio = bio;

        const updatedUser = await User.findByIdAndUpdate(
            decoded.userId,
            { $set: updateFields },
            { new: true }
        ).select('-password');

        console.log(`🟢 Профіль оновлено для ID: ${decoded.userId}`);
        res.json({ message: "Профіль успішно оновлено! ✨", user: updatedUser });

    } catch (error) {
        console.error("🔴 Помилка PUT /api/me:", error.message);
        res.status(500).json({ error: "Не вдалося оновити профіль" });
    }
});

// === ОТРИМАННЯ АНІМЕ З ВЛАСНОЇ БД MONGODB (GET /api/anime) ===
app.get('/api/anime', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 24;
        const skip = (page - 1) * limit;

        const { search, genre, type, yearFrom, yearTo, sort, orderDir } = req.query;

        let filterQuery = {};

        if (search) {
            filterQuery.title = { $regex: search, $options: 'i' };
        }

        // Обробка сумісності фільтрів жанру та типу без їх взаємного перезапису
        if (genre && genre !== 'all' && type && type !== 'all') {
            filterQuery.$and = [
                { genres: { $regex: genre, $options: 'i' } },
                { genres: { $regex: type, $options: 'i' } }
            ];
        } else if (genre && genre !== 'all') {
            filterQuery.genres = { $regex: genre, $options: 'i' };
        } else if (type && type !== 'all') {
            filterQuery.genres = { $regex: type, $options: 'i' };
        }

        if (yearFrom || yearTo) {
            filterQuery.year = {};
            if (yearFrom) filterQuery.year.$gte = parseInt(yearFrom, 10);
            if (yearTo) filterQuery.year.$lte = parseInt(yearTo, 10);
        }

        let sortOptions = {};
        const direction = orderDir === 'asc' ? 1 : -1;

        if (sort === 'ranked' || sort === 'popularity') {
            sortOptions = { rating: direction, year: -1 };
        } else if (sort === 'aired_on' || sort === 'year') {
            sortOptions = { year: direction, rating: -1 };
        } else if (sort === 'name' || sort === 'title') {
            sortOptions = { title: direction };
        } else {
            sortOptions = { rating: -1, year: -1 };
        }

        const animeList = await Anime.find(filterQuery)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        res.json(animeList);
    } catch (err) {
        console.error("Помилка завантаження з БД:", err);
        res.status(500).json({ error: "Помилка завантаження аніме з бази даних" });
    }
});

// ----------------------------------------------------
// 5. ЗАПУСК СЕРВЕРА
// ----------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер NekoStream працює на порту ${PORT}`);
});