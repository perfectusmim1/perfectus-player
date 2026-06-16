/* ==========================================================================
   PERFECTUS PLAYER - CONTROLLER LOGIC + SUBTITLE INTEGRATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM Elements ─────────────────────────────────────────────────────
    const playerContainer = document.getElementById('player-container');
    const mainVideo = document.getElementById('main-video');
    const previewVideo = document.getElementById('preview-video');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const backwardBtn = document.getElementById('backward-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const videoTitleEl = document.getElementById('video-title');
    const timelineContainer = document.getElementById('timeline-container');
    const progressBar = document.getElementById('progress-bar');
    const bufferBar = document.getElementById('buffer-bar');
    const previewTooltip = document.getElementById('preview-tooltip');
    const previewCanvas = document.getElementById('preview-canvas');
    const previewTime = document.getElementById('preview-time');
    const canvasSpinner = document.getElementById('canvas-spinner');
    const speedMenuBtn = document.getElementById('speed-menu-btn');
    const speedMenu = document.getElementById('speed-menu');
    const currentSpeedLabel = document.getElementById('current-speed-label');
    const qualityMenuBtn = document.getElementById('quality-menu-btn');
    const qualityMenu = document.getElementById('quality-menu');
    const currentQualityLabel = document.getElementById('current-quality-label');
    const qualityOptions = document.getElementById('quality-options');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const dropZone = document.getElementById('drop-zone');
    const fileSelectorTrigger = document.getElementById('file-selector-trigger');
    const localFileInput = document.getElementById('local-file-input');
    const loadDemoBtn = document.getElementById('load-demo-btn');
    const hudOverlay = document.getElementById('hud-overlay');
    const hudIcon = document.getElementById('hud-icon');
    const hudText = document.getElementById('hud-text');

    // Subtitle DOM
    const subtitleOverlay = document.getElementById('subtitle-overlay');
    const ccMenuBtn = document.getElementById('cc-menu-btn');
    const ccMenu = document.getElementById('cc-menu');
    const ccOptions = document.getElementById('cc-options');
    const ccLoadFileBtn = document.getElementById('cc-load-file-btn');
    const ccDownloadSrtBtn = document.getElementById('cc-download-srt-btn');
    const subtitleFileInput = document.getElementById('subtitle-file-input');

    // Resume Banner DOM
    const resumeBanner = document.getElementById('resume-banner');
    const resumeTitle = document.getElementById('resume-title');
    const resumeTime = document.getElementById('resume-time');
    const resumeContinueBtn = document.getElementById('resume-continue-btn');
    const resumeDismissBtn = document.getElementById('resume-dismiss-btn');

    // Settings Modal DOM
    const settingsModalBackdrop = document.getElementById('settings-modal-backdrop');
    const settingsTriggerBtn = document.getElementById('settings-trigger-btn');
    const settingsModalClose = document.getElementById('settings-modal-close');
    const modalTabs = document.querySelectorAll('.modal-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // API Settings
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyToggle = document.getElementById('api-key-toggle');
    const modelSelect = document.getElementById('model-select');
    const apiStatus = document.getElementById('api-status');
    const thinkingSelect = document.getElementById('thinking-select');

    // Translation
    const translateSourceSelect = document.getElementById('translate-source-select');
    const translateTargetLang = document.getElementById('translate-target-lang');
    const translateBtn = document.getElementById('translate-btn');
    const translateProgress = document.getElementById('translate-progress');
    const translateProgressFill = document.getElementById('translate-progress-fill');
    const translateProgressText = document.getElementById('translate-progress-text');
    const translateStatus = document.getElementById('translate-status');

    // Style Settings
    const subFontSize = document.getElementById('sub-font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const subFontColor = document.getElementById('sub-font-color');
    const subFontColorValue = document.getElementById('sub-font-color-value');
    const subBgEnabled = document.getElementById('sub-bg-enabled');
    const bgSettingsGroup = document.getElementById('bg-settings-group');
    const bgOpacityGroup = document.getElementById('bg-opacity-group');
    const subBgColor = document.getElementById('sub-bg-color');
    const subBgColorValue = document.getElementById('sub-bg-color-value');
    const subBgOpacity = document.getElementById('sub-bg-opacity');
    const bgOpacityValue = document.getElementById('bg-opacity-value');
    const subShadowEnabled = document.getElementById('sub-shadow-enabled');
    const subPreviewText = document.getElementById('sub-preview-text');

    // ── State Variables ──────────────────────────────────────────────────
    let isScrubbing = false;
    let wasPausedBeforeScrub = false;
    let controlsTimeout = null;
    let isSeekingPreview = false;
    let pendingPreviewTime = null;
    let currentSpeed = 1;
    let currentQuality = 'original';
    let currentVolume = 1;
    let activeMainUrl = null;
    let activePreviewUrl = null;

    // Subtitle state
    let subtitleTracks = [];        // [{name, lang, cues, type}]
    let activeTrackIndex = -1;      // -1 = off
    let subtitleStyle = null;       // Current style config
    let lastRenderedCueText = '';   // Avoid redundant DOM writes
    let currentFileName = '';       // Current loaded file name
    let currentFileSize = 0;        // Current loaded file size

    const demoVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoVideoTitle = 'Big Buck Bunny (Cinematic Demo)';

    // ── Init ─────────────────────────────────────────────────────────────
    mainVideo.volume = currentVolume;
    volumeSlider.value = currentVolume;
    loadSavedSettings();
    populateLanguageDropdown();

    // ══════════════════════════════════════════════════════════════════════
    //  SETTINGS PERSISTENCE (localStorage)
    // ══════════════════════════════════════════════════════════════════════

    function loadSavedSettings() {
        // API Key
        const savedKey = localStorage.getItem('perfectus_api_key');
        if (savedKey) {
            apiKeyInput.value = savedKey;
            updateApiStatus();
        }

        // Model
        const savedModel = localStorage.getItem('perfectus_model');
        if (savedModel) modelSelect.value = savedModel;

        // Thinking level
        const savedThinking = localStorage.getItem('perfectus_thinking');
        if (savedThinking) {
            thinkingSelect.value = savedThinking;
            syncCustomDropdown('thinking-select');
        }

        // Subtitle Style
        const savedStyle = localStorage.getItem('perfectus_sub_style');
        if (savedStyle) {
            try {
                subtitleStyle = JSON.parse(savedStyle);
            } catch (e) {
                subtitleStyle = window.PerfectusSubtitle.getDefaultStyle();
            }
        } else {
            subtitleStyle = window.PerfectusSubtitle.getDefaultStyle();
        }

        // Sync UI with style state
        syncStyleUI();
        applySubtitleStyle();
    }

    function saveSettings() {
        localStorage.setItem('perfectus_api_key', apiKeyInput.value);
        localStorage.setItem('perfectus_model', modelSelect.value);
        localStorage.setItem('perfectus_thinking', thinkingSelect.value);
        localStorage.setItem('perfectus_sub_style', JSON.stringify(subtitleStyle));
    }

    // ══════════════════════════════════════════════════════════════════════
    //  SETTINGS MODAL
    // ══════════════════════════════════════════════════════════════════════

    settingsTriggerBtn.addEventListener('click', () => {
        settingsModalBackdrop.classList.add('visible');
    });

    settingsModalClose.addEventListener('click', () => {
        settingsModalBackdrop.classList.remove('visible');
        saveSettings();
    });

    settingsModalBackdrop.addEventListener('click', (e) => {
        if (e.target === settingsModalBackdrop) {
            settingsModalBackdrop.classList.remove('visible');
            saveSettings();
        }
    });

    // Tab switching
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // API Key toggle visibility
    apiKeyToggle.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        apiKeyToggle.innerHTML = `<i class="fa-solid fa-eye${isPassword ? '-slash' : ''}"></i>`;
    });

    // API Key save on change
    apiKeyInput.addEventListener('input', () => {
        saveSettings();
        updateApiStatus();
    });

    modelSelect.addEventListener('change', () => saveSettings());
    thinkingSelect.addEventListener('change', () => saveSettings());

    function updateApiStatus() {
        const key = apiKeyInput.value.trim();
        if (!key) {
            apiStatus.className = 'api-status';
            apiStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>API anahtarı girilmemiş</span>';
        } else if (key.startsWith('AIza')) {
            apiStatus.className = 'api-status success';
            apiStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>API anahtarı kaydedildi</span>';
        } else {
            apiStatus.className = 'api-status';
            apiStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i><span>API anahtarı kaydedildi</span>';
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  SUBTITLE STYLE CUSTOMIZATION
    // ══════════════════════════════════════════════════════════════════════

    function syncStyleUI() {
        subFontSize.value = subtitleStyle.fontSize;
        fontSizeValue.textContent = subtitleStyle.fontSize + 'px';
        subFontColor.value = subtitleStyle.fontColor;
        subFontColorValue.textContent = subtitleStyle.fontColor.toUpperCase();
        subBgEnabled.checked = subtitleStyle.bgEnabled;
        subBgColor.value = subtitleStyle.bgColor;
        subBgColorValue.textContent = subtitleStyle.bgColor.toUpperCase();
        subBgOpacity.value = Math.round(subtitleStyle.bgOpacity * 100);
        bgOpacityValue.textContent = Math.round(subtitleStyle.bgOpacity * 100) + '%';
        subShadowEnabled.checked = subtitleStyle.shadowEnabled;

        // Show/hide bg sub-settings
        bgSettingsGroup.style.display = subtitleStyle.bgEnabled ? '' : 'none';
        bgOpacityGroup.style.display = subtitleStyle.bgEnabled ? '' : 'none';
    }

    function onStyleChange() {
        subtitleStyle.fontSize = parseInt(subFontSize.value);
        subtitleStyle.fontColor = subFontColor.value;
        subtitleStyle.bgEnabled = subBgEnabled.checked;
        subtitleStyle.bgColor = subBgColor.value;
        subtitleStyle.bgOpacity = parseInt(subBgOpacity.value) / 100;
        subtitleStyle.shadowEnabled = subShadowEnabled.checked;

        fontSizeValue.textContent = subtitleStyle.fontSize + 'px';
        subFontColorValue.textContent = subtitleStyle.fontColor.toUpperCase();
        subBgColorValue.textContent = subtitleStyle.bgColor.toUpperCase();
        bgOpacityValue.textContent = Math.round(subtitleStyle.bgOpacity * 100) + '%';

        bgSettingsGroup.style.display = subtitleStyle.bgEnabled ? '' : 'none';
        bgOpacityGroup.style.display = subtitleStyle.bgEnabled ? '' : 'none';

        applySubtitleStyle();
        updatePreviewStyle();
        saveSettings();
    }

    subFontSize.addEventListener('input', onStyleChange);
    subFontColor.addEventListener('input', onStyleChange);
    subBgEnabled.addEventListener('change', onStyleChange);
    subBgColor.addEventListener('input', onStyleChange);
    subBgOpacity.addEventListener('input', onStyleChange);
    subShadowEnabled.addEventListener('change', onStyleChange);

    function applySubtitleStyle() {
        if (window.PerfectusSubtitle) {
            window.PerfectusSubtitle.applyStyle(subtitleOverlay, subtitleStyle);
        }
    }

    function updatePreviewStyle() {
        if (window.PerfectusSubtitle) {
            // Apply to preview with slightly smaller font
            const previewStyle = { ...subtitleStyle, fontSize: Math.max(14, Math.round(subtitleStyle.fontSize * 0.7)) };
            window.PerfectusSubtitle.applyStyle(subPreviewText, previewStyle);
        }
    }

    // Initialize preview style
    setTimeout(() => updatePreviewStyle(), 100);

    // ══════════════════════════════════════════════════════════════════════
    //  TRANSLATION SYSTEM
    // ══════════════════════════════════════════════════════════════════════

    function populateLanguageDropdown() {
        if (!window.PerfectusTranslate) return;
        const langs = window.PerfectusTranslate.getSupportedLanguages();
        translateTargetLang.innerHTML = '';
        langs.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.name;
            opt.textContent = lang.name;
            translateTargetLang.appendChild(opt);
        });
        // Sync custom dropdown
        setTimeout(() => syncCustomDropdown('translate-target-lang'), 0);
    }

    function updateTranslateSourceList() {
        translateSourceSelect.innerHTML = '';
        if (subtitleTracks.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.selected = true;
            opt.textContent = 'Önce bir altyazı yükleyin...';
            translateSourceSelect.appendChild(opt);
            translateBtn.disabled = true;
            // Sync custom dropdown
            setTimeout(() => syncCustomDropdown('translate-source-select'), 0);
            return;
        }

        subtitleTracks.forEach((track, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = track.name + (track.lang ? ` (${track.lang})` : '');
            translateSourceSelect.appendChild(opt);
        });

        translateBtn.disabled = !apiKeyInput.value.trim();

        // Sync custom dropdown
        setTimeout(() => syncCustomDropdown('translate-source-select'), 0);
    }

    // Enable/disable translate button based on API key
    apiKeyInput.addEventListener('input', () => {
        if (subtitleTracks.length > 0) {
            translateBtn.disabled = !apiKeyInput.value.trim();
        }
    });

    translateBtn.addEventListener('click', async () => {
        const sourceIndex = parseInt(translateSourceSelect.value);
        const targetLang = translateTargetLang.value;
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;
        const thinkingBudget = parseInt(thinkingSelect.value) || 0;

        if (isNaN(sourceIndex) || !subtitleTracks[sourceIndex]) {
            showTranslateStatus('Lütfen bir kaynak altyazı seçin.', 'error');
            return;
        }

        if (!apiKey) {
            showTranslateStatus('API anahtarı gereklidir. Ayarlar > API sekmesinden girin.', 'error');
            return;
        }

        const sourceCues = subtitleTracks[sourceIndex].cues;

        // Show progress
        translateProgress.style.display = '';
        translateProgressFill.style.width = '0%';
        translateProgressText.textContent = `0 / ${sourceCues.length}`;
        translateBtn.disabled = true;
        translateStatus.style.display = 'none';

        try {
            const translatedCues = await window.PerfectusTranslate.translateSubtitles(
                sourceCues, targetLang, apiKey, model,
                (completed, total) => {
                    const pct = Math.round((completed / total) * 100);
                    translateProgressFill.style.width = pct + '%';
                    translateProgressText.textContent = `${completed} / ${total}`;
                },
                thinkingBudget
            );

            // Add as new track
            const trackName = `${subtitleTracks[sourceIndex].name} → ${targetLang}`;
            addSubtitleTrack(trackName, targetLang, translatedCues, 'translated');

            // Auto-select the new track
            setActiveTrack(subtitleTracks.length - 1);

            showTranslateStatus(`✓ Çeviri tamamlandı! "${trackName}" eklendi.`, 'success');
        } catch (err) {
            showTranslateStatus(`Hata: ${err.message}`, 'error');
        } finally {
            translateBtn.disabled = false;
            setTimeout(() => { translateProgress.style.display = 'none'; }, 2000);
        }
    });

    function showTranslateStatus(message, type) {
        translateStatus.style.display = '';
        translateStatus.className = `translate-status ${type}`;
        translateStatus.textContent = message;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  SUBTITLE TRACK MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════

    function addSubtitleTrack(name, lang, cues, type) {
        subtitleTracks.push({ name, lang, cues, type });
        rebuildCCMenu();
        updateTranslateSourceList();
    }

    function setActiveTrack(index) {
        activeTrackIndex = index;
        lastRenderedCueText = '';
        subtitleOverlay.innerHTML = '';

        // Show/hide download button
        ccDownloadSrtBtn.style.display = (index >= 0) ? '' : 'none';

        // Update CC menu active state
        const items = ccOptions.querySelectorAll('.menu-item');
        items.forEach(item => {
            const trackVal = item.dataset.track;
            if (trackVal === 'off' && index === -1) {
                item.classList.add('active');
            } else if (trackVal !== 'off' && parseInt(trackVal) === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function rebuildCCMenu() {
        ccOptions.innerHTML = '';

        // "Off" option
        const offItem = document.createElement('button');
        offItem.className = 'menu-item' + (activeTrackIndex === -1 ? ' active' : '');
        offItem.dataset.track = 'off';
        offItem.textContent = 'Kapalı';
        ccOptions.appendChild(offItem);

        // Track options
        subtitleTracks.forEach((track, i) => {
            const item = document.createElement('button');
            item.className = 'menu-item' + (activeTrackIndex === i ? ' active' : '');
            item.dataset.track = String(i);
            item.textContent = track.name;
            ccOptions.appendChild(item);
        });
    }

    // CC Menu interactions
    ccMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus(ccMenu);
        ccMenu.classList.toggle('visible');
    });

    ccOptions.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        if (item.dataset.track === 'off') {
            setActiveTrack(-1);
            showHUD('fa-closed-captioning', 'Altyazı Kapalı');
        } else {
            const idx = parseInt(item.dataset.track);
            setActiveTrack(idx);
            showHUD('fa-closed-captioning', subtitleTracks[idx].name);
        }

        ccMenu.classList.remove('visible');
    });

    // Load subtitle file
    ccLoadFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        subtitleFileInput.click();
    });

    // Download active subtitle as SRT
    ccDownloadSrtBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeTrackIndex < 0 || !subtitleTracks[activeTrackIndex]) return;

        const track = subtitleTracks[activeTrackIndex];
        const srtText = window.PerfectusSubtitle.exportToSRT(track.cues);
        const blob = new Blob([srtText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const baseName = currentFileName ? currentFileName.replace(/\.[^.]+$/, '') : 'video';
        const fileName = `${baseName} - ${track.name}.srt`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showHUD('fa-file-arrow-down', 'SRT İndirildi');
        ccMenu.classList.remove('visible');
    });

    subtitleFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            let cues;

            if (file.name.endsWith('.vtt')) {
                cues = window.PerfectusSubtitle.parseVTT(text);
            } else {
                cues = window.PerfectusSubtitle.parseSRT(text);
            }

            if (cues.length === 0) {
                showHUD('fa-triangle-exclamation', 'Altyazı bulunamadı');
                return;
            }

            const trackName = file.name.replace(/\.(srt|vtt|sub)$/i, '');
            addSubtitleTrack(trackName, '', cues, 'file');
            setActiveTrack(subtitleTracks.length - 1);
            showHUD('fa-closed-captioning', `${cues.length} satır yüklendi`);
            ccMenu.classList.remove('visible');
        };

        reader.readAsText(file);
        // Reset so same file can be loaded again
        subtitleFileInput.value = '';
    });

    // ══════════════════════════════════════════════════════════════════════
    //  SUBTITLE RENDERING (synced with timeupdate)
    // ══════════════════════════════════════════════════════════════════════

    function renderSubtitle() {
        if (activeTrackIndex < 0 || !subtitleTracks[activeTrackIndex]) {
            if (subtitleOverlay.innerHTML !== '') subtitleOverlay.innerHTML = '';
            return;
        }

        const cues = subtitleTracks[activeTrackIndex].cues;
        const activeCue = window.PerfectusSubtitle.findActiveCue(cues, mainVideo.currentTime);

        if (activeCue) {
            if (activeCue.text !== lastRenderedCueText) {
                subtitleOverlay.innerHTML = activeCue.text;
                lastRenderedCueText = activeCue.text;
            }
        } else {
            if (lastRenderedCueText !== '') {
                subtitleOverlay.innerHTML = '';
                lastRenderedCueText = '';
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  EMBEDDED TRACK DETECTION
    // ══════════════════════════════════════════════════════════════════════

    function detectEmbeddedTracks() {
        const tracks = mainVideo.textTracks;
        if (!tracks || tracks.length === 0) return;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            // Disable native rendering
            track.mode = 'hidden';

            // Wait for cues to load
            track.addEventListener('load', () => {
                extractTrackCues(track);
            });

            // If already loaded
            if (track.cues && track.cues.length > 0) {
                extractTrackCues(track);
            }
        }
    }

    function extractTrackCues(track) {
        if (!track.cues || track.cues.length === 0) return;

        const cues = [];
        for (let j = 0; j < track.cues.length; j++) {
            const c = track.cues[j];
            cues.push({
                id: j + 1,
                start: c.startTime,
                end: c.endTime,
                text: c.text
            });
        }

        const name = track.label || `Gömülü (${track.language || 'Bilinmeyen'})`;
        // Check if already added
        const exists = subtitleTracks.some(t => t.name === name && t.type === 'embedded');
        if (!exists) {
            addSubtitleTrack(name, track.language || '', cues, 'embedded');
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  VIDEO SOURCE LOADING
    // ══════════════════════════════════════════════════════════════════════

    function revokeLocalUrls() {
        if (activeMainUrl) { URL.revokeObjectURL(activeMainUrl); activeMainUrl = null; }
        if (activePreviewUrl) { URL.revokeObjectURL(activePreviewUrl); activePreviewUrl = null; }
    }

    function loadVideoSource(mainUrl, previewUrl, title) {
        videoTitleEl.textContent = title;
        mainVideo.src = mainUrl;
        previewVideo.src = previewUrl;
        mainVideo.load();
        previewVideo.load();

        dropZone.classList.add('hidden');
        playerContainer.classList.add('paused');
        playerContainer.classList.remove('playing');
        progressBar.style.width = '0%';
        bufferBar.style.width = '0%';
        currentTimeEl.textContent = '00:00';
        totalDurationEl.textContent = '00:00';

        // Reset quality
        currentQuality = 'original';
        currentQualityLabel.textContent = 'Orijinal';
        applyQualityFilter('original');
        qualityOptions.querySelectorAll('.menu-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.quality === 'original');
        });

        // Reset subtitles
        subtitleTracks = [];
        activeTrackIndex = -1;
        lastRenderedCueText = '';
        subtitleOverlay.innerHTML = '';
        rebuildCCMenu();
        updateTranslateSourceList();

        showHUD('fa-circle-notch fa-spin', 'Yükleniyor');
    }

    loadDemoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        revokeLocalUrls();
        loadVideoSource(demoVideoUrl, demoVideoUrl, demoVideoTitle);
        mainVideo.play().catch(err => console.log('Oynatma engellendi:', err));
    });

    // ══════════════════════════════════════════════════════════════════════
    //  DRAG AND DROP / LOCAL FILE
    // ══════════════════════════════════════════════════════════════════════

    fileSelectorTrigger.addEventListener('click', () => localFileInput.click());
    dropZone.addEventListener('click', () => localFileInput.click());

    localFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleVideoFile(file);
    });

    ['dragenter', 'dragover'].forEach(ev => {
        playerContainer.addEventListener(ev, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.remove('hidden');
            dropZone.style.background = 'rgba(0, 119, 255, 0.15)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(ev => {
        playerContainer.addEventListener(ev, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.style.background = '';
        }, false);
    });

    playerContainer.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            handleVideoFile(file);
        } else if (file && (file.name.endsWith('.srt') || file.name.endsWith('.vtt'))) {
            // Allow dropping subtitle files too
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const cues = file.name.endsWith('.vtt')
                    ? window.PerfectusSubtitle.parseVTT(text)
                    : window.PerfectusSubtitle.parseSRT(text);
                if (cues.length > 0) {
                    const name = file.name.replace(/\.(srt|vtt)$/i, '');
                    addSubtitleTrack(name, '', cues, 'file');
                    setActiveTrack(subtitleTracks.length - 1);
                    showHUD('fa-closed-captioning', `${cues.length} satır yüklendi`);
                }
            };
            reader.readAsText(file);
        } else {
            showHUD('fa-triangle-exclamation', 'Geçersiz Dosya');
        }
    });

    function handleVideoFile(file) {
        revokeLocalUrls();
        currentFileName = file.name;
        currentFileSize = file.size;
        const url1 = URL.createObjectURL(file);
        const url2 = URL.createObjectURL(file);
        activeMainUrl = url1;
        activePreviewUrl = url2;
        loadVideoSource(url1, url2, file.name);
        mainVideo.play().catch(err => console.log('Otomatik oynatılamadı:', err));

        // Hide resume banner if visible
        resumeBanner.style.display = 'none';

        // Parse embedded subtitles for MKV/WebM files
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'mkv' || ext === 'webm') {
            parseEmbeddedSubtitles(file);
        }
    }

    async function parseEmbeddedSubtitles(file) {
        try {
            console.log('[PerfectusPlayer] Parsing embedded subtitles...');
            const embeddedTracks = await window.PerfectusSubtitle.parseMKV(file);
            console.log('[PerfectusPlayer] Found embedded tracks:', embeddedTracks);

            if (embeddedTracks && embeddedTracks.length > 0) {
                let addedAny = false;
                embeddedTracks.forEach(track => {
                    if (track.cues && track.cues.length > 0) {
                        addSubtitleTrack(track.name, track.language, track.cues, 'embedded');
                        addedAny = true;
                    }
                });

                if (addedAny) {
                    rebuildCCMenu();
                    updateTranslateSourceList();
                    showHUD('fa-closed-captioning', `${embeddedTracks.length} altyazı eklendi`);
                }
            }
        } catch (err) {
            console.error('[PerfectusPlayer] Error parsing embedded subtitles:', err);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  HUD OVERLAY
    // ══════════════════════════════════════════════════════════════════════

    function showHUD(iconClass, text) {
        hudIcon.className = `fa-solid ${iconClass}`;
        hudText.textContent = text;
        hudOverlay.classList.remove('active');
        void hudOverlay.offsetWidth;
        hudOverlay.classList.add('active');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  PLAY / PAUSE
    // ══════════════════════════════════════════════════════════════════════

    function togglePlay() {
        if (mainVideo.paused) {
            mainVideo.play().then(() => showHUD('fa-play', 'Oynat')).catch(err => console.error('Play failed:', err));
        } else {
            mainVideo.pause();
            showHUD('fa-pause', 'Durdur');
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    mainVideo.addEventListener('click', togglePlay);

    mainVideo.addEventListener('play', () => {
        playerContainer.classList.remove('paused');
        playerContainer.classList.add('playing');
        resetControlsTimeout();
    });

    mainVideo.addEventListener('pause', () => {
        playerContainer.classList.add('paused');
        playerContainer.classList.remove('playing');
        showControls();
    });

    // ══════════════════════════════════════════════════════════════════════
    //  TIME & PROGRESS
    // ══════════════════════════════════════════════════════════════════════

    function formatTime(t) {
        if (isNaN(t)) return '00:00';
        const m = Math.floor(t / 60), s = Math.floor(t % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    mainVideo.addEventListener('loadedmetadata', () => {
        totalDurationEl.textContent = formatTime(mainVideo.duration);
        detectEmbeddedTracks();
    });

    mainVideo.addEventListener('timeupdate', () => {
        if (!isScrubbing) {
            currentTimeEl.textContent = formatTime(mainVideo.currentTime);
            const pct = (mainVideo.currentTime / mainVideo.duration) * 100;
            progressBar.style.width = `${pct}%`;
        }
        renderSubtitle();
    });

    mainVideo.addEventListener('progress', () => {
        if (mainVideo.buffered.length > 0 && mainVideo.duration) {
            const end = mainVideo.buffered.end(mainVideo.buffered.length - 1);
            bufferBar.style.width = `${(end / mainVideo.duration) * 100}%`;
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    //  SEEK / TIMELINE
    // ══════════════════════════════════════════════════════════════════════

    function seekTo(e) {
        const rect = timelineContainer.getBoundingClientRect();
        const pct = Math.min(Math.max(0, e.clientX - rect.left), rect.width) / rect.width;
        if (isScrubbing) {
            progressBar.style.width = `${pct * 100}%`;
            currentTimeEl.textContent = formatTime(pct * mainVideo.duration);
        }
        return pct * mainVideo.duration;
    }

    timelineContainer.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        wasPausedBeforeScrub = mainVideo.paused;
        if (!wasPausedBeforeScrub) mainVideo.pause();
        mainVideo.currentTime = seekTo(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isScrubbing) mainVideo.currentTime = seekTo(e);
    });

    window.addEventListener('mouseup', () => {
        if (isScrubbing) {
            isScrubbing = false;
            if (!wasPausedBeforeScrub) mainVideo.play().catch(() => {});
        }
    });

    backwardBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10);
        showHUD('fa-backward', '-10s');
    });

    forwardBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.min(mainVideo.duration, mainVideo.currentTime + 10);
        showHUD('fa-forward', '+10s');
    });

    // ══════════════════════════════════════════════════════════════════════
    //  HOVER PREVIEW THUMBNAILS
    // ══════════════════════════════════════════════════════════════════════

    function seekPreviewVideo(time) {
        if (!previewVideo.src || previewVideo.readyState < 2) return;
        if (isSeekingPreview) { pendingPreviewTime = time; return; }
        isSeekingPreview = true;
        canvasSpinner.classList.add('active');
        if ('fastSeek' in previewVideo) previewVideo.fastSeek(time);
        else previewVideo.currentTime = time;
    }

    previewVideo.addEventListener('seeked', () => {
        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height);
        canvasSpinner.classList.remove('active');
        isSeekingPreview = false;
        if (pendingPreviewTime !== null) {
            const t = pendingPreviewTime; pendingPreviewTime = null;
            seekPreviewVideo(t);
        }
    });

    timelineContainer.addEventListener('mousemove', (e) => {
        const rect = timelineContainer.getBoundingClientRect();
        const pct = Math.min(Math.max(0, e.clientX - rect.left), rect.width) / rect.width;
        const time = pct * mainVideo.duration;
        const tw = previewTooltip.offsetWidth / 2;
        let left = pct * rect.width;
        if (left < tw) left = tw;
        else if (left > rect.width - tw) left = rect.width - tw;
        previewTooltip.style.left = `${left}px`;
        previewTime.textContent = formatTime(time);
        previewTooltip.classList.add('visible');
        seekPreviewVideo(time);
    });

    timelineContainer.addEventListener('mouseleave', () => {
        previewTooltip.classList.remove('visible');
    });

    // ══════════════════════════════════════════════════════════════════════
    //  VOLUME
    // ══════════════════════════════════════════════════════════════════════

    function setVolume(v) {
        currentVolume = parseFloat(v);
        mainVideo.volume = currentVolume * currentVolume;
        volumeSlider.value = currentVolume;
        mainVideo.muted = currentVolume === 0;
        updateVolumeUI();
    }

    function updateVolumeUI() {
        if (mainVideo.muted || currentVolume === 0) muteBtn.setAttribute('data-state', 'muted');
        else if (currentVolume < 0.5) muteBtn.setAttribute('data-state', 'low');
        else muteBtn.setAttribute('data-state', 'high');
    }

    volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));

    muteBtn.addEventListener('click', () => {
        mainVideo.muted = !mainVideo.muted;
        updateVolumeUI();
        showHUD(mainVideo.muted ? 'fa-volume-xmark' : 'fa-volume-high',
            mainVideo.muted ? 'Sessiz' : `${Math.round(currentVolume * 100)}%`);
    });

    // ══════════════════════════════════════════════════════════════════════
    //  PLAYBACK SPEED
    // ══════════════════════════════════════════════════════════════════════

    speedMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); closeAllMenus(speedMenu);
        speedMenu.classList.toggle('visible');
    });

    speedMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        speedMenu.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
        item.classList.add('active');
        currentSpeed = parseFloat(item.dataset.speed);
        mainVideo.playbackRate = currentSpeed;
        currentSpeedLabel.textContent = currentSpeed === 1 ? 'Normal' : `${currentSpeed}x`;
        speedMenu.classList.remove('visible');
        showHUD('fa-gauge-high', `${currentSpeed}x Hız`);
    });

    // ══════════════════════════════════════════════════════════════════════
    //  QUALITY
    // ══════════════════════════════════════════════════════════════════════

    qualityMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); closeAllMenus(qualityMenu);
        qualityMenu.classList.toggle('visible');
    });

    qualityOptions.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        qualityOptions.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
        item.classList.add('active');
        currentQuality = item.dataset.quality;
        applyQualityFilter(currentQuality);
        currentQualityLabel.textContent = currentQuality === 'original' ? 'Orijinal' : `${currentQuality}p`;
        qualityMenu.classList.remove('visible');
        showHUD('fa-sliders', `Kalite: ${currentQualityLabel.textContent}`);
    });

    function applyQualityFilter(q) {
        if (q === 'original' || q === '1080') mainVideo.style.filter = 'none';
        else if (q === '720') mainVideo.style.filter = 'blur(0.5px)';
        else if (q === '480') mainVideo.style.filter = 'blur(1.6px) contrast(0.96) saturate(0.95)';
    }

    // ══════════════════════════════════════════════════════════════════════
    //  FULLSCREEN
    // ══════════════════════════════════════════════════════════════════════

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            playerContainer.requestFullscreen().then(() => {
                playerContainer.classList.add('fullscreen-mode');
                showHUD('fa-expand', 'Tam Ekran');
            }).catch(err => console.error('Fullscreen failed:', err));
        } else {
            document.exitFullscreen();
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);
    mainVideo.addEventListener('dblclick', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            playerContainer.classList.remove('fullscreen-mode');
            showHUD('fa-compress', 'Tam Ekrandan Çıkıldı');
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    //  CLOSE MENUS / AUTO-HIDE CONTROLS
    // ══════════════════════════════════════════════════════════════════════

    function closeAllMenus(exceptMenu = null) {
        if (exceptMenu !== speedMenu) speedMenu.classList.remove('visible');
        if (exceptMenu !== qualityMenu) qualityMenu.classList.remove('visible');
        if (exceptMenu !== ccMenu) ccMenu.classList.remove('visible');
    }

    window.addEventListener('click', () => closeAllMenus());

    function showControls() {
        playerContainer.classList.remove('hidden-controls');
        resetControlsTimeout();
    }

    function resetControlsTimeout() {
        clearTimeout(controlsTimeout);
        if (!mainVideo.paused &&
            !speedMenu.classList.contains('visible') &&
            !qualityMenu.classList.contains('visible') &&
            !ccMenu.classList.contains('visible')) {
            controlsTimeout = setTimeout(() => {
                playerContainer.classList.add('hidden-controls');
            }, 2500);
        }
    }

    playerContainer.addEventListener('mousemove', showControls);
    playerContainer.addEventListener('mouseleave', () => {
        if (!mainVideo.paused) playerContainer.classList.add('hidden-controls');
    });

    // ══════════════════════════════════════════════════════════════════════
    //  KEYBOARD SHORTCUTS
    // ══════════════════════════════════════════════════════════════════════

    window.addEventListener('keydown', (e) => {
        // Skip if settings modal is open or focused on input
        if (settingsModalBackdrop.classList.contains('visible')) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) ||
            document.activeElement.isContentEditable) return;

        if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 5); showHUD('fa-backward', '-5s'); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); mainVideo.currentTime = Math.min(mainVideo.duration, mainVideo.currentTime + 5); showHUD('fa-forward', '+5s'); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(Math.min(1, currentVolume + 0.05)); showHUD('fa-volume-high', `${Math.round(currentVolume * 100)}%`); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(Math.max(0, currentVolume - 0.05)); showHUD('fa-volume-low', `${Math.round(currentVolume * 100)}%`); }
        else if (e.key.toLowerCase() === 'm') { e.preventDefault(); muteBtn.click(); }
        else if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
        else if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
            // Toggle subtitles: cycle through tracks or turn off
            if (subtitleTracks.length === 0) {
                showHUD('fa-closed-captioning', 'Altyazı Yok');
            } else if (activeTrackIndex === -1) {
                setActiveTrack(0);
                showHUD('fa-closed-captioning', subtitleTracks[0].name);
            } else {
                setActiveTrack(-1);
                showHUD('fa-closed-captioning', 'Altyazı Kapalı');
            }
        }
        else if (e.key === ',' || e.key === '<') { e.preventDefault(); adjustSpeedStep(-1); }
        else if (e.key === '.' || e.key === '>') { e.preventDefault(); adjustSpeedStep(1); }
    });

    const speedSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    function adjustSpeedStep(dir) {
        let idx = speedSteps.indexOf(currentSpeed);
        if (idx === -1) idx = 3;
        const ni = idx + dir;
        if (ni >= 0 && ni < speedSteps.length) {
            const item = speedMenu.querySelector(`[data-speed="${speedSteps[ni]}"]`);
            if (item) item.click();
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CUSTOM DROPDOWN SYSTEM
    // ══════════════════════════════════════════════════════════════════════

    function positionDropdownList(trigger, list) {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        list.style.width = rect.width + 'px';
        list.style.left = rect.left + 'px';

        // Temporarily make visible to measure scrollHeight
        const wasHidden = !list.classList.contains('open');
        if (wasHidden) {
            list.style.opacity = '0';
            list.style.display = 'block';
            list.style.pointerEvents = 'none';
        }
        const listHeight = Math.min(240, list.scrollHeight || 200);
        if (wasHidden) {
            list.style.opacity = '';
            list.style.display = '';
            list.style.pointerEvents = '';
        }

        if (spaceBelow >= listHeight + 8 || spaceBelow >= spaceAbove) {
            list.style.top = (rect.bottom + 4) + 'px';
            list.style.bottom = 'auto';
            list.style.maxHeight = Math.min(240, spaceBelow - 8) + 'px';
        } else {
            list.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
            list.style.top = 'auto';
            list.style.maxHeight = Math.min(240, spaceAbove - 8) + 'px';
        }
    }

    function closeAllDropdowns(except) {
        document.querySelectorAll('.custom-dropdown').forEach(d => {
            if (d !== except) {
                const t = d.querySelector('.custom-dropdown-trigger');
                if (t.classList.contains('open')) {
                    t.classList.remove('open');
                    // Return portaled list back to its dropdown
                    const list = d._portaledList || d.querySelector('.custom-dropdown-list');
                    if (list) {
                        list.classList.remove('open');
                        if (list.parentNode === document.body) {
                            d.appendChild(list);
                        }
                    }
                    d._portaledList = null;
                }
            }
        });
    }

    function initCustomDropdowns() {
        document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            const trigger = dropdown.querySelector('.custom-dropdown-trigger');
            const list = dropdown.querySelector('.custom-dropdown-list');
            const label = trigger.querySelector('.dropdown-label');
            const selectId = dropdown.dataset.for;
            const hiddenSelect = selectId ? document.getElementById(selectId) : null;

            // Open/close with portal
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllDropdowns(dropdown);

                const isOpening = !trigger.classList.contains('open');

                if (isOpening) {
                    // Portal: move list to body so it escapes overflow/transform/backdrop-filter
                    document.body.appendChild(list);
                    dropdown._portaledList = list;
                    positionDropdownList(trigger, list);
                    trigger.classList.add('open');
                    list.classList.add('open');
                } else {
                    // Close: return list to dropdown
                    trigger.classList.remove('open');
                    list.classList.remove('open');
                    dropdown.appendChild(list);
                    dropdown._portaledList = null;
                }
            });

            // Item selection
            list.addEventListener('click', (e) => {
                const item = e.target.closest('.custom-dropdown-item');
                if (!item || item.classList.contains('disabled')) return;

                const value = item.dataset.value;
                label.textContent = item.textContent;

                list.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                if (hiddenSelect) {
                    hiddenSelect.value = value;
                    hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                trigger.classList.remove('open');
                list.classList.remove('open');
                dropdown.appendChild(list);
                dropdown._portaledList = null;
            });
        });

        // Global close on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                const t = d.querySelector('.custom-dropdown-trigger');
                if (t && t.classList.contains('open')) {
                    t.classList.remove('open');
                    const list = d._portaledList || d.querySelector('.custom-dropdown-list');
                    if (list) {
                        list.classList.remove('open');
                        if (list.parentNode === document.body) {
                            d.appendChild(list);
                        }
                    }
                    d._portaledList = null;
                }
            });
        });

        // Reposition on scroll/resize
        const reposition = () => {
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                const t = d.querySelector('.custom-dropdown-trigger');
                if (t && t.classList.contains('open') && d._portaledList) {
                    positionDropdownList(t, d._portaledList);
                }
            });
        };
        window.addEventListener('resize', reposition);
        document.querySelectorAll('.modal-body').forEach(mb => {
            mb.addEventListener('scroll', reposition);
        });
    }

    // Sync custom dropdown when hidden select changes programmatically
    function syncCustomDropdown(selectId) {
        const hiddenSelect = document.getElementById(selectId);
        const dropdown = document.querySelector(`.custom-dropdown[data-for="${selectId}"]`);
        if (!hiddenSelect || !dropdown) return;

        const list = dropdown.querySelector('.custom-dropdown-list');
        const label = dropdown.querySelector('.dropdown-label');

        // Rebuild items from hidden select
        list.innerHTML = '';
        Array.from(hiddenSelect.options).forEach(opt => {
            const item = document.createElement('button');
            item.className = 'custom-dropdown-item';
            item.dataset.value = opt.value;
            item.textContent = opt.textContent;
            if (opt.selected) item.classList.add('active');
            if (opt.disabled) item.classList.add('disabled');
            list.appendChild(item);
        });

        // Update label
        const selectedOpt = hiddenSelect.options[hiddenSelect.selectedIndex];
        if (selectedOpt) {
            label.textContent = selectedOpt.textContent;
        }
    }

    initCustomDropdowns();

    // ══════════════════════════════════════════════════════════════════════
    //  PLAYBACK STATE PERSISTENCE (Resume)
    // ══════════════════════════════════════════════════════════════════════

    const STORAGE_KEY_PLAYBACK = 'perfectus_playback_state';

    function formatTimeHHMM(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function savePlaybackState() {
        if (!currentFileName || !mainVideo.src || mainVideo.currentTime < 5) return;

        const state = {
            fileName: currentFileName,
            fileSize: currentFileSize,
            currentTime: mainVideo.currentTime,
            volume: mainVideo.volume,
            activeTrackIndex: activeTrackIndex,
            subtitleTracks: subtitleTracks.map(t => ({
                name: t.name,
                lang: t.lang,
                cues: t.cues,
                type: t.type
            })),
            savedAt: Date.now()
        };

        try {
            localStorage.setItem(STORAGE_KEY_PLAYBACK, JSON.stringify(state));
        } catch (e) {
            console.warn('[Resume] localStorage kayıt hatası:', e.message);
        }
    }

    function loadPlaybackState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PLAYBACK);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function clearPlaybackState() {
        localStorage.removeItem(STORAGE_KEY_PLAYBACK);
    }

    function showResumeBanner() {
        const state = loadPlaybackState();
        if (!state || !state.fileName || state.currentTime < 5) return;

        // Don't show if saved more than 30 days ago
        if (Date.now() - state.savedAt > 30 * 24 * 60 * 60 * 1000) {
            clearPlaybackState();
            return;
        }

        resumeTitle.textContent = state.fileName;
        resumeTime.textContent = `${formatTimeHHMM(state.currentTime)}'te kaldınız`;
        resumeBanner.style.display = '';
    }

    function restorePlaybackState(file) {
        const state = loadPlaybackState();
        if (!state) return false;

        // Verify file matches
        if (file.name !== state.fileName || file.size !== state.fileSize) {
            showHUD('fa-triangle-exclamation', 'Dosya eşleşmiyor');
            return false;
        }

        // Load the video
        handleVideoFile(file);

        // Wait for video to be ready, then seek and restore
        mainVideo.addEventListener('loadedmetadata', function onMeta() {
            mainVideo.removeEventListener('loadedmetadata', onMeta);

            // Seek to saved position
            mainVideo.currentTime = state.currentTime;

            // Restore volume
            if (state.volume !== undefined) {
                mainVideo.volume = state.volume;
                currentVolume = state.volume;
                volumeSlider.value = state.volume;
            }

            // Restore subtitle tracks
            if (state.subtitleTracks && state.subtitleTracks.length > 0) {
                // Wait a bit for embedded subs to parse, then add non-embedded ones
                setTimeout(() => {
                    state.subtitleTracks.forEach(savedTrack => {
                        if (savedTrack.type !== 'embedded') {
                            // Check if track already exists
                            const exists = subtitleTracks.some(t => 
                                t.name === savedTrack.name && t.type === savedTrack.type
                            );
                            if (!exists) {
                                addSubtitleTrack(savedTrack.name, savedTrack.lang, savedTrack.cues, savedTrack.type);
                            }
                        }
                    });

                    // Restore active track
                    if (state.activeTrackIndex >= 0 && state.activeTrackIndex < subtitleTracks.length) {
                        setActiveTrack(state.activeTrackIndex);
                    }
                }, 1500);
            }

            showHUD('fa-rotate-left', 'Kaldığınız yerden devam');
        });

        return true;
    }

    // Resume banner button handlers
    resumeContinueBtn.addEventListener('click', () => {
        resumeBanner.style.display = 'none';
        // Trigger file picker — user must select the same file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                restorePlaybackState(file);
            }
        });
        input.click();
    });

    resumeDismissBtn.addEventListener('click', () => {
        resumeBanner.style.display = 'none';
        clearPlaybackState();
    });

    // Save state periodically (every 5 seconds during playback)
    mainVideo.addEventListener('timeupdate', (() => {
        let lastSave = 0;
        return () => {
            const now = Date.now();
            if (now - lastSave > 5000) {
                lastSave = now;
                savePlaybackState();
            }
        };
    })());

    // Save on pause
    mainVideo.addEventListener('pause', () => savePlaybackState());

    // Save before page unload
    window.addEventListener('beforeunload', () => savePlaybackState());

    // Show resume banner on page load if there's saved state
    showResumeBanner();
});
