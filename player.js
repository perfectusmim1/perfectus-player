/* ==========================================================================
   PERFECTUS PLAYER - CONTROLLER LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const playerContainer = document.getElementById('player-container');
    const mainVideo = document.getElementById('main-video');
    const previewVideo = document.getElementById('preview-video');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const backwardBtn = document.getElementById('backward-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    const volumeContainer = document.getElementById('volume-container');
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
    
    const speedMenuContainer = document.getElementById('speed-menu-container');
    const speedMenuBtn = document.getElementById('speed-menu-btn');
    const speedMenu = document.getElementById('speed-menu');
    const currentSpeedLabel = document.getElementById('current-speed-label');
    
    const qualityMenuContainer = document.getElementById('quality-menu-container');
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

    // State Variables
    let isScrubbing = false;
    let wasPausedBeforeScrub = false;
    let controlsTimeout = null;
    let isSeekingPreview = false;
    let pendingPreviewTime = null;
    let currentSpeed = 1;
    let currentQuality = 'original';
    let currentVolume = 1;

    // Default Demo Video URL
    const demoVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoVideoTitle = 'Big Buck Bunny (Cinematic Demo)';

    /* ==========================================================================
       INITIALIZATION
       ========================================================================== */
    
    // Set initial volume
    mainVideo.volume = currentVolume;
    volumeSlider.value = currentVolume;

    // Keep track of active Object URLs to revoke them and prevent memory leaks
    let activeMainUrl = null;
    let activePreviewUrl = null;

    function revokeLocalUrls() {
        if (activeMainUrl) {
            URL.revokeObjectURL(activeMainUrl);
            activeMainUrl = null;
        }
        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
            activePreviewUrl = null;
        }
    }

    // Load URL/Source helper
    function loadVideoSource(mainUrl, previewUrl, title) {
        // Show loading state
        videoTitleEl.textContent = title;
        mainVideo.src = mainUrl;
        previewVideo.src = previewUrl;
        
        mainVideo.load();
        previewVideo.load();
        
        // Hide dropzone
        dropZone.classList.add('hidden');
        
        // Reset controls state
        playerContainer.classList.add('paused');
        playerContainer.classList.remove('playing');
        
        // Reset timeline
        progressBar.style.width = '0%';
        bufferBar.style.width = '0%';
        currentTimeEl.textContent = '00:00';
        totalDurationEl.textContent = '00:00';
        
        // Reset quality to Orijinal on new load
        currentQuality = 'original';
        currentQualityLabel.textContent = 'Orijinal';
        applyQualityFilter('original');
        qualityOptions.querySelectorAll('.menu-item').forEach(btn => {
            if (btn.dataset.quality === 'original') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // HUD Overlay update
        showHUD('fa-circle-notch fa-spin', 'Yükleniyor');
    }

    // Load Cinematic Demo on click
    loadDemoBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent trigger dropzone click
        revokeLocalUrls();
        loadVideoSource(demoVideoUrl, demoVideoUrl, demoVideoTitle);
        mainVideo.play().catch(err => console.log('Oynatma engellendi:', err));
    });

    /* ==========================================================================
       DRAG AND DROP / LOCAL FILE SELECTOR
       ========================================================================== */

    // Open file selector when clicking trigger
    fileSelectorTrigger.addEventListener('click', () => {
        localFileInput.click();
    });

    // Dropzone click triggers selector
    dropZone.addEventListener('click', () => {
        localFileInput.click();
    });

    // Handle selected file
    localFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleVideoFile(file);
        }
    });

    // Drag-and-drop events
    ['dragenter', 'dragover'].forEach(eventName => {
        playerContainer.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('hidden');
            dropZone.style.background = 'rgba(0, 119, 255, 0.15)';
            dropZone.style.borderColor = 'var(--accent-blue)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        playerContainer.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '';
            dropZone.style.borderColor = '';
        }, false);
    });

    playerContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file && file.type.startsWith('video/')) {
            handleVideoFile(file);
        } else {
            showHUD('fa-triangle-exclamation', 'Geçersiz Dosya');
        }
    });

    function handleVideoFile(file) {
        // Revoke old urls to free memory
        revokeLocalUrls();

        // Create two separate blob streams so they don't block each other
        const url1 = URL.createObjectURL(file);
        const url2 = URL.createObjectURL(file);
        
        activeMainUrl = url1;
        activePreviewUrl = url2;

        loadVideoSource(url1, url2, file.name);
        mainVideo.play().catch(err => console.log('Otomatik oynatılamadı:', err));
    }

    /* ==========================================================================
       HUD / FEEDBACK OVERLAYS
       ========================================================================== */
    
    function showHUD(iconClass, text) {
        hudIcon.className = `fa-solid ${iconClass}`;
        hudText.textContent = text;
        
        hudOverlay.classList.remove('active');
        void hudOverlay.offsetWidth; // Force reflow to restart CSS animation
        hudOverlay.classList.add('active');
    }

    /* ==========================================================================
       PLAY / PAUSE & CORE EVENTS
       ========================================================================== */

    function togglePlay() {
        if (mainVideo.paused) {
            mainVideo.play()
                .then(() => {
                    showHUD('fa-play', 'Oynat');
                })
                .catch(err => {
                    console.error('Play failed:', err);
                });
        } else {
            mainVideo.pause();
            showHUD('fa-pause', 'Durdur');
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    mainVideo.addEventListener('click', togglePlay);

    // Dynamic classes based on state
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

    /* ==========================================================================
       TIME FORMATTING & UPDATES
       ========================================================================== */

    function formatTime(timeInSeconds) {
        if (isNaN(timeInSeconds)) return '00:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        
        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(seconds).padStart(2, '0');
        
        return `${paddedMinutes}:${paddedSeconds}`;
    }

    // Set duration when metadata is ready
    mainVideo.addEventListener('loadedmetadata', () => {
        totalDurationEl.textContent = formatTime(mainVideo.duration);
    });

    // Update time counter and progress bar during playback
    mainVideo.addEventListener('timeupdate', () => {
        if (!isScrubbing) {
            currentTimeEl.textContent = formatTime(mainVideo.currentTime);
            const percentage = (mainVideo.currentTime / mainVideo.duration) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    });

    // Buffer range calculations
    mainVideo.addEventListener('progress', updateBuffer);
    function updateBuffer() {
        if (mainVideo.buffered.length > 0 && mainVideo.duration) {
            const bufferedEnd = mainVideo.buffered.end(mainVideo.buffered.length - 1);
            const bufferedPercentage = (bufferedEnd / mainVideo.duration) * 100;
            bufferBar.style.width = `${bufferedPercentage}%`;
        }
    }

    /* ==========================================================================
       SEEK / TIMELINE INTERACTION
       ========================================================================== */

    function seekTo(event) {
        const rect = timelineContainer.getBoundingClientRect();
        const percent = Math.min(Math.max(0, event.clientX - rect.left), rect.width) / rect.width;
        
        if (isScrubbing) {
            progressBar.style.width = `${percent * 100}%`;
            currentTimeEl.textContent = formatTime(percent * mainVideo.duration);
        }
        
        return percent * mainVideo.duration;
    }

    timelineContainer.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        wasPausedBeforeScrub = mainVideo.paused;
        if (!wasPausedBeforeScrub) {
            mainVideo.pause();
        }
        
        const newTime = seekTo(e);
        mainVideo.currentTime = newTime;
    });

    window.addEventListener('mousemove', (e) => {
        if (isScrubbing) {
            const newTime = seekTo(e);
            mainVideo.currentTime = newTime;
        }
    });

    window.addEventListener('mouseup', () => {
        if (isScrubbing) {
            isScrubbing = false;
            if (!wasPausedBeforeScrub) {
                mainVideo.play().catch(err => console.log(err));
            }
        }
    });

    // Seek buttons
    backwardBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 10);
        showHUD('fa-backward', '-10s');
    });

    forwardBtn.addEventListener('click', () => {
        mainVideo.currentTime = Math.min(mainVideo.duration, mainVideo.currentTime + 10);
        showHUD('fa-forward', '+10s');
    });

    /* ==========================================================================
       DYNAMIC HOVER PREVIEW THUMBNAILS (HIGH PERFORMANCE CANVAS METHOD)
       ========================================================================== */

    function seekPreviewVideo(time) {
        if (!previewVideo.src || previewVideo.readyState < 2) return;
        
        if (isSeekingPreview) {
            // Queue up the latest requested time if currently decoding
            pendingPreviewTime = time;
            return;
        }
        
        isSeekingPreview = true;
        canvasSpinner.classList.add('active');
        
        // fastSeek utilizes keyframes where supported, falling back to currentTime setting
        if ('fastSeek' in previewVideo) {
            previewVideo.fastSeek(time);
        } else {
            previewVideo.currentTime = time;
        }
    }

    // When the preview video successfully seeked, render the frame to the canvas
    previewVideo.addEventListener('seeked', () => {
        const ctx = previewCanvas.getContext('2d');
        // Render 16:9 frame to fit the size
        ctx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height);
        
        canvasSpinner.classList.remove('active');
        isSeekingPreview = false;
        
        // If there was a seek event waiting, process it
        if (pendingPreviewTime !== null) {
            const nextTime = pendingPreviewTime;
            pendingPreviewTime = null;
            seekPreviewVideo(nextTime);
        }
    });

    timelineContainer.addEventListener('mousemove', (e) => {
        const rect = timelineContainer.getBoundingClientRect();
        const percent = Math.min(Math.max(0, e.clientX - rect.left), rect.width) / rect.width;
        const targetTime = percent * mainVideo.duration;

        // Position tooltip relative to coordinate
        const tooltipWidth = previewTooltip.offsetWidth;
        const halfTooltip = tooltipWidth / 2;
        let leftPosition = percent * rect.width;
        
        // Bound constraints so tooltip doesn't cut off boundaries
        if (leftPosition < halfTooltip) {
            leftPosition = halfTooltip;
        } else if (leftPosition > rect.width - halfTooltip) {
            leftPosition = rect.width - halfTooltip;
        }

        previewTooltip.style.left = `${leftPosition}px`;
        previewTime.textContent = formatTime(targetTime);
        previewTooltip.classList.add('visible');

        // Throttle previews slightly to avoid spamming seeks
        seekPreviewVideo(targetTime);
    });

    timelineContainer.addEventListener('mouseleave', () => {
        previewTooltip.classList.remove('visible');
    });

    /* ==========================================================================
       VOLUME / MUTE CONTROLS
       ========================================================================== */

    function setVolume(value) {
        currentVolume = parseFloat(value);
        // Apply volume quadratically for a natural curve
        mainVideo.volume = currentVolume * currentVolume;
        volumeSlider.value = currentVolume;
        
        mainVideo.muted = currentVolume === 0;
        updateVolumeUI();
    }

    function updateVolumeUI() {
        if (mainVideo.muted || currentVolume === 0) {
            muteBtn.setAttribute('data-state', 'muted');
        } else if (currentVolume < 0.5) {
            muteBtn.setAttribute('data-state', 'low');
        } else {
            muteBtn.setAttribute('data-state', 'high');
        }
    }

    volumeSlider.addEventListener('input', (e) => {
        setVolume(e.target.value);
    });

    muteBtn.addEventListener('click', () => {
        mainVideo.muted = !mainVideo.muted;
        updateVolumeUI();
        if (mainVideo.muted) {
            showHUD('fa-volume-xmark', 'Sessiz');
        } else {
            showHUD('fa-volume-high', `${Math.round(currentVolume * 100)}%`);
        }
    });

    /* ==========================================================================
       PLAYBACK SPEED SELECTOR
       ========================================================================== */

    speedMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus(speedMenu);
        speedMenu.classList.toggle('visible');
    });

    // Select Speed option
    speedMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        // Toggle Active
        speedMenu.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
        item.classList.add('active');

        currentSpeed = parseFloat(item.dataset.speed);
        mainVideo.playbackRate = currentSpeed;
        currentSpeedLabel.textContent = currentSpeed === 1 ? 'Normal' : `${currentSpeed}x`;
        speedMenu.classList.remove('visible');
        
        showHUD('fa-gauge-high', `${currentSpeed}x Hız`);
    });

    /* ==========================================================================
       SIMULATED RESOLUTION QUALITY SELECTOR
       ========================================================================== */

    qualityMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus(qualityMenu);
        qualityMenu.classList.toggle('visible');
    });

    // Select Quality option
    qualityOptions.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        qualityOptions.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
        item.classList.add('active');

        currentQuality = item.dataset.quality;
        applyQualityFilter(currentQuality);
        
        currentQualityLabel.textContent = currentQuality === 'original' ? 'Orijinal' : `${currentQuality}p`;
        qualityMenu.classList.remove('visible');
        
        showHUD('fa-sliders', `Kalite: ${currentQualityLabel.textContent}`);
    });

    // High performance quality simulator using canvas/CSS filtering on client files!
    function applyQualityFilter(quality) {
        if (quality === 'original' || quality === '1080') {
            mainVideo.style.filter = 'none';
        } else if (quality === '720') {
            // Apply slight blur for 720p simulation
            mainVideo.style.filter = 'blur(0.5px)';
        } else if (quality === '480') {
            // Lower fidelity simulation
            mainVideo.style.filter = 'blur(1.6px) contrast(0.96) saturate(0.95)';
        }
    }

    /* ==========================================================================
       FULLSCREEN TOGGLES
       ========================================================================== */

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            playerContainer.requestFullscreen()
                .then(() => {
                    playerContainer.classList.add('fullscreen-mode');
                    showHUD('fa-expand', 'Tam Ekran');
                })
                .catch(err => {
                    console.error('Fullscreen request failed:', err);
                });
        } else {
            document.exitFullscreen();
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Double-click to fullscreen (common pattern)
    mainVideo.addEventListener('dblclick', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            playerContainer.classList.remove('fullscreen-mode');
            showHUD('fa-compress', 'Tam Ekrandan Çıkıldı');
        }
    });

    /* ==========================================================================
       GLOBAL CLICK CLOSES SETTINGS
       ========================================================================== */

    function closeAllMenus(exceptMenu = null) {
        if (exceptMenu !== speedMenu) speedMenu.classList.remove('visible');
        if (exceptMenu !== qualityMenu) qualityMenu.classList.remove('visible');
    }

    window.addEventListener('click', () => {
        closeAllMenus();
    });

    /* ==========================================================================
       AUTO-HIDE CONTROLS (INACTIVITY TIMER)
       ========================================================================== */

    function showControls() {
        playerContainer.classList.remove('hidden-controls');
        resetControlsTimeout();
    }

    function resetControlsTimeout() {
        clearTimeout(controlsTimeout);
        
        // Hide only if playing and settings menus are closed
        if (!mainVideo.paused && 
            !speedMenu.classList.contains('visible') && 
            !qualityMenu.classList.contains('visible')) {
            
            controlsTimeout = setTimeout(() => {
                playerContainer.classList.add('hidden-controls');
            }, 2500); // 2.5 seconds timeout
        }
    }

    playerContainer.addEventListener('mousemove', showControls);
    playerContainer.addEventListener('mouseleave', () => {
        if (!mainVideo.paused) {
            playerContainer.classList.add('hidden-controls');
        }
    });

    /* ==========================================================================
       KEYBOARD SHORTCUTS
       ========================================================================== */

    window.addEventListener('keydown', (e) => {
        // Only run shortcuts if active target is not an input
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.isContentEditable) {
            return;
        }

        // Match spacebar
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } 
        // Seek backward 5s
        else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 5);
            showHUD('fa-backward', '-5s');
        } 
        // Seek forward 5s
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            mainVideo.currentTime = Math.min(mainVideo.duration, mainVideo.currentTime + 5);
            showHUD('fa-forward', '+5s');
        } 
        // Volume Up
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setVolume(Math.min(1, currentVolume + 0.05));
            showHUD('fa-volume-high', `${Math.round(currentVolume * 100)}%`);
        } 
        // Volume Down
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setVolume(Math.max(0, currentVolume - 0.05));
            showHUD('fa-volume-low', `${Math.round(currentVolume * 100)}%`);
        } 
        // Mute Toggle
        else if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            muteBtn.click();
        } 
        // Fullscreen Toggle
        else if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullscreen();
        }
        // Decrease playback speed
        else if (e.key === ',' || e.key === '<') {
            e.preventDefault();
            adjustSpeedStep(-1);
        }
        // Increase playback speed
        else if (e.key === '.' || e.key === '>') {
            e.preventDefault();
            adjustSpeedStep(1);
        }
    });

    // Step-wise playback speed modifiers (matching YouTube , / .)
    const speedSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    function adjustSpeedStep(direction) {
        let currentIndex = speedSteps.indexOf(currentSpeed);
        if (currentIndex === -1) currentIndex = 3; // Fallback to Normal (1x)
        
        let newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < speedSteps.length) {
            const newSpeed = speedSteps[newIndex];
            
            // Emulate clicking on the menu item
            const item = speedMenu.querySelector(`[data-speed="${newSpeed}"]`);
            if (item) item.click();
        }
    }
});
