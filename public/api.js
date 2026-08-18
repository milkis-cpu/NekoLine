// ==========================================
// API.JS — Отримання даних про аніме
// ==========================================
let currentFilters = {};

async function attachAniListPosters(animeList) {
    if (!animeList || animeList.length === 0) return animeList;

    const aliasQueries = animeList.map((anime, index) => {
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

async function fetchAnimeFromAPI(query = '', append = false, filters = {}) {
    const grid = document.getElementById('anime-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!grid) return;

    if (isLoading) return;
    isLoading = true;

    // Зберігаємо фільтри для наступних сторінок (при підвантаженні)
    if (!append) {
        currentFilters = filters;
    } else if (Object.keys(filters).length === 0) {
        filters = currentFilters;
    }

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
        // 1. Визначаємо суворо валідний критерій сортування для Shikimori API
        const validOrders = ['popularity', 'aired_on', 'ranked', 'name', 'id', 'episodes', 'random'];
        let shikimoriOrder = validOrders.includes(filters.sort) ? filters.sort : 'popularity';

        let apiUrl = `${SHIKIMORI_BASE}/api/animes?limit=24&page=${currentPage}&order=${shikimoriOrder}`;

        // 1. Обробка декількох жанрів (мультиселект)
        if (filters.genres && Array.isArray(filters.genres) && filters.genres.length > 0) {
            const genreIds = filters.genres
                .map(g => SHIKIMORI_GENRE_IDS[g.trim().toLowerCase()])
                .filter(Boolean);
            if (genreIds.length > 0) {
                apiUrl += `&genre=${genreIds.join(',')}`;
            }
        } else {
            const cleanQuery = query.trim().toLowerCase();
            if (SHIKIMORI_GENRE_IDS[cleanQuery]) {
                apiUrl += `&genre=${SHIKIMORI_GENRE_IDS[cleanQuery]}`;
            } else if (cleanQuery !== '' && cleanQuery !== 'all' && cleanQuery !== 'favorites') {
                apiUrl += `&search=${encodeURIComponent(query)}`;
            }
        }

        // 2. Фільтр за типом
        const typeMapping = {
            'tv': 'tv',
            'серіал (tv)': 'tv',
            'movie': 'movie',
            'повнометражне': 'movie',
            'ova': 'ova',
            'ona': 'ona',
            'special': 'special'
        };

        if (filters.type && filters.type !== 'all') {
            const rawType = filters.type.trim().toLowerCase();
            const mappedKind = typeMapping[rawType] || rawType;
            apiUrl += `&kind=${mappedKind}`;
        }

        // 3. Фільтр за діапазоном років (Формат Shikimori API: YYYY_YYYY)
        const yearFromVal = parseInt(filters.yearFrom, 10);
        const yearToVal = parseInt(filters.yearTo, 10);

        if (!isNaN(yearFromVal) && !isNaN(yearToVal)) {
            if (yearFromVal === yearToVal) {
                apiUrl += `&season=${yearFromVal}`;
            } else {
                apiUrl += `&season=${yearFromVal}_${yearToVal}`;
            }
        } else if (!isNaN(yearFromVal)) {
            apiUrl += `&season=${yearFromVal}_${new Date().getFullYear()}`;
        } else if (!isNaN(yearToVal)) {
            apiUrl += `&season=1970_${yearToVal}`;
        }
    

        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}&_t=${Date.now()}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Помилка завантаження");

        const data = await response.json();

        let addedItems = [];

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
                    year: (item.released_on || item.aired_on) ? (item.released_on || item.aired_on).split('-')[0] : '2024',
                    status: statusName,
                    description: 'Опис доступний при переході на сторінку аніме.',
                    poster: fallbackPoster,
                    rawPosterPath: rawImg,
                    genres: [kindText, statusName],
                    episodes: item.episodes || item.episodes_aired || 0
                };
            });

            newItems = await attachAniListPosters(newItems);

            // Захищена обробка AniList постерів
            if (typeof attachAniListPosters === 'function') {
                try {
                    newItems = await attachAniListPosters(newItems);
                } catch (err) {
                    console.error("Помилка завантаження постерів AniList:", err);
                }
            }

            // Безпечна перевірка параметрів сортування та обробка напрямку (asc / desc)
            const activeFilters = filters || {};
            if (activeFilters.sort === 'aired_on') {
                newItems.sort((a, b) => {
                    const yearA = parseInt(a.year, 10) || 0;
                    const yearB = parseInt(b.year, 10) || 0;
                    return activeFilters.orderDir === 'asc' ? yearA - yearB : yearB - yearA;
                });
            } else if (activeFilters.orderDir === 'asc') {
                newItems.reverse();
            }

            // Наповнення та оновлення каталогу
            if (append) {
                const existingIds = new Set((currentAnimeList || []).map(a => String(a.id)));
                addedItems = newItems.filter(item => !existingIds.has(String(item.id)));
                currentAnimeList = [...(currentAnimeList || []), ...addedItems];
            } else {
                addedItems = newItems;
                currentAnimeList = newItems;
            }
        }

        renderCatalog(append, addedItems);
        attachTooltipHoverEvents();

    } catch (error) {
        console.error("Помилка API:", error);
    } finally {
        isLoading = false;
        if (loadMoreBtn) loadMoreBtn.innerText = 'Завантажити ще 🔥';
    }
}

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