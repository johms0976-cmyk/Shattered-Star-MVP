/**
 * SHATTERED STAR - Main Entry Point
 * Sci-Fi Noir Cosmic Horror Deckbuilder
 * 
 * @version 0.2.0 MVP
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

/**
 * Main Game Application
 */
class ShatteredStar {
    constructor() {
        this.version = '0.2.0';
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
     * Initialize the game
     */
    async init() {
        console.log(`[Shattered Star] Initializing v${this.version}...`);
        
        try {
            // Update loading progress
            this.updateLoadingProgress(0, 'Loading game data...');
            
            // Load all game data
            await this.dataLoader.preload();
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
            
            this.updateLoadingProgress(100, 'Ready');
            this.initialized = true;
            
            // Set title screen background BEFORE transitioning
            this.setInitialTitleBackground();
            
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
     * Set the title screen background before first transition
     */
    setInitialTitleBackground() {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) {
            const bgPath = this.getBackgroundPath('titlescreen');
            titleScreen.style.backgroundImage = `url('${bgPath}')`;
            titleScreen.style.backgroundSize = 'cover';
            titleScreen.style.backgroundPosition = 'center';
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
        // Preload background images for current device
        const imagesToPreload = [
            this.getBackgroundPath('titlescreen'),
            this.getBackgroundPath('startscreen1'),
            this.getBackgroundPath('heroselect1')
        ];
        
        const imagePromises = imagesToPreload.map(src => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve; // Don't fail on missing images
                img.src = src;
            });
        });
        
        await Promise.all(imagePromises);
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
        
        // Handle node selection - route to appropriate screen
        this.eventBus.on('node:selected', (node) => {
            this.handleNodeEnter(node);
        });
        
        // Handle event triggers
        this.eventBus.on('event:complete', () => {
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        });
        
        // Handle rest/shop triggers
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
        
        // Handle visibility change (pause when hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.get('runActive')) {
                this.saveManager.quickSave();
            }
        });
        
        // Handle window resize for device detection
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = this.detectMobile();
            window.isMobile = this.isMobile;
            
            if (wasMobile !== this.isMobile) {
                // Device type changed - update backgrounds
                this.eventBus.emit('device:changed', { isMobile: this.isMobile });
            }
        });
    }
    
    /**
     * Handle keyboard input
     */
    handleKeyPress(e) {
        // ESC - Open menu or go back
        if (e.key === 'Escape') {
            const currentScreen = this.screenManager.currentScreen;
            if (currentScreen === 'combat-screen') {
                // Can't escape combat
                return;
            }
            if (currentScreen !== 'title-screen' && currentScreen !== 'start-screen') {
                this.openSettingsModal();
            }
        }
        
        // Number keys 1-5 for card selection in combat
        if (this.screenManager.currentScreen === 'combat-screen') {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 5) {
                this.combat.selectCardByIndex(num - 1);
            }
            if (e.key === 'e' || e.key === 'E') {
                this.combat.endTurn();
            }
        }
        
        // D for deck view
        if (e.key === 'd' || e.key === 'D') {
            this.openDeckModal();
        }
    }
    
    /**
     * Start a new run
     */
    startNewRun(heroId) {
        console.log(`[Shattered Star] Starting new run with hero: ${heroId}`);
        
        // Initialize run state
        this.state.initializeRun(heroId, this.dataLoader);
        
        // Generate Act I map
        this.mapGenerator.generateAct(1);
        
        // Save initial state
        this.saveManager.save();
        
        // Transition to map
        this.screenManager.transitionTo('map-screen');
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
     * Start a standard combat encounter
     */
    startCombat() {
        const act = this.state.get('act') || 1;
        const enemies = this.dataLoader.getEnemiesForAct(act, 'normal');
        
        if (enemies && enemies.length > 0) {
            this.combat.startCombat(enemies);
            this.screenManager.transitionTo('combat-screen');
        } else {
            console.error('[Shattered Star] No enemies found for combat');
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Start an elite combat encounter
     */
    startEliteCombat() {
        const act = this.state.get('act') || 1;
        const enemies = this.dataLoader.getEnemiesForAct(act, 'elite');
        
        if (enemies && enemies.length > 0) {
            this.combat.startCombat(enemies);
            this.screenManager.transitionTo('combat-screen');
        } else {
            // Fallback to normal combat if no elites available
            this.startCombat();
        }
    }
    
    /**
     * Start a boss combat encounter
     */
    startBossCombat() {
        const act = this.state.get('act') || 1;
        const boss = this.dataLoader.getBossForAct(act);
        
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
        const bossName = document.getElementById('boss-intro-name');
        const bossTitle = document.getElementById('boss-intro-title');
        
        if (bossName) bossName.textContent = boss.name;
        if (bossTitle) bossTitle.textContent = boss.title || 'Guardian of the Seal';
        
        this.screenManager.transitionTo('boss-intro-screen');
        
        // Auto-advance after delay
        setTimeout(callback, 3000);
    }
    
    /**
     * Start an event encounter
     */
    startEvent() {
        const act = this.state.get('act') || 1;
        const corruption = this.state.get('corruption') || 0;
        
        // Get random event
        const event = this.dataLoader.getRandomEvent(act, corruption);
        
        if (event) {
            this.eventBus.emit('event:start', event);
            this.screenManager.transitionTo('event-screen');
        } else {
            // Fallback - just complete node
            this.mapGenerator.completeCurrentNode();
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Open treasure reward
     */
    openTreasure() {
        // Generate artifact reward
        const artifact = this.dataLoader.getRandomArtifact('rare');
        
        if (artifact) {
            const artifacts = this.state.get('artifacts') || [];
            artifacts.push(artifact);
            this.state.set('artifacts', artifacts);
            this.eventBus.emit('artifact:gained', artifact);
        }
        
        // Credits too
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
        
        // Build death stats
        const stats = this.buildRunStats();
        this.displayGameOver(stats);
        
        this.screenManager.transitionTo('gameover-screen');
    }
    
    /**
     * Handle combat victory
     */
    handleCombatVictory() {
        const nodeType = this.state.get('currentNodeType');
        
        // Generate rewards based on node type
        this.rewards.generateCombatRewards(nodeType);
        
        // Show reward screen
        this.screenManager.transitionTo('reward-screen');
    }
    
    /**
     * Handle boss victory
     */
    handleBossVictory() {
        const act = this.state.get('act');
        
        if (act >= 3) {
            // Game complete!
            this.handleVictory();
        } else {
            // Generate boss rewards
            this.rewards.generateBossRewards(act);
            
            // Mark act as complete
            this.state.set('actComplete', true);
            
            // Show victory screen
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
            <div class="gameover-stat">
                <span>Hero</span>
                <span>${(stats.hero || 'Unknown').toUpperCase()}</span>
            </div>
            <div class="gameover-stat">
                <span>Reached Floor</span>
                <span>${stats.floor || 1}</span>
            </div>
            <div class="gameover-stat">
                <span>Act</span>
                <span>${stats.act || 1}</span>
            </div>
            <div class="gameover-stat">
                <span>Corruption</span>
                <span>${stats.corruption || 0}%</span>
            </div>
            <div class="gameover-stat">
                <span>Combats Won</span>
                <span>${stats.combatsWon || 0}</span>
            </div>
        `;
    }
    
    /**
     * Display victory stats
     */
    displayVictory(stats) {
        const container = document.getElementById('victory-content');
        if (!container) return;
        
        container.innerHTML = `
            <p>You have survived the horrors of Vharos...</p>
            <p>For now.</p>
        `;
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
        
        // Render cards (simplified for MVP)
        container.innerHTML = deck.map(card => `
            <div class="card type-${card.type} rarity-${card.rarity}">
                <div class="card-cost">${card.cost}</div>
                <div class="card-type-indicator"></div>
                <div class="card-art">${this.getCardIcon(card.type)}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-description">${card.description}</div>
                <div class="card-footer">
                    <div class="card-rarity-indicator"></div>
                </div>
            </div>
        `).join('');
        
        document.getElementById('deck-modal')?.classList.add('active');
    }
    
    /**
     * Get card icon based on type
     */
    getCardIcon(type) {
        const icons = {
            attack: '⚔️',
            skill: '🛡️',
            power: '⚡',
            corrupted: '👁️'
        };
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
