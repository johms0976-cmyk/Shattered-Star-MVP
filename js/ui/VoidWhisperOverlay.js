/**
 * VoidWhisperOverlay.js - Atmospheric Horror UI Layer
 * 
 * Displays void whispers, corruption effects, and atmospheric
 * text at the edges of the screen. Integrates with NarrativeSystem.
 * 
 * "The void speaks in frequencies below hearing. You feel its words in your bones."
 */

class VoidWhisperOverlay {
    constructor(eventBus, gameState) {
        this.eventBus = eventBus;
        this.state = gameState;
        
        // DOM elements
        this.overlay = null;
        this.whisperContainer = null;
        this.atmosphereLayer = null;
        
        // Active whispers
        this.activeWhispers = [];
        this.maxWhispers = 3;
        
        // Atmosphere state
        this.dreadLevel = 'calm';
        this.corruption = 0;
        
        this.init();
    }
    
    init() {
        this.createOverlay();
        this.setupEventListeners();
        console.log('[VoidWhisperOverlay] The void's voice finds form...');
    }
    
    /**
     * Create the overlay DOM structure
     */
    createOverlay() {
        // Main overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'void-whisper-overlay';
        this.overlay.className = 'void-overlay dread-calm';
        this.overlay.innerHTML = `
            <!-- Corner whisper zones -->
            <div class="whisper-zone top-left"></div>
            <div class="whisper-zone top-right"></div>
            <div class="whisper-zone bottom-left"></div>
            <div class="whisper-zone bottom-right"></div>
            
            <!-- Edge zones for ambient effects -->
            <div class="edge-zone left"></div>
            <div class="edge-zone right"></div>
            <div class="edge-zone top"></div>
            <div class="edge-zone bottom"></div>
            
            <!-- Central atmosphere notification -->
            <div class="atmosphere-notification" id="atmosphere-notification">
                <div class="atmosphere-text"></div>
            </div>
            
            <!-- Dread indicator (subtle) -->
            <div class="dread-indicator" id="dread-indicator">
                <div class="dread-fill"></div>
            </div>
            
            <!-- Corruption vignette -->
            <div class="corruption-vignette" id="corruption-vignette"></div>
            
            <!-- Void eye (appears at high corruption) -->
            <div class="void-eye" id="void-eye">
                <div class="eye-lid"></div>
                <div class="eye-iris"></div>
                <div class="eye-pupil"></div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        
        this.whisperContainer = this.overlay;
        this.atmosphereLayer = document.getElementById('atmosphere-notification');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Void whispers from NarrativeSystem
        this.eventBus.on('void:whisper', (whisper) => {
            this.displayWhisper(whisper);
        });
        
        // Atmosphere changes
        this.eventBus.on('narrative:atmosphere', (text) => {
            this.showAtmosphereText(text);
        });
        
        // Act intros
        this.eventBus.on('narrative:act_intro', (data) => {
            this.showActIntro(data);
        });
        
        // Dread level changes
        this.eventBus.on('dread:changed', (data) => {
            this.updateDread(data);
        });
        
        // Corruption changes
        this.eventBus.on('corruption:changed', (data) => {
            this.updateCorruption(data);
        });
        
        // Atmosphere intensification
        this.eventBus.on('atmosphere:intensify', () => {
            this.intensifyAtmosphere();
        });
        
        this.eventBus.on('atmosphere:critical', () => {
            this.criticalAtmosphere();
        });
        
        // Screen transitions - adjust visibility
        this.eventBus.on('screen:changed', (data) => {
            this.onScreenChange(data);
        });
        
        // Combat events
        this.eventBus.on('combat:start', () => {
            this.overlay.classList.add('combat-active');
        });
        
        this.eventBus.on('combat:end', () => {
            this.overlay.classList.remove('combat-active');
        });
        
        // Death
        this.eventBus.on('narrative:death', (data) => {
            this.showDeathNarrative(data);
        });
    }
    
    /**
     * Display a void whisper
     */
    displayWhisper(whisper) {
        // Select a random zone
        const zones = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        const zone = zones[Math.floor(Math.random() * zones.length)];
        
        const container = this.overlay.querySelector(`.whisper-zone.${zone}`);
        if (!container) return;
        
        // Create whisper element
        const whisperEl = document.createElement('div');
        whisperEl.className = `void-whisper intensity-${whisper.intensity || 'subtle'}`;
        
        // Apply glitch effect to text based on intensity
        let displayText = whisper.text;
        if (whisper.intensity === 'strong' || whisper.intensity === 'overwhelming') {
            displayText = this.glitchText(whisper.text);
        }
        
        whisperEl.innerHTML = `<span class="whisper-text">${displayText}</span>`;
        
        // Random positioning within zone
        whisperEl.style.setProperty('--offset-x', `${Math.random() * 20 - 10}px`);
        whisperEl.style.setProperty('--offset-y', `${Math.random() * 20 - 10}px`);
        
        container.appendChild(whisperEl);
        
        // Track active whispers
        this.activeWhispers.push(whisperEl);
        
        // Remove excess whispers
        while (this.activeWhispers.length > this.maxWhispers) {
            const oldWhisper = this.activeWhispers.shift();
            oldWhisper.classList.add('fading');
            setTimeout(() => oldWhisper.remove(), 1000);
        }
        
        // Animation sequence
        requestAnimationFrame(() => {
            whisperEl.classList.add('appearing');
        });
        
        // Fade out after delay
        const duration = this.getWhisperDuration(whisper.intensity);
        setTimeout(() => {
            whisperEl.classList.remove('appearing');
            whisperEl.classList.add('fading');
            
            setTimeout(() => {
                whisperEl.remove();
                const index = this.activeWhispers.indexOf(whisperEl);
                if (index > -1) this.activeWhispers.splice(index, 1);
            }, 2000);
        }, duration);
        
        // Play whisper sound
        this.eventBus.emit('audio:play', { 
            type: 'sfx', 
            id: 'void_whisper', 
            volume: 0.2 + (whisper.corruption / 200)
        });
    }
    
    /**
     * Apply glitch effect to text
     */
    glitchText(text) {
        const glitchChars = ['̷', '̸', '̵', '̶', '̴'];
        let result = '';
        
        for (let char of text) {
            result += char;
            // Add zalgo-style corruption
            if (Math.random() < 0.15) {
                result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            }
        }
        
        return result;
    }
    
    /**
     * Get whisper duration based on intensity
     */
    getWhisperDuration(intensity) {
        const durations = {
            subtle: 4000,
            noticeable: 5000,
            strong: 6000,
            overwhelming: 8000
        };
        return durations[intensity] || 4000;
    }
    
    /**
     * Show atmosphere text (node entry, transitions)
     */
    showAtmosphereText(text) {
        const container = document.getElementById('atmosphere-notification');
        if (!container) return;
        
        const textEl = container.querySelector('.atmosphere-text');
        if (textEl) {
            textEl.textContent = text;
        }
        
        container.classList.add('active');
        
        // Add dread-based styling
        container.className = `atmosphere-notification active dread-${this.dreadLevel}`;
        
        // Fade out after delay
        setTimeout(() => {
            container.classList.remove('active');
        }, 4000);
    }
    
    /**
     * Show act intro (major transition)
     */
    showActIntro(data) {
        // Create full-screen intro overlay
        const intro = document.createElement('div');
        intro.className = 'act-intro-overlay';
        intro.innerHTML = `
            <div class="act-intro-content">
                <h1 class="act-number">ACT ${data.act}</h1>
                <div class="act-text">${data.text}</div>
            </div>
        `;
        
        document.body.appendChild(intro);
        
        // Animate in
        requestAnimationFrame(() => {
            intro.classList.add('active');
        });
        
        // Remove after animation
        setTimeout(() => {
            intro.classList.remove('active');
            setTimeout(() => intro.remove(), 1500);
        }, 5000);
    }
    
    /**
     * Update dread visualization
     */
    updateDread(data) {
        const { current, max } = data;
        const percentage = (current / max) * 100;
        
        // Update dread indicator
        const indicator = document.getElementById('dread-indicator');
        const fill = indicator?.querySelector('.dread-fill');
        if (fill) {
            fill.style.width = `${percentage}%`;
        }
        
        // Determine dread level
        let newLevel = 'calm';
        if (current >= 75) newLevel = 'terror';
        else if (current >= 50) newLevel = 'dread';
        else if (current >= 25) newLevel = 'uneasy';
        
        // Update overlay class
        if (newLevel !== this.dreadLevel) {
            this.overlay.classList.remove(`dread-${this.dreadLevel}`);
            this.overlay.classList.add(`dread-${newLevel}`);
            this.dreadLevel = newLevel;
            
            // Trigger level change effects
            if (newLevel === 'dread' || newLevel === 'terror') {
                this.triggerDreadEffect();
            }
        }
    }
    
    /**
     * Update corruption visuals
     */
    updateCorruption(data) {
        this.corruption = data.current;
        const percentage = data.current;
        
        // Update vignette
        const vignette = document.getElementById('corruption-vignette');
        if (vignette) {
            vignette.style.setProperty('--corruption-intensity', percentage / 100);
        }
        
        // Show void eye at high corruption
        const eye = document.getElementById('void-eye');
        if (eye) {
            if (percentage >= 50) {
                eye.classList.add('visible');
                if (percentage >= 75) eye.classList.add('watching');
            } else {
                eye.classList.remove('visible', 'watching');
            }
        }
        
        // Update overlay corruption class
        this.overlay.classList.remove('corruption-low', 'corruption-medium', 'corruption-high', 'corruption-critical');
        if (percentage >= 75) this.overlay.classList.add('corruption-critical');
        else if (percentage >= 50) this.overlay.classList.add('corruption-high');
        else if (percentage >= 25) this.overlay.classList.add('corruption-medium');
        else this.overlay.classList.add('corruption-low');
    }
    
    /**
     * Trigger dread effect (visual/audio pulse)
     */
    triggerDreadEffect() {
        this.overlay.classList.add('dread-pulse');
        setTimeout(() => {
            this.overlay.classList.remove('dread-pulse');
        }, 1000);
        
        // Audio cue
        this.eventBus.emit('audio:play', { 
            type: 'sfx', 
            id: 'dread_pulse', 
            volume: 0.3 
        });
    }
    
    /**
     * Intensify atmosphere (mid-level warning)
     */
    intensifyAtmosphere() {
        this.overlay.classList.add('intensified');
        
        // Trigger ambient whisper
        setTimeout(() => {
            this.eventBus.emit('void:whisper', {
                text: '...something watches...',
                type: 'ambient',
                intensity: 'noticeable',
                corruption: this.corruption
            });
        }, 2000);
    }
    
    /**
     * Critical atmosphere (high-level warning)
     */
    criticalAtmosphere() {
        this.overlay.classList.add('critical');
        
        // Series of whispers
        const whispers = [
            '...the end approaches...',
            '...we see you...',
            '...PREPARE...'
        ];
        
        whispers.forEach((text, i) => {
            setTimeout(() => {
                this.eventBus.emit('void:whisper', {
                    text,
                    type: 'aware',
                    intensity: i === 2 ? 'overwhelming' : 'strong',
                    corruption: this.corruption
                });
            }, 1000 + (i * 2000));
        });
    }
    
    /**
     * Show death narrative
     */
    showDeathNarrative(data) {
        const intro = document.createElement('div');
        intro.className = 'death-narrative-overlay';
        intro.innerHTML = `
            <div class="death-narrative-content">
                <div class="death-text">${data.text}</div>
            </div>
        `;
        
        document.body.appendChild(intro);
        
        requestAnimationFrame(() => {
            intro.classList.add('active');
        });
        
        setTimeout(() => {
            intro.classList.remove('active');
            setTimeout(() => intro.remove(), 1500);
        }, 4000);
    }
    
    /**
     * Handle screen changes
     */
    onScreenChange(data) {
        const screen = data.to || data;
        
        // Show/hide overlay based on screen
        const hideOnScreens = ['loading-screen', 'title-screen', 'start-screen', 'hero-select-screen'];
        
        if (hideOnScreens.includes(screen)) {
            this.overlay.classList.add('hidden');
        } else {
            this.overlay.classList.remove('hidden');
        }
    }
    
    /**
     * Clear all whispers
     */
    clearWhispers() {
        this.activeWhispers.forEach(w => {
            w.classList.add('fading');
            setTimeout(() => w.remove(), 500);
        });
        this.activeWhispers = [];
    }
    
    /**
     * Reset overlay state
     */
    reset() {
        this.clearWhispers();
        this.dreadLevel = 'calm';
        this.corruption = 0;
        
        this.overlay.className = 'void-overlay dread-calm corruption-low';
    }
}

export { VoidWhisperOverlay };
