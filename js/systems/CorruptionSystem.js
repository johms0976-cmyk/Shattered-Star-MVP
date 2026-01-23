/**
 * CorruptionSystem - Manages corruption mechanics and visual effects
 */
class CorruptionSystem {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.thresholds = [0, 25, 50, 75, 100];
        this.currentThreshold = 0;
        
        this.effects = {
            0: {
                name: 'Pure',
                description: 'No corruption influence',
                visualIntensity: 0
            },
            25: {
                name: 'Touched',
                description: 'Subtle visual distortion, occasional whispers',
                visualIntensity: 1
            },
            50: {
                name: 'Corrupted',
                description: 'Corrupted cards may appear, intents may distort',
                visualIntensity: 2
            },
            75: {
                name: 'Consumed',
                description: 'Reality fractures, combat modifiers, unstable events',
                visualIntensity: 3
            },
            100: {
                name: 'Lost',
                description: 'Transformation or death imminent',
                visualIntensity: 4
            }
        };
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on('corruption:gained', (amount) => this.addCorruption(amount));
        this.eventBus.on('corruption:lost', (amount) => this.removeCorruption(amount));
    }

    /**
     * Add corruption
     */
    addCorruption(amount) {
        const current = this.state.get('corruption') || 0;
        const newValue = Math.min(100, current + amount);
        
        this.state.set('corruption', newValue);
        
        // Check threshold crossing
        this.checkThresholds(current, newValue);
        
        this.eventBus.emit('corruption:changed', newValue);
        this.updateUI();
    }

    /**
     * Remove corruption
     */
    removeCorruption(amount) {
        const current = this.state.get('corruption') || 0;
        const newValue = Math.max(0, current - amount);
        
        this.state.set('corruption', newValue);
        
        // Check threshold crossing
        this.checkThresholds(current, newValue);
        
        this.eventBus.emit('corruption:changed', newValue);
        this.updateUI();
    }

    /**
     * Get current corruption level
     */
    getCorruption() {
        return this.state.get('corruption') || 0;
    }

    /**
     * Get current threshold tier
     */
    getCurrentThreshold() {
        const corruption = this.getCorruption();
        for (let i = this.thresholds.length - 1; i >= 0; i--) {
            if (corruption >= this.thresholds[i]) {
                return this.thresholds[i];
            }
        }
        return 0;
    }

    /**
     * Check if crossed a threshold
     */
    checkThresholds(oldValue, newValue) {
        const oldThreshold = this.getThresholdForValue(oldValue);
        const newThreshold = this.getThresholdForValue(newValue);
        
        if (newThreshold !== oldThreshold) {
            this.currentThreshold = newThreshold;
            this.eventBus.emit('corruption:threshold', {
                threshold: newThreshold,
                effect: this.effects[newThreshold]
            });
            
            // Apply visual theme
            this.updateTheme(newThreshold);
            
            // Check for max corruption
            if (newValue >= 100) {
                this.eventBus.emit('corruption:max');
            }
        }
    }

    /**
     * Get threshold for a value
     */
    getThresholdForValue(value) {
        for (let i = this.thresholds.length - 1; i >= 0; i--) {
            if (value >= this.thresholds[i]) {
                return this.thresholds[i];
            }
        }
        return 0;
    }

    /**
     * Update visual theme based on corruption
     */
    updateTheme(threshold) {
        const themeLink = document.getElementById('corruption-theme');
        if (themeLink) {
            themeLink.href = `css/themes/corruption-${threshold}.css`;
        }
        
        // Add body class for additional styling
        document.body.className = document.body.className
            .replace(/corruption-\d+/g, '')
            .trim();
        document.body.classList.add(`corruption-${threshold}`);
        
        // Trigger visual effects if enabled
        if (threshold >= 50) {
            this.startVisualEffects(threshold);
        } else {
            this.stopVisualEffects();
        }
    }

    /**
     * Start corruption visual effects
     */
    startVisualEffects(threshold) {
        const intensity = this.effects[threshold]?.visualIntensity || 0;
        
        // Apply CSS variables for shader-like effects
        document.documentElement.style.setProperty('--corruption-intensity', intensity);
        
        // Random glitch effect
        if (intensity >= 2) {
            this.startGlitchEffect();
        }
    }

    /**
     * Stop corruption visual effects
     */
    stopVisualEffects() {
        document.documentElement.style.setProperty('--corruption-intensity', 0);
        this.stopGlitchEffect();
    }

    /**
     * Start periodic glitch effect
     */
    startGlitchEffect() {
        if (this.glitchInterval) return;
        
        this.glitchInterval = setInterval(() => {
            if (Math.random() < 0.1) {
                document.body.classList.add('glitch');
                setTimeout(() => {
                    document.body.classList.remove('glitch');
                }, 100 + Math.random() * 200);
            }
        }, 2000);
    }

    /**
     * Stop glitch effect
     */
    stopGlitchEffect() {
        if (this.glitchInterval) {
            clearInterval(this.glitchInterval);
            this.glitchInterval = null;
        }
        document.body.classList.remove('glitch');
    }

    /**
     * Get current effect description
     */
    getCurrentEffect() {
        return this.effects[this.currentThreshold];
    }

    /**
     * Check if corruption allows certain actions
     */
    canUseCorruptedCard() {
        return this.getCorruption() < 100;
    }

    /**
     * Get corruption modifier for damage
     */
    getCorruptionDamageModifier() {
        const corruption = this.getCorruption();
        if (corruption >= 75) return 1.25;
        if (corruption >= 50) return 1.1;
        return 1;
    }

    /**
     * Should spawn corrupted enemy variant
     */
    shouldSpawnCorrupted() {
        const corruption = this.getCorruption();
        if (corruption >= 75) return Math.random() < 0.4;
        if (corruption >= 50) return Math.random() < 0.2;
        return false;
    }

    /**
     * Update UI elements
     */
    updateUI() {
        const corruption = this.getCorruption();
        
        // Update map corruption display
        const mapCorruption = document.getElementById('map-corruption');
        if (mapCorruption) {
            mapCorruption.textContent = `${corruption}%`;
            mapCorruption.className = `stat-value corruption-${this.currentThreshold}`;
        }
        
        // Update any corruption bars
        const corruptionBars = document.querySelectorAll('.corruption-bar');
        corruptionBars.forEach(bar => {
            bar.style.width = `${corruption}%`;
        });
    }
}

export { CorruptionSystem };
