/**
 * TitleScreen - Main menu screen handler
 */

export function setupTitleScreen(game) {
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
                game.saveManager.load();
                game.screenManager.transitionTo('map-screen');
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
    
    // Settings modal close
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('active');
        });
    }
    
    // Settings save
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            saveSettings(game);
            document.getElementById('settings-modal').classList.remove('active');
        });
    }
    
    // Volume sliders
    setupVolumeControls(game);
    
    // Codex button (disabled for MVP)
    const btnCodex = document.getElementById('btn-codex');
    if (btnCodex) {
        btnCodex.addEventListener('click', () => {
            // TODO: Implement codex
            console.log('Codex not yet implemented');
        });
    }
    
    // Animate title on screen show
 game.eventBus.on('screen:changed', ({ to, from }) => {
    if (to === 'title-screen') {
        animateTitleScreen();

        // Play title screen music
        game.audioManager.playMusic('title_screen');
    }

    // Stop title music when leaving the title screen
    if (from === 'title-screen' && to !== 'title-screen') {
        game.audioManager.stopMusic();
    }
});

}

function setupVolumeControls(game) {
    const masterVolume = document.getElementById('setting-master-volume');
    const musicVolume = document.getElementById('setting-music-volume');
    const sfxVolume = document.getElementById('setting-sfx-volume');
    
    if (masterVolume) {
        masterVolume.addEventListener('input', (e) => {
            game.audioManager.setMasterVolume(e.target.value / 100);
        });
    }
    
    if (musicVolume) {
        musicVolume.addEventListener('input', (e) => {
            game.audioManager.setMusicVolume(e.target.value / 100);
        });
    }
    
    if (sfxVolume) {
        sfxVolume.addEventListener('input', (e) => {
            game.audioManager.setSfxVolume(e.target.value / 100);
        });
    }
}

function saveSettings(game) {
    const settings = {
        masterVolume: document.getElementById('setting-master-volume').value,
        musicVolume: document.getElementById('setting-music-volume').value,
        sfxVolume: document.getElementById('setting-sfx-volume').value,
        screenShake: document.getElementById('setting-screen-shake').checked,
        corruptionEffects: document.getElementById('setting-corruption-effects').value
    };
    
    game.state.set('settings', settings);
    localStorage.setItem('shattered-star-settings', JSON.stringify(settings));
}

function animateTitleScreen() {
    const title = document.querySelector('.game-title');
    if (title) {
        title.classList.remove('animate');
        void title.offsetWidth; // Force reflow
        title.classList.add('animate');
    }
}
