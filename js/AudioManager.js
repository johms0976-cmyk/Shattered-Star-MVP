/**
 * AudioManager - Handles all game audio
 */
class AudioManager {
    constructor() {
        this.musicPlayer = document.getElementById('music-player');
        this.context = null;
        this.sounds = new Map();
        
        this.volumes = {
            master: 0.8,
            music: 0.7,
            sfx: 0.8
        };
        
        this.currentTrack = null;
        this.initialized = false;
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    init() {
        if (this.initialized) return;
        
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('[AudioManager] Initialized');
        } catch (error) {
            console.warn('[AudioManager] Could not initialize:', error);
        }
    }

    /**
     * Set volume for a channel
     */
    setVolume(channel, value) {
        this.volumes[channel] = Math.max(0, Math.min(1, value));
        
        if (channel === 'music' || channel === 'master') {
            this.updateMusicVolume();
        }
        
        this.saveSettings();
    }

    /**
     * Get volume for a channel
     */
    getVolume(channel) {
        return this.volumes[channel] || 1;
    }

    /**
     * Update music volume
     */
    updateMusicVolume() {
        if (this.musicPlayer) {
            this.musicPlayer.volume = this.volumes.master * this.volumes.music;
        }
    }

    /**
     * Play background music
     */
    playMusic(trackId) {
        if (!this.musicPlayer) return;
        
        const trackPath = `assets/audio/music/${trackId}.mp3`;
        
        if (this.currentTrack !== trackId) {
            this.currentTrack = trackId;
            this.musicPlayer.src = trackPath;
            this.updateMusicVolume();
            
            this.musicPlayer.play().catch(error => {
                console.warn('[AudioManager] Could not play music:', error);
            });
        }
    }

    /**
     * Stop background music
     */
    stopMusic() {
        if (this.musicPlayer) {
            this.musicPlayer.pause();
            this.musicPlayer.currentTime = 0;
            this.currentTrack = null;
        }
    }

    /**
     * Pause background music
     */
    pauseMusic() {
        if (this.musicPlayer) {
            this.musicPlayer.pause();
        }
    }

    /**
     * Resume background music
     */
    resumeMusic() {
        if (this.musicPlayer && this.currentTrack) {
            this.musicPlayer.play().catch(() => {});
        }
    }

    /**
     * Play a sound effect
     */
    playSFX(soundId, options = {}) {
        if (!this.initialized) {
            this.init();
        }
        
        const volume = (options.volume || 1) * this.volumes.master * this.volumes.sfx;
        
        // For MVP, we'll use simple audio elements
        // In production, we'd use Web Audio API for better control
        const audio = new Audio(`assets/audio/sfx/${soundId}.mp3`);
        audio.volume = volume;
        audio.play().catch(() => {
            // Silently fail if audio can't play
        });
    }

    /**
     * Play a UI sound
     */
    playUI(type) {
        const uiSounds = {
            click: 'ui_click',
            hover: 'ui_hover',
            confirm: 'ui_confirm',
            cancel: 'ui_cancel',
            error: 'ui_error',
            cardDraw: 'card_draw',
            cardPlay: 'card_play',
            damage: 'damage_hit',
            block: 'block_gain',
            heal: 'heal',
            victory: 'victory',
            defeat: 'defeat'
        };
        
        const soundId = uiSounds[type];
        if (soundId) {
            this.playSFX(soundId, { volume: 0.5 });
        }
    }

    /**
     * Save audio settings
     */
    saveSettings() {
        try {
            localStorage.setItem('shatteredstar_audio', JSON.stringify(this.volumes));
        } catch (error) {
            console.warn('[AudioManager] Could not save settings');
        }
    }

    /**
     * Load audio settings
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('shatteredstar_audio');
            if (saved) {
                this.volumes = { ...this.volumes, ...JSON.parse(saved) };
                this.updateMusicVolume();
            }
        } catch (error) {
            console.warn('[AudioManager] Could not load settings');
        }
    }

    /**
     * Mute all audio
     */
    mute() {
        this.previousVolumes = { ...this.volumes };
        this.volumes.master = 0;
        this.updateMusicVolume();
    }

    /**
     * Unmute all audio
     */
    unmute() {
        if (this.previousVolumes) {
            this.volumes = this.previousVolumes;
            this.previousVolumes = null;
            this.updateMusicVolume();
        }
    }

    /**
     * Check if audio is muted
     */
    isMuted() {
        return this.volumes.master === 0;
    }
}

export { AudioManager };
