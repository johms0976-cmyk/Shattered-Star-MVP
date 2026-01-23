/**
 * SHATTERED STAR - Main Entry Point
 * Sci-Fi Noir Cosmic Horror Deckbuilder
 * 
 * @version 0.1.0 MVP
 */

// Import core systems
import { GameState } from './core/GameState.js';
import { EventBus } from './core/EventBus.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { ScreenManager } from './core/ScreenManager.js';

// Import game systems
import { CombatSystem } from './systems/CombatSystem.js';
import { DeckManager } from './systems/DeckManager.js';
import { MapGenerator } from './systems/MapGenerator.js';
import { CorruptionSystem } from './systems/CorruptionSystem.js';
import { RewardSystem } from './systems/RewardSystem.js';

// Import data loaders
import { DataLoader } from './core/DataLoader.js';

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
        this.version = '0.1.0';
        this.initialized = false;
        
        // Core systems
        this.eventBus = new EventBus();
        this.state = new GameState(this.eventBus);
        this.saveManager = new SaveManager(this.state);
        this.audioManager = new AudioManager();
        this.screenManager = new ScreenManager(this.eventBus);
        this.dataLoader = new DataLoader();
        
        // Game systems (initialized after data load)
        this.combat = null;
        this.deck = null;
        this.mapGenerator = null;
        this.corruption = null;
        this.rewards = null;
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
            await this.dataLoader.loadAll();
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
            if (hasSave) {
                document.getElementById('btn-continue').disabled = false;
            }
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            this.updateLoadingProgress(100, 'Ready');
            this.initialized = true;
            
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
        // For MVP, we'll use placeholder assets
        // This is where we'd load images, audio, etc.
        return Promise.resolve();
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
            if (currentScreen !== 'title-screen') {
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
        
        // Show intro sequence
        this.screenManager.transitionTo('intro-screen');
        this.playIntroSequence();
    }
    
    /**
     * Continue existing run
     */
    continueRun() {
        const saveData = this.saveManager.load();
        if (saveData) {
            this.state.loadFromSave(saveData);
            this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Play intro cutscene
     */
    playIntroSequence() {
        const introText = document.getElementById('intro-text');
        const heroId = this.state.get('hero.id');
        
        // Get intro text for hero
        const introLines = this.getIntroText(heroId);
        
        let currentLine = 0;
        const showNextLine = () => {
            if (currentLine < introLines.length) {
                const p = document.createElement('p');
                p.innerHTML = introLines[currentLine];
                p.style.animationDelay = `${currentLine * 0.5}s`;
                introText.appendChild(p);
                currentLine++;
                setTimeout(showNextLine, 2000);
            } else {
                // Intro complete, go to map
                setTimeout(() => {
                    this.screenManager.transitionTo('map-screen');
                }, 2000);
            }
        };
        
        introText.innerHTML = '';
        showNextLine();
    }
    
    /**
     * Get intro text based on hero
     */
    getIntroText(heroId) {
        const intros = {
            korvax: [
                'The crash tore through your systems like a plasma cutter through flesh.',
                'Warning lights. Error codes. The familiar symphony of failure.',
                'You awaken in rust and ruin. The <span class="highlight">Ironspine Wastes</span> stretch to every horizon.',
                'Somewhere in the static, a signal pulses. <span class="highlight">The Dawnseeker\'s distress beacon.</span>',
                'But something else answers. Something that was waiting.',
                '<span class="highlight">The void remembers you, Korvax.</span>'
            ],
            lyria: [
                'Time shatters around you like glass.',
                'You see the crash. You see it happen. You see it unhappen.',
                'The <span class="highlight">Eclipse Marsh</span> shimmers with impossible reflections.',
                'Past and future blur into a present that refuses to stay still.',
                'The signal that drew you here... you\'ve heard it before. Or will hear it.',
                '<span class="highlight">The Pattern recognizes you, Lyria.</span>'
            ],
            auren: [
                'The light that guided you here has gone dark.',
                'Your faith... you\'re not sure what remains.',
                'The <span class="highlight">Radiant Highlands</span> should feel like home. They don\'t.',
                'Broken temples. Fallen angels. The First Light\'s shadow.',
                'The signal promised answers. It delivered only questions.',
                '<span class="highlight">The void sees through your doubt, Auren.</span>'
            ],
            shade: [
                'Who were you before the crash?',
                'The masks you wore. The faces you stole. All of it... fragments.',
                'The <span class="highlight">Obsidian Thicket</span> whispers your name. Names.',
                'Someone here knows you. Someone remembers what you\'ve forgotten.',
                'The signal called to you specifically. Why?',
                '<span class="highlight">The void knows your true face, Shade.</span>'
            ]
        };
        
        return intros[heroId] || intros.korvax;
    }
    
    /**
     * Handle entering a node based on its type
     */
    handleNodeEnter(node) {
        console.log(`[Shattered Star] Entering node: ${node.type}`);
        
        switch (node.type) {
            case 'combat':
                this.startCombat('normal');
                break;
                
            case 'elite':
                this.startCombat('elite');
                break;
                
            case 'boss':
                this.startBossCombat();
                break;
                
            case 'event':
                this.startEvent();
                break;
                
            case 'shop':
                this.eventBus.emit('shop:enter');
                this.screenManager.transitionTo('shop-screen');
                break;
                
            case 'rest':
                this.eventBus.emit('rest:enter');
                this.screenManager.transitionTo('rest-screen');
                break;
                
            case 'treasure':
                this.openTreasure();
                break;
                
            default:
                console.warn(`Unknown node type: ${node.type}`);
                this.screenManager.transitionTo('map-screen');
        }
    }
    
    /**
     * Start a combat encounter
     */
    startCombat(difficulty = 'normal') {
        // Get enemies based on act and difficulty
        const act = this.state.get('act') || 1;
        const enemies = this.dataLoader.getEnemiesForAct(act, difficulty);
        
        // Start combat
        this.combat.startCombat(enemies);
        this.screenManager.transitionTo('combat-screen');
    }
    
    /**
     * Start boss combat
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
        container.innerHTML = `
            <div class="gameover-stat">
                <span>Hero</span>
                <span>${stats.hero.toUpperCase()}</span>
            </div>
            <div class="gameover-stat">
                <span>Reached Floor</span>
                <span>${stats.floor}</span>
            </div>
            <div class="gameover-stat">
                <span>Act</span>
                <span>${stats.act}</span>
            </div>
            <div class="gameover-stat">
                <span>Corruption</span>
                <span>${stats.corruption}%</span>
            </div>
            <div class="gameover-stat">
                <span>Combats Won</span>
                <span>${stats.combatsWon}</span>
            </div>
        `;
    }
    
    /**
     * Display victory stats
     */
    displayVictory(stats) {
        const container = document.getElementById('victory-content');
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
        document.getElementById('settings-modal').classList.add('active');
    }
    
    /**
     * Open deck view modal
     */
    openDeckModal() {
        const deck = this.state.get('deck') || [];
        const container = document.getElementById('deck-view-cards');
        
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
        
        document.getElementById('deck-modal').classList.add('active');
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
