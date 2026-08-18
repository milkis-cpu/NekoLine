// ==========================================
// PLAYER.JS — Перегляд аніме, плеєр та коментарі
// ==========================================

async function openAnimePlayer(anime) {
    const catalogView = document.getElementById('catalog-view');
    const playerView = document.getElementById('player-view');
    const profileView = document.getElementById('profile-view');
    const mainPlayer = document.getElementById('main-player');

    if (catalogView) catalogView.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
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