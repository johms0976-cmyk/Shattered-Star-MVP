/**
 * SHATTERED STAR - Main Entry Point
 * Sci-Fi Noir Cosmic Horror Deckbuilder
 * 
 * @version 0.2.1 MVP - Fixed screen initialization
 */

// Import core systems (singletons)
import gameState from './core/GameState.js';
import eventBus from './core/EventBus.js';
import saveManager from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { ScreenManager } from './core/ScreenManager.js';

// Import game systems
import { CombatSystem } from './systems/CombatSystem.js';
import { DeckManager } from './systems/DeckManager.js';
import { MapGenerator } from './systems/MapGenerator.js';
import { CorruptionSystem } from './systems/CorruptionSystem.js';
import { RewardSystem } from './systems/RewardSystem.js';

// Import data loaders
import dataLoader from './core/DataLoader.js';

// Import UI handlers
import { setupTitleScreen } from './screens/TitleScreen.js';
import { setupHeroSelect } from './screens/HeroSelectScreen.js';
import { setupMapScreen } from './screens/MapScreen.js';
import { setupCombatScreen } from './screens/CombatScreen.js';
import { setupEventScreen } from './screens/EventScreen.js';
import { setupShopScreen } from './screens/ShopScreen.js';
import { setupRestScreen } from './screens/RestScreen.js';
import { setupRewardScreen } from './screens/RewardScreen.js';

// MVP Fallback hero data
const MVP_HERO_DATA = {
    korvax: {
        id: 'korvax',
        name: 'Korvax Rend',
        title: 'The Broken Titan',
        hp: 80,
        energy: 3,
        startingCredits: 100,
        startingDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'thermal_vent', 'rage_spike', 'system_check'],
        startingArtifact: 'thermal_regulator'
    }
};

// MVP Fallback card data for Korvax
const MVP_CARDS = {
    strike: { id: 'strike', name: 'Strike', type: 'attack', cost: 1, damage: 6, description: 'Deal 6 damage.' },
    defend: { id: 'defend', name: 'Defend', type: 'skill', cost: 1, block: 5, description: 'Gain 5 Block.' },
    thermal_vent: { id: 'thermal_vent', name: 'Thermal Vent', type: 'skill', cost: 1, block: 4, overheat: 1, description: 'Gain 4 Block. Gain 1 Overheat.' },
    rage_spike: { id: 'rage_spike', name: 'Rage Spike', type: 'attack', cost: 1, damage: 4, conditionalDamage: 8, description: 'Deal 4 damage. If you took damage this turn, deal 8 instead.' },
    system_check: { id: 'system_check', name: 'System Check', type: 'skill', cost: 0, draw: 1, exhaust: true, description: 'Draw 1 card. Exhaust.' }
};

/**
 * Main Game Application
 */
class ShatteredStar {
    constructor() {
        this.version = '0.2.1';
        this.initialized = false;
        
        // Device detection
        this.isMobile = this.detectMobile();
        window.isMobile = this.isMobile;
        
        // Core systems (use singletons)
        this.eventBus = eventBus;
        this.state = gameState;
        this.saveManager = saveManager;
        this.audioManager = new AudioManager();
        this.screenManager = new ScreenManager(eventBus);
        this.dataLoader = dataLoader;
        
        // Game systems (initialized after data load)
        this.combat = null;
        this.deck = null;
        this.mapGenerator = null;
        this.corruption = null;
        this.rewards = null;
        
        // Screen initialization functions (for direct calling)
        this.screenInitializers = {};
    }
    
    /**
     * Detect if the device is mobile
     */
    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
        const isSmallScreen = window.innerWidth <= 768;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        const isMobile = isMobileUA || (isSmallScreen && isTouchDevice);
        console.log(`[Shattered Star] Device detected: ${isMobile ? 'Mobile' : 'Desktop'}`);
        return isMobile;
    }
    
    /**
     * Get the correct background path based on device
     */
    getBackgroundPath(screenType) {
        const deviceFolder = this.isMobile ? 'mobile' : 'desktop';
        const prefix = this.isMobile ? 'mobile' : 'desktop';
        return `assets/images/backgrounds/${deviceFolder}/${prefix}_${screenType}.png`;
    }
    
    /**
     * Get fallback background paths to try
     */
    getBackgroundFallbacks(screenType) {
        const deviceFolder = this.isMobile ? 'mobile' : 'desktop';
        const prefix = this.isMobile ? 'mobile' : 'desktop';
        
        return [
            `assets/images/backgrounds/${deviceFolder}/${prefix}_${screenType}.png`,
            `assets/images/backgrounds/${deviceFolder}/${screenType}.png`,
            `assets/images/backgrounds/${screenType}.png`,
            `assets/images/backgrounds/${prefix}_${screenType}.png`
        ];
    }
    
    /**
     * Set background for a screen with fallback support
     */
    setScreenBackground(screenId, imageName) {
        const screenEl = document.getElementById(screenId);
        if (!screenEl) {
            console.error(`[Shattered Star] Screen not found: ${screenId}`);
            return;
        }
        
        const paths = this.getBackgroundFallbacks(imageName);
        console.log(`[Shattered Star] Setting ${screenId} background, trying:`, paths);
        
        this.tryBackgroundPaths(screenEl, paths, 0);
    }
    
    /**
     * Try background paths until one works
     */
    tryBackgroundPaths(element, paths, index) {
        if (index >= paths.length) {
            console.warn('[Shattered Star] All background paths failed, using gradient');
            element.style.background = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)';
            return;
        }
        
        const path = paths[index];
        const img = new Image();
        
        img.onload = () => {
            console.log(`[Shattered Star] Background loaded: ${path}`);
            element.style.backgroundImage = `url('${path}')`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
        };
        
        img.onerror = () => {
            console.warn(`[Shattered Star] Background failed: ${path}`);
            this.tryBackgroundPaths(element, paths, index + 1);
        };
        
        img.src = path;
    }
    
    /**
     * Initialize the game
     */
    async init() {
        console.log(`[Shattered Star] Initializing v${this.version}...`);
        
        try {
            // Update loading progress
            this.updateLoadingProgress(0, 'Loading game data...');
            
            // Load all game data (with error handling)
            try {
                await this.dataLoader.preload();
                console.log('[Shattered Star] DataLoader preload complete');
            } catch (e) {
                console.warn('[Shattered Star] DataLoader preload failed, using fallbacks:', e);
            }
            this.updateLoadingProgress(30, 'Initializing systems...');
            
            // Initialize game systems
            this.initializeSystems();
            this.updateLoadingProgress(50, 'Setting up screens...');
            
            // Setup screen handlers
            this.setupScreens();
            this.updateLoadingProgress(70, 'Loading assets...');
            
            // Preload critical assets
            await this.preloadAssets();
            this.updateLoadingProgress(90, 'Finalizing...');
            
            // Check for existing save
            const hasSave = this.saveManager.hasSave();
            const continueBtn = document.getElementById('btn-continue');
            if (continueBtn) {
                continueBtn.disabled = !hasSave;
            }
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            // Setup direct screen transition hooks
            this.setupDirectScreenHooks();
            
            this.updateLoadingProgress(100, 'Ready');
            this.initialized = true;
            
            // Set title screen background BEFORE transitioning
            this.setScreenBackground('title-screen', 'titlescreen');
            
            // Transition to title screen after brief delay
            setTimeout(() => {
                this.screenManager.transitionTo('title-screen');
            }, 500);
            
            console.log('[Shattered Star] Initialization complete!');
            
        } catch (error) {
            console.error('[Shattered Star] Initialization failed:', error);
            this.showError('Failed to initialize game. Please refresh.');
        }
    }
    
    /**
     * Setup direct screen hooks that call initialization functions directly
     * This is a backup in case event-based initialization fails
     */
    setupDirectScreenHooks() {
        // Use MutationObserver to detect when screens become active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active') && target.classList.contains('screen')) {
                        const screenId = target.id;
                        console.log(`[Shattered Star] Screen became active: ${screenId}`);
                        this.onScreenActivated(screenId);
                    }
                }
            });
        });
        
        // Observe all screens
        document.querySelectorAll('.screen').forEach(screen => {
            observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
        });
    }
    
    /**
     * Called when a screen becomes active - handles direct initialization
     */
    onScreenActivated(screenId) {
        switch (screenId) {
            case 'title-screen':
                this.setScreenBackground('title-screen', 'titlescreen');
                break;
                
            case 'start-screen':
                this.setScreenBackground('start-screen', 'startscreen1');
                // Update continue button
                const continueBtn = document.getElementById('btn-continue');
                if (continueBtn) {
                    continueBtn.disabled = !this.saveManager.hasSave();
                }
                break;
                
            case 'hero-select-screen':
                this.setScreenBackground('hero-select-screen', 'heroselect1');
                // Trigger hero cards render if not already done
                this.initializeHeroSelectDirect();
                break;
                
            case 'map-screen':
                this.setScreenBackground('map-screen', 'newgame1');
                break;
        }
    }
    
    /**
     * Direct hero select initialization (backup method)
     */
    initializeHeroSelectDirect() {
        const container = document.getElementById('hero-cards');
        if (!container) {
            console.error('[Shattered Star] Hero cards container not found');
            return;
        }
        
        // Check if already populated
        if (container.children.length > 0) {
            console.log('[Shattered Star] Hero cards already populated');
            return;
        }
        
        console.log('[Shattered Star] Direct initialization of hero select');
        
        // Get heroes
        let heroes = [];
        try {
            heroes = this.dataLoader.getAllHeroes();
            console.log(`[Shattered Star] Got ${heroes.length} heroes from DataLoader`);
        } catch (e) {
            console.warn('[Shattered Star] DataLoader.getAllHeroes failed:', e);
        }
        
        // Fallback heroes
        if (!heroes || heroes.length === 0) {
            console.log('[Shattered Star] Using fallback heroes');
            heroes = [
                {
                    id: 'korvax',
                    name: 'Korvax Rend',
                    title: 'The Broken Titan',
                    description: 'A former shock trooper engineered for frontline devastation.',
                    hp: 80,
                    energy: 3,
                    locked: false,
                    archetypes: [
                        { name: 'Rage', description: 'Self-damage fuels power' },
                        { name: 'Overheat', description: 'Tech-berserker reactor management' },
                        { name: 'Titan', description: 'Defense and counters' }
                    ],
                    startingDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'thermal_vent', 'rage_spike', 'system_check']
                },
                {
                    id: 'lyria',
                    name: 'Lyria Voss',
                    title: 'The Fractured Mind',
                    description: 'A temporal mage experiencing nonlinear time.',
                    hp: 70, energy: 3, locked: true,
                    archetypes: [{ name: 'Astral', description: 'Scaling cosmic damage' }, { name: 'Temporal', description: 'Draw and cost manipulation' }, { name: 'Void', description: 'High-risk corruption magic' }]
                },
                {
                    id: 'auren',
                    name: 'Auren Solari',
                    title: 'The Fallen Light',
                    description: 'A former holy knight seeking redemption.',
                    hp: 85, energy: 3, locked: true,
                    archetypes: [{ name: 'Radiant', description: 'Holy DoT' }, { name: 'Aegis', description: 'Persistent shields' }, { name: 'Judgment', description: 'Punish debuffed enemies' }]
                },
                {
                    id: 'shade',
                    name: 'Shade',
                    title: 'The Faceless',
                    description: 'A covert operative with no memory of their true identity.',
                    hp: 65, energy: 3, locked: true,
                    archetypes: [{ name: 'Stealth', description: 'Vanish and burst' }, { name: 'Bleed', description: 'Stacking DoT' }, { name: 'Identity Theft', description: 'Copy enemy abilities' }]
                }
            ];
        }
        
        // Normalize hero data
        heroes = heroes.map(hero => this.normalizeHeroData(hero));
        
        // Render hero cards
        container.innerHTML = heroes.map(hero => `
            <div class="hero-card ${hero.locked ? 'locked' : ''}"
                 data-hero-id="${hero.id}"
                 style="cursor: ${hero.locked ? 'not-allowed' : 'pointer'}">
                <div class="hero-card-portrait">
                    <div class="hero-silhouette ${hero.id}"></div>
                </div>
                <div class="hero-card-info">
                    <h3 class="hero-card-name">${hero.name}</h3>
                    <p class="hero-card-title">${hero.title}</p>
                </div>
                ${hero.locked ? `
                    <div class="locked-overlay">
                        <span class="lock-icon">🔒</span>
                        <span class="lock-text">Complete previous hero to unlock</span>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // Setup click handlers
        const game = this;
        container.querySelectorAll('.hero-card:not(.locked)').forEach(card => {
            card.addEventListener('click', function() {
                const heroId = this.dataset.heroId;
                game.selectHeroDirect(heroId, heroes);
            });
        });
        
        // Show first unlocked hero details
        const firstUnlocked = heroes.find(h => !h.locked);
        if (firstUnlocked) {
            this.displayHeroDetailsDirect(firstUnlocked);
        }
        
        console.log('[Shattered Star] Hero cards rendered via direct method');
    }
    
    /**
     * Normalize hero data to consistent format
     */
    normalizeHeroData(hero) {
        if (!hero) return null;
        
        // Handle locked vs unlocked
        let isLocked = hero.locked;
        if (isLocked === undefined) {
            isLocked = hero.unlocked === false;
        }
        
        // Normalize archetypes
        let archetypes = hero.archetypes || [];
        if (archetypes.length > 0 && typeof archetypes[0] === 'string') {
            const descriptions = {
                'rage': 'Self-damage fuels power',
                'overheat': 'Tech-berserker reactor management',
                'titan': 'Defense and counters',
                'astral': 'Scaling cosmic damage',
                'temporal': 'Draw and cost manipulation',
                'void': 'High-risk corruption magic',
                'radiant': 'Holy DoT',
                'aegis': 'Persistent shields',
                'judgment': 'Punish debuffed enemies',
                'stealth': 'Vanish and burst',
                'bleed': 'Stacking DoT',
                'identity theft': 'Copy enemy abilities'
            };
            archetypes = archetypes.map(a => ({
                name: a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' '),
                description: descriptions[a.toLowerCase()] || 'Unique playstyle'
            }));
        }
        
        return {
            ...hero,
            locked: isLocked,
            archetypes: archetypes,
            hp: hero.hp || hero.maxHp || 80,
            energy: hero.energy || 3
        };
    }
    
    /**
     * Direct hero selection (backup method)
     */
    selectHeroDirect(heroId, heroes) {
        this.audioManager.playSFX('ui_click');
        
        // Update visual selection
        document.querySelectorAll('.hero-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`.hero-card[data-hero-id="${heroId}"]`)?.classList.add('selected');
        
        // Store selected hero
        this.selectedHeroId = heroId;
        
        // Enable start button
        const btnStartRun = document.getElementById('btn-start-run');
        if (btnStartRun) btnStartRun.disabled = false;
        
        // Show hero details
        const hero = heroes.find(h => h.id === heroId);
        if (hero) {
            this.displayHeroDetailsDirect(hero);
        }
    }
    
    /**
     * Direct hero details display (backup method)
     */
    displayHeroDetailsDirect(hero) {
        // Portrait
        const portrait = document.getElementById('hero-portrait');
        if (portrait) {
            portrait.className = `hero-portrait ${hero.id}`;
            portrait.innerHTML = `<div class="hero-portrait-inner"></div>`;
        }
        
        // Text
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setEl('hero-name', hero.name);
        setEl('hero-title', hero.title);
        setEl('hero-desc', hero.description);
        
        // Stats
        const stats = document.getElementById('hero-stats');
        if (stats) {
            stats.innerHTML = `
                <div class="stat-row"><span class="stat-label">HP</span><span class="stat-value">${hero.hp}</span></div>
                <div class="stat-row"><span class="stat-label">Energy</span><span class="stat-value">${hero.energy}</span></div>
                <div class="stat-row"><span class="stat-label">Starting Cards</span><span class="stat-value">${hero.startingDeck?.length || 10}</span></div>
            `;
        }
        
        // Archetypes
        const archetypesEl = document.getElementById('hero-archetypes');
        if (archetypesEl && hero.archetypes?.length) {
            archetypesEl.innerHTML = `
                <h4>Archetypes</h4>
                <div class="archetype-list">
                    ${hero.archetypes.map(a => `
                        <div class="archetype">
                            <span class="archetype-name">${a.name || a}</span>
                            <span class="archetype-desc">${a.description || ''}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    /**
     * Initialize game systems
     */
    initializeSystems() {
        this.corruption = new CorruptionSystem(this.state, this.eventBus);
        this.deck = new DeckManager(this.state, this.eventBus);
        this.combat = new CombatSystem(this.state, this.eventBus, this.deck);
        this.mapGenerator = new MapGenerator(this.state, this.eventBus);
        this.rewards = new RewardSystem(this.state, this.eventBus, this.dataLoader);
        
        // Make systems accessible globally for debugging
        window.game = this;
    }
    
    /**
     * Setup all screen handlers
     */
    setupScreens() {
        setupTitleScreen(this);
        setupHeroSelect(this);
        setupMapScreen(this);
        setupCombatScreen(this);
        setupEventScreen(this);
        setupShopScreen(this);
        setupRestScreen(this);
        setupRewardScreen(this);
    }
    
    /**
     * Preload critical assets
     */
    async preloadAssets() {
        const screensToPreload = ['titlescreen', 'startscreen1', 'heroselect1'];
        
        const imagePromises = screensToPreload.map(screenType => {
            return new Promise((resolve) => {
                const paths = this.getBackgroundFallbacks(screenType);
                this.tryLoadImage(paths, 0, resolve);
            });
        });
        
        await Promise.all(imagePromises);
    }
    
    /**
     * Try to load image from array of paths
     */
    tryLoadImage(paths, index, callback) {
        if (index >= paths.length) {
            console.warn(`[Shattered Star] No valid image found for paths:`, paths);
            callback();
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            console.log(`[Shattered Star] Preloaded: ${paths[index]}`);
            callback();
        };
        img.onerror = () => {
            this.tryLoadImage(paths, index + 1, callback);
        };
        img.src = paths[index];
    }
    
    /**
     * Setup global event listeners
     */
    setupGlobalEvents() {
        // Handle state changes
        this.eventBus.on('corruption:changed', (level) => {
            this.corruption.updateTheme(level);
        });
        
        this.eventBus.on('hp:changed', ({ current, max }) => {
            if (current <= 0) {
                this.handlePlayerDeath();
            }
        });
        
        this.eventBus.on('combat:victory', () => {
            this.handleCombatVictory();
        });
        
        this.eventBus.on('combat:defeat', () => {
            this.handlePlayerDeath();
        });
        
        this.eventBus.on('boss:defeated', () => {
            this.handleBossVictory();
        });
        
        // Handle node selection
        this.eventBus.on('node:selected', (node) => {
            this.handleNodeEnter(node);
        });
        
        // Handle event triggers
        this.eventBus.on('event:complete', () => {
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        });
        
        this.eventBus.on('rest:enter', () => {
            this.screenManager.transitionTo('rest-screen');
        });
        
        this.eventBus.on('shop:enter', () => {
            this.screenManager.transitionTo('shop-screen');
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
        
        // Prevent context menu in game
        document.addEventListener('contextmenu', (e) => {
            if (this.screenManager.currentScreen !== 'title-screen') {
                e.preventDefault();
            }
        });
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.get('runActive')) {
                this.saveManager.quickSave();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = this.detectMobile();
            window.isMobile = this.isMobile;
            
            if (wasMobile !== this.isMobile) {
                this.eventBus.emit('device:changed', { isMobile: this.isMobile });
            }
        });
    }
    
    /**
     * Handle keyboard input
     */
    handleKeyPress(e) {
        if (e.key === 'Escape') {
            const currentScreen = this.screenManager.currentScreen;
            if (currentScreen === 'combat-screen') return;
            if (currentScreen !== 'title-screen' && currentScreen !== 'start-screen') {
                this.openSettingsModal();
            }
        }
        
        if (this.screenManager.currentScreen === 'combat-screen') {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 5) {
                this.combat.selectCardByIndex(num - 1);
            }
            if (e.key === 'e' || e.key === 'E') {
                this.combat.endTurn();
            }
        }
        
        if (e.key === 'd' || e.key === 'D') {
            this.openDeckModal();
        }
    }
    
    /**
     * Start a new run
     */
    startNewRun(heroId) {
        // Use passed heroId or stored selectedHeroId
        const finalHeroId = heroId || this.selectedHeroId;
        console.log(`[Shattered Star] Starting new run with hero: ${finalHeroId}`);
        
        if (!finalHeroId) {
            console.error('[Shattered Star] No hero selected!');
            return;
        }
        
        // Try to initialize run via state manager
        let success = false;
        try {
            success = this.state.initializeRun(finalHeroId, this.dataLoader);
        } catch (e) {
            console.warn('[Shattered Star] initializeRun failed:', e);
        }
        
        // If that failed, use fallback initialization
        if (!success) {
            console.log('[Shattered Star] Using fallback hero initialization');
            this.initializeRunFallback(finalHeroId);
        }
        
        // Generate Act I map
        this.mapGenerator.generateAct(1);
        
        // Save initial state - FIX: Use saveRun() not save()
        try {
            this.saveManager.saveRun();
        } catch (e) {
            console.warn('[Shattered Star] Save failed (might be Private Browsing):', e);
        }
        
        // Transition to intro screen first, then map
        this.showActIntro(1, () => {
            this.screenManager.transitionTo('map-screen');
        });
    }
    
    /**
     * Fallback run initialization if DataLoader fails
     */
    initializeRunFallback(heroId) {
        const hero = MVP_HERO_DATA[heroId];
        if (!hero) {
            console.error(`[Shattered Star] No fallback data for hero: ${heroId}`);
            return;
        }
        
        this.state.reset();
        this.state.state.seed = Date.now();
        this.state.state.runActive = true;
        this.state.state.hero.id = hero.id;
        this.state.state.hero.name = hero.name;
        this.state.state.hero.hp = hero.hp;
        this.state.state.hero.maxHp = hero.hp;
        this.state.state.hero.energy = hero.energy;
        this.state.state.hero.maxEnergy = hero.energy;
        this.state.state.credits = hero.startingCredits || 100;
        
        // Build starting deck from fallback cards
        this.state.state.deck = hero.startingDeck.map((cardId, index) => {
            const card = MVP_CARDS[cardId];
            if (card) {
                return { ...card, instanceId: `card_${Date.now()}_${index}` };
            }
            return {
                id: cardId,
                instanceId: `card_${Date.now()}_${index}`,
                name: cardId.charAt(0).toUpperCase() + cardId.slice(1).replace('_', ' '),
                type: 'attack',
                cost: 1,
                damage: 5,
                description: 'A basic card.'
            };
        });
        
        console.log(`[Shattered Star] Fallback run initialized for ${hero.name}`);
    }
    
    /**
     * Show Act intro
     */
    showActIntro(actNumber, callback) {
        const introScreen = document.getElementById('intro-screen');
        const introText = document.getElementById('intro-text');
        
        if (!introScreen || !introText) {
            callback();
            return;
        }
        
        const actIntros = {
            1: [
                "The Dawnseeker falls from the sky like a dying star.",
                "You awaken amid twisted metal and ash.",
                "The Ironspine Wastes stretch endlessly before you.",
                "Somewhere in this rust desert, answers await.",
                "But so does the void."
            ]
        };
        
        const lines = actIntros[actNumber] || ['The journey continues...'];
        
        this.screenManager.transitionTo('intro-screen');
        
        let lineIndex = 0;
        introText.innerHTML = '';
        
        const showNextLine = () => {
            if (lineIndex < lines.length) {
                const p = document.createElement('p');
                p.textContent = lines[lineIndex];
                p.style.opacity = '0';
                introText.appendChild(p);
                
                setTimeout(() => {
                    p.style.opacity = '1';
                    p.style.transition = 'opacity 0.5s ease';
                }, 100);
                
                lineIndex++;
                setTimeout(showNextLine, 2000);
            } else {
                setTimeout(callback, 1500);
            }
        };
        
        const skipBtn = document.getElementById('btn-skip-intro');
        if (skipBtn) {
            skipBtn.onclick = callback;
        }
        
        setTimeout(showNextLine, 500);
    }
    
    /**
     * Continue existing run
     */
    continueRun() {
        if (this.saveManager.hasSave()) {
            this.saveManager.load();
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Handle entering a node
     */
    handleNodeEnter(node) {
        this.state.set('currentNode', node);
        this.state.set('currentNodeType', node.type);
        
        switch (node.type) {
            case 'combat':
                this.startCombat();
                break;
            case 'elite':
                this.startEliteCombat();
                break;
            case 'boss':
                this.startBossCombat();
                break;
            case 'event':
                this.startEvent();
                break;
            case 'shop':
                this.eventBus.emit('shop:enter');
                break;
            case 'rest':
                this.eventBus.emit('rest:enter');
                break;
            case 'treasure':
                this.openTreasure();
                break;
            default:
                console.warn(`Unknown node type: ${node.type}`);
        }
    }
    
    /**
     * Get fallback enemies
     */
    getFallbackEnemies(type = 'normal') {
        const enemies = {
            normal: [
                { id: 'rustborn_raider', name: 'Rustborn Raider', hp: 20, block: 0, intents: [{ type: 'attack', damage: 6 }] }
            ],
            elite: [
                { id: 'scrap_golem', name: 'Scrap Golem', hp: 45, block: 0, intents: [{ type: 'attack', damage: 12 }, { type: 'defend', block: 8 }] }
            ],
            boss: [
                { id: 'scrap_king', name: 'Scrap-King', hp: 100, block: 0, intents: [{ type: 'attack', damage: 15 }] }
            ]
        };
        return enemies[type] || enemies.normal;
    }
    
    /**
     * Start a standard combat encounter
     */
    startCombat() {
        const act = this.state.get('act') || 1;
        let enemies = null;
        
        try {
            enemies = this.dataLoader.getEnemiesForAct(act, 'normal');
        } catch (e) {
            console.warn('[Shattered Star] Failed to get enemies:', e);
        }
        
        if (!enemies || enemies.length === 0) {
            enemies = this.getFallbackEnemies('normal');
        }
        
        if (enemies && enemies.length > 0) {
            this.combat.startCombat(enemies);
            this.screenManager.transitionTo('combat-screen');
        } else {
            console.error('[Shattered Star] No enemies found');
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Start an elite combat
     */
    startEliteCombat() {
        const act = this.state.get('act') || 1;
        let enemies = null;
        
        try {
            enemies = this.dataLoader.getEnemiesForAct(act, 'elite');
        } catch (e) {
            console.warn('[Shattered Star] Failed to get elite enemies:', e);
        }
        
        if (!enemies || enemies.length === 0) {
            enemies = this.getFallbackEnemies('elite');
        }
        
        if (enemies && enemies.length > 0) {
            this.combat.startCombat(enemies);
            this.screenManager.transitionTo('combat-screen');
        }
    }
    
    /**
     * Start a boss combat
     */
    startBossCombat() {
        const act = this.state.get('act') || 1;
        let boss = null;
        
        try {
            boss = this.dataLoader.getBossForAct(act);
        } catch (e) {
            console.warn('[Shattered Star] Failed to get boss:', e);
        }
        
        if (!boss) {
            boss = this.getFallbackEnemies('boss')[0];
        }
        
        // Show boss intro
        this.showBossIntro(boss, () => {
            this.combat.startCombat([boss]);
            this.screenManager.transitionTo('combat-screen');
        });
    }
    
    /**
     * Show boss intro screen
     */
    showBossIntro(boss, callback) {
        const bossIntroScreen = document.getElementById('boss-intro-screen');
        const bossName = document.getElementById('boss-intro-name');
        const bossTitle = document.getElementById('boss-intro-title');
        
        if (!bossIntroScreen) {
            callback();
            return;
        }
        
        if (bossName) bossName.textContent = boss.name || 'UNKNOWN';
        if (bossTitle) bossTitle.textContent = boss.title || 'Herald of the Void';
        
        this.screenManager.transitionTo('boss-intro-screen');
        
        setTimeout(callback, 3000);
    }
    
    /**
     * Start an event
     */
    startEvent() {
        const act = this.state.get('act') || 1;
        const corruption = this.state.get('corruption') || 0;
        
        let event = null;
        try {
            event = this.dataLoader.getRandomEvent(act, corruption);
        } catch (e) {
            console.warn('[Shattered Star] Failed to get event:', e);
        }
        
        if (event) {
            this.eventBus.emit('event:start', event);
            this.screenManager.transitionTo('event-screen');
        } else {
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Open treasure reward
     */
    openTreasure() {
        let artifact = null;
        try {
            artifact = this.dataLoader.getRandomArtifact('rare');
        } catch (e) {
            console.warn('[Shattered Star] Failed to get artifact:', e);
        }
        
        if (artifact) {
            const artifacts = this.state.get('artifacts') || [];
            artifacts.push(artifact);
            this.state.set('artifacts', artifacts);
            this.eventBus.emit('artifact:gained', artifact);
        }
        
        const credits = this.state.get('credits') || 0;
        this.state.set('credits', credits + 50);
        
        this.mapGenerator.completeCurrentNode();
        this.screenManager.transitionTo('map-screen');
    }
    
    /**
     * Handle player death
     */
    handlePlayerDeath() {
        this.state.set('runActive', false);
        this.saveManager.clearSave();
        
        const stats = this.buildRunStats();
        this.displayGameOver(stats);
        
        this.screenManager.transitionTo('gameover-screen');
    }
    
    /**
     * Handle combat victory
     */
    handleCombatVictory() {
        const nodeType = this.state.get('currentNodeType');
        this.rewards.generateCombatRewards(nodeType);
        this.screenManager.transitionTo('reward-screen');
    }
    
    /**
     * Handle boss victory
     */
    handleBossVictory() {
        const act = this.state.get('act');
        
        if (act >= 3) {
            this.handleVictory();
        } else {
            this.rewards.generateBossRewards(act);
            this.state.set('actComplete', true);
            this.screenManager.transitionTo('victory-screen');
        }
    }
    
    /**
     * Handle full game victory
     */
    handleVictory() {
        this.state.set('runActive', false);
        this.state.set('gameComplete', true);
        
        const stats = this.buildRunStats();
        this.displayVictory(stats);
        
        this.screenManager.transitionTo('victory-screen');
    }
    
    /**
     * Build run statistics
     */
    buildRunStats() {
        return {
            hero: this.state.get('hero.id'),
            floor: this.state.get('floor'),
            act: this.state.get('act'),
            corruption: this.state.get('corruption'),
            cardsPlayed: this.state.get('stats.cardsPlayed') || 0,
            damageDealt: this.state.get('stats.damageDealt') || 0,
            combatsWon: this.state.get('stats.combatsWon') || 0,
            artifactsCollected: (this.state.get('artifacts') || []).length
        };
    }
    
    /**
     * Display game over stats
     */
    displayGameOver(stats) {
        const container = document.getElementById('gameover-stats');
        if (!container) return;
        
        container.innerHTML = `
            <div class="gameover-stat"><span>Hero</span><span>${(stats.hero || 'Unknown').toUpperCase()}</span></div>
            <div class="gameover-stat"><span>Reached Floor</span><span>${stats.floor || 1}</span></div>
            <div class="gameover-stat"><span>Act</span><span>${stats.act || 1}</span></div>
            <div class="gameover-stat"><span>Corruption</span><span>${stats.corruption || 0}%</span></div>
            <div class="gameover-stat"><span>Combats Won</span><span>${stats.combatsWon || 0}</span></div>
        `;
    }
    
    /**
     * Display victory stats
     */
    displayVictory(stats) {
        const container = document.getElementById('victory-content');
        if (!container) return;
        
        container.innerHTML = `<p>You have survived the horrors of Vharos...</p><p>For now.</p>`;
    }
    
    /**
     * Update loading progress
     */
    updateLoadingProgress(percent, text) {
        const progressBar = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (loadingText) loadingText.textContent = text;
    }
    
    /**
     * Open settings modal
     */
    openSettingsModal() {
        document.getElementById('settings-modal')?.classList.add('active');
    }
    
    /**
     * Open deck view modal
     */
    openDeckModal() {
        const deck = this.state.get('deck') || [];
        const container = document.getElementById('deck-view-cards');
        
        if (!container) return;
        
        container.innerHTML = deck.map(card => `
            <div class="card type-${card.type} rarity-${card.rarity}">
                <div class="card-cost">${card.cost}</div>
                <div class="card-type-indicator"></div>
                <div class="card-art">${this.getCardIcon(card.type)}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-description">${card.description}</div>
                <div class="card-footer"><div class="card-rarity-indicator"></div></div>
            </div>
        `).join('');
        
        document.getElementById('deck-modal')?.classList.add('active');
    }
    
    /**
     * Get card icon based on type
     */
    getCardIcon(type) {
        const icons = { attack: '⚔️', skill: '🛡️', power: '⚡', corrupted: '👁️' };
        return icons[type] || '📜';
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = message;
            loadingText.style.color = 'var(--color-hp)';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new ShatteredStar();
    game.init();
});

export { ShatteredStar };
