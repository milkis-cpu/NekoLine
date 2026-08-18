// ==========================================
// AUTH.JS — Авторизація, профілі та токени
// ==========================================

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

function renderHeatmap() {
    const heatmapContainer = document.getElementById('activity-heatmap');
    if (!heatmapContainer) return;
    heatmapContainer.innerHTML = '';
    for (let i = 0; i < 28; i++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.style.cssText = 'width:12px; height:12px; background:#242731; border-radius:2px; display:inline-block; margin:2px;';
        if (Math.random() > 0.6) cell.style.background = '#a855f7';
        heatmapContainer.appendChild(cell);
    }
}

async function loadUserProfile() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok && data.user) {
            const avatarUrl = (data.user.avatar && data.user.avatar.trim() !== '') 
                ? data.user.avatar 
                : "https://i.ibb.co/default-avatar.png";

            const headerAvatar = document.getElementById('header-avatar');
            const headerName = document.getElementById('user-nickname');
            if (headerAvatar) headerAvatar.src = avatarUrl;
            if (headerName) headerName.textContent = data.user.username;

            const modalAvatar = document.getElementById('user-avatar');
            const modalName = document.getElementById('user-name');
            const modalEmail = document.getElementById('user-email');
            const modalBio = document.getElementById('user-bio');

            if (modalAvatar) modalAvatar.src = avatarUrl;
            if (modalName) modalName.textContent = data.user.username;
            if (modalEmail) modalEmail.textContent = data.user.email || "";
            if (modalBio) modalBio.textContent = data.user.bio || "Інформація відсутня...";

            renderHeatmap();
        }
    } catch (err) {
        console.error("Помилка завантаження профілю:", err);
    }
}

function checkAuthStatus() {
    const savedUser = localStorage.getItem('nekostream_user');
    const userProfile = document.getElementById('user-profile');
    const openAuthBtn = document.getElementById('open-auth-btn');
    if (savedUser) {
        safeSetText('user-nickname', `👤 ${savedUser}`);
        if (openAuthBtn) openAuthBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        loadUserProfile();
    } else {
        if (openAuthBtn) openAuthBtn.style.display = 'block';
        if (userProfile) userProfile.style.display = 'none';
    }
}