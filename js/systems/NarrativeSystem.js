/**
 * NarrativeSystem - Manages atmospheric horror narrative elements
 * Handles dread level, void whispers, and atmospheric effects
 * @version 0.3.0 - Stub implementation providing interface expected by main.js
 */

class NarrativeSystem {
    constructor(eventBus, state) {
        this.eventBus = eventBus;
        this.state = state;
        this.dreadLevel = 0;
        this.maxDread = 100;
        this.whisperQueue = [];
        this.activeEffects = new Set();
        
        this.setupListeners();
        console.log('[NarrativeSystem] Initialized');
    }
    
    setupListeners() {
        // React to corruption changes
        this.eventBus.on('corruption:changed', (level) => {
            this.updateDread(level);
        });
        
        this.eventBus.on('corruption:threshold', ({ threshold }) => {
            this.onCorruptionThreshold(threshold);
        });
        
        // React to combat events
        this.eventBus.on('combat:end', (result) => {
            if (result?.victory) {
                this.onCombatVictory();
            }
        });
        
        this.eventBus.on('player:death', () => {
            this.onPlayerDeath();
        });
    }
    
    updateDread(corruptionLevel) {
        this.dreadLevel = Math.min(this.maxDread, corruptionLevel * 0.8);
        this.eventBus.emit('dread:changed', {
            level: this.dreadLevel,
            max: this.maxDread
        });
    }
    
    onCorruptionThreshold(threshold) {
        const whispers = {
            25: "Something stirs in the void...",
            50: "The walls between worlds grow thin.",
            75: "You feel the void's gaze upon you.",
            100: "The void has found you. There is no escape."
        };
        
        const whisper = whispers[threshold];
        if (whisper) {
            this.eventBus.emit('void:whisper', { text: whisper, intensity: threshold / 100 });
        }
    }
    
    onCombatVictory() {
        // Occasionally trigger atmospheric effects after combat
        if (this.dreadLevel > 30 && Math.random() < 0.3) {
            this.eventBus.emit('atmosphere:change', {
                type: 'post_combat',
                dread: this.dreadLevel
            });
        }
    }
    
    onPlayerDeath() {
        this.eventBus.emit('void:whisper', {
            text: "The void claims another fragment...",
            intensity: 1.0
        });
    }
    
    getDreadLevel() {
        return this.dreadLevel;
    }
    
    reset() {
        this.dreadLevel = 0;
        this.whisperQueue = [];
        this.activeEffects.clear();
    }
}

export { NarrativeSystem };
export default NarrativeSystem;
