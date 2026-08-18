// ==========================================
// NEKOSTREAM - ПОВНІСТЮ СТАБІЛЬНИЙ SCRIPT.JS
// ==========================================

const SHIKIMORI_BASE = "https://shikimori.one";
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'><rect width='100%' height='100%' fill='%231f222e'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23a855f7' font-family='sans-serif' font-size='18' font-weight='bold'>🎬 Без постера</text></svg>";

let currentAnimeList = [];
let favorites = JSON.parse(localStorage.getItem('nekostream_favs')) || [];
let selectedGenre = 'all';
let currentSort = 'rating-desc';
let currentAnimeForComments = null;
let currentPage = 1;
let isLoading = false;

// --- ХЕЛПЕРИ ---
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

// --- ІСТОРІЯ ТА ОБРАНЕ ---
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
    renderCatalog();
}

const SHIKIMORI_GENRE_IDS = {
    'екшн': '1',
    'пригоди': '2',
    'магія': '10',
    'драма': '8',
    'ісекай': '62'
};

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

// --- ПІДТЯГУВАННЯ ПОСТЕРІВ З ANILIST ---
async function attachAniListPosters(animeList) {
    if (!animeList || animeList.length === 0) return animeList;

    const aliasQueries = animeList.map((anime, index) => {
        // Використовуємо англійську/англіфіковану назву для кращого пошуку в AniList
        const cleanTitle = (anime.originalTitle || anime.title || '')
            .replace(/["\\]/g, '')
            .trim();

        if (!cleanTitle) {
            return `a${index}: Page(perPage: 1) { media { id } }`;
        }

        return `a${index}: Page(perPage: 1) { media(search: "${cleanTitle}", type: ANIME) { coverImage { extraLarge large medium } } }`;
    }).join('\n');

    const query = `query {\n${aliasQueries}\n}`;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) return animeList;

        const result = await response.json();
        const data = result?.data || {};

        return animeList.map((anime, index) => {
            const pageData = data[`a${index}`];
            const mediaItem = pageData?.media?.[0];

            if (mediaItem?.coverImage) {
                anime.poster = mediaItem.coverImage.extraLarge || mediaItem.coverImage.large || mediaItem.coverImage.medium;
            }
            return anime;
        });
    } catch (err) {
        console.error("Помилка AniList:", err);
        return animeList;
    }
}

// --- ОСНОВНА ФУНКЦІЯ ОТРИМАННЯ АНІМЕ ---
async function fetchAnimeFromAPI(query = '', append = false) {
    const grid = document.getElementById('anime-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!grid) return;

    if (isLoading) return;
    isLoading = true;

    if (loadMoreBtn) {
        loadMoreBtn.innerText = 'Завантаження...';
        loadMoreBtn.style.display = 'inline-block';
    }

    if (!append) {
        currentPage = 1;
        currentAnimeList = [];
        grid.innerHTML = Array(8).fill('<div class="skeleton-card" style="height:320px; background:#1f222e; border-radius:12px;"></div>').join('');
    }

    try {
        const currentSortSelect = document.getElementById('sort-select');
        const sortVal = currentSortSelect ? currentSortSelect.value : 'rating-desc';
        
        let shikimoriOrder = 'popularity';
        if (sortVal === 'rating-desc') shikimoriOrder = 'ranked';
        if (sortVal === 'title-asc') shikimoriOrder = 'name';

        let apiUrl = `${SHIKIMORI_BASE}/api/animes?limit=24&page=${currentPage}&order=${shikimoriOrder}`;
        const cleanQuery = query.trim().toLowerCase();
        
        if (SHIKIMORI_GENRE_IDS[cleanQuery]) {
            apiUrl += `&genre=${SHIKIMORI_GENRE_IDS[cleanQuery]}`;
        } else if (cleanQuery !== '' && cleanQuery !== 'all' && cleanQuery !== 'favorites') {
            apiUrl += `&search=${encodeURIComponent(query)}`;
        }

        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}&_t=${Date.now()}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Помилка завантаження");

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            let newItems = data.map((item) => {
                const titleText = item.russian || item.name || 'Без назви';
                const originalTitle = item.name || '';
                const kindText = item.kind ? item.kind.toUpperCase() : 'TV';
                const statusName = item.status === 'ongoing' ? 'Онґоїнг' : 'Завершено';

                const rawImg = item.image?.original || item.image?.preview || '';
                const fallbackPoster = buildProxiedPosterUrl(rawImg);

                return {
                    id: String(item.id),
                    title: titleText,
                    originalTitle: originalTitle,
                    rating: item.score ? String(item.score) : '8.0',
                    tags: kindText,
                    year: item.released_on ? item.released_on.split('-')[0] : '2024',
                    status: statusName,
                    description: 'Опис доступний при переході на сторінку аніме.',
                    poster: fallbackPoster,
                    rawPosterPath: rawImg,
                    genres: [kindText, statusName],
                    episodes: item.episodes || item.episodes_aired || 0
                };
            });

            newItems = await attachAniListPosters(newItems);

            if (append) {
                const existingIds = new Set(currentAnimeList.map(a => String(a.id)));
                const filteredNew = newItems.filter(item => !existingIds.has(String(item.id)));
                currentAnimeList = [...currentAnimeList, ...filteredNew];
            } else {
                currentAnimeList = newItems;
            }
        }

        renderCatalog();
        attachTooltipHoverEvents();

    } catch (error) {
        console.error("Помилка API:", error);
    } finally {
        isLoading = false;
        if (loadMoreBtn) loadMoreBtn.innerText = 'Завантажити ще 🔥';
    }
}

// --- СТВОРЕННЯ КАРТКИ ---
function createAnimeCardHTML(anime) {
    const imgUrl = anime.poster || DEFAULT_PLACEHOLDER;
    const rating = anime.rating || '0.0';
    const status = anime.status || '';
    const isFav = favorites.includes(anime.id) ? 'active' : '';
    const epCount = anime.episodes || anime.episodes_aired || '';
    const genresList = anime.genres ? anime.genres.map(g => `<span>${g}</span>`).join('') : '';

    // Резервне дзеркало для Shikimori
    const mirrorUrl = imgUrl.includes('shikimori.one') 
        ? imgUrl.replace('shikimori.one', 'shikimori.me') 
        : imgUrl;

    return `
    <div class="anime-card" data-id="${anime.id}" data-title="${anime.title}" style="cursor: pointer;">
        <div class="poster-container">
            <img class="poster-img" 
                 src="${imgUrl}" 
                 alt="${anime.title || ''}" 
                 loading="lazy"
                 referrerpolicy="no-referrer"
                 onerror="if(!this.dataset.triedMirror){this.dataset.triedMirror='true'; this.src='${mirrorUrl}';} else {this.onerror=null; this.src='${DEFAULT_PLACEHOLDER}';}">
            
            <div class="card-badges-top">
                <span class="badge-rating">⭐ ${rating}</span>
                <button class="fav-btn ${isFav}" title="Додати в переглянути">📜</button>
            </div>

            ${status ? `<span class="badge-status">${status}</span>` : ''}
        </div>

        <div class="card-info">
            <h3 class="card-title" title="${anime.title}">${anime.title}</h3>
            <div class="card-meta">
                <span>${anime.year || ''} • ${anime.tags || anime.kind || 'TV'}</span>
                ${epCount ? `<span class="badge-episodes">🎬 ${epCount} сер.</span>` : ''}
            </div>
        </div>

        <div class="anime-tooltip">
            <div class="tooltip-content">
                <h4 class="tooltip-title">${anime.title}</h4>
                <div class="tooltip-meta">${anime.year || '2024'} | ${anime.tags || 'TV'} | <b>${status}</b></div>
                <div class="tooltip-genres">${genresList}</div>
                <p class="tooltip-studio">Студія: <b>${anime.studio || 'Невідомо'}</b></p>
                <p class="tooltip-desc">${anime.description || 'Опис відсутній'}</p>
            </div>
            <img class="tooltip-poster" 
                 src="${imgUrl}" 
                 alt="${anime.title}" 
                 referrerpolicy="no-referrer"
                 onerror="this.onerror=null; this.src='${DEFAULT_PLACEHOLDER}';">
        </div>
    </div>
    `;
}

// --- РЕНДЕР КАТАЛОГУ ---
function renderCatalog() {
    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    grid.innerHTML = '';
    safeSetText('catalog-heading', (selectedGenre === 'favorites') ? '📜 Ваше переглянути аніме' : '🔥 Каталог аніме');

    let listToRender = currentAnimeList || [];

    if (selectedGenre === 'favorites') {
        listToRender = listToRender.filter(anime => favorites.includes(anime.id));
    }

    if (listToRender.length === 0) {
        const emptyMsg = selectedGenre === 'favorites' 
            ? "📜 Ваш список переглянути поки порожній."
            : "🔍 Нічого не знайдено.";
        grid.innerHTML = `<div class="no-results" style="color: #9ca3af; text-align: center; grid-column: 1/-1; padding: 40px; font-size: 16px;">${emptyMsg}</div>`;
        return;
    }

    listToRender.forEach(anime => {
        grid.insertAdjacentHTML('beforeend', createAnimeCardHTML(anime));
    });
}

const GENRE_TRANSLATIONS = {
    'Action': 'Екшн', 'Adventure': 'Пригоди', 'Comedy': 'Комедія', 'Drama': 'Драма',
    'Fantasy': 'Фентезі', 'Magic': 'Магія', 'Supernatural': 'Містика', 'Horror': 'Жахи',
    'Mystery': 'Детектив', 'Psychological': 'Психологія', 'Romance': 'Романтика',
    'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повсякденність', 'Sports': 'Спорт',
    'Isekai': 'Ісекай', 'Mecha': 'Меха', 'Music': 'Музика', 'School': 'Школа'
};

// --- ВІДКРИТТЯ ПЛЕЄРА ---
async function openAnimePlayer(anime) {
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const mainPlayer = document.getElementById('main-player');

    if (catalogView) catalogView.style.display = 'none';
    if (playerView) playerView.style.display = 'block';

    safeSetText('anime-title-full', anime.title);
    safeSetText('active-anime-title', anime.title);
    safeSetText('info-badge-rating', `⭐ ${anime.rating || '8.0'}`);
    safeSetText('info-badge-status', anime.status || 'Завершено');
    safeSetText('info-badge-type', anime.tags || 'TV Серіал');

    safeSetText('spec-year', (anime.year || '2024') + ' рік');
    safeSetText('spec-studio', 'Завантаження...');
    safeSetText('anime-description', 'Завантажуємо детальний опис...');

    const totalEps = anime.episodesCount || (anime.episodes && typeof anime.episodes === 'object' ? Object.keys(anime.episodes).length : 12);
    safeSetText('spec-episodes', `${totalEps} серій`);

    try {
        const detailUrl = `https://corsproxy.io/?${encodeURIComponent(`https://shikimori.one/api/animes/${anime.id}`)}`;
        const res = await fetch(detailUrl);
        if (res.ok) {
            const fullData = await res.json();
            
            safeSetText('spec-studio', (fullData.studios && fullData.studios.length > 0) ? fullData.studios[0].name : 'Невідомо');

            if (fullData.description) {
                let cleanDesc = fullData.description.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '');
                safeSetText('anime-description', cleanDesc);
            } else {
                safeSetText('anime-description', 'Опис для цього аніме поки відсутній.');
            }

            const genresContainer = document.getElementById('info-genres-list');
            if (genresContainer && fullData.genres && fullData.genres.length > 0) {
                const realGenres = fullData.genres.map(g => {
                    const rawName = g.russian || g.name;
                    return GENRE_TRANSLATIONS[rawName] || rawName;
                });
                genresContainer.innerHTML = realGenres.map(g => `<span class="genre-chip">${g}</span>`).join('');
            }
        }
    } catch (err) {
        safeSetText('spec-studio', anime.studio || 'Невідомо');
        safeSetText('anime-description', anime.description || 'Опис відсутній.');
    }

    const history = getWatchHistory();
    const animeProgress = history[anime.id] || { lastEp: 1, watched: [] };
    const startEp = animeProgress.lastEp || 1;

    const episodesContainer = document.getElementById('episodes-container');
    const currentEpLabel = document.getElementById('current-ep-label');

    if (episodesContainer) {
        episodesContainer.innerHTML = '';
        for (let i = 1; i <= totalEps; i++) {
            const btn = document.createElement('button');
            btn.classList.add('ep-btn');
            if (i === startEp) btn.classList.add('active');
            if (animeProgress.watched.includes(i)) btn.classList.add('watched');
            btn.textContent = i;
            btn.style.cssText = "background: #1f222e; color: #9ca3af; border: 1px solid #242731; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600;";

            if (i === startEp) {
                btn.style.background = '#a855f7';
                btn.style.color = '#fff';
            }

            btn.addEventListener('click', () => {
                document.querySelectorAll('#episodes-container button').forEach(b => {
                    b.style.background = '#1f222e';
                    b.style.color = '#9ca3af';
                });
                btn.style.background = '#a855f7';
                btn.style.color = '#fff';
                
                if (currentEpLabel) currentEpLabel.textContent = `Серія ${i}`;
                if (mainPlayer) mainPlayer.src = (anime.episodes && anime.episodes[i]) ? anime.episodes[i] : "https://www.youtube.com/embed/aqz-KE-bpKQ";

                saveEpisodeProgress(anime.id, i);
            });

            episodesContainer.appendChild(btn);
        }
    }

    if (currentEpLabel) currentEpLabel.textContent = `Серія ${startEp}`;
    if (mainPlayer) mainPlayer.src = (anime.episodes && anime.episodes[startEp]) ? anime.episodes[startEp] : "https://www.youtube.com/embed/aqz-KE-bpKQ";
    saveEpisodeProgress(anime.id, startEp);

    loadComments(anime.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCatalog() {
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const mainPlayer = document.getElementById('main-player');

    if (playerView) playerView.style.display = 'none';
    if (catalogView) catalogView.style.display = 'block';
    if (mainPlayer) mainPlayer.src = '';
}

// --- КОМЕНТАРІ ТА АВТОРИЗАЦІЯ ---
function loadComments(animeId) {
    currentAnimeForComments = animeId;
    const commentsList = document.getElementById('comments-list');
    const commentFormBox = document.getElementById('comment-form-box');
    const authPrompt = document.getElementById('auth-comment-prompt');
    const currentUser = localStorage.getItem('nekostream_user');

    if (commentFormBox && authPrompt) {
        commentFormBox.style.display = currentUser ? 'block' : 'none';
        authPrompt.style.display = currentUser ? 'none' : 'block';
    }

    if (!commentsList) return;
    const allComments = JSON.parse(localStorage.getItem('nekostream_comments')) || {};
    const animeComments = allComments[animeId] || [];

    commentsList.innerHTML = animeComments.length === 0 
        ? '<p style="color: #666; margin-top: 15px;">Поки немає коментарів. Будьте першим!</p>'
        : animeComments.map(c => `
            <div class="comment-card" style="background:#1f222e; padding:10px; border-radius:8px; margin-top:10px;">
                <div style="font-size:12px; color:#a855f7; font-weight:bold;">👤 ${c.user} • ${c.date}</div>
                <div style="margin-top:5px; color:#d1d5db;">${c.text}</div>
            </div>
        `).join('');
}

function checkAuthStatus() {
    const savedUser = localStorage.getItem('nekostream_user');
    const userProfile = document.getElementById('user-profile');
    const openAuthBtn = document.getElementById('open-auth-btn');
    if (savedUser) {
        safeSetText('user-nickname', `👤 ${savedUser}`);
        if (openAuthBtn) openAuthBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
    } else {
        if (openAuthBtn) openAuthBtn.style.display = 'block';
        if (userProfile) userProfile.style.display = 'none';
    }
}

// --- ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', () => {

    const animeGrid = document.getElementById('anime-grid');
    if (animeGrid) {
        animeGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.anime-card');
            if (!card) return;

            const animeId = card.dataset.id;
            const anime = currentAnimeList.find(a => a.id === animeId);
            if (!anime) return;

            if (e.target.closest('.fav-btn')) {
                e.stopPropagation();
                toggleFavorite(anime.id);
                return;
            }

            openAnimePlayer(anime);
        });
    }

    // Hero Банер
    const heroPlayBtn = document.getElementById('hero-play-btn');
    const heroMoreBtn = document.getElementById('hero-more-btn');
    const heroAnime = {
        id: '51009',
        title: 'Магічна битва 2',
        rating: '8.8',
        tags: 'TV • ЕКШН',
        year: '2023',
        status: 'Онґоїнг',
        studio: 'MAPPA',
        description: 'Продовження історії про Юджі Ітадорі та магів, які борються проти найсильніших проклять людства.',
        poster: 'https://wsrv.nl/?url=shikimori.one/system/animes/original/51009.jpg',
        episodesCount: 23,
        genres: ["екшн", "магія"],
        episodes: { 1: "https://www.youtube.com/embed/aqz-KE-bpKQ", 2: "https://www.youtube.com/embed/dQw4w9WgXcQ" }
    };
    if (heroPlayBtn) heroPlayBtn.addEventListener('click', () => openAnimePlayer(heroAnime));
    if (heroMoreBtn) heroMoreBtn.addEventListener('click', () => openAnimePlayer(heroAnime));

    // Навігація
    const logoBtn = document.getElementById('logo-btn');
    const backBtn = document.getElementById('back-to-catalog');

    if (logoBtn) {
        logoBtn.addEventListener('click', () => {
            showCatalog();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', showCatalog);
    }

    // Пошук
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            searchTimeout = setTimeout(() => {
                selectedGenre = 'all';
                fetchAnimeFromAPI(query);
            }, 400);
        });
    }

    // Сортування
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentPage = 1;
            const activeSearch = searchInput ? searchInput.value.trim() : '';
            const activeQuery = (selectedGenre !== 'all' && selectedGenre !== 'favorites') ? selectedGenre : activeSearch;
            fetchAnimeFromAPI(activeQuery, false);
        });
    }

    // Жанри
    const genreBtns = document.querySelectorAll('.genre-btn');
    genreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genreBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const genreAttr = btn.getAttribute('data-genre');
            if (btn.classList.contains('fav-filter') || genreAttr === 'favorites') {
                selectedGenre = 'favorites';
                renderCatalog();
            } else {
                selectedGenre = genreAttr || 'all';
                currentPage = 1;
                fetchAnimeFromAPI(selectedGenre === 'all' ? '' : selectedGenre, false);
            }
        });
    });

    // Завантажити ще
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            const activeSearch = searchInput ? searchInput.value.trim() : '';
            const activeQuery = (selectedGenre !== 'all' && selectedGenre !== 'favorites') ? selectedGenre : activeSearch;
            fetchAnimeFromAPI(activeQuery, true);
        });
    }

    // Мобільне меню
    const mobileHome = document.getElementById('mobile-nav-home');
    const mobileSearch = document.getElementById('mobile-nav-search');
    const mobileFavs = document.getElementById('mobile-nav-favs');
    const mobileAuth = document.getElementById('mobile-nav-auth');

    function updateMobileNavActive(activeBtn) {
        document.querySelectorAll('.mobile-nav-item').forEach(btn => btn.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }

    if (mobileHome) {
        mobileHome.addEventListener('click', () => {
            showCatalog();
            selectedGenre = 'all';
            genreBtns.forEach(b => b.classList.remove('active'));
            const allBtn = document.querySelector('.genre-btn[data-genre="all"]');
            if (allBtn) allBtn.classList.add('active');
            renderCatalog();
            updateMobileNavActive(mobileHome);
        });
    }

    if (mobileSearch && searchInput) {
        mobileSearch.addEventListener('click', () => {
            showCatalog();
            searchInput.focus();
            updateMobileNavActive(mobileSearch);
        });
    }

    if (mobileFavs) {
        mobileFavs.addEventListener('click', () => {
            showCatalog();
            selectedGenre = 'favorites';
            genreBtns.forEach(b => b.classList.remove('active'));
            const favGenreBtn = document.querySelector('.genre-btn.fav-filter');
            if (favGenreBtn) favGenreBtn.classList.add('active');
            renderCatalog();
            updateMobileNavActive(mobileFavs);
        });
    }

    if (mobileAuth) {
        const authModal = document.getElementById('auth-modal');
        mobileAuth.addEventListener('click', () => {
            if (authModal) authModal.classList.add('active');
            updateMobileNavActive(mobileAuth);
        });
    }

    // Коментарі
    const sendCommentBtn = document.getElementById('send-comment-btn');
    if (sendCommentBtn) {
        sendCommentBtn.addEventListener('click', () => {
            const input = document.getElementById('comment-input');
            const text = input ? input.value.trim() : '';
            const currentUser = localStorage.getItem('nekostream_user');

            if (!text) return showToast('Введіть текст коментаря!', 'error');
            if (!currentUser) return showToast('Спочатку увійдіть в акаунт!', 'error');

            const allComments = JSON.parse(localStorage.getItem('nekostream_comments')) || {};
            if (!allComments[currentAnimeForComments]) allComments[currentAnimeForComments] = [];

            allComments[currentAnimeForComments].unshift({
                user: currentUser,
                text: text,
                date: new Date().toLocaleDateString('uk-UA', { hour: '2-digit', minute: '2-digit' })
            });

            localStorage.setItem('nekostream_comments', JSON.stringify(allComments));
            if (input) input.value = '';
            loadComments(currentAnimeForComments);
            showToast('Коментар опубліковано! 💬', 'success');
        });
    }

    // --- АВТОРИЗАЦІЯ ---
    const authModal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth-btn');
    const closeAuthBtn = document.getElementById('close-modal-btn');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const logoutBtn = document.getElementById('logout-btn');

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    const API_URL = 'http://localhost:5000/api';

    if (openAuthBtn && authModal) openAuthBtn.addEventListener('click', () => authModal.classList.add('active'));
    if (closeAuthBtn && authModal) closeAuthBtn.addEventListener('click', () => authModal.classList.remove('active'));

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            if (formLogin) formLogin.style.display = 'block';
            if (formRegister) formRegister.style.display = 'none';
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            if (formRegister) formRegister.style.display = 'block';
            if (formLogin) formLogin.style.display = 'none';
        });
    }

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = formLogin.querySelector('input[type="text"]').value.trim();
            const passwordInput = formLogin.querySelector('input[type="password"]').value.trim();

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: emailInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    return showToast(data.error || 'Помилка входу!', 'error');
                }

                localStorage.setItem('nekostream_token', data.token);
                localStorage.setItem('nekostream_user', data.user.username);

                checkAuthStatus();
                if (authModal) authModal.classList.remove('active');
                showToast(`Ласкаво просимо, ${data.user.username}! ✨`, 'success');

            } catch (err) {
                console.error("Помилка підключення:", err);
                showToast('Не вдалося з’єднатися з сервером ❌', 'error');
            }
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nicknameInput = formRegister.querySelector('input[type="text"]').value.trim();
            const emailInput = formRegister.querySelector('input[type="email"]').value.trim();
            const passwordInput = formRegister.querySelector('input[type="password"]').value.trim();

            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: nicknameInput,
                        email: emailInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    return showToast(data.error || 'Помилка реєстрації!', 'error');
                }

                localStorage.setItem('nekostream_token', userToken);
                localStorage.setItem('nekostream_user', data.user.username);

                checkAuthStatus();
                if (authModal) authModal.classList.remove('active');
                showToast('Акаунт успішно створено! 🎉', 'success');

            } catch (err) {
                console.error("Помилка підключення:", err);
                showToast('Не вдалося з’єднатися з сервером ❌', 'error');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('nekostream_user');
            localStorage.removeItem('nekostream_token');
            
            checkAuthStatus();
            showToast('Ви вийшли з акаунту', 'info');
        });
    }

    // СТАРТ
    checkAuthStatus();
    fetchAnimeFromAPI();
});

// Напрямок спливаючої шторки
document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.anime-card');
    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    if (window.innerWidth - cardRect.right < 340) {
        card.classList.add('open-left');
    } else {
        card.classList.remove('open-left');
    }
});

// Швидкий пошук Ctrl + K
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
    }
});

// Підвантаження опису при наведенні
function attachTooltipHoverEvents() {
    const cards = document.querySelectorAll('.anime-card');
    
    cards.forEach(card => {
        if (card.dataset.hoverAttached) return;
        card.dataset.hoverAttached = 'true';

        card.addEventListener('mouseenter', async () => {
            if (card.dataset.loaded === 'true') return;

            const animeId = card.getAttribute('data-id');
            const descElement = card.querySelector('.tooltip-desc');
            const genresElement = card.querySelector('.tooltip-genres');
            const studioElement = card.querySelector('.tooltip-studio b');

            if (descElement) descElement.innerText = 'Завантаження опису...';

            try {
                const url = `${SHIKIMORI_BASE}/api/animes/${animeId}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) return;

                const data = await response.json();

                if (descElement && data.description) {
                    descElement.innerText = data.description.replace(/\[.*?\]/g, '');
                } else if (descElement) {
                    descElement.innerText = 'Опис для цього аніме відсутній.';
                }

                if (genresElement && Array.isArray(data.genres) && data.genres.length > 0) {
                    genresElement.innerHTML = data.genres.slice(0, 4).map(g => `<span>${g.russian || g.name}</span>`).join(' ');
                }

                if (studioElement && Array.isArray(data.studios) && data.studios.length > 0) {
                    studioElement.innerText = data.studios[0].name;
                }

                card.dataset.loaded = 'true';

            } catch (err) {
                if (descElement) descElement.innerText = 'Не вдалося завантажити опис.';
            }
        });
    });
}
// ==========================================
// НАДІЙНА ЛОГІКА ПРОФІЛЮ ТА ВХОДУ
// ==========================================

// 1. Завантаження даних профілю з сервера
// --- ФУНКЦІЇ ВІДКРИТТЯ ТА ЗАКРИТТЯ МОДАЛКИ ПРОФІЛЮ ---
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// --- ФУНКЦІЯ ЗАВАНТАЖЕННЯ ДАНИХ КОРИСТУВАЧА ---
async function loadUserProfile() {
    // Виправлено ключ токена на nekostream_token
    const token = localStorage.getItem('nekostream_token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:5000/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok && data.user) {
            const avatarUrl = (data.user.avatar && data.user.avatar.trim() !== '') 
                ? data.user.avatar 
                : "https://i.ibb.co/default-avatar.png";

            // Оновлюємо шапку
            const headerAvatar = document.getElementById('header-avatar');
            const headerName = document.getElementById('user-nickname');
            if (headerAvatar) headerAvatar.src = avatarUrl;
            if (headerName) headerName.textContent = data.user.username;

            // Оновлюємо модалку
            const modalAvatar = document.getElementById('user-avatar');
            const modalName = document.getElementById('user-name');
            const modalEmail = document.getElementById('user-email');
            const modalBio = document.getElementById('user-bio');

            if (modalAvatar) modalAvatar.src = avatarUrl;
            if (modalName) modalName.textContent = data.user.username;
            if (modalEmail) modalEmail.textContent = data.user.email || "";
            if (modalBio) modalBio.textContent = data.user.bio || "Інформація відсутня...";

            // Відмальовуємо сітку активності
            renderHeatmap();
        }
    } catch (err) {
        console.error("Помилка завантаження профілю:", err);
    }
}

// --- ІНІЦІАЛІЗАЦІЯ ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ ---
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();

    // Відкриття модалки
    const userProfileBadge = document.getElementById('user-profile');
    if (userProfileBadge) {
        userProfileBadge.onclick = (e) => {
            if (e.target.id !== 'logout-btn') {
                openProfileModal();
            }
        };
    }

    // Закриття на хрестик
    const closeProfileBtn = document.getElementById('close-profile-modal-btn');
    if (closeProfileBtn) {
        closeProfileBtn.onclick = (e) => {
            e.preventDefault();
            closeProfileModal();
        };
    }

    // Закриття по кліку поза вікном
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        profileModal.onclick = (e) => {
            if (e.target === profileModal) closeProfileModal();
        };
    }

    // Збереження форми
    const updateForm = document.getElementById('form-update-profile');
    if (updateForm) {
        updateForm.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            if (!token) return alert("Помилка авторизації!");

            const avatarUrl = document.getElementById('input-avatar-url').value.trim();
            const bioText = document.getElementById('input-bio').value.trim();

            try {
                const response = await fetch('http://localhost:5000/api/me', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        avatar: avatarUrl || undefined,
                        bio: bioText || undefined
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    alert("Профіль оновлено! ✨");
                    loadUserProfile();
                    closeProfileModal();
                    updateForm.reset();
                } else {
                    alert(data.error || "Не вдалося зберегти");
                }
            } catch (err) {
                console.error("Помилка збереження:", err);
            }
        };
    }
});
// ОБРОБКА ВХОДУ (LOGIN)
const loginForm = document.getElementById('form-login');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Шукаємо інпути за індексами або за їх полями
        const inputs = loginForm.querySelectorAll('input');
        let emailOrUsername = '';
        let password = '';

        inputs.forEach(input => {
            if (input.type === 'password') {
                password = input.value.trim();
            } else if (input.type === 'text' || input.type === 'email') {
                emailOrUsername = input.value.trim();
            }
        });

        // Якщо тип інпутів не розмічений, беремо просто за порядком
        if (!emailOrUsername && inputs[0]) emailOrUsername = inputs[0].value.trim();
        if (!password && inputs[1]) password = inputs[1].value.trim();

        if (!emailOrUsername || !password) {
            return alert("Будь ласка, заповніть і логін, і пароль!");
        }

        try {
            const res = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailOrUsername, password })
            });

            const data = await res.json();

            if (res.ok) {
                const userToken = data.token || data.accessToken;
                localStorage.setItem('token', userToken);
                
                const authModal = document.getElementById('auth-modal');
                if (authModal) {
                    authModal.style.display = 'none';
                    authModal.classList.remove('active');
                }

                await loadUserProfile();
                alert("Успішний вхід! 🎉");
            } else {
                alert(data.error || "Помилка входу");
            }
        } catch (err) {
            console.error("Помилка підключення:", err);
            alert("Не вдалося з'єднатися з сервером");
        }
    });
}
// Переключення видів (Каталог / Плеєр / Профіль)
function showCatalogView() {
    document.getElementById('catalog-view').style.display = 'block';
    document.getElementById('player-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showProfileView() {
    document.getElementById('catalog-view').style.display = 'none';
    document.getElementById('player-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadUserProfile(); // Оновлюємо дані при відкритті
}

// Клік на аватарку/нікнейм у шапці
const userProfileBadge = document.getElementById('user-profile');
if (userProfileBadge) {
    userProfileBadge.addEventListener('click', (e) => {
        // Якщо клікнули не на кнопку "Вийти" — відкриваємо профіль
        if (e.target.id !== 'logout-btn') {
            showProfileView();
        }
    });
}

// Кнопки повернення до каталогу
document.getElementById('logo-btn')?.addEventListener('click', showCatalogView);
document.getElementById('nav-home-btn')?.addEventListener('click', showCatalogView);
document.getElementById('back-from-profile')?.addEventListener('click', showCatalogView);