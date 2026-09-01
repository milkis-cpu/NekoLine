// ==========================================
// API.JS — Отримання даних про аніме
// ==========================================
const SHIKIMORI_BASE = "https://shikimori.io";
const API_URL = 'http://localhost:5000/api';
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='300'%20height='420'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%231f222e'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23a855f7'%20font-family='sans-serif'%20font-size='18'%3E%F0%9F%8D%AC%20%D0%91%D0%B5%D0%B7%20%D0%BF%D0%BE%D1%81%D1%82%D0%B5%D1%80%D0%B0%3C/text%3E%3C/svg%3E";

window.handleImageError = function(img) {
    if (img && img.src !== DEFAULT_PLACEHOLDER) {
        img.onerror = null;
        img.src = DEFAULT_PLACEHOLDER;
    }
};

function buildProxiedPosterUrl(rawPath) {
    if (!rawPath || typeof rawPath !== 'string' || rawPath.includes('missing')) {
        return DEFAULT_PLACEHOLDER;
    }
    if (rawPath.startsWith('data:')) {
        return rawPath;
    }
    
    // Видаляємо проксі wsrv.nl та примусово зводимо всі посилання до базового домену shikimori.io
    let cleanPath = rawPath.replace(/^https?:\/\/wsrv\.nl\/\?url=/g, '');
    cleanPath = cleanPath.replace(/shikimori\.one/g, 'shikimori.io');

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        return cleanPath;
    }
    if (cleanPath.startsWith('/')) {
        return `https://shikimori.io${cleanPath}`;
    }
    return `https://shikimori.io/${cleanPath}`;
}
function getPosterCache() {
    try {
        const cached = localStorage.getItem(POSTER_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (e) {
        return {};
    }
}
function setPosterCache(id, url) {
    try {
        const cache = getPosterCache();
        cache[id] = url;
        localStorage.setItem(POSTER_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
}

function getSearchQueries(rawTitle) {
    if (!rawTitle) return [];
    
    let clean = rawTitle
        .replace(/\d+\s*(сезон|season|часть|part)/gi, '')
        .replace(/[\.\-\—\xAB\BB"'\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const queries = [];

    // Точні пріоритетні ключі для складних тайтлів
    if (/Re\s*[:\.]?\s*Zero/i.test(rawTitle)) {
        queries.push('Re:Zero');
    } else if (/Ван\s*[\-\s]*Пис|One\s*Piece/i.test(rawTitle)) {
        queries.push('One Piece');
        queries.push('Ван-Пис');
    } else if (/Блич|Bleach/i.test(rawTitle)) {
        queries.push('Bleach');
    } else {
        queries.push(clean);
        const words = clean.split(' ').filter(w => w.length > 1);
        if (words.length >= 2) {
            queries.push(words.slice(0, 2).join(' '));
        }
    }

    return [...new Set(queries)];
}

const POSTER_CACHE_KEY = 'nekostream_poster_cache_v8';
// Автоматичне видалення застарілих версій кешу постерів
try {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('nekostream_poster_cache') && key !== POSTER_CACHE_KEY) {
            localStorage.removeItem(key);
        }
    });
} catch (e) {}

// Блок attachShikimoriPosters вимкнено — дані беруться виключно з вашої БД
async function attachShikimoriPosters(animeList) {
    return animeList;
}
// Функція нормалізації тексту для двомовного пошуку (UA / RU)
function normalizeSearchText(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/є/g, 'е')
        .replace(/э/g, 'е')
        .replace(/ы/g, 'и')
        .replace(/і/g, 'и')
        .replace(/ї/g, 'и')
        .replace(/чорн/g, 'черн') // Уніфікація коріння чорн <-> черн
        .replace(/[\.\-\—\xAB\BB"'\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
async function fetchAnimeFromAPI(query = '', append = false, filters = {}) {
    const grid = document.getElementById('anime-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!grid) return;

    if (isLoading) return;
    isLoading = true;

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
        const sortType = filters.sort || 'ranked';
        const orderDir = filters.orderDir || 'desc';

        const params = new URLSearchParams({
            page: currentPage,
            limit: 24,
            sort: sortType,
            orderDir: orderDir
        });

        if (query) {
            // Вилучаємо закінчення прикметників (ий/ый/ая тощо) та нормалізуємо літери для бекенд-пошуку
            const searchStem = query.trim().toLowerCase()
                .replace(/ё/g, 'е')
                .replace(/є/g, 'е')
                .replace(/э/g, 'е')
                .replace(/ы/g, 'и')
                .replace(/і/g, 'и')
                .replace(/ї/g, 'и')
                .replace(/чорн/g, 'черн')
                .replace(/(ий|ый|ая|яя|ое|ее|их|ых|им|ым)$/g, '');

            params.append('search', searchStem || query);
        }
        if (filters.genres && Array.isArray(filters.genres) && filters.genres.length > 0) {
            params.append('genre', filters.genres[0]);
        }
        if (filters.type && filters.type !== 'all') params.append('type', filters.type);
        if (filters.yearFrom) params.append('yearFrom', filters.yearFrom);
        if (filters.yearTo) params.append('yearTo', filters.yearTo);

        const apiUrl = `http://localhost:5000/api/anime?${params.toString()}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Помилка завантаження з БД");

        const data = await response.json();

        let addedItems = [];

        if (Array.isArray(data) && data.length > 0) {
            let newItems = data.map((item) => {
                const proxiedPoster = (item.poster && typeof item.poster === 'string' && item.poster.trim() !== '')
                    ? item.poster
                    : DEFAULT_PLACEHOLDER;

                return {
                    id: String(item._id || item.id),
                    shikimori_id: item.shikimori_id || null,
                    title: item.title || item.russian || item.name || 'Без назви',
                    originalTitle: item.originalTitle || item.name || item.title || '',
                    russianTitle: item.russian || '',
                    nativeName: item.name || '',
                    rating: item.rating ? String(item.rating) : (item.score ? String(item.score) : '0.0'),
                    tags: Array.isArray(item.genres) ? item.genres.join(', ') : (item.genres || item.kind || 'TV'),
                    year: item.year ? String(item.year) : ((item.released_on || item.aired_on) ? String(item.released_on || item.aired_on).split('-')[0] : '2024'),
                    status: item.status === 'ongoing' ? 'Онґоїнг' : (item.status || 'Завершено'),
                    description: item.description || 'Опис доступний при переході на сторінку аніме.',
                    poster: proxiedPoster,
                    genres: Array.isArray(item.genres) 
                        ? (item.genres.length === 1 && typeof item.genres[0] === 'string' && item.genres[0].includes(',') 
                            ? item.genres[0].split(',').map(g => g.trim()).filter(Boolean) 
                            : item.genres)
                        : (typeof item.genres === 'string' ? item.genres.split(',').map(g => g.trim()).filter(Boolean) : ['TV']),
                    episodes: item.episodes || item.episodes_aired || 0
                };
            });

            if (typeof attachShikimoriPosters === 'function') {
                try {
                    newItems = await attachShikimoriPosters(newItems);
                } catch (err) {
                    console.error("Помилка завантаження постерів:", err);
                }
            }

            // Розумне сортування пошуку з нормалізацією та перевіркою всіх назв
            if (query && query.trim() !== '') {
                const normQuery = normalizeSearchText(query);

                newItems.sort((a, b) => {
                    const titlesA = [a.title, a.russianTitle, a.originalTitle, a.nativeName]
                        .filter(Boolean)
                        .map(normalizeSearchText);

                    const titlesB = [b.title, b.russianTitle, b.originalTitle, b.nativeName]
                        .filter(Boolean)
                        .map(normalizeSearchText);

                    const getScore = (titles) => {
                        if (titles.some(t => t === normQuery)) return 1;
                        if (titles.some(t => t.startsWith(normQuery))) return 2;
                        if (titles.some(t => t.includes(normQuery))) return 3;
                        if (titles.some(t => t.split(' ').some(w => w.startsWith(normQuery)))) return 4;
                        return 5;
                    };

                    const scoreA = getScore(titlesA);
                    const scoreB = getScore(titlesB);

                    if (scoreA !== scoreB) {
                        return scoreA - scoreB;
                    }
                    return (a.title || '').localeCompare(b.title || '');
                });
            }

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
        if (typeof attachTooltipHoverEvents === 'function') {
            attachTooltipHoverEvents();
        }

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

        card.addEventListener('mouseenter', () => {
            const animeId = card.getAttribute('data-id');
            const descElement = card.querySelector('.tooltip-desc');
            const genresElement = card.querySelector('.tooltip-genres');
            const studioElement = card.querySelector('.tooltip-studio b');

            // Пошук даних об'єкта локально з уже завантаженого каталогу
            const item = (currentAnimeList || []).find(a => String(a.id) === String(animeId));

            if (item) {
                if (descElement) {
                    descElement.innerText = item.description ? item.description.replace(/\[.*?\]/g, '') : 'Опис для цього аніме відсутній.';
                }

                if (genresElement) {
    let rawGenres = item.genres;
    
    if (typeof rawGenres === 'string') {
        rawGenres = rawGenres.split(',').map(g => g.trim()).filter(Boolean);
    } else if (!Array.isArray(rawGenres)) {
        rawGenres = [];
    }

    if (rawGenres.length > 0) {
        const maxVisible = 4;
        const visibleGenres = rawGenres.slice(0, maxVisible);
        const extraCount = rawGenres.length - maxVisible;

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
            'меха': 18,
            'военное': 19, 'військове': 19
        };

        let genresHtml = visibleGenres.map(g => {
            const name = typeof g === 'object' ? (g.russian || g.name) : g;
            const cleanName = String(name).trim().toLowerCase();
            
            let colorIdx = genreColorMap[cleanName];
            if (colorIdx === undefined) {
                let hash = 0;
                for (let i = 0; i < cleanName.length; i++) {
                    hash = (hash * 31 + cleanName.charCodeAt(i)) % 20;
                }
                colorIdx = Math.abs(hash);
            }

            return `<span class="neon-genre-tag color-${colorIdx}">${name}</span>`;
        }).join('');

        if (extraCount > 0) {
            genresHtml += `<span class="neon-genre-tag more-tag">+ ${extraCount}</span>`;
        }

        genresElement.innerHTML = genresHtml;
    } else {
        genresElement.innerHTML = '<span class="neon-genre-tag">Аніме</span>';
    }
}

                if (studioElement) {
                    studioElement.innerText = item.studio || 'NekoStream';
                }
            }
        });
    });
}
async function fetchAnimeDetailsFromShikimori(shikimoriId) {
    return null;
}