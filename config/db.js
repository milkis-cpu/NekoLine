require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('Змінна MONGO_URI не знайдена в .env файлі!');
        }
        const conn = await mongoose.connect(mongoURI);
        console.log(`🟢 MongoDB підключено: ${conn.connection.host}`);
    } catch (error) {
        console.error(`🔴 Помилка підключення до MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;