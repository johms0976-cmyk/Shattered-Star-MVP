/**
 * CorruptionSystem - Manages corruption mechanics and visual effects
 * FIXED: Defensive event handlers, number coercion, threshold boundary checks
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
     * Setup event listeners — DEFENSIVE: wrap handlers in try-catch with number coercion
     */
    setupEventListeners() {
        this.eventBus.on('corruption:gained', (data) => {
            try {
                let amount = 0;
                if (typeof data === 'number') {
                    amount = data;
                } else if (data && typeof data === 'object') {
                    amount = data.amount || data.value || 0;
                } else {
                    amount = Number(data) || 0;
                }
                if (amount > 0) this.addCorruption(amount);
            } catch (e) {
                console.warn('[CorruptionSystem] Error handling corruption:gained:', e);
            }
        });
        
        this.eventBus.on('corruption:lost', (data) => {
            try {
                let amount = 0;
                if (typeof data === 'number') {
                    amount = data;
                } else if (data && typeof data === 'object') {
                    amount = data.amount || data.value || 0;
                } else {
                    amount = Number(data) || 0;
                }
                if (amount > 0) this.removeCorruption(amount);
            } catch (e) {
                console.warn('[CorruptionSystem] Error handling corruption:lost:', e);
            }
        });
        
        // Listen for state-already-set changes (from CombatScreen which manages state directly)
        this.eventBus.on('corruption:changed', (newValue) => {
            try {
                const safeValue = Number(newValue) || 0;
                const oldThreshold = this.currentThreshold;
                const newThreshold = this.getThresholdForValue(safeValue);
                
                if (newThreshold !== oldThreshold) {
                    this.currentThreshold = newThreshold;
                    this.eventBus.emit('corruption:threshold', {
                        threshold: newThreshold,
                        effect: this.effects[newThreshold]
                    });
                    this.updateTheme(newThreshold);
                    
                    if (safeValue >= 100) {
                        this.eventBus.emit('corruption:max');
                    }
                }
                this.updateUI();
            } catch (e) {
                console.warn('[CorruptionSystem] Error handling corruption:changed:', e);
            }
        });
    }

    /**
     * Add corruption — reads current state (caller may have already set it)
     * Only responsible for threshold checks, theme updates, and UI
     */
    addCorruption(amount) {
        const oldValue = this.state.get('corruption') || 0;
        const newValue = Math.min(100, Math.max(0, oldValue + amount));
        
        this.state.set('corruption', newValue);
        this.checkThresholds(oldValue, newValue);
        this.eventBus.emit('corruption:changed', newValue);
        this.updateUI();
    }

    /**
     * Remove corruption — same defensive approach
     */
    removeCorruption(amount) {
        const current = this.state.get('corruption') || 0;
        const newValue = Math.max(0, current - amount);
        
        this.state.set('corruption', newValue);
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
        return this.getThresholdForValue(corruption);
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
            
            this.updateTheme(newThreshold);
            
            if (newValue >= 100) {
                this.eventBus.emit('corruption:max');
            }
        }
    }

    /**
     * Get threshold for a value — FIXED: safe boundary checks
     */
    getThresholdForValue(value) {
        if (!this.thresholds || this.thresholds.length === 0) return 0;
        
        const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
        
        for (let i = this.thresholds.length - 1; i >= 0; i--) {
            if (safeValue >= this.thresholds[i]) {
                return this.thresholds[i];
            }
        }
        return 0;
    }

    /**
     * Update visual theme based on corruption level
     */
    updateTheme(threshold) {
        try {
            document.body.classList.remove(
                'corruption-pure', 'corruption-touched',
                'corruption-corrupted', 'corruption-consumed', 'corruption-lost'
            );
            
            const themeMap = {
                0: 'corruption-pure',
                25: 'corruption-touched',
                50: 'corruption-corrupted',
                75: 'corruption-consumed',
                100: 'corruption-lost'
            };
            
            const className = themeMap[threshold];
            if (className) {
                document.body.classList.add(className);
            }
            
            // Apply glitch effect at high corruption
            if (threshold >= 50) {
                this.startGlitchEffect(threshold);
            } else {
                this.stopGlitchEffect();
            }
        } catch (e) {
            console.warn('[CorruptionSystem] Error updating theme:', e);
        }
    }

    /**
     * Start glitch visual effect
     */
    startGlitchEffect(threshold) {
        this.stopGlitchEffect();
        
        const intensity = threshold >= 75 ? 1000 : 2000;
        
        this.glitchInterval = setInterval(() => {
            if (Math.random() < 0.3) {
                document.body.classList.add('glitch');
                setTimeout(() => {
                    document.body.classList.remove('glitch');
                }, 100 + Math.random() * 200);
            }
        }, intensity);
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
        try {
            const corruption = this.getCorruption();
            
            const mapCorruption = document.getElementById('map-corruption');
            if (mapCorruption) {
                mapCorruption.textContent = `${corruption}%`;
                mapCorruption.className = `stat-value corruption-${this.currentThreshold}`;
            }
            
            const corruptionBars = document.querySelectorAll('.corruption-bar');
            corruptionBars.forEach(bar => {
                bar.style.width = `${corruption}%`;
            });
        } catch (e) {
            console.warn('[CorruptionSystem] Error updating UI:', e);
        }
    }
}

export { CorruptionSystem };
