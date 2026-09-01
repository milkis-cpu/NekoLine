// ==========================================
// HERO.JS — Мульти-карусель топ-аніме (по 3 картки)
// ==========================================

let heroAnimeList = [];
let currentHeroPage = 0;
const ITEMS_PER_PAGE = 3;
let heroInterval = null;

function initHeroSlider(animeList) {
    if (!animeList || animeList.length === 0) return;
    
    heroAnimeList = animeList.slice(0, 12);
    currentHeroPage = 0;
    
    renderHeroDots();
    renderHeroCards();
    startHeroAutoPlay();

    const prevBtn = document.getElementById('hero-prev-btn');
    const nextBtn = document.getElementById('hero-next-btn');

    if (prevBtn) prevBtn.onclick = () => changeHeroPage(-1);
    if (nextBtn) nextBtn.onclick = () => changeHeroPage(1);

    // Пауза автопрокручування при наведенні курсору на блок трендів
    const container = document.getElementById('hero-cards-container');
    if (container) {
        container.addEventListener('mouseenter', stopHeroAutoPlay);
        container.addEventListener('mouseleave', startHeroAutoPlay);
    }
}

function renderHeroCards() {
    const container = document.getElementById('hero-cards-container');
    if (!container || !heroAnimeList.length) return;

    const totalPages = Math.ceil(heroAnimeList.length / ITEMS_PER_PAGE);
    if (currentHeroPage >= totalPages) currentHeroPage = 0;
    if (currentHeroPage < 0) currentHeroPage = totalPages - 1;

    const startIdx = currentHeroPage * ITEMS_PER_PAGE;
    const visibleItems = heroAnimeList.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    container.innerHTML = visibleItems.map(item => {
        let imgUrl = item.poster || item.image || '';
        if (typeof imgUrl === 'string') {
            imgUrl = imgUrl.replace('/preview/', '/original/')
                           .replace('/x96/', '/original/')
                           .replace('/x48/', '/original/');
        }
        const rating = item.rating || '8.0';
        const status = item.status || 'Завершено';
        const isFav = (typeof favorites !== 'undefined' && favorites.includes(item.id)) ? 'active' : '';

        let cleanDesc = item.description ? item.description.replace(/\[.*?\]/g, '').trim() : '';
        if (!cleanDesc || cleanDesc.includes('Опис доступний')) {
            cleanDesc = 'Захоплююча історія про пригоди, випробування та персонажів у популярному тайтлі.';
        }

        const genreColorMap = {
            'сёнен': 0, 'сьонен': 0,
            'экшен': 1, 'екшн': 1,
            'приключения': 2, 'пригоди': 2,
            'фэнтези': 3, 'фентезі': 3,
            'сверхъестественное': 4, 'надприродне': 4,
            'драма': 5,
            'триллер': 6, 'трилер': 6,
            'исэкай': 7, 'ісекай': 7,
            'романтика': 8,
            'комедия': 9, 'комедія': 9,
            'детектив': 10,
            'спорт': 11,
            'повседневность': 12, 'буденність': 12,
            'мистика': 13, 'містика': 13,
            'фантастика': 14,
            'ужасы': 15, 'жахи': 15,
            'школа': 16,
            'музыка': 17, 'музика': 17,
            'сэйнэн': 18, 'сейнен': 18,
            'меха': 19,
            'военное': 20, 'військове': 20,
            'взрослые персонажи': 21, 'дорослі персонажі': 21
        };

        const getGenreColorIdx = (genreName) => {
            const cleanName = String(genreName).trim().toLowerCase();
            let colorIdx = genreColorMap[cleanName];
            if (colorIdx === undefined) {
                let hash = 0;
                for (let i = 0; i < cleanName.length; i++) {
                    hash = (hash * 31 + cleanName.charCodeAt(i)) % 22;
                }
                colorIdx = Math.abs(hash);
            }
            return colorIdx;
        };

        const rawGenres = Array.isArray(item.genres) 
            ? (item.genres.length === 1 && typeof item.genres[0] === 'string' && item.genres[0].includes(',')
                ? item.genres[0].split(',').map(g => g.trim()).filter(Boolean)
                : item.genres)
            : (typeof item.genres === 'string' ? item.genres.split(',').map(g => g.trim()).filter(Boolean) : []);

        const heroGenresHTML = rawGenres.slice(0, 3).map(g => {
            const name = typeof g === 'object' ? (g.russian || g.name) : g;
            const colorIdx = getGenreColorIdx(name);
            return `<span class="neon-genre-tag card-genre-badge color-${colorIdx}">${name}</span>`;
        }).join('');

       return `
        <div class="hero-card" data-id="${item.id}">
            <div class="hero-card-poster">
                <img src="${imgUrl}" 
                     alt="${item.title || ''}" 
                     loading="lazy"
                     referrerpolicy="no-referrer"
                     onerror="handleImageError(this, '${imgUrl}')">
            </div>

            <div class="hero-card-info">
                <div class="hero-card-top">
                    <div class="hero-card-badges">
                        <span class="badge-rating">⭐ ${rating}</span>
                        ${status ? `<span class="hero-card-status">${status}</span>` : ''}
                    </div>
                    <button class="fav-btn ${isFav}" title="Додати в переглянути">📜</button>
                </div>

                <h3 class="hero-card-title" title="${item.title || ''}">${item.title || 'Без назви'}</h3>
                <div class="hero-card-meta">
                    <span class="card-year">${item.year || '2024'}</span>
                    ${heroGenresHTML}
                </div>
                <p class="hero-card-desc" title="${cleanDesc}">${cleanDesc}</p>
            </div>
        </div>
        `;
    }).join('');

    container.querySelectorAll('.hero-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const animeId = card.dataset.id;
            const anime = heroAnimeList.find(a => String(a.id) === String(animeId));
            if (!anime) return;

            if (e.target.closest('.fav-btn')) {
                e.stopPropagation();
                if (typeof toggleFavorite === 'function') toggleFavorite(anime.id);
                return;
            }

            if (typeof openAnimePlayer === 'function') openAnimePlayer(anime);
        });
    });

    updateHeroDots();
}
function renderHeroDots() {
    const dotsContainer = document.getElementById('hero-dots');
    if (!dotsContainer) return;

    const totalPages = Math.ceil(heroAnimeList.length / ITEMS_PER_PAGE);
    dotsContainer.innerHTML = Array.from({ length: totalPages }, (_, i) => 
        `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToHeroPage(${i})"></span>`
    ).join('');
}

function updateHeroDots() {
    const dots = document.querySelectorAll('#hero-dots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentHeroPage);
    });
}

function changeHeroPage(direction) {
    stopHeroAutoPlay();
    currentHeroPage += direction;
    renderHeroCards();
    startHeroAutoPlay();
}

function goToHeroPage(pageIndex) {
    stopHeroAutoPlay();
    currentHeroPage = pageIndex;
    renderHeroCards();
    startHeroAutoPlay();
}

function startHeroAutoPlay() {
    stopHeroAutoPlay();
    heroInterval = setInterval(() => {
        currentHeroPage++;
        renderHeroCards();
    }, 7000);
}

function stopHeroAutoPlay() {
    if (heroInterval) clearInterval(heroInterval);
}