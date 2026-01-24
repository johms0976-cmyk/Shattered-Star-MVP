/**
 * DataLoader - Handles loading and caching of game data from JSON files
 * Provides centralized access to all game content
 */
import eventBus from './EventBus.js';

class DataLoader {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
        this.basePath = './data/';
        
        // Fallback hero data for when external files aren't available
        this.fallbackHeroes = [
            {
                id: 'korvax',
                name: 'Korvax Rend',
                title: 'The Broken Titan',
                description: 'A former shock trooper engineered for frontline devastation. His Overheat systems malfunction on Vharos, forcing him to battle both enemies and himself.',
                hp: 80,
                energy: 3,
                locked: false,
                archetypes: [
                    { name: 'Rage', description: 'Self-damage fuels power' },
                    { name: 'Overheat', description: 'Tech-berserker mechanics' },
                    { name: 'Titan', description: 'Defense and counters' }
                ],
                startingDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'thermal_vent', 'rage_spike', 'system_check'],
                startingArtifact: 'thermal_regulator'
            },
            {
                id: 'lyria',
                name: 'Lyria Voss',
                title: 'The Fractured Mind',
                description: 'A temporal mage experiencing nonlinear time. The Marsh amplifies her abilities and her instability.',
                hp: 70,
                energy: 3,
                locked: true,
                archetypes: [
                    { name: 'Astral', description: 'Scaling damage over time' },
                    { name: 'Temporal', description: 'Draw and cost manipulation' },
                    { name: 'Void', description: 'High-risk corruption magic' }
                ],
                startingDeck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'temporal_slip', 'astral_lance'],
                startingArtifact: 'astral_conduit'
            },
            {
                id: 'auren',
                name: 'Auren Solari',
                title: 'The Fallen Light',
                description: 'A former holy knight seeking redemption. His faith shattered years ago; now he must decide if the Light was ever worth serving.',
                hp: 75,
                energy: 3,
                locked: true,
                archetypes: [
                    { name: 'Radiant', description: 'Holy damage over time' },
                    { name: 'Aegis', description: 'Persistent shields' },
                    { name: 'Judgment', description: 'Punish debuffed enemies' }
                ],
                startingDeck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'radiant_strike', 'aegis_of_faith'],
                startingArtifact: 'shard_of_first_light'
            },
            {
                id: 'shade',
                name: 'Shade',
                title: 'The Faceless',
                description: 'A covert operative with no memory of their true identity. The Thicket awakens forgotten echoes.',
                hp: 65,
                energy: 3,
                locked: true,
                archetypes: [
                    { name: 'Stealth', description: 'Vanish and burst damage' },
                    { name: 'Bleed', description: 'Stacking damage over time' },
                    { name: 'Identity Theft', description: 'Copy enemy abilities' }
                ],
                startingDeck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'shadowstep', 'arterial_cut'],
                startingArtifact: 'mask_of_echoes'
            }
        ];
        
        // Fallback data for when external files aren't available
        this.fallbackData = {
            enemies: [
                { id: 'rustborn_raider', name: 'Rustborn Raider', hp: 20, type: 'normal', minAct: 1, intents: [{type: 'attack', damage: 6}] },
                { id: 'scrap_golem', name: 'Scrap Golem', hp: 35, type: 'normal', minAct: 1, intents: [{type: 'defend', block: 8}, {type: 'attack', damage: 12}] },
                { id: 'sand_crawler', name: 'Sand Crawler', hp: 15, type: 'normal', minAct: 1, intents: [{type: 'attack', damage: 4}] },
                { id: 'rust_prophet', name: 'Rust Prophet', hp: 25, type: 'elite', minAct: 1, intents: [{type: 'buff'}, {type: 'attack', damage: 10}] },
                { id: 'scrap_king', name: 'Scrap-King', hp: 80, type: 'boss', intents: [{type: 'attack', damage: 15}, {type: 'summon'}] },
                { id: 'rust_titan', name: 'Rust Titan', hp: 120, type: 'boss', intents: [{type: 'attack', damage: 20}, {type: 'defend', block: 15}] },
                { id: 'xalkorath', name: "Xal'Korath", hp: 200, type: 'boss', intents: [{type: 'attack', damage: 25}, {type: 'corrupt'}] }
            ],
            events: [
                { id: 'dying_soldier', name: 'The Dying Soldier', text: 'A Rustborn warrior lies bleeding...', choices: [{text: 'Help them', effects: {reputation: {rustborn: 1}, hp: -5}}, {text: 'Walk away', effects: {}}] },
                { id: 'void_mirror', name: 'The Void Mirror', text: 'A pool of darkness shows your reflection...', choices: [{text: 'Reach in', effects: {corruption: 5, card: 'random_rare'}}, {text: 'Shatter it', effects: {hp: -10}}] },
                { id: 'merchant_camp', name: 'Merchant Camp', text: 'Travelers have set up a small trading post.', choices: [{text: 'Trade', effects: {credits: -20, hp: 10}}, {text: 'Leave', effects: {}}] }
            ],
            artifacts: [
                { id: 'scrap_shield', name: 'Scrap Shield', rarity: 'common', description: 'Gain 3 Block at start of combat', effect: {type: 'start_combat_block', value: 3} },
                { id: 'void_shard', name: 'Void Shard', rarity: 'rare', description: '+1 Energy, but gain 3 Corruption per combat', effect: {type: 'bonus_energy', value: 1} },
                { id: 'ancient_core', name: 'Ancient Core', rarity: 'rare', description: 'Draw 1 extra card each turn', effect: {type: 'bonus_draw', value: 1} }
            ]
        };
        
        // Data categories and their file mappings
        this.dataPaths = {
            // Heroes
            heroes: {
                korvax: 'heroes/korvax.json',
                lyria: 'heroes/lyria.json',
                auren: 'heroes/auren.json',
                shade: 'heroes/shade.json'
            },
            
            // Cards
            cards: {
                korvax: 'cards/korvax_cards.json',
                lyria: 'cards/lyria_cards.json',
                auren: 'cards/auren_cards.json',
                shade: 'cards/shade_cards.json',
                neutral: 'cards/neutral_cards.json',
                corrupted: 'cards/corrupted_cards.json'
            },
            
            // Enemies
            enemies: {
                act1: 'enemies/act1_enemies.json',
                act2: 'enemies/act2_enemies.json',
                act3: 'enemies/act3_enemies.json',
                bosses: 'enemies/bosses.json',
                elites: 'enemies/elites.json'
            },
            
            // Events
            events: {
                act1: 'events/act1_events.json',
                act2: 'events/act2_events.json',
                act3: 'events/act3_events.json',
                faction: 'events/faction_events.json',
                hero: 'events/hero_events.json'
            },
            
            // Maps
            maps: {
                act1: 'maps/act1_config.json',
                act2: 'maps/act2_config.json',
                act3: 'maps/act3_config.json'
            },
            
            // Dialogue
            dialogue: {
                act1: 'dialogue/act1_dialogue.json',
                intro: 'dialogue/intro_dialogue.json',
                combat: 'dialogue/combat_dialogue.json'
            },
            
            // Artifacts
            artifacts: {
                common: 'artifacts/common.json',
                rare: 'artifacts/rare.json',
                mythic: 'artifacts/mythic.json',
                hero: 'artifacts/hero_artifacts.json',
                faction: 'artifacts/faction_artifacts.json'
            },
            
            // Status effects
            statuses: {
                all: 'statuses/statuses.json'
            },
            
            // Factions
            factions: {
                all: 'factions/factions.json'
            }
        };
    }

    /**
     * Load a single JSON file
     * @param {string} path - Path relative to data folder
     * @returns {Promise<Object>} Parsed JSON data
     */
    async loadFile(path) {
        const fullPath = this.basePath + path;
        
        // Check cache first
        if (this.cache.has(fullPath)) {
            return this.cache.get(fullPath);
        }
        
        // Check if already loading
        if (this.loading.has(fullPath)) {
            return this.loading.get(fullPath);
        }
        
        // Start loading
        const loadPromise = fetch(fullPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${fullPath}: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.cache.set(fullPath, data);
                this.loading.delete(fullPath);
                return data;
            })
            .catch(error => {
                this.loading.delete(fullPath);
                console.error(`[DataLoader] Error loading ${fullPath}:`, error);
                throw error;
            });
        
        this.loading.set(fullPath, loadPromise);
        return loadPromise;
    }

    /**
     * Load data by category and key
     * @param {string} category - Data category (e.g., 'heroes', 'cards')
     * @param {string} key - Specific key within category
     * @returns {Promise<Object>} Data
     */
    async load(category, key) {
        if (!this.dataPaths[category]) {
            throw new Error(`Unknown data category: ${category}`);
        }
        
        const path = this.dataPaths[category][key];
        if (!path) {
            throw new Error(`Unknown ${category} key: ${key}`);
        }
        
        return this.loadFile(path);
    }

    /**
     * Load all data for a category
     * @param {string} category - Data category
     * @returns {Promise<Object>} All data in category, keyed by their names
     */
    async loadCategory(category) {
        if (!this.dataPaths[category]) {
            throw new Error(`Unknown data category: ${category}`);
        }
        
        const results = {};
        const entries = Object.entries(this.dataPaths[category]);
        
        await Promise.all(
            entries.map(async ([key, path]) => {
                try {
                    results[key] = await this.loadFile(path);
                } catch (error) {
                    console.warn(`[DataLoader] Could not load ${category}/${key}`);
                    results[key] = null;
                }
            })
        );
        
        return results;
    }

    /**
     * Load all required data for starting a run
     * @param {string} heroId - Selected hero
     * @param {number} act - Starting act
     * @returns {Promise<Object>} All required data
     */
    async loadRunData(heroId, act = 1) {
        const actKey = `act${act}`;
        
        const [hero, heroCards, neutralCards, enemies, events, mapConfig, dialogue] = 
            await Promise.all([
                this.load('heroes', heroId),
                this.load('cards', heroId),
                this.load('cards', 'neutral'),
                this.load('enemies', actKey),
                this.load('events', actKey),
                this.load('maps', actKey),
                this.load('dialogue', actKey)
            ]);
        
        return {
            hero,
            cards: [...heroCards.cards, ...neutralCards.cards],
            enemies: enemies.enemies,
            events: events.events,
            mapConfig,
            dialogue
        };
    }

    /**
     * Preload essential data for faster startup
     * @param {Function} progressCallback - Called with loading progress
     * @returns {Promise<void>}
     */
    async preload(progressCallback = null) {
        const essentialFiles = [
            'heroes/korvax.json',
            'cards/korvax_cards.json',
            'cards/neutral_cards.json',
            'enemies/act1_enemies.json',
            'enemies/bosses.json',
            'events/act1_events.json',
            'maps/act1_config.json',
            'dialogue/intro_dialogue.json',
            'statuses/statuses.json'
        ];
        
        let loaded = 0;
        
        await Promise.all(
            essentialFiles.map(async (file) => {
                try {
                    await this.loadFile(file);
                } catch (error) {
                    console.warn(`[DataLoader] Preload failed for ${file}`);
                }
                
                loaded++;
                if (progressCallback) {
                    progressCallback(loaded / essentialFiles.length);
                }
            })
        );
    }

    /**
     * Get all available heroes
     * @returns {Array} Array of hero objects
     */
    getAllHeroes() {
        // Try to get heroes from cache
        const heroes = [];
        
        for (const [heroId, path] of Object.entries(this.dataPaths.heroes)) {
            const fullPath = this.basePath + path;
            const cachedData = this.cache.get(fullPath);
            
            if (cachedData) {
                heroes.push(cachedData);
            } else {
                // Use fallback data
                const fallback = this.fallbackHeroes.find(h => h.id === heroId);
                if (fallback) {
                    heroes.push(fallback);
                }
            }
        }
        
        // If no heroes found, return all fallback heroes
        if (heroes.length === 0) {
            console.warn('[DataLoader] No heroes in cache, using fallback data');
            return this.fallbackHeroes;
        }
        
        return heroes;
    }

    /**
     * Get a specific hero by ID
     * @param {string} heroId - Hero identifier
     * @returns {Object|null} Hero data or null if not found
     */
    getHero(heroId) {
        // Try cache first
        const path = this.dataPaths.heroes[heroId];
        if (path) {
            const fullPath = this.basePath + path;
            const cachedData = this.cache.get(fullPath);
            if (cachedData) {
                return cachedData;
            }
        }
        
        // Fallback
        const fallback = this.fallbackHeroes.find(h => h.id === heroId);
        if (fallback) {
            console.warn(`[DataLoader] Using fallback data for hero: ${heroId}`);
            return fallback;
        }
        
        console.error(`[DataLoader] Hero not found: ${heroId}`);
        return null;
    }

    /**
     * Get a specific card by ID
     * @param {string} cardId 
     * @returns {Object|null}
     */
    getCard(cardId) {
        // Search through all loaded card pools
        for (const [path, data] of this.cache) {
            if (path.includes('/cards/') && data.cards) {
                const card = data.cards.find(c => c.id === cardId);
                if (card) return card;
            }
        }
        return null;
    }

    /**
     * Get all cards for a hero
     * @param {string} heroId 
     * @returns {Array}
     */
    getHeroCards(heroId) {
        const path = this.basePath + this.dataPaths.cards[heroId];
        const data = this.cache.get(path);
        return data ? data.cards : [];
    }

    /**
     * Get enemy data by ID
     * @param {string} enemyId 
     * @returns {Object|null}
     */
    getEnemy(enemyId) {
        for (const [path, data] of this.cache) {
            if (path.includes('/enemies/') && data.enemies) {
                const enemy = data.enemies.find(e => e.id === enemyId);
                if (enemy) return enemy;
            }
        }
        return null;
    }

    /**
     * Get event data by ID
     * @param {string} eventId 
     * @returns {Object|null}
     */
    getEvent(eventId) {
        for (const [path, data] of this.cache) {
            if (path.includes('/events/') && data.events) {
                const event = data.events.find(e => e.id === eventId);
                if (event) return event;
            }
        }
        return null;
    }

    /**
     * Get random cards matching criteria
     * @param {Object} criteria - Filter criteria
     * @param {number} count - Number of cards to return
     * @returns {Array}
     */
    getRandomCards(criteria = {}, count = 3) {
        const allCards = [];
        
        for (const [path, data] of this.cache) {
            if (path.includes('/cards/') && data.cards) {
                allCards.push(...data.cards);
            }
        }
        
        // Filter by criteria
        let filtered = allCards.filter(card => {
            if (criteria.type && card.type !== criteria.type) return false;
            if (criteria.rarity && card.rarity !== criteria.rarity) return false;
            if (criteria.heroId && card.heroId && card.heroId !== criteria.heroId) return false;
            if (criteria.maxCost !== undefined && card.cost > criteria.maxCost) return false;
            return true;
        });
        
        // Shuffle and take count
        filtered = this.shuffle(filtered);
        return filtered.slice(0, count);
    }

    /**
     * Get random enemies for an encounter
     * @param {string} act - Act key (e.g., 'act1')
     * @param {string} type - Encounter type ('normal', 'elite', 'boss')
     * @returns {Array}
     */
    getRandomEnemies(act, type = 'normal') {
        const path = this.basePath + this.dataPaths.enemies[act];
        const data = this.cache.get(path);
        
        if (!data) return [];
        
        const pools = data.encounters?.[type] || [];
        if (pools.length === 0) return [];
        
        // Select a random encounter configuration
        const encounter = pools[Math.floor(Math.random() * pools.length)];
        
        // Build enemy array
        return encounter.enemies.map(enemyId => {
            const enemyData = data.enemies.find(e => e.id === enemyId);
            return enemyData ? { ...enemyData } : null;
        }).filter(e => e !== null);
    }

    /**
     * Shuffle array (Fisher-Yates)
     * @param {Array} array 
     * @returns {Array}
     */
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Get enemies for an act with specified difficulty
     * @param {number} act 
     * @param {string} difficulty - 'normal' or 'elite'
     * @returns {Array}
     */
    getEnemiesForAct(act, difficulty = 'normal') {
        // First try to get from cache
        let data = null;
        
        for (const [path, cached] of this.cache) {
            if (path.includes('/enemies/') && cached.enemies) {
                data = cached.enemies;
                break;
            }
        }
        
        // Fallback
        if (!data) {
            data = this.fallbackData.enemies;
        }
        
        if (!data) return [];
        
        // Filter enemies by act and difficulty
        let pool = data.filter(e => {
            if (difficulty === 'elite') return e.type === 'elite';
            return e.type === 'normal' && (!e.minAct || e.minAct <= act);
        });
        
        if (pool.length === 0) {
            // Fallback to any normal enemy
            pool = data.filter(e => e.type !== 'boss');
        }
        
        // Pick 1-3 enemies
        const count = difficulty === 'elite' ? 1 : 1 + Math.floor(Math.random() * 2);
        const enemies = [];
        
        for (let i = 0; i < count && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            enemies.push({ ...pool[idx] });
        }
        
        return enemies;
    }

    /**
     * Get boss for an act
     * @param {number} act 
     * @returns {Object}
     */
    getBossForAct(act) {
        // First try to get from cache
        let data = null;
        
        for (const [path, cached] of this.cache) {
            if (path.includes('/enemies/') && cached.enemies) {
                data = cached.enemies;
                break;
            }
        }
        
        // Fallback
        if (!data) {
            data = this.fallbackData.enemies;
        }
        
        if (!data) return null;
        
        // Find boss for this act
        const bosses = data.filter(e => e.type === 'boss');
        
        // Map acts to boss IDs
        const actBosses = {
            1: 'scrap_king',
            2: 'rust_titan',
            3: 'xalkorath'
        };
        
        const bossId = actBosses[act] || actBosses[1];
        const boss = bosses.find(b => b.id === bossId) || bosses[0];
        
        return boss ? { ...boss } : null;
    }

    /**
     * Get random event for current act and corruption
     * @param {number} act 
     * @param {number} corruption 
     * @returns {Object}
     */
    getRandomEvent(act, corruption = 0) {
        // Try to get from cache
        let data = null;
        
        for (const [path, cached] of this.cache) {
            if (path.includes('/events/') && cached.events) {
                data = cached.events;
                break;
            }
        }
        
        // Fallback
        if (!data) {
            data = this.fallbackData.events;
        }
        
        if (!data || data.length === 0) return null;
        
        // Filter events by act and corruption requirements
        let pool = data.filter(e => {
            if (e.minAct && e.minAct > act) return false;
            if (e.maxAct && e.maxAct < act) return false;
            if (e.minCorruption && corruption < e.minCorruption) return false;
            return true;
        });
        
        if (pool.length === 0) pool = data;
        
        // Pick random event
        return { ...pool[Math.floor(Math.random() * pool.length)] };
    }

    /**
     * Get a random artifact by rarity
     * @param {string} rarity - 'common', 'rare', or 'mythic'
     * @returns {Object}
     */
    getRandomArtifact(rarity = 'common') {
        const data = this.cache.get('artifacts') || this.fallbackData.artifacts;
        if (!data || data.length === 0) return null;
        
        // Filter by rarity
        let pool = data.filter(a => a.rarity === rarity);
        if (pool.length === 0) pool = data;
        
        return { ...pool[Math.floor(Math.random() * pool.length)] };
    }

    /**
     * Clear cache (useful for reloading modified data)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        return {
            cachedFiles: this.cache.size,
            loadingFiles: this.loading.size,
            cachedPaths: Array.from(this.cache.keys())
        };
    }
}

// Create singleton instance
const dataLoader = new DataLoader();

export { DataLoader, dataLoader };
export default dataLoader;
