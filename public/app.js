// ==========================================
// APP.JS — Рендеринг каталогу, перемикання видів та обробка подій
// ==========================================
function createAnimeCardHTML(anime) {
    const imgUrl = anime.poster || DEFAULT_PLACEHOLDER;
    const rating = anime.rating || '0.0';
    const status = anime.status || '';
    const isFav = (typeof favorites !== 'undefined' && favorites.includes(anime.id)) ? 'active' : '';

    const genresArr = Array.isArray(anime.genres) 
        ? (anime.genres.length === 1 && typeof anime.genres[0] === 'string' && anime.genres[0].includes(',')
            ? anime.genres[0].split(',').map(g => g.trim()).filter(Boolean)
            : anime.genres)
        : (typeof anime.genres === 'string' ? anime.genres.split(',').map(g => g.trim()).filter(Boolean) : []);

    const maxVisibleGenres = 4;
    const visibleGenres = genresArr.slice(0, maxVisibleGenres);
    const extraGenresCount = genresArr.length - maxVisibleGenres;

    const genreColorMap = {
        'сёнен': 0, 'сьонен': 0,
        'экшен': 1, 'екшн': 1,
        'приключения': 2, 'пригоди': 2,
        'фэнтези': 3, 'фентезі': 3,
        'сверхъестественное': 4, 'надприродне': 4,
        'драма': 5,                           // Фіолетовий
        'триллер': 6, 'трилер': 6,
        'исэкай': 7, 'ісекай': 7,
        'романтика': 8,                        // Яскраво-рожевий
        'комедия': 9, 'комедія': 9,
        'детектив': 10,
        'спорт': 11,
        'повседневность': 12, 'буденність': 12, // Світло-м'ятний зелений
        'мистика': 13, 'містика': 13,
        'фантастика': 14,
        'ужасы': 15, 'жахи': 15,
        'школа': 16,                           // Насичений смарагдово-зелений
        'музыка': 17, 'музика': 17,
        'сэйнэн': 18, 'сейнен': 18,
        'меха': 19,
        'военное': 20, 'військове': 20,         // Оливково-салатовий
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

    // Формуємо 2 жанри для самої картки
    const cardGenresHTML = genresArr.slice(0, 2).map(g => {
        const name = typeof g === 'object' ? (g.russian || g.name) : g;
        const colorIdx = getGenreColorIdx(name);
        return `<span class="neon-genre-tag card-genre-badge color-${colorIdx}">${name}</span>`;
    }).join('');

    // Список жанрів для спливаючого тултіпа
    let genresList = visibleGenres.map(g => {
        const name = typeof g === 'object' ? (g.russian || g.name) : g;
        const colorIdx = getGenreColorIdx(name);
        return `<span class="neon-genre-tag color-${colorIdx}">${name}</span>`;
    }).join('');

    if (extraGenresCount > 0) {
        genresList += `<span class="neon-genre-tag more-tag">+ ${extraGenresCount}</span>`;
    }

    if (!genresList) {
        genresList = '<span class="neon-genre-tag">Аніме</span>';
    }

    return `
    <div class="anime-card" data-id="${anime.id}" data-title="${anime.title || ''}" style="cursor: pointer;">
        <div class="poster-container">
            <img class="poster-img" 
                 src="${imgUrl}" 
                 alt="${anime.title || ''}" 
                 loading="lazy"
                 referrerpolicy="no-referrer"
                 onerror="handleImageError(this, '${imgUrl}')">
            
            <div class="card-badges-top">
                <span class="badge-rating">⭐ ${rating}</span>
                <button class="fav-btn ${isFav}" title="Додати в переглянути">📜</button>
            </div>

            ${status ? `<span class="badge-status">${status}</span>` : ''}
        </div>

        <div class="card-info">
            <h3 class="card-title" title="${anime.title || ''}">${anime.title || 'Без назви'}</h3>
            <div class="card-meta">
                <span class="card-year">${anime.year || '2024'}</span>
                ${cardGenresHTML}
            </div>
        </div>

        <div class="anime-tooltip">
            <div class="tooltip-top-row">
                <div class="tooltip-content">
                    <div class="tooltip-header">
                        <h4 class="tooltip-title">${anime.title || ''}</h4>
                        <div class="tooltip-badges">
                            <span class="tooltip-pill rating">⭐ ${rating}</span>
                            <span class="tooltip-pill year">${anime.year || '2024'}</span>
                            ${status ? `<span class="tooltip-pill status">${status}</span>` : ''}
                        </div>
                    </div>

                    <div class="tooltip-block">
                        <span class="tooltip-block-label">ЖАНРИ</span>
                        <div class="tooltip-genres">${genresList}</div>
                    </div>
                </div>

                <img class="tooltip-poster" 
                     src="${imgUrl}" 
                     alt="${anime.title || ''}" 
                     referrerpolicy="no-referrer"
                     onerror="handleImageError(this, '${imgUrl}')">
            </div>

            <div class="tooltip-block desc-block">
                <span class="tooltip-block-label">ОПИС</span>
                <p class="tooltip-desc">${anime.description || 'Опис відсутній'}</p>
            </div>
        </div>
    </div>
    `;
}
function renderCatalog(append = false, newItemsOnly = null) {
    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    safeSetText('catalog-heading', (selectedGenre === 'favorites') ? '📜 Ваше переглянути аніме' : '🔥 Каталог аніме');

    // 1. При підвантаженні "Завантажити ще" просто додаємо нові картки в кінець сітки без перемальовування
    if (append && Array.isArray(newItemsOnly)) {
        newItemsOnly.forEach(anime => {
            grid.insertAdjacentHTML('beforeend', createAnimeCardHTML(anime));
        });
        return;
    }
if (typeof initHeroSlider === 'function' && Array.isArray(currentAnimeList) && currentAnimeList.length > 0) {
        initHeroSlider(currentAnimeList);
    }
    // 2. Перше завантаження / новий фільтр — очищаємо сітку і рендеримо першу сторінку
    grid.innerHTML = '';

    let listToRender = [...(currentAnimeList || [])];

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

function showCatalogView() {
    const homeView = document.getElementById('home-view');
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const profileView = document.getElementById('profile-view');
    const mainPlayer = document.getElementById('main-player');

    if (homeView) homeView.style.display = 'none';
    if (playerView) playerView.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
    if (catalogView) catalogView.style.display = 'block';
    if (mainPlayer) mainPlayer.src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCatalog() {
    showCatalogView();
}

function showProfileView() {
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const profileView = document.getElementById('profile-view');

    if (catalogView) catalogView.style.display = 'none';
    if (playerView) playerView.style.display = 'none';
    if (profileView) profileView.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadUserProfile();
}

// ІНІЦІАЛІЗАЦІЯ ПОДІЙ
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
    const navHomeBtn = document.getElementById('nav-home-btn');
    const backFromProfileBtn = document.getElementById('back-from-profile');

    if (logoBtn) logoBtn.addEventListener('click', showCatalogView);
    if (backBtn) backBtn.addEventListener('click', showCatalogView);
    if (navHomeBtn) navHomeBtn.addEventListener('click', showCatalogView);
    if (backFromProfileBtn) backFromProfileBtn.addEventListener('click', showCatalogView);

    // Профіль у шапці
    const userProfileBadge = document.getElementById('user-profile');
    if (userProfileBadge) {
        userProfileBadge.addEventListener('click', (e) => {
            if (e.target.id !== 'logout-btn') {
                if (document.getElementById('profile-view')) {
                    showProfileView();
                } else {
                    openProfileModal();
                }
            }
        });
    }

    // Модалка профілю
    const closeProfileBtn = document.getElementById('close-profile-modal-btn');
    if (closeProfileBtn) {
        closeProfileBtn.onclick = (e) => {
            e.preventDefault();
            closeProfileModal();
        };
    }

    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        profileModal.onclick = (e) => {
            if (e.target === profileModal) closeProfileModal();
        };
    }

    // Оновлення профілю
    const updateForm = document.getElementById('form-update-profile');
    if (updateForm) {
        updateForm.onsubmit = async (e) => {
            e.preventDefault();
            const token = getAuthToken();
            if (!token) return showToast("Помилка авторизації!", "error");

            const avatarUrl = document.getElementById('input-avatar-url')?.value.trim();
            const bioText = document.getElementById('input-bio')?.value.trim();

            try {
                const response = await fetch(`${API_URL}/me`, {
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
                    showToast("Профіль оновлено! ✨", "success");
                    loadUserProfile();
                    closeProfileModal();
                    updateForm.reset();
                } else {
                    showToast(data.error || "Не вдалося зберегти", "error");
                }
            } catch (err) {
                console.error("Помилка збереження:", err);
                showToast("Помилка збереження профілю", "error");
            }
        };
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

    // Сортування (Селектор)
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentPage = 1;
            const orderDir = filterOrderBtn ? (filterOrderBtn.getAttribute('data-order') || 'desc') : 'desc';
            fetchAnimeFromAPI('', false, {
                ...currentFilters,
                sort: sortSelect.value,
                orderDir: orderDir
            });
        });
    }

    // Жанри
    // Керування випадаючим меню фільтрів
// Керування випадаючим меню фільтрів
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterDropdown = document.getElementById('filter-dropdown');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const randomAnimeBtn = document.getElementById('random-anime-btn');
// Перемикач напрямку сортування (Зростання / Спадання)
const filterOrderBtn = document.getElementById('filter-order-btn');
if (filterOrderBtn) {
    filterOrderBtn.addEventListener('click', () => {
        const currentOrder = filterOrderBtn.getAttribute('data-order') || 'desc';
        const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        filterOrderBtn.setAttribute('data-order', newOrder);
        filterOrderBtn.innerText = newOrder === 'asc' ? '⬆️ Зростання' : '⬇️ Спадання';

        currentPage = 1;
        const activeSort = document.getElementById('filter-sort')?.value || 'popularity';
        fetchAnimeFromAPI('', false, {
            ...currentFilters,
            sort: activeSort,
            orderDir: newOrder
        });
    });
}

// Показ / приховування меню фільтрів
if (filterToggleBtn && filterDropdown) {
    filterToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!filterDropdown.contains(e.target) && e.target !== filterToggleBtn) {
            filterDropdown.classList.add('hidden');
        }
    });
}

// Застосування фільтрів
// Застосування фільтрів
if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
        const selectedGenres = Array.from(document.querySelectorAll('.genre-cb:checked'))
            .map(cb => cb.value)
            .filter(val => val !== 'favorites');
        const isFavorites = document.querySelector('.genre-cb[value="favorites"]')?.checked || false;

        const type = document.getElementById('filter-type')?.value || 'all';
        const yearFrom = document.getElementById('filter-year-from')?.value || '';
        const yearTo = document.getElementById('filter-year-to')?.value || '';
        const sort = document.getElementById('filter-sort')?.value || 'popularity';
        const orderDir = filterOrderBtn ? filterOrderBtn.getAttribute('data-order') : 'desc';

        currentPage = 1;

        if (isFavorites) {
            selectedGenre = 'favorites';
            renderCatalog();
        } else {
            selectedGenre = selectedGenres.length > 0 ? selectedGenres[0] : 'all';
            fetchAnimeFromAPI('', false, {
                genres: selectedGenres,
                type,
                yearFrom,
                yearTo,
                sort,
                orderDir
            });
        }

        filterDropdown.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Скидання фільтрів
if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
        const genreSelect = document.getElementById('filter-genre');
        if (genreSelect) {
            Array.from(genreSelect.options).forEach(opt => opt.selected = (opt.value === 'all'));
        }
        if (document.getElementById('filter-type')) document.getElementById('filter-type').value = 'all';
        if (document.getElementById('filter-year-from')) document.getElementById('filter-year-from').value = '';
        if (document.getElementById('filter-year-to')) document.getElementById('filter-year-to').value = '';
        if (document.getElementById('filter-sort')) document.getElementById('filter-sort').value = 'popularity';
        if (filterOrderBtn) {
            filterOrderBtn.setAttribute('data-order', 'desc');
            filterOrderBtn.innerText = '⬇️ Спадання';
        }

        selectedGenre = 'all';
        currentPage = 1;
        fetchAnimeFromAPI('', false);
        filterDropdown.classList.add('hidden');
    });
}
// Рандомне аніме
if (randomAnimeBtn) {
    randomAnimeBtn.addEventListener('click', async () => {
        try {
            showToast('Підбираємо випадкове аніме... 🎲', 'info');
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`${SHIKIMORI_BASE}/api/animes?limit=1&order=random`)}&_t=${Date.now()}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Помилка завантаження');
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                const rawImg = item.image?.original || item.image?.preview || '';
                const randomAnime = {
                    id: String(item.id),
                    title: item.russian || item.name || 'Без назви',
                    originalTitle: item.name || '',
                    rating: item.score ? String(item.score) : '8.0',
                    tags: item.kind ? item.kind.toUpperCase() : 'TV',
                    year: item.released_on ? item.released_on.split('-')[0] : '2024',
                    status: item.status === 'ongoing' ? 'Онґоїнг' : 'Завершено',
                    description: 'Перехід до перегляду...',
                    poster: buildProxiedPosterUrl(rawImg),
                    genres: [item.kind ? item.kind.toUpperCase() : 'TV'],
                    episodes: item.episodes || item.episodes_aired || 0
                };
                openAnimePlayer(randomAnime);
            }
        } catch (err) {
            console.error('Помилка випадкового аніме:', err);
            showToast('Не вдалося завантажити випадкове аніме ❌', 'error');
        }
    });
}

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
            showCatalogView();
            selectedGenre = 'all';
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
            const allBtn = document.querySelector('.genre-btn[data-genre="all"]');
            if (allBtn) allBtn.classList.add('active');
            renderCatalog();
            updateMobileNavActive(mobileHome);
        });
    }

    if (mobileSearch && searchInput) {
        mobileSearch.addEventListener('click', () => {
            showCatalogView();
            searchInput.focus();
            updateMobileNavActive(mobileSearch);
        });
    }

    if (mobileFavs) {
        mobileFavs.addEventListener('click', () => {
            showCatalogView();
            selectedGenre = 'favorites';
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
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

    // Вхід / Реєстрація
    const authModal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth-btn');
    const closeAuthBtn = document.getElementById('close-modal-btn');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const logoutBtn = document.getElementById('logout-btn');

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

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
            
            const inputs = formLogin.querySelectorAll('input');
            let emailOrUsername = '';
            let password = '';

            inputs.forEach(input => {
                if (input.type === 'password') {
                    password = input.value.trim();
                } else if (input.type === 'text' || input.type === 'email') {
                    emailOrUsername = input.value.trim();
                }
            });

            if (!emailOrUsername && inputs[0]) emailOrUsername = inputs[0].value.trim();
            if (!password && inputs[1]) password = inputs[1].value.trim();

            if (!emailOrUsername || !password) {
                return showToast('Будь ласка, заповніть всі поля!', 'error');
            }

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: emailOrUsername,
                        emailOrUsername: emailOrUsername,
                        password: password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    return showToast(data.error || 'Помилка входу!', 'error');
                }

                const userToken = data.token || data.accessToken;
                const username = data.user ? data.user.username : emailOrUsername;

                saveAuthToken(userToken);
                localStorage.setItem('nekostream_user', username);

                checkAuthStatus();
                if (authModal) {
                    authModal.style.display = 'none';
                    authModal.classList.remove('active');
                }
                showToast(`Ласкаво просимо, ${username}! ✨`, 'success');

            } catch (err) {
                console.error("Помилка підключення:", err);
                showToast('Не вдалося з’єднатися з сервером ❌', 'error');
            }
        });
    }

    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nicknameInput = formRegister.querySelector('input[type="text"]')?.value.trim();
            const emailInput = formRegister.querySelector('input[type="email"]')?.value.trim();
            const passwordInput = formRegister.querySelector('input[type="password"]')?.value.trim();

            if (!nicknameInput || !emailInput || !passwordInput) {
                return showToast('Заповніть всі поля реєстрації!', 'error');
            }

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

                const userToken = data.token || data.accessToken;
                if (userToken) saveAuthToken(userToken);
                localStorage.setItem('nekostream_user', data.user ? data.user.username : nicknameInput);

                checkAuthStatus();
                if (authModal) {
                    authModal.style.display = 'none';
                    authModal.classList.remove('active');
                }
                showToast('Акаунт успішно створено! 🎉', 'success');

            } catch (err) {
                console.error("Помилка підключення:", err);
                showToast('Не вдалося з’єднатися з сервером ❌', 'error');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeAuthToken();
            checkAuthStatus();
            showToast('Ви вийшли з акаунту', 'info');
        });
    }

    // Запуск
    checkAuthStatus();
    fetchAnimeFromAPI();
});

// Напрямок спливаючої підказки
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
document.addEventListener('DOMContentLoaded', () => {
    const navHomeBtn = document.getElementById('nav-home-btn');
    const sideNavHome = document.getElementById('side-nav-home');
    const navCatalogBtn = document.getElementById('nav-catalog-btn');
    const logoBtn = document.getElementById('logo-btn');

    const homeView = document.getElementById('home-view');
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const profileView = document.getElementById('profile-view');

    // Функція переходу на Головну сторінку
    function openHome(e) {
        if (e) e.preventDefault();
        if (homeView) homeView.style.display = 'block';
        if (catalogView) catalogView.style.display = 'none';
        if (playerView) playerView.style.display = 'none';
        if (profileView) profileView.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Функція переходу в Каталог
    function openCatalog(e) {
        if (e) e.preventDefault();
        if (homeView) homeView.style.display = 'none';
        if (catalogView) catalogView.style.display = 'block';
        if (playerView) playerView.style.display = 'none';
        if (profileView) profileView.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (navHomeBtn) navHomeBtn.addEventListener('click', openHome);
    if (sideNavHome) sideNavHome.addEventListener('click', openHome);
    if (logoBtn) logoBtn.addEventListener('click', openHome);
    if (navCatalogBtn) navCatalogBtn.addEventListener('click', openCatalog);
});
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('cyber-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-collapsed');
        });
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const genreAll = document.getElementById('genre-all');
    const genreCheckboxes = document.querySelectorAll('.genre-cb');

    if (!genreAll) return;

    // Клік на "Всі жанри" — знімає виділення з інших жанрів
    genreAll.addEventListener('change', () => {
        if (genreAll.checked) {
            genreCheckboxes.forEach(cb => cb.checked = false);
        } else {
            const anyChecked = Array.from(genreCheckboxes).some(cb => cb.checked);
            if (!anyChecked) genreAll.checked = true;
        }
    });

    // Клік на окремий жанр — перемикає стан "Всі жанри"
    genreCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const anyChecked = Array.from(genreCheckboxes).some(c => c.checked);
            genreAll.checked = !anyChecked;
        });
    });
});