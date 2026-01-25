/**
 * TitleScreen - Splash screen and main menu handler
 * Shattered Star
 * 
 * Flow: Title Screen (click anywhere) -> Start Screen (menu) -> Hero Select
 * FIX: Now plays title_screen.mp3 and properly sets backgrounds
 */

export function setupTitleScreen(game) {
    console.log('[TitleScreen] Setting up title and start screens');
    
    // Set initial title screen background
    setScreenBackground(game, 'title-screen', 'titlescreen');
    
    // ===========================================
    // TITLE SCREEN (Splash - click anywhere)
    // ===========================================
    const titleScreen = document.getElementById('title-screen');
    
    if (titleScreen) {
        // Click/touch anywhere to proceed to start screen
        const handleTitleClick = (e) => {
            // Prevent multiple clicks during transition
            if (game.screenManager.transitioning) return;
            
            game.audioManager.init(); // Initialize audio on first interaction
            game.audioManager.playSFX('ui_click');
            
            // Start background music (will continue through start/hero screens)
            game.audioManager.playMusic('background');
            
            game.screenManager.transitionTo('start-screen');
        };
        
        titleScreen.addEventListener('click', handleTitleClick);
        titleScreen.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTitleClick(e);
        });
    }
    
    // ===========================================
    // START SCREEN (Main Menu)
    // ===========================================
    
    // New Game button
    const btnNewGame = document.getElementById('btn-new-game');
    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.screenManager.transitionTo('hero-select-screen');
        });
    }
    
    // Continue button
    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            if (game.saveManager.hasSave()) {
                game.audioManager.playSFX('ui_click');
                game.continueRun();
            }
        });
    }
    
    // Settings button
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.openSettingsModal();
        });
    }
    
    // Codex button (disabled for MVP)
    const btnCodex = document.getElementById('btn-codex');
    if (btnCodex) {
        btnCodex.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            // TODO: Implement codex
            console.log('Codex not yet implemented');
        });
    }
    
    // Settings modal close
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.remove('active');
        });
    }
    
    // Settings save
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            saveSettings(game);
            document.getElementById('settings-modal')?.classList.remove('active');
        });
    }
    
    // Volume sliders
    setupVolumeControls(game);
    
    // ===========================================
    // Screen change handlers - try multiple event types
    // ===========================================
    game.eventBus.on('screen:transition:start', ({ to, from }) => {
        console.log(`[TitleScreen] transition:start: ${from} -> ${to}`);
        handleScreenChange(game, to, from);
    });
    
    // Backup: also listen for screen:changed
    game.eventBus.on('screen:changed', ({ to, from }) => {
        console.log(`[TitleScreen] screen:changed: ${from} -> ${to}`);
        handleScreenChange(game, to, from);
    });
    
    // Backup: also listen for screen:show
    game.eventBus.on('screen:show', (screenId) => {
        console.log(`[TitleScreen] screen:show: ${screenId}`);
        handleScreenChange(game, screenId, null);
    });
}

/**
 * Handle screen changes for title and start screens
 */
function handleScreenChange(game, to, from) {
    // Title Screen Enter
    if (to === 'title-screen') {
        setScreenBackground(game, 'title-screen', 'titlescreen');
        animateTitleScreen();
        
        // FIX: Play title music when on title screen
        if (game.audioManager.initialized) {
            game.audioManager.playMusic('title_screen');
        }
    }
    
    // Start Screen Enter
    if (to === 'start-screen') {
        setScreenBackground(game, 'start-screen', 'startscreen1');
        
        // Update continue button state
        const continueBtn = document.getElementById('btn-continue');
        if (continueBtn) {
            continueBtn.disabled = !game.saveManager.hasSave();
        }
    }
}

/**
 * Set background image for a screen element with multiple fallback attempts
 * FIX: Uses inline styles with !important to ensure visibility
 */
function setScreenBackground(game, screenId, imageName) {
    const screenEl = document.getElementById(screenId);
    if (!screenEl) {
        console.error(`[TitleScreen] Screen element not found: ${screenId}`);
        return;
    }
    
    // Get fallback paths
    const paths = game.getBackgroundFallbacks ? 
        game.getBackgroundFallbacks(imageName) : 
        [game.getBackgroundPath(imageName)];
    
    console.log(`[TitleScreen] Trying background paths for ${screenId}:`, paths);
    
    // Try each path until one works
    tryBackgroundPaths(screenEl, paths, 0);
}

/**
 * Recursively try background paths until one loads
 * FIX: Apply styles with proper CSS reset first
 */
function tryBackgroundPaths(element, paths, index) {
    if (index >= paths.length) {
        console.warn('[TitleScreen] All background paths failed, using gradient fallback');
        applyFallbackBackground(element);
        return;
    }
    
    const path = paths[index];
    const img = new Image();
    
    img.onload = () => {
        console.log(`[TitleScreen] Background loaded successfully: ${path}`);
        applyBackground(element, path);
    };
    
    img.onerror = () => {
        console.warn(`[TitleScreen] Background failed to load: ${path}`);
        tryBackgroundPaths(element, paths, index + 1);
    };
    
    img.src = path;
}

/**
 * FIX: Apply background with proper CSS to ensure visibility
 */
function applyBackground(element, path) {
    // Clear any existing background first
    element.style.background = '';
    element.style.backgroundColor = '';
    
    // Apply new background with all necessary properties
    element.style.backgroundImage = `url('${path}')`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundColor = '#0a0a1a';
}

/**
 * FIX: Apply fallback gradient background
 */
function applyFallbackBackground(element) {
    element.style.backgroundImage = '';
    element.style.background = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)';
}

function setupVolumeControls(game) {
    const masterVolume = document.getElementById('setting-master-volume');
    const musicVolume = document.getElementById('setting-music-volume');
    const sfxVolume = document.getElementById('setting-sfx-volume');
    
    if (masterVolume) {
        masterVolume.addEventListener('input', (e) => {
            game.audioManager.setVolume('master', e.target.value / 100);
        });
    }
    
    if (musicVolume) {
        musicVolume.addEventListener('input', (e) => {
            game.audioManager.setVolume('music', e.target.value / 100);
        });
    }
    
    if (sfxVolume) {
        sfxVolume.addEventListener('input', (e) => {
            game.audioManager.setVolume('sfx', e.target.value / 100);
        });
    }
}

function saveSettings(game) {
    const settings = {
        masterVolume: document.getElementById('setting-master-volume')?.value || 80,
        musicVolume: document.getElementById('setting-music-volume')?.value || 70,
        sfxVolume: document.getElementById('setting-sfx-volume')?.value || 80,
        screenShake: document.getElementById('setting-screen-shake')?.checked ?? true,
        corruptionEffects: document.getElementById('setting-corruption-effects')?.value || 'full'
    };
    
    game.state.set('settings', settings);
    
    try {
        localStorage.setItem('shattered-star-settings', JSON.stringify(settings));
    } catch (e) {
        console.warn('[TitleScreen] Could not save settings to localStorage');
    }
}

function animateTitleScreen() {
    const title = document.querySelector('.game-title');
    if (title) {
        title.classList.remove('animate');
        void title.offsetWidth; // Force reflow
        title.classList.add('animate');
    }
    
    const prompt = document.querySelector('.click-prompt');
    if (prompt) {
        prompt.classList.remove('animate');
        void prompt.offsetWidth;
        prompt.classList.add('animate');
    }
}
