const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Сервер віддаватиме файли з папки public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 NekoStream працює на http://localhost:${PORT}`);
    console.log(`=================================`);
});