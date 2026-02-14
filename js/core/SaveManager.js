/**
 * SaveManager - Handles game persistence using LocalStorage
 * Manages save slots, auto-save, and data validation
 */
import eventBus, { GameEvents } from './EventBus.js';
import gameState from './GameState.js';

class SaveManager {
    constructor() {
        this.STORAGE_PREFIX = 'shattered_star_';
        this.RUN_SAVE_KEY = this.STORAGE_PREFIX + 'current_run';
        this.PROFILE_KEY = this.STORAGE_PREFIX + 'profile';
        this.SETTINGS_KEY = this.STORAGE_PREFIX + 'settings';
        this.UNLOCKS_KEY = this.STORAGE_PREFIX + 'unlocks';
        
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds
    }

    /**
     * Initialize save manager
     */
    init() {
        // Set up auto-save
        this.startAutoSave();
        
        // Listen for events that should trigger saves
        eventBus.on(GameEvents.NODE_COMPLETED, () => this.saveRun());
        eventBus.on(GameEvents.COMBAT_END, () => this.saveRun());
        eventBus.on(GameEvents.EVENT_END, () => this.saveRun());
        eventBus.on(GameEvents.SHOP_EXIT, () => this.saveRun());
        eventBus.on(GameEvents.REST_END, () => this.saveRun());
    }

    /**
     * Check if a save exists
     * @returns {boolean}
     */
    hasSave() {
        return localStorage.getItem(this.RUN_SAVE_KEY) !== null;
    }

    /**
     * Save current run state
     * @returns {boolean} Success
     */
    saveRun() {
        try {
            if (!gameState.get('runActive')) return false;
            
            eventBus.emit(GameEvents.SAVE_START);
            
            const saveData = {
                state: gameState.export(),
                timestamp: Date.now(),
                version: gameState.get('version')
            };
            
            localStorage.setItem(this.RUN_SAVE_KEY, JSON.stringify(saveData));
            
            eventBus.emit(GameEvents.SAVE_COMPLETE, { timestamp: saveData.timestamp });
            return true;
        } catch (error) {
            console.error('[SaveManager] Failed to save run:', error);
            return false;
        }
    }

    /**
     * Load saved run state
     * @returns {Object|null} Loaded state or null
     */
    loadRun() {
        try {
            eventBus.emit(GameEvents.LOAD_START);
            
            const saveData = localStorage.getItem(this.RUN_SAVE_KEY);
            if (!saveData) return null;
            
            const parsed = JSON.parse(saveData);
            
            // Validate save data
            if (!this.validateSave(parsed)) {
                console.warn('[SaveManager] Invalid save data, clearing');
                this.clearRun();
                return null;
            }
            
            gameState.import(parsed.state);
            
            return parsed.state;
        } catch (error) {
            console.error('[SaveManager] Failed to load run:', error);
            return null;
        }
    }

    /**
     * Clear current run save
     */
    clearRun() {
        localStorage.removeItem(this.RUN_SAVE_KEY);
    }

    /**
     * Validate save data structure
     * @param {Object} saveData 
     * @returns {boolean}
     */
    validateSave(saveData) {
        if (!saveData || typeof saveData !== 'object') return false;
        if (!saveData.state) return false;
        if (!saveData.state.hero) return false;
        if (typeof saveData.state.hero.hp !== 'number') return false;
        return true;
    }

    // ==========================================
    // Profile Management (Meta-progression)
    // ==========================================

    /**
     * Get or create player profile
     * @returns {Object} Profile data
     */
    getProfile() {
        try {
            const profile = localStorage.getItem(this.PROFILE_KEY);
            if (profile) {
                return JSON.parse(profile);
            }
            
            // Create default profile
            const defaultProfile = this.getDefaultProfile();
            this.saveProfile(defaultProfile);
            return defaultProfile;
        } catch (error) {
            console.error('[SaveManager] Failed to get profile:', error);
            return this.getDefaultProfile();
        }
    }

    /**
     * Get default profile structure
     * @returns {Object}
     */
    getDefaultProfile() {
        return {
            created: Date.now(),
            lastPlayed: Date.now(),
            
            // Echoes (meta-progression currency)
            echoes: 0,
            totalEchoes: 0,
            
            // Run statistics
            totalRuns: 0,
            completedRuns: 0,
            deaths: 0,
            
            // Hero statistics
            heroStats: {
                korvax: { runs: 0, wins: 0, bestFloor: 0 },
                lyria: { runs: 0, wins: 0, bestFloor: 0 },
                auren: { runs: 0, wins: 0, bestFloor: 0 },
                shade: { runs: 0, wins: 0, bestFloor: 0 }
            },
            
            // Achievements unlocked
            achievements: [],
            
            // Codex entries discovered
            codexEntries: [],
            
            // Cards seen (for collection tracking)
            cardsSeen: [],
            
            // Artifacts seen
            artifactsSeen: [],
            
            // Endings achieved
            endings: [],
            
            // Highest values achieved
            records: {
                highestDamage: 0,
                mostCardsPlayed: 0,
                fastestBossKill: null,
                highestCorruption: 0,
                lowestCorruptionWin: null
            }
        };
    }

    /**
     * Save player profile
     * @param {Object} profile 
     */
    saveProfile(profile) {
        profile.lastPlayed = Date.now();
        localStorage.setItem(this.PROFILE_KEY, JSON.stringify(profile));
    }

    /**
     * Update profile after run ends
     * @param {Object} runResult 
     */
    updateProfileFromRun(runResult) {
        const profile = this.getProfile();
        const heroId = runResult.heroId;
        
        profile.totalRuns++;
        
        if (runResult.victory) {
            profile.completedRuns++;
            profile.heroStats[heroId].wins++;
        } else {
            profile.deaths++;
        }
        
        profile.heroStats[heroId].runs++;
        profile.heroStats[heroId].bestFloor = Math.max(
            profile.heroStats[heroId].bestFloor,
            runResult.floor
        );
        
        // Award echoes
        const echoesEarned = this.calculateEchoes(runResult);
        profile.echoes += echoesEarned;
        profile.totalEchoes += echoesEarned;
        
        // Update records
        if (runResult.stats.damageDealt > profile.records.highestDamage) {
            profile.records.highestDamage = runResult.stats.damageDealt;
        }
        
        this.saveProfile(profile);
        
        return { echoes: echoesEarned };
    }

    /**
     * Calculate echoes earned from run
     * @param {Object} runResult 
     * @returns {number}
     */
    calculateEchoes(runResult) {
        let echoes = 0;
        
        // Base echoes from progress
        echoes += runResult.floor * 2;
        
        // Bonus for enemies killed
        echoes += runResult.stats.enemiesKilled;
        echoes += runResult.stats.elitesKilled * 3;
        echoes += runResult.stats.bossesKilled * 10;
        
        // Victory bonus
        if (runResult.victory) {
            echoes += 50;
        }
        
        // First-time bonuses (handled separately)
        
        return echoes;
    }

    // ==========================================
    // Unlocks Management
    // ==========================================

    /**
     * Get unlocks data
     * @returns {Object}
     */
    getUnlocks() {
        try {
            const unlocks = localStorage.getItem(this.UNLOCKS_KEY);
            if (unlocks) {
                return JSON.parse(unlocks);
            }
            
            return this.getDefaultUnlocks();
        } catch (error) {
            return this.getDefaultUnlocks();
        }
    }

    /**
     * Get default unlocks
     * @returns {Object}
     */
    getDefaultUnlocks() {
        return {
            // Heroes (Korvax available by default)
            heroes: ['korvax'],
            
            // Starting bonuses purchased with echoes
            bonuses: [],
            
            // Card pool expansions
            cardPools: ['basic'],
            
            // Cosmetics
            heroSkins: {
                korvax: ['default'],
                lyria: ['default'],
                auren: ['default'],
                shade: ['default']
            },
            cardBacks: ['default'],
            
            // Special modes
            voidMode: false,
            nightmareMode: false
        };
    }

    /**
     * Check if something is unlocked
     * @param {string} category 
     * @param {string} id 
     * @returns {boolean}
     */
    isUnlocked(category, id) {
        const unlocks = this.getUnlocks();
        if (Array.isArray(unlocks[category])) {
            return unlocks[category].includes(id);
        }
        return unlocks[category] === true;
    }

    /**
     * Unlock something
     * @param {string} category 
     * @param {string} id 
     */
    unlock(category, id) {
        const unlocks = this.getUnlocks();
        
        if (Array.isArray(unlocks[category])) {
            if (!unlocks[category].includes(id)) {
                unlocks[category].push(id);
            }
        } else {
            unlocks[category] = true;
        }
        
        localStorage.setItem(this.UNLOCKS_KEY, JSON.stringify(unlocks));
    }

    // ==========================================
    // Settings Management
    // ==========================================

    /**
     * Get settings
     * @returns {Object}
     */
    getSettings() {
        try {
            const settings = localStorage.getItem(this.SETTINGS_KEY);
            if (settings) {
                return { ...this.getDefaultSettings(), ...JSON.parse(settings) };
            }
            return this.getDefaultSettings();
        } catch (error) {
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default settings
     * @returns {Object}
     */
    getDefaultSettings() {
        return {
            musicVolume: 0.7,
            sfxVolume: 0.8,
            uiVolume: 0.8,
            textSpeed: 'normal', // 'slow', 'normal', 'fast', 'instant'
            screenShake: true,
            corruptionEffects: true,
            showDamageNumbers: true,
            confirmEndTurn: false,
            showTooltips: true,
            cardPreview: true,
            autoEndTurn: false,
            reducedMotion: false,
            highContrast: false,
            colorblindMode: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
            language: 'en'
        };
    }

    /**
     * Save settings
     * @param {Object} settings 
     */
    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        gameState.batch({ settings });
    }

    /**
     * Update a single setting
     * @param {string} key 
     * @param {*} value 
     */
    setSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        this.saveSettings(settings);
    }

    // ==========================================
    // Auto-save Management
    // ==========================================

    /**
     * Start auto-save interval
     */
    startAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            if (gameState.get('runActive')) {
                this.saveRun();
            }
        }, this.autoSaveDelay);
    }

    /**
     * Stop auto-save
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // ==========================================
    // Export/Import (for sharing/backup)
    // ==========================================

    /**
     * Export all save data as downloadable JSON
     * @returns {string} JSON string
     */
    exportAll() {
        const exportData = {
            profile: this.getProfile(),
            unlocks: this.getUnlocks(),
            settings: this.getSettings(),
            currentRun: localStorage.getItem(this.RUN_SAVE_KEY) 
                ? JSON.parse(localStorage.getItem(this.RUN_SAVE_KEY)) 
                : null,
            exportDate: Date.now(),
            version: gameState.get('version')
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import save data from JSON
     * @param {string} jsonString 
     * @returns {boolean} Success
     */
    importAll(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.profile) {
                this.saveProfile(data.profile);
            }
            
            if (data.unlocks) {
                localStorage.setItem(this.UNLOCKS_KEY, JSON.stringify(data.unlocks));
            }
            
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            
            if (data.currentRun) {
                localStorage.setItem(this.RUN_SAVE_KEY, JSON.stringify(data.currentRun));
            }
            
            return true;
        } catch (error) {
            console.error('[SaveManager] Failed to import save data:', error);
            return false;
        }
    }

    /**
     * Clear all save data (nuclear option)
     */
    clearAll() {
        localStorage.removeItem(this.RUN_SAVE_KEY);
        localStorage.removeItem(this.PROFILE_KEY);
        localStorage.removeItem(this.UNLOCKS_KEY);
        localStorage.removeItem(this.SETTINGS_KEY);
    }

    /**
     * Get save file size estimate
     * @returns {number} Size in bytes
     */
    getSaveSize() {
        let total = 0;
        for (const key in localStorage) {
            if (key.startsWith(this.STORAGE_PREFIX)) {
                total += localStorage.getItem(key).length * 2; // UTF-16
            }
        }
        return total;
    }
}

// Create singleton instance
const saveManager = new SaveManager();

export { SaveManager, saveManager };
export default saveManager;
