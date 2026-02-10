/**
 * GameState - Central state management for Shattered Star
 * Single source of truth for all game data
 */
import eventBus, { GameEvents } from './EventBus.js';

class GameState {
    constructor() {
        this.state = this.getInitialState();
        this.history = [];
        this.maxHistory = 50;
    }

    /**
     * Get the initial state structure
     * @returns {Object} Initial state
     */
    getInitialState() {
        return {
            // Meta information
            version: '0.1.0',
            seed: null,
            runActive: false,
            
            // Current position
            act: 1,
            floor: 0,
            
            // Hero state
            hero: {
                id: null,
                name: '',
                hp: 0,
                maxHp: 0,
                energy: 3,
                maxEnergy: 3,
                block: 0,
                
                // Korvax-specific
                overheat: 0,
                maxOverheat: 10,
                rage: 0,
                
                // Lyria-specific
                astralCharge: 0,
                temporalFlux: 0,
                
                // Auren-specific
                radiance: 0,
                aegis: 0,
                
                // Shade-specific
                stealth: false,
                echoCards: []
            },
            
            // Deck state
            deck: [],
            hand: [],
            drawPile: [],
            discardPile: [],
            exhaustPile: [],
            
            // Items
            artifacts: [],
            
            // Global meters
            corruption: 0,
            maxCorruption: 100,
            
            // Economy
            credits: 0,
            scrap: 0,
            
            // Faction reputation (-5 to +5)
            factions: {
                rustborn: 0,      // Rustborn Tribes
                choir: 0,        // Veiled Choir
                firstLight: 0,   // First Light Remnants
                syndicate: 0,    // Mask Syndicate
                whisperers: 0    // Abyssal Whisperers
            },
            
            // Map state
            map: {
                nodes: [],
                currentNode: null,
                visitedNodes: [],
                paths: []
            },
            
            // Combat state
            combat: {
                active: false,
                enemies: [],
                turn: 0,
                isPlayerTurn: true,
                selectedCard: null,
                targetedEnemy: null
            },
            
            // Event state
            event: {
                active: false,
                currentEvent: null,
                history: [],
                // v2: Serialized EventManager data (history, flags, chains)
                eventManagerState: null
            },
            
            // Shop state
            shop: {
                cards: [],
                artifacts: [],
                services: [],
                visited: false
            },
            
            // Run statistics
            stats: {
                damageDealt: 0,
                damageTaken: 0,
                cardsPlayed: 0,
                goldEarned: 0,
                goldSpent: 0,
                enemiesKilled: 0,
                elitesKilled: 0,
                bossesKilled: 0,
                floorsClimbed: 0,
                turnsPlayed: 0,
                perfectCombats: 0, // No damage taken
                corruptionGained: 0,
                corruptionCleansed: 0,
                combatsWon: 0
            },
            
            // Narrative flags
            flags: {
                // Act 1 story flags
                metRustbornScavenger: false,
                foundDawnseekerFragment: false,
                heardVoidWhispers: false,
                discoveredCorruptedNode: false,
                
                // Character-specific flags
                korvaxOverheatWarning: false,
                korvaxRageUnlocked: false
            },
            
            // Settings (persisted separately)
            settings: {
                musicVolume: 0.7,
                sfxVolume: 0.8,
                textSpeed: 'normal',
                screenShake: true,
                corruptionEffects: true,
                showDamageNumbers: true,
                confirmEndTurn: false,
                showTooltips: true
            }
        };
    }

    /**
     * Get current state or specific path
     * @param {string} path - Dot-notation path (e.g., 'hero.hp')
     * @returns {*} State value
     */
    get(path = null) {
        if (!path) return this.state;
        
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, this.state);
    }

    /**
     * Set state value at path
     * @param {string} path - Dot-notation path
     * @param {*} value - New value
     * @param {boolean} silent - If true, don't emit events
     */
    set(path, value, silent = false) {
        // Save to history for undo capability
        this.saveHistory();
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.state);
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        if (!silent) {
            eventBus.emit(GameEvents.UI_UPDATE, { path, value, oldValue });
            this.emitSpecificEvents(path, value, oldValue);
        }
    }

    /**
     * Update multiple state values
     * @param {Object} updates - Object with path: value pairs
     * @param {boolean} silent - If true, don't emit events
     */
    batch(updates, silent = false) {
        this.saveHistory();
        
        Object.entries(updates).forEach(([path, value]) => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {};
                return obj[key];
            }, this.state);
            target[lastKey] = value;
        });
        
        if (!silent) {
            eventBus.emit(GameEvents.UI_UPDATE, { batch: updates });
        }
    }

    /**
     * Increment a numeric value at path
     * @param {string} path - Dot-notation path (e.g., 'floor' or 'stats.damageDealt')
     * @param {number} amount - Amount to increment by (default: 1)
     * @returns {number} New value
     */
    increment(path, amount = 1) {
        const currentValue = this.get(path) || 0;
        const newValue = currentValue + amount;
        this.set(path, newValue);
        return newValue;
    }

    /**
     * Decrement a numeric value at path
     * @param {string} path - Dot-notation path
     * @param {number} amount - Amount to decrement by (default: 1)
     * @param {number} min - Minimum value (default: 0)
     * @returns {number} New value
     */
    decrement(path, amount = 1, min = 0) {
        const currentValue = this.get(path) || 0;
        const newValue = Math.max(min, currentValue - amount);
        this.set(path, newValue);
        return newValue;
    }

    /**
     * Emit specific events based on what changed
     */
    emitSpecificEvents(path, newValue, oldValue) {
        // HP changes
        if (path === 'hero.hp') {
            eventBus.emit(GameEvents.HP_CHANGED, { 
                current: newValue, 
                previous: oldValue,
                max: this.state.hero.maxHp 
            });
            
            if (newValue <= 0) {
                eventBus.emit(GameEvents.GAME_OVER, { reason: 'death' });
            }
        }
        
        // Energy changes
        if (path === 'hero.energy') {
            if (newValue > oldValue) {
                eventBus.emit(GameEvents.ENERGY_GAINED, { amount: newValue - oldValue });
            } else {
                eventBus.emit(GameEvents.ENERGY_SPENT, { amount: oldValue - newValue });
            }
        }
        
        // Corruption changes
        if (path === 'corruption') {
            const diff = newValue - oldValue;
            if (diff > 0) {
                eventBus.emit(GameEvents.CORRUPTION_GAINED, { amount: diff, total: newValue });
            } else {
                eventBus.emit(GameEvents.CORRUPTION_LOST, { amount: Math.abs(diff), total: newValue });
            }
            
            // Check thresholds
            const thresholds = [25, 50, 75, 100];
            thresholds.forEach(threshold => {
                if (oldValue < threshold && newValue >= threshold) {
                    eventBus.emit(GameEvents.CORRUPTION_THRESHOLD, { threshold, corruption: newValue });
                }
            });
        }
        
        // Overheat changes (Korvax)
        if (path === 'hero.overheat') {
            eventBus.emit(GameEvents.OVERHEAT_CHANGED, { 
                current: newValue, 
                max: this.state.hero.maxOverheat 
            });
            
            if (newValue >= this.state.hero.maxOverheat) {
                eventBus.emit(GameEvents.OVERHEAT_MAX, { overheat: newValue });
            }
        }
        
        // Block changes
        if (path === 'hero.block') {
            eventBus.emit(GameEvents.BLOCK_CHANGED, { 
                current: newValue, 
                previous: oldValue 
            });
        }
        
        // Faction reputation changes
        if (path.startsWith('factions.')) {
            const faction = path.split('.')[1];
            eventBus.emit(GameEvents.FACTION_REP_CHANGED, { 
                faction, 
                value: newValue, 
                previous: oldValue 
            });
        }
    }

    /**
     * Save current state to history
     */
    saveHistory() {
        this.history.push(JSON.stringify(this.state));
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    /**
     * Undo last state change
     * @returns {boolean} Success
     */
    undo() {
        if (this.history.length === 0) return false;
        
        const previous = this.history.pop();
        this.state = JSON.parse(previous);
        eventBus.emit(GameEvents.UI_UPDATE, { undo: true });
        return true;
    }

    /**
     * Reset to initial state
     */
    reset() {
        this.state = this.getInitialState();
        this.history = [];
        eventBus.emit(GameEvents.UI_UPDATE, { reset: true });
    }

    /**
     * Initialize a new run
     * @param {string} heroId - Selected hero ID
     * @param {number} seed - Random seed (optional)
     */
    initRun(heroId, seed = null) {
        this.reset();
        
        this.state.seed = seed || Date.now();
        this.state.runActive = true;
        this.state.hero.id = heroId;
        
        eventBus.emit(GameEvents.RUN_START, { heroId, seed: this.state.seed });
    }

    /**
     * Initialize a new run with hero data
     * @param {string} heroId - Selected hero ID
     * @param {DataLoader} dataLoader - Data loader instance
     */
    initializeRun(heroId, dataLoader) {
        this.reset();
        
        const hero = dataLoader.getHero(heroId);
        if (!hero) {
            console.error(`Hero not found: ${heroId}`);
            return false;
        }
        
        this.state.seed = Date.now();
        this.state.runActive = true;
        this.state.hero.id = heroId;
        this.state.hero.name = hero.name;
        this.state.hero.hp = hero.hp;
        this.state.hero.maxHp = hero.hp;
        this.state.hero.energy = hero.energy;
        this.state.hero.maxEnergy = hero.energy;
        this.state.credits = hero.startingCredits || 100;
        
        // Initialize deck with starting cards
        if (hero.startingDeck) {
            this.state.deck = hero.startingDeck.map((cardId, index) => {
                const card = dataLoader.getCard(heroId, cardId);
                return card ? { ...card, instanceId: `card_${Date.now()}_${index}` } : null;
            }).filter(Boolean);
        }
        
        // Add starting artifact
        if (hero.startingArtifact) {
            const artifact = dataLoader.getArtifact(hero.startingArtifact);
            if (artifact) {
                this.state.artifacts.push(artifact);
            }
        }
        
        eventBus.emit(GameEvents.RUN_START, { heroId, seed: this.state.seed });
        return true;
    }

    /**
     * Export state for saving
     * @returns {Object} Serializable state
     */
    export() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Import state from save
     * @param {Object} savedState - Previously exported state
     */
    import(savedState) {
        // Validate version compatibility
        if (savedState.version !== this.state.version) {
            console.warn(`Save version mismatch: ${savedState.version} vs ${this.state.version}`);
            // Could add migration logic here
        }
        
        this.state = savedState;
        this.history = [];
        eventBus.emit(GameEvents.LOAD_COMPLETE, { state: this.state });
    }

    // ==========================================
    // Convenience methods for common operations
    // ==========================================

    // Hero methods
    modifyHp(amount) {
        const newHp = Math.max(0, Math.min(this.state.hero.maxHp, this.state.hero.hp + amount));
        this.set('hero.hp', newHp);
        return newHp;
    }

    modifyBlock(amount) {
        const newBlock = Math.max(0, this.state.hero.block + amount);
        this.set('hero.block', newBlock);
        return newBlock;
    }

    modifyEnergy(amount) {
        const newEnergy = Math.max(0, this.state.hero.energy + amount);
        this.set('hero.energy', newEnergy);
        return newEnergy;
    }

    // Corruption methods
    addCorruption(amount) {
        const newCorruption = Math.min(this.state.maxCorruption, this.state.corruption + amount);
        this.set('corruption', newCorruption);
        this.state.stats.corruptionGained += amount;
        return newCorruption;
    }

    removeCorruption(amount) {
        const newCorruption = Math.max(0, this.state.corruption - amount);
        this.set('corruption', newCorruption);
        this.state.stats.corruptionCleansed += amount;
        return newCorruption;
    }

    getCorruptionTier() {
        const c = this.state.corruption;
        if (c >= 75) return 3;
        if (c >= 50) return 2;
        if (c >= 25) return 1;
        return 0;
    }

    // Economy methods
    addCredits(amount) {
        this.set('credits', this.state.credits + amount);
        this.state.stats.goldEarned += amount;
    }

    spendCredits(amount) {
        if (this.state.credits >= amount) {
            this.set('credits', this.state.credits - amount);
            this.state.stats.goldSpent += amount;
            return true;
        }
        return false;
    }

    // Faction methods
    modifyFaction(factionId, amount) {
        const current = this.state.factions[factionId] || 0;
        const newValue = Math.max(-5, Math.min(5, current + amount));
        this.set(`factions.${factionId}`, newValue);
        return newValue;
    }

    getFactionTier(factionId) {
        const rep = this.state.factions[factionId] || 0;
        if (rep >= 4) return 'allied';
        if (rep >= 2) return 'trusted';
        if (rep >= 0) return 'neutral';
        if (rep >= -2) return 'distrustful';
        return 'hostile';
    }

    // Deck methods
    addCardToDeck(card) {
        this.state.deck.push(card);
        eventBus.emit(GameEvents.CARD_ADDED, { card });
    }

    removeCardFromDeck(cardId) {
        const index = this.state.deck.findIndex(c => c.id === cardId);
        if (index > -1) {
            const card = this.state.deck.splice(index, 1)[0];
            eventBus.emit(GameEvents.CARD_REMOVED, { card });
            return card;
        }
        return null;
    }

    // Artifact methods
    addArtifact(artifact) {
        this.state.artifacts.push(artifact);
        eventBus.emit(GameEvents.ARTIFACT_GAINED, { artifact });
    }

    hasArtifact(artifactId) {
        return this.state.artifacts.some(a => a.id === artifactId);
    }

    // Flag methods
    setFlag(flagName, value = true) {
        this.set(`flags.${flagName}`, value);
    }

    getFlag(flagName) {
        return this.state.flags[flagName] || false;
    }

    // Combat state methods
    startCombat(enemies) {
        this.batch({
            'combat.active': true,
            'combat.enemies': enemies,
            'combat.turn': 0,
            'combat.isPlayerTurn': true
        });
        eventBus.emit(GameEvents.COMBAT_START, { enemies });
    }

    endCombat(victory) {
        const result = {
            victory,
            turn: this.state.combat.turn,
            remainingHp: this.state.hero.hp
        };
        
        this.batch({
            'combat.active': false,
            'combat.enemies': [],
            'combat.turn': 0,
            'hero.block': 0
        });
        
        eventBus.emit(GameEvents.COMBAT_END, result);
        return result;
    }
}

// Create singleton instance
const gameState = new GameState();

export { GameState, gameState };
export default gameState;
