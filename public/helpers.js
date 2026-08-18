// ==========================================
// HELPERS.JS — Константи, стан та допоміжні функції
// ==========================================

const SHIKIMORI_BASE = "https://shikimori.one";
const API_URL = 'http://localhost:5000/api';
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'><rect width='100%' height='100%' fill='%231f222e'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23a855f7' font-family='sans-serif' font-size='18' font-weight='bold'>🎬 Без постера</text></svg>";

// Глобальний стан
let currentAnimeList = [];
let favorites = JSON.parse(localStorage.getItem('nekostream_favs')) || [];
let selectedGenre = 'all';
let currentSort = 'rating-desc';
let currentAnimeForComments = null;
let currentPage = 1;
let isLoading = false;

const SHIKIMORI_GENRE_IDS = {
    'екшн': '1', 'action': '1',
    'пригоди': '2', 'adventure': '2',
    'комедія': '4', 'comedy': '4',
    'детектив': '7', 'mystery': '7',
    'драма': '8', 'drama': '8',
    'фентезі': '10', 'fantasy': '10',
    'магія': '10', 'magic': '10',
    'жахи': '14', 'horror': '14',
    'меха': '18', 'mecha': '18',
    'музика': '19', 'music': '19',
    'романтика': '22', 'romance': '22',
    'школа': '23', 'school': '23',
    'фантастика': '24', 'sci-fi': '24',
    'спорт': '30', 'sports': '30',
    'повсякденність': '36', 'slice of life': '36',
    'містика': '37', 'supernatural': '37',
    'психологія': '40', 'psychological': '40',
    'ісекай': '62', 'isekai': '62'
};

const GENRE_TRANSLATIONS = {
    'Action': 'Екшн', 'Adventure': 'Пригоди', 'Comedy': 'Комедія', 'Drama': 'Драма',
    'Fantasy': 'Фентезі', 'Magic': 'Магія', 'Supernatural': 'Містика', 'Horror': 'Жахи',
    'Mystery': 'Детектив', 'Psychological': 'Психологія', 'Romance': 'Романтика',
    'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повсякденність', 'Sports': 'Спорт',
    'Isekai': 'Ісекай', 'Mecha': 'Меха', 'Music': 'Музика', 'School': 'Школа'
};

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '✨'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function getAuthToken() {
    return localStorage.getItem('nekostream_token') || localStorage.getItem('token');
}

function saveAuthToken(token) {
    localStorage.setItem('nekostream_token', token);
    localStorage.setItem('token', token);
}

function removeAuthToken() {
    localStorage.removeItem('nekostream_token');
    localStorage.removeItem('token');
    localStorage.removeItem('nekostream_user');
}

function getWatchHistory() {
    return JSON.parse(localStorage.getItem('nekostream_history')) || {};
}

function saveEpisodeProgress(animeId, epNumber) {
    const history = getWatchHistory();
    if (!history[animeId]) {
        history[animeId] = { lastEp: epNumber, watched: [] };
    }
    history[animeId].lastEp = epNumber;
    if (!history[animeId].watched.includes(epNumber)) {
        history[animeId].watched.push(epNumber);
    }
    localStorage.setItem('nekostream_history', JSON.stringify(history));
}

function saveFavorites() {
    localStorage.setItem('nekostream_favs', JSON.stringify(favorites));
}

function toggleFavorite(animeId) {
    if (favorites.includes(animeId)) {
        favorites = favorites.filter(id => id !== animeId);
        showToast('Видалено з переглянути 📜❌', 'info');
    } else {
        favorites.push(animeId);
        showToast('Додано в переглянути 📜', 'success');
    }
    saveFavorites();
    if (typeof renderCatalog === 'function') renderCatalog();
}

function buildProxiedPosterUrl(rawPath) {
    if (!rawPath || rawPath.includes('missing')) {
        return DEFAULT_PLACEHOLDER;
    }
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('data:')) {
        return rawPath;
    }
    if (rawPath.startsWith('/')) {
        return `https://shikimori.one${rawPath}`;
    }
    return `https://shikimori.one/${rawPath}`;
}