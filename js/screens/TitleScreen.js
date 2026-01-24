/**
 * TitleScreen - Splash screen and main menu handler
 * Shattered Star
 * 
 * Flow: Title Screen (click anywhere) -> Start Screen (menu) -> Hero Select
 */

export function setupTitleScreen(game) {
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
    // Screen change handlers - use transition:start for immediate setup
    // ===========================================
    game.eventBus.on('screen:transition:start', ({ to, from }) => {
        // Title Screen Enter - set background immediately
        if (to === 'title-screen') {
            setScreenBackground(game, 'title-screen', 'titlescreen');
            
            // Play title music when entering title screen (including from loading)
            // Use setTimeout to ensure audio context is ready after user gesture
            if (from === 'loading-screen') {
                // First load - audio will be initialized on click
                console.log('[TitleScreen] Ready for first interaction');
            }
            
            // Animate title
            animateTitleScreen();
        }
        
        // Start Screen Enter - set background immediately
        if (to === 'start-screen') {
            setScreenBackground(game, 'start-screen', 'startscreen1');
            
            // Update continue button state
            const continueBtn = document.getElementById('btn-continue');
            if (continueBtn) {
                continueBtn.disabled = !game.saveManager.hasSave();
            }
        }
    });
    
    // Also handle screen:changed for any late updates
    game.eventBus.on('screen:changed', ({ to, from }) => {
        // Going back to title from elsewhere - switch music
        if (to === 'title-screen' && from !== 'loading-screen') {
            game.audioManager.playMusic('title_screen');
        }
    });
}

/**
 * Set background image for a screen element
 */
function setScreenBackground(game, screenId, imageName) {
    const screenEl = document.getElementById(screenId);
    if (!screenEl) return;
    
    const bgPath = game.getBackgroundPath(imageName);
    console.log(`[TitleScreen] Setting ${screenId} background: ${bgPath}`);
    
    screenEl.style.backgroundImage = `url('${bgPath}')`;
    screenEl.style.backgroundSize = 'cover';
    screenEl.style.backgroundPosition = 'center';
    screenEl.style.backgroundRepeat = 'no-repeat';
    
    // Fallback: if image fails to load, try alternate paths
    const img = new Image();
    img.onerror = () => {
        console.warn(`[TitleScreen] Background not found: ${bgPath}, trying fallback...`);
        // Try without device prefix
        const fallbackPath = `assets/images/backgrounds/${imageName}.png`;
        screenEl.style.backgroundImage = `url('${fallbackPath}')`;
    };
    img.src = bgPath;
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
