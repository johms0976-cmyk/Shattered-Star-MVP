/**
 * CombatScreen - Handles turn-based combat
 * FIXED: Properly handles effects array format, empty deck, multiple state paths
 * FIXED: Added intent type CSS classes for proper styling
 * FIXED: Deck persistence - prioritize state deck over DataLoader starter deck
 * FIXED: Intent rendering structure for CSS styling
 * FIXED: Card targeting for single/multiple enemies
 * FIXED: Added deck/discard pile viewing
 * FIXED: Enemy block bug - enemy block now persists through player turn, resets at start of enemy turn
 * ADDED: Boss phase transitions with dialogue overlay and screen shake
 * ADDED: Multi-hit attack support (hits/times), buff/debuff/heal intent execution
 * FIXED: NaN enemy health - robust number validation in normalizeEnemy
 * FIXED: NaN protection in damage calculations for both player and enemy
 * ADDED: BiomeEffects integration (Temporal Flux, Purifying Light, Shifting Faces, etc.)
 * ADDED: CorruptionCurrency void channeling system
 * ADDED: First-person POV perspective — enemies depth-positioned, player area hidden, HUD overlay
 * ADDED: CardPreview system — tap-to-preview, confirm-to-play on mobile (prevents accidental plays)
 * ADDED: Collapsible hero resource bars on mobile (tap to expand/collapse Heat/Rage/Corruption)
 * ADDED: Integration with compact mobile HUD and card token CSS changes
 * @version 0.7.0 — Card preview system, collapsible hero resources, compact mobile HUD
 */

import BiomeEffects from '../systems/BiomeEffects.js';
import CorruptionCurrency from '../systems/CorruptionCurrency.js';
import CardAnimator from '../systems/CardAnimator.js';

// ── Corruption Cascade Systems (Balatro/Inscryption-inspired) ──
import DamageCascadeRenderer from '../systems/DamageCascadeRenderer.js';
import CascadeEventRenderer from '../systems/CascadeEventRenderer.js';
import UnreliableInterface from '../systems/UnreliableInterface.js';

// ── UI/UX Enhancement Systems (mobile-friendly card preview + collapsible resources) ──
import { CardPreview } from '../ui/CardPreview.js';
import { setupHeroResourcesToggle } from '../ui/HeroResourcesToggle.js';

export function setupCombatScreen(game) {
    const screen = document.getElementById('combat-screen');
    
    console.log('[CombatScreen] Setting up combat screen v0.4.0');
    
    // ── BiomeEffects + CorruptionCurrency + CardAnimator ──
    let biomeEffects = null;
    let corruptionCurrency = null;
    let cardAnimator = null;
    
    // ── Corruption Cascade Systems (combat-local) ──
    let damageCascade = null;
    let cascadeRenderer = null;
    let unreliableUI = null;
    
    // ── UI/UX Enhancement Systems ──
    let cardPreview = null;
    
    try {
        biomeEffects = new BiomeEffects(game.state, game.eventBus);
        corruptionCurrency = new CorruptionCurrency(game.state, game.eventBus);
        cardAnimator = new CardAnimator(game.eventBus);
        console.log('[CombatScreen] BiomeEffects + CorruptionCurrency + CardAnimator initialized');
    } catch (e) {
        console.warn('[CombatScreen] Failed to init BiomeEffects/CorruptionCurrency/CardAnimator:', e);
    }
    
    try {
        damageCascade = new DamageCascadeRenderer(game.eventBus);
        cascadeRenderer = new CascadeEventRenderer(game.eventBus);
        unreliableUI = new UnreliableInterface(game.state, game.eventBus);
        console.log('[CombatScreen] Cascade systems initialized');
    } catch (e) {
        console.warn('[CombatScreen] Failed to init cascade systems (non-fatal):', e);
    }
    
    // ── Card Preview System (mobile-friendly tap-to-preview-then-confirm) ──
    try {
        cardPreview = new CardPreview(game);
        console.log('[CombatScreen] CardPreview system initialized');
    } catch (e) {
        console.warn('[CombatScreen] Failed to init CardPreview (non-fatal):', e);
    }
    
    // Wire corruption:draw event → drawCard function
    game.eventBus.on('corruption:draw', (count) => {
        for (let i = 0; i < count; i++) drawCard();
        renderCombatUI();
    });
    
    // Guard to prevent double initialization
    let isInitializing = false;
    let lastInitTime = 0;
    
    // Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'combat-screen') {
            console.log('[CombatScreen] Screen shown, initializing...');
            safeInitializeCombat();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'combat-screen') {
            console.log('[CombatScreen] Screen changed to combat, initializing...');
            safeInitializeCombat();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('combat:start', () => {
        console.log('[CombatScreen] combat:start event received');
        safeInitializeCombat();
    });
    
    // Safe wrapper to prevent double initialization
    function safeInitializeCombat() {
        const now = Date.now();
        if (isInitializing || (now - lastInitTime) < 500) {
            console.log('[CombatScreen] Skipping duplicate initialization');
            return;
        }
        isInitializing = true;
        lastInitTime = now;
        
        try {
            initializeCombat();
        } finally {
            isInitializing = false;
        }
    }
    
    function initializeCombat() {
        console.log('[CombatScreen] ╔══════════════════════════════════════╗');
        console.log('[CombatScreen] ║     INITIALIZING COMBAT              ║');
        console.log('[CombatScreen] ╚══════════════════════════════════════╝');
        
        // Clear any previous combat state flags
        game.state.set('combat.victoryPending', false);
        
        // Get enemies from multiple possible state paths
        let enemies = game.state.get('combat.enemies') 
                   || game.state.get('pendingCombat.enemies')
                   || game.state.get('enemies');
        
        if (!enemies || enemies.length === 0) {
            console.log('[CombatScreen] No enemies in state, generating encounter');
            enemies = generateEncounter();
        }
        
        console.log(`[CombatScreen] Combat with ${enemies.length} enemies:`, enemies.map(e => e.name));
        
        // CRITICAL FIX: Prioritize state deck (which includes reward cards) over DataLoader starter deck
        let deck = getDeckFromState();
        
        if (!deck || deck.length === 0) {
            console.log('[CombatScreen] State deck empty, trying DataLoader starter deck...');
            deck = getDeckFromDataLoader();
        }
        
        if (!deck || deck.length === 0) {
            console.warn('[CombatScreen] No deck found! Generating starter deck...');
            deck = generateStarterDeck();
        }
        
        // Normalize card properties (convert effects array to direct properties)
        deck = deck.map(card => normalizeCard(card));
        
        // Store deck in state for other systems
        game.state.set('deck', deck);
        
        console.log(`[CombatScreen] Deck has ${deck.length} cards`);
        console.log(`[CombatScreen] Deck contents:`, deck.map(c => c.name));
        
        // Initialize combat state
        initializeCombatState(enemies, deck);
        
        // FIXED: Wait for DOM to be ready before rendering
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log('[CombatScreen] DOM should be ready, rendering UI...');
                setupCombatBackground();
                // First-person POV: hero sprite hidden, skip setup
                // setupHeroSprite();
                renderCombatUI();
                setupCombatButtons();
                setupPileViewers();
                console.log('[CombatScreen] Combat initialization complete');
            }, 50);
        });
    }
    
    /**
     * Setup layered combat background based on current act
     * Layers: far (sky/landscape), mid (architecture), floor (ground plane)
     */
    function setupCombatBackground() {
        const act = game.state.get('act') || 1;
        const variant = game.state.get('combat.bgVariant') || 'day1';
        const basePath = `./assets/images/backgrounds/combat/act${act}/${variant}`;
        
        console.log(`[CombatScreen] Setting up background: act${act}/${variant}`);
        
        // Remove any existing background layers
        const existing = screen.querySelector('.combat-bg-layers');
        if (existing) existing.remove();
        
        // Create the three-layer background container
        const bgLayers = document.createElement('div');
        bgLayers.className = 'combat-bg-layers';
        bgLayers.innerHTML = `
            <div class="combat-bg-layer combat-bg-far"></div>
            <div class="combat-bg-layer combat-bg-mid"></div>
            <div class="combat-bg-layer combat-bg-floor"></div>
        `;
        
        // Insert as first child so all combat content renders on top
        const container = screen.querySelector('.combat-container') || screen;
        container.insertBefore(bgLayers, container.firstChild);
        
        // Load each layer with fallback
        const layers = [
            { el: bgLayers.querySelector('.combat-bg-far'),   file: `act${act}_far.PNG` },
            { el: bgLayers.querySelector('.combat-bg-mid'),   file: `act${act}_mid.PNG` },
            { el: bgLayers.querySelector('.combat-bg-floor'), file: `act${act}_floor.PNG` }
        ];
        
        layers.forEach(({ el, file }) => {
            const img = new Image();
            img.onload = () => {
                el.style.backgroundImage = `url('${basePath}/${file}')`;
                el.classList.add('loaded');
                console.log(`[CombatScreen] BG layer loaded: ${file}`);
            };
            img.onerror = () => {
                console.warn(`[CombatScreen] BG layer not found: ${basePath}/${file}`);
            };
            img.src = `${basePath}/${file}`;
        });
    }
    
    // ═══════════════════════════════════════════
    // SPRITE PATH MAPPING
    // Maps enemy IDs → folder/filename in assets/images/enemies/
    // ═══════════════════════════════════════════
    
    const ENEMY_SPRITE_MAP = {
        'rustborn_raider':       'rustbornraider/rustborn_raider.png',
        'scrap_golem':           'scrapgolem/scrap_golem.png',
        'sand_crawler':          'sandcrawler/sand_crawler.png',
        'rust_prophet':          'rustprophet/rust_prophet.png',
        'feral_titan_shard':     'feraltitanshard/feral_titan_shard.png',
        'scrap_kings_champion':  'scrapkingchampion/scrap_kings_champion.png',
        'corrupted_scavenger':   'corruptedscavenger/corrupted_scavenger.png',
        'scrap_king':            'scrapking/scrap_king.png'
    };
    
    const HERO_SPRITE_MAP = {
        'korvax': 'assets/images/heroes/korvax/background/korvax_idle.png'
    };
    
    /**
     * Get sprite image path for an enemy, with fallback
     */
    function getEnemySpritePath(enemy) {
        const id = (enemy.id || '').replace(/_\d+$/, ''); // strip instance suffixes like _1234
        if (ENEMY_SPRITE_MAP[id]) {
            return `./assets/images/enemies/${ENEMY_SPRITE_MAP[id]}`;
        }
        // Fallback: try to derive path from id
        const folder = id.replace(/_/g, '');
        return `./assets/images/enemies/${folder}/${id}.png`;
    }
    
    /**
     * Get sprite image path for the current hero
     */
    function getHeroSpritePath() {
        const heroId = game.state.get('hero.id') || 'korvax';
        return HERO_SPRITE_MAP[heroId] || `./assets/images/heroes/${heroId}/background/${heroId}_idle.png`;
    }
    
    /**
     * Setup hero sprite in the player area
     */
    function setupHeroSprite() {
        const playerSprite = screen.querySelector('.player-sprite');
        if (!playerSprite) return;
        
        const spritePath = getHeroSpritePath();
        const img = new Image();
        img.onload = () => {
            playerSprite.innerHTML = `<img src="${spritePath}" alt="Hero" class="hero-sprite-img" />`;
            playerSprite.classList.add('has-sprite');
            console.log(`[CombatScreen] Hero sprite loaded: ${spritePath}`);
        };
        img.onerror = () => {
            console.warn(`[CombatScreen] Hero sprite not found: ${spritePath}, using placeholder`);
            playerSprite.innerHTML = '<div class="hero-placeholder">⚔️</div>';
        };
        img.src = spritePath;
    }
    
    /**
     * Try to get deck from DataLoader.getStarterDeck()
     */
    function getDeckFromDataLoader() {
        const heroId = game.state.get('hero.id') || 'korvax';
        
        try {
            if (game.dataLoader && typeof game.dataLoader.getStarterDeck === 'function') {
                const deck = game.dataLoader.getStarterDeck(heroId);
                if (deck && deck.length > 0) {
                    console.log(`[CombatScreen] Got STARTER deck from DataLoader: ${deck.length} cards`);
                    return deck;
                }
            }
        } catch (e) {
            console.warn('[CombatScreen] DataLoader.getStarterDeck failed:', e);
        }
        
        return null;
    }
    
    /**
     * Get deck from multiple possible state paths
     */
    function getDeckFromState() {
        const paths = ['deck', 'hero.deck', 'player.deck', 'combat.deck'];
        
        for (const path of paths) {
            const deck = game.state.get(path);
            if (deck && Array.isArray(deck) && deck.length > 0) {
                console.log(`[CombatScreen] Found deck at '${path}' with ${deck.length} cards`);
                return [...deck];
            }
        }
        
        // Check DeckManager
        if (game.deck && game.deck.fullDeck && game.deck.fullDeck.length > 0) {
            console.log(`[CombatScreen] Found deck in DeckManager: ${game.deck.fullDeck.length} cards`);
            return [...game.deck.fullDeck];
        }
        
        if (game.deck && game.deck.deck && game.deck.deck.length > 0) {
            console.log(`[CombatScreen] Found deck in DeckManager.deck: ${game.deck.deck.length} cards`);
            return [...game.deck.deck];
        }
        
        return null;
    }
    
    /**
     * Normalize card properties - convert effects array to direct properties
     */
    /**
     * Normalize card properties - convert effects array to direct properties
     * FIXED: For upgraded cards, direct properties (damage, block, etc.) already have boosted values.
     * Only fill in from effects array if the property isn't already set on the card.
     */
    function normalizeCard(card) {
        const normalized = { ...card };
        
        if (!normalized.instanceId) {
            normalized.instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        if (card.effects && Array.isArray(card.effects)) {
            card.effects.forEach(effect => {
                switch (effect.type) {
                    case 'damage':
                        // Only set from effects if not already present (preserves upgraded values)
                        if (normalized.damage === undefined) {
                            if (typeof effect.value === 'number') normalized.damage = effect.value;
                            else if (effect.value === 'block') normalized.damage = 'block'; // Body Slam
                            else if (effect.value === 'corruption') normalized.damage = 'corruption'; // Corruption Pulse
                            else if (effect.value === 'block_plus_judgment') normalized.damage = 'special'; // Final Absolution
                        }
                        // Scaling info (Fuel the Fire, Meltdown, Titan's Wrath)
                        if (effect.scaling) {
                            normalized._damageScaling = effect.scaling;
                        }
                        // Multi-hit from effects (Pummel)
                        if (effect.hits && normalized.hits === undefined) normalized.hits = effect.hits;
                        // Lifesteal (Reaper)
                        if (effect.lifesteal) normalized.lifesteal = true;
                        // Conditional damage (Rage Spike)
                        if (effect.conditional) normalized._damageConditional = effect.conditional;
                        // AoE target (Cleave, Reactor Breach)
                        if (effect.target === 'all') normalized.targetAllDamage = true;
                        break;
                    case 'block':
                    case 'block_gain':
                        if (normalized.block === undefined) {
                            if (typeof effect.value === 'number') normalized.block = effect.value;
                            else if (effect.value === 'overheat') normalized.block = 'overheat'; // Vent Heat
                            else if (effect.value === 'missing_hp') normalized.block = 'missing_hp'; // Second Wind
                        }
                        break;
                    case 'draw':
                        if (typeof effect.value === 'number' && normalized.draw === undefined) normalized.draw = effect.value;
                        break;
                    case 'energy':
                        if (typeof effect.value === 'number' && normalized.energyGain === undefined) normalized.energyGain = effect.value;
                        break;
                    case 'self_damage':
                        if (normalized.selfDamage === undefined) normalized.selfDamage = effect.value;
                        break;
                    case 'vulnerable':
                    case 'vulnerability':
                        if (normalized.applyVulnerable === undefined) normalized.applyVulnerable = effect.value;
                        break;
                    case 'weak':
                        if (normalized.applyWeak === undefined) normalized.applyWeak = effect.value;
                        break;
                    case 'strength':
                        if (normalized.strengthGain === undefined) normalized.strengthGain = effect.value;
                        break;
                    case 'heal':
                        if (normalized.heal === undefined) normalized.heal = effect.value;
                        break;
                    case 'poison':
                        if (normalized.applyPoison === undefined) normalized.applyPoison = effect.value;
                        break;
                    case 'bleed':
                        if (normalized.applyBleed === undefined) normalized.applyBleed = effect.value;
                        break;
                    case 'burn':
                        if (normalized.applyBurn === undefined) normalized.applyBurn = effect.value;
                        break;
                    case 'frail':
                        if (normalized.applyFrail === undefined) normalized.applyFrail = effect.value;
                        break;
                    case 'regen':
                        if (normalized.applyRegen === undefined) normalized.applyRegen = effect.value;
                        break;
                    case 'overheat':
                        if (normalized.overheatGain === undefined) normalized.overheatGain = effect.value;
                        break;
                    case 'overheat_reduce':
                        if (normalized.overheatReduce === undefined) normalized.overheatReduce = effect.value;
                        break;
                    case 'reset_overheat':
                        normalized.resetOverheat = true;
                        break;
                    case 'dexterity':
                        if (normalized.dexterityGain === undefined) normalized.dexterityGain = effect.value;
                        break;
                    case 'rage':
                        if (normalized.rageGain === undefined) normalized.rageGain = effect.value;
                        break;
                    case 'armor':
                    case 'armour':
                    case 'armor_plating':
                        if (normalized.armorGain === undefined) normalized.armorGain = effect.value;
                        break;
                    case 'thorns':
                        if (normalized.thornsGain === undefined) normalized.thornsGain = effect.value;
                        break;
                    case 'counter':
                        if (normalized.counterGain === undefined) normalized.counterGain = effect.value;
                        break;
                    case 'stun':
                        if (normalized.applyStun === undefined) normalized.applyStun = effect.value;
                        break;
                    case 'slow':
                        if (normalized.applySlow === undefined) normalized.applySlow = effect.value;
                        break;
                    case 'intangible':
                        if (normalized.applyIntangible === undefined) normalized.applyIntangible = effect.value;
                        break;
                    case 'corruption':
                        if (normalized.corruptionGain === undefined) normalized.corruptionGain = effect.value;
                        break;
                    case 'judgment':
                        if (normalized.judgmentGain === undefined) normalized.judgmentGain = effect.value;
                        break;
                    case 'trigger':
                        // Store trigger effects for power cards
                        if (!normalized.triggers) normalized.triggers = [];
                        normalized.triggers.push(effect);
                        break;
                    // ── "type":"status" — the JSON format used by most cards ──
                    case 'status': {
                        const sName = effect.status;
                        const sTarget = effect.target || 'self';
                        const isEnemy = sTarget === 'enemy' || sTarget === 'all_enemies';
                        if (isEnemy) {
                            switch (sName) {
                                case 'vulnerable': normalized.applyVulnerable = (normalized.applyVulnerable || 0) + effect.value; break;
                                case 'weak': normalized.applyWeak = (normalized.applyWeak || 0) + effect.value; break;
                                case 'poison': normalized.applyPoison = (normalized.applyPoison || 0) + effect.value; break;
                                case 'bleed': normalized.applyBleed = (normalized.applyBleed || 0) + effect.value; break;
                                case 'burn': normalized.applyBurn = (normalized.applyBurn || 0) + effect.value; break;
                                case 'stun': normalized.applyStun = (normalized.applyStun || 0) + effect.value; break;
                                case 'slow': normalized.applySlow = (normalized.applySlow || 0) + effect.value; break;
                                case 'strength':
                                    // Negative strength on enemies (Piercing Wail)
                                    if (!normalized._enemyStrength) normalized._enemyStrength = [];
                                    normalized._enemyStrength.push({ value: effect.value, duration: effect.duration });
                                    break;
                                default: console.log(`[normalizeCard] Unhandled enemy status: ${sName}`); break;
                            }
                            if (sTarget === 'all_enemies') normalized.targetAllEnemies = true;
                        } else {
                            switch (sName) {
                                case 'overheat': normalized.overheatGain = (normalized.overheatGain || 0) + effect.value; break;
                                case 'rage': normalized.rageGain = (normalized.rageGain || 0) + effect.value; break;
                                case 'strength': normalized.strengthGain = (normalized.strengthGain || 0) + effect.value; break;
                                case 'dexterity': normalized.dexterityGain = (normalized.dexterityGain || 0) + effect.value; break;
                                case 'armor': normalized.armorGain = (normalized.armorGain || 0) + effect.value; break;
                                case 'thorns': normalized.thornsGain = (normalized.thornsGain || 0) + effect.value; break;
                                case 'counter': normalized.counterGain = (normalized.counterGain || 0) + effect.value; break;
                                case 'intangible': normalized.applyIntangible = (normalized.applyIntangible || 0) + effect.value; break;
                                case 'artifact': normalized.artifactGain = (normalized.artifactGain || 0) + effect.value; break;
                                case 'vulnerable': normalized.applySelfVulnerable = (normalized.applySelfVulnerable || 0) + effect.value; break;
                                case 'weak': normalized.applySelfWeak = (normalized.applySelfWeak || 0) + effect.value; break;
                                case 'frail': normalized.applyFrail = (normalized.applyFrail || 0) + effect.value; break;
                                case 'regen': normalized.applyRegen = (normalized.applyRegen || 0) + effect.value; break;
                                case 'no_draw': normalized.noDrawThisTurn = true; break;
                                default: console.log(`[normalizeCard] Unhandled self status: ${sName}`); break;
                            }
                        }
                        break;
                    }
                    // ── "type":"passive" — power card triggers (turn_start, turn_end, etc.) ──
                    case 'passive': {
                        if (!normalized.triggers) normalized.triggers = [];
                        normalized.triggers.push(effect);
                        break;
                    }
                    // ── Reset a status to 0 (Vent Heat, Meltdown) ──
                    case 'reset_status': {
                        if (!normalized._resetStatuses) normalized._resetStatuses = [];
                        normalized._resetStatuses.push(effect.status);
                        break;
                    }
                    // ── Double a status (Limit Break) ──
                    case 'double_status': {
                        if (!normalized._doubleStatuses) normalized._doubleStatuses = [];
                        normalized._doubleStatuses.push(effect.status);
                        break;
                    }
                    // ── Upgrade all cards in combat (Apotheosis) ──
                    case 'upgrade_all':
                        normalized.upgradeAllCards = true;
                        break;
                    // ── Conditional effects (Bloodlust: if enemy dies, gain rage) ──
                    case 'conditional': {
                        if (!normalized._conditionals) normalized._conditionals = [];
                        normalized._conditionals.push(effect);
                        break;
                    }
                    // ── Max HP gain (Feed) ──
                    case 'max_hp':
                        normalized.maxHpGain = (normalized.maxHpGain || 0) + effect.value;
                        break;
                    // Hero-specific complex types handled directly in applyCardEffects via effects array
                    case 'astral_charge':
                    case 'temporal_flux':
                    case 'consume_astral':
                    case 'consume_astral_charge':
                    case 'block_to_judgment':
                    case 'consume_judgment':
                    case 'corruption_per_combat':
                    case 'energy_per_turn':
                    case 'damage_per_turn':
                    case 'block_per_turn':
                    case 'draw_per_turn':
                    case 'judgment_per_turn':
                    case 'discard':
                    case 'discard_hand':
                    case 'put_on_top':
                    case 'draw_type':
                    case 'draw_conditional':
                    case 'cost_reduction':
                    case 'return_discard':
                        break; // preserved in effects array for applyCardEffects
                    default:
                        console.log(`[CombatScreen] normalizeCard: unhandled effect type '${effect.type}' on card '${card.name || card.id}'`);
                        break;
                }
            });
        }
        
        // Multi-hit support
        if (card.hits && normalized.hits === undefined) normalized.hits = card.hits;
        if (card.times && normalized.hits === undefined) normalized.hits = card.times;
        
        return normalized;
    }
    
    /**
     * Determine if a card needs an enemy target
     * This includes attack cards AND skill cards that apply debuffs to enemies
     */
    function cardNeedsEnemyTarget(card) {
        // Attack cards always need a target
        if (card.type === 'attack') return true;
        if (card.damage > 0) return true;
        if (card.targetRequired) return true;
        
        // Skill/power cards that apply enemy debuffs need a target
        if (card.applyVulnerable) return true;
        if (card.applyWeak) return true;
        if (card.applyPoison) return true;
        if (card.applyBleed) return true;
        if (card.applyBurn) return true;
        if (card.applyStun) return true;
        if (card.applySlow) return true;
        
        // Check effects array for enemy-targeted effects
        if (card.effects && Array.isArray(card.effects)) {
            const enemyTargetedTypes = ['vulnerable', 'weak', 'poison', 'bleed', 'burn', 'stun', 'slow'];
            if (card.effects.some(e => enemyTargetedTypes.includes(e.type) && e.target !== 'self')) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Generate a starter deck as fallback
     */
    function generateStarterDeck() {
        const heroId = game.state.get('hero.id') || 'korvax';
        console.log(`[CombatScreen] Generating fallback starter deck for: ${heroId}`);
        
        const timestamp = Date.now();
        const deck = [];
        
        for (let i = 0; i < 5; i++) {
            deck.push({
                id: 'strike',
                instanceId: `strike_${timestamp}_${i}`,
                name: 'Strike',
                type: 'attack',
                cost: 1,
                damage: 6,
                rarity: 'starter',
                description: 'Deal 6 damage.',
                effects: [{type: 'damage', value: 6}]
            });
        }
        
        for (let i = 0; i < 4; i++) {
            deck.push({
                id: 'defend',
                instanceId: `defend_${timestamp}_${i}`,
                name: 'Defend',
                type: 'skill',
                cost: 1,
                block: 5,
                rarity: 'starter',
                description: 'Gain 5 Block.',
                effects: [{type: 'block', value: 5}]
            });
        }
        
        deck.push({
            id: 'bash',
            instanceId: `bash_${timestamp}`,
            name: 'Bash',
            type: 'attack',
            cost: 2,
            damage: 8,
            applyVulnerable: 2,
            rarity: 'starter',
            description: 'Deal 8 damage. Apply 2 Vulnerable.',
            effects: [{type: 'damage', value: 8}, {type: 'vulnerable', value: 2}]
        });
        
        return deck;
    }
    
    function generateEncounter() {
        const act = game.state.get('act') || 1;
        
        try {
            if (game.dataLoader) {
                if (typeof game.dataLoader.getRandomEncounter === 'function') {
                    const encounter = game.dataLoader.getRandomEncounter(act, 'normal');
                    if (encounter && encounter.length > 0) {
                        return encounter.map(normalizeEnemy);
                    }
                }
                if (typeof game.dataLoader.getEnemiesForAct === 'function') {
                    const enemies = game.dataLoader.getEnemiesForAct(act, 'normal');
                    if (enemies && enemies.length > 0) {
                        return enemies.map(normalizeEnemy);
                    }
                }
            }
        } catch (e) {
            console.warn('[CombatScreen] Failed to get encounter:', e);
        }
        
        return [normalizeEnemy({
            id: 'wasteland_scavenger_' + Date.now(),
            name: 'Wasteland Scavenger',
            hp: 25,
            maxHp: 25,
            intents: [{type: 'attack', damage: 8}]
        })];
    }
    
    function normalizeEnemy(enemy) {
        // Safely parse hp values - handle undefined, null, strings, NaN
        const rawMaxHp = enemy.maxHp ?? enemy.hp ?? enemy.health ?? enemy.max_hp ?? 30;
        const rawCurrentHp = enemy.currentHp ?? enemy.hp ?? enemy.health ?? rawMaxHp;
        
        const maxHp = (Number.isFinite(Number(rawMaxHp)) && Number(rawMaxHp) > 0) ? Number(rawMaxHp) : 30;
        const currentHp = (Number.isFinite(Number(rawCurrentHp)) && Number(rawCurrentHp) > 0) ? Number(rawCurrentHp) : maxHp;
        
        console.log(`[CombatScreen] normalizeEnemy: ${enemy.name || 'Unknown'} hp=${currentHp}/${maxHp} (raw: currentHp=${enemy.currentHp}, hp=${enemy.hp}, maxHp=${enemy.maxHp})`);
        
        return {
            ...enemy,
            currentHp,
            maxHp,
            block: Number(enemy.block) || 0,
            vulnerable: Number(enemy.vulnerable) || 0,
            weak: Number(enemy.weak) || 0,
            intent: enemy.intent || (enemy.intents && enemy.intents.length > 0 ? { ...enemy.intents[0] } : { type: 'attack', damage: 8 })
        };
    }
    
    // ═══════════════════════════════════════════
    // STATUS EFFECT PROCESSING SYSTEM
    // Handles DoTs, buffs, debuffs for player + enemies
    // ═══════════════════════════════════════════
    
    /**
     * Get a player status value (debuffs and buffs tracked in combat.status.*)
     */
    function getPlayerStatus(id) {
        return game.state.get(`combat.status.${id}`) || 0;
    }
    function setPlayerStatus(id, value) {
        game.state.set(`combat.status.${id}`, Math.max(0, value));
    }
    function addPlayerStatus(id, amount) {
        const current = getPlayerStatus(id);
        setPlayerStatus(id, current + amount);
        console.log(`[CombatScreen] Player status ${id}: ${current} → ${current + amount}`);
        game.eventBus.emit('status:applied', { target: 'player', effect: id, value: amount, total: current + amount });
    }
    
    /**
     * Calculate player outgoing damage with all modifiers
     */
    function calculatePlayerDamage(baseDamage) {
        let damage = baseDamage;
        
        // Add strength
        const strength = game.state.get('combat.strength') || 0;
        damage += strength;
        
        // Add rage (Korvax)
        const rage = game.state.get('combat.rage') || 0;
        damage += rage;
        
        // Add overheat damage bonus (Korvax: +2 at 5+ heat)
        const overheat = game.state.get('combat.overheat') || 0;
        if (overheat >= 5) {
            damage += 2;
        }
        
        // Apply relic bonuses
        damage += getRelicBonus('strength');
        
        // Weak reduces outgoing damage by 25%
        if (getPlayerStatus('weak') > 0) {
            damage = Math.floor(damage * 0.75);
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Calculate player block gain with all modifiers
     */
    function calculatePlayerBlock(baseBlock) {
        let block = baseBlock;
        
        // Add dexterity
        const dex = game.state.get('combat.dexterity') || 0;
        block += dex;
        
        // Add relic bonuses
        block += getRelicBonus('dexterity');
        
        // Frail reduces block gain by 25%
        if (getPlayerStatus('frail') > 0) {
            block = Math.floor(block * 0.75);
        }
        
        return Math.max(0, block);
    }
    
    /**
     * Calculate incoming damage to player with all modifiers
     */
    function calculateIncomingDamage(baseDamage) {
        let damage = baseDamage;
        
        // Intangible reduces ALL damage to 1
        const intangible = game.state.get('combat.intangible') || 0;
        if (intangible > 0) {
            return 1;
        }
        
        // Vulnerable increases incoming damage by 50%
        if (getPlayerStatus('vulnerable') > 0) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Permanent armor reduction (Korvax)
        const armor = game.state.get('combat.armor') || 0;
        if (armor > 0) {
            damage = Math.max(0, damage - armor);
        }
        
        // Relic armor reduction
        const armorBonus = getRelicBonus('armor');
        if (armorBonus > 0) {
            damage = Math.max(0, damage - armorBonus);
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Process end-of-turn status effects for the player (called before enemy turn)
     */
    function processPlayerEndOfTurnStatuses() {
        let playerHp = game.state.get('hero.hp') || 50;
        const maxHp = game.state.get('hero.maxHp') || 80;
        let totalDot = 0;
        
        // ── Poison: damage equal to stacks, decrease by 1 ──
        const poison = getPlayerStatus('poison');
        if (poison > 0) {
            totalDot += poison;
            setPlayerStatus('poison', poison - 1);
            console.log(`[CombatScreen] Poison ticks for ${poison} damage (${poison - 1} remaining)`);
        }
        
        // ── Bleed: damage equal to stacks, decrease by 1 ──
        const bleed = getPlayerStatus('bleed');
        if (bleed > 0) {
            totalDot += bleed;
            setPlayerStatus('bleed', bleed - 1);
            console.log(`[CombatScreen] Bleed ticks for ${bleed} damage (${bleed - 1} remaining)`);
        }
        
        // ── Burn: damage equal to stacks, halve stacks ──
        const burn = getPlayerStatus('burn');
        if (burn > 0) {
            totalDot += burn;
            setPlayerStatus('burn', Math.floor(burn / 2));
            console.log(`[CombatScreen] Burn ticks for ${burn} damage (${Math.floor(burn / 2)} remaining)`);
        }
        
        // Apply DoT damage (bypasses block)
        if (totalDot > 0) {
            playerHp = Math.max(0, playerHp - totalDot);
            game.state.set('hero.hp', playerHp);
            game.state.set('hero.hp', playerHp);
            console.log(`[CombatScreen] Player takes ${totalDot} DoT damage (HP: ${playerHp})`);
            game.eventBus.emit('player:dot', { amount: totalDot, hp: playerHp });
        }
        
        // ── Regen: heal equal to stacks, decrease by 1 ──
        const regen = getPlayerStatus('regen');
        if (regen > 0) {
            const healAmount = Math.min(regen, maxHp - playerHp);
            playerHp = Math.min(maxHp, playerHp + regen);
            game.state.set('hero.hp', playerHp);
            game.state.set('hero.hp', playerHp);
            setPlayerStatus('regen', regen - 1);
            console.log(`[CombatScreen] Regen heals ${healAmount} (HP: ${playerHp}, ${regen - 1} remaining)`);
        }
        
        // ── Tick down duration-based statuses ──
        const durationStatuses = ['vulnerable', 'weak', 'frail', 'stun', 'slow'];
        durationStatuses.forEach(id => {
            const val = getPlayerStatus(id);
            if (val > 0) {
                setPlayerStatus(id, val - 1);
                console.log(`[CombatScreen] Player ${id} ticks down: ${val} → ${val - 1}`);
            }
        });
        
        // ── Overheat self-damage at 10+ (Korvax) ──
        const overheat = game.state.get('combat.overheat') || 0;
        if (overheat >= 10 && overheat < 15) {
            const heatDamage = 3;
            playerHp = Math.max(0, playerHp - heatDamage);
            game.state.set('hero.hp', playerHp);
            game.state.set('hero.hp', playerHp);
            console.log(`[CombatScreen] Overheat burns for ${heatDamage} (heat: ${overheat}, HP: ${playerHp})`);
            showStatusFloater('player', '🌡️', `-${heatDamage} Overheat`, '#ff4400');
        }
        
        // ── Counter resets each turn ──
        if ((game.state.get('combat.counter') || 0) > 0) {
            game.state.set('combat.counter', 0);
            console.log('[CombatScreen] Counter reset');
        }
        
        // ── Intangible ticks down ──
        const intangible = game.state.get('combat.intangible') || 0;
        if (intangible > 0) {
            game.state.set('combat.intangible', intangible - 1);
            console.log(`[CombatScreen] Intangible ticks: ${intangible} → ${intangible - 1}`);
        }
        
        // ══════ PROCESS POWER CARD TRIGGERS: turn_end ══════
        const triggers = game.state.get('combat.triggers') || [];
        if (triggers.length > 0) {
            const enemies = game.state.get('combat.enemies') || [];
            triggers.forEach(trigger => {
                if (trigger.trigger !== 'turn_end') return;
                try {
                    const applies = Array.isArray(trigger.apply) ? trigger.apply : [trigger.apply];
                    applies.forEach(applyEffect => {
                        if (!applyEffect) return;
                        switch (applyEffect.type) {
                            case 'block': {
                                const block = calculatePlayerBlock(applyEffect.value || 0);
                                const cb = game.state.get('combat.block') || 0;
                                game.state.set('combat.block', cb + block);
                                console.log(`[CombatScreen] Power trigger: +${block} Block (turn_end)`);
                                showStatusFloater('player', '🛡️', `+${block} Block`, '#4488ff');
                                break;
                            }
                            case 'self_damage': {
                                const selfDmg = applyEffect.value || 1;
                                playerHp = Math.max(1, playerHp - selfDmg);
                                game.state.set('hero.hp', playerHp);
                                console.log(`[CombatScreen] Power trigger: -${selfDmg} HP (turn_end)`);
                                break;
                            }
                            case 'damage': {
                                const target = applyEffect.target || 'enemy';
                                if (target === 'all') {
                                    enemies.forEach(enemy => {
                                        if (enemy.currentHp <= 0) return;
                                        const dmg = applyEffect.value || 5;
                                        enemy.currentHp = Math.max(0, enemy.currentHp - dmg);
                                        console.log(`[CombatScreen] Power trigger: ${dmg} damage to ${enemy.name} (turn_end)`);
                                    });
                                    // Remove dead
                                    const deadFromPower = enemies.filter(e => e.currentHp <= 0);
                                    deadFromPower.forEach(e => {
                                        console.log(`[CombatScreen] ☠ ${e.name} killed by power trigger!`);
                                        game.eventBus.emit('enemy:defeated', e);
                                    });
                                    const alive = enemies.filter(e => e.currentHp > 0);
                                    enemies.length = 0;
                                    enemies.push(...alive);
                                    game.state.set('combat.enemies', enemies);
                                }
                                break;
                            }
                            case 'status': {
                                const sName = applyEffect.status;
                                if (applyEffect.target === 'self' || !applyEffect.target) {
                                    addPlayerStatus(sName, applyEffect.value || 1);
                                    console.log(`[CombatScreen] Power trigger: +${applyEffect.value} ${sName} (turn_end)`);
                                }
                                break;
                            }
                            default:
                                console.log(`[CombatScreen] Unhandled turn_end trigger type: ${applyEffect.type}`);
                        }
                    });
                } catch (e) {
                    console.warn('[CombatScreen] Turn end trigger failed:', e);
                }
            });
        }
        
        return playerHp;
    }
    
    /**
     * Process end-of-turn status effects for enemies (called at end of enemy turn)
     */
    function processEnemyEndOfTurnStatuses(enemies) {
        enemies.forEach(enemy => {
            if (enemy.currentHp <= 0) return;
            
            let totalDot = 0;
            
            // Poison
            if (enemy.poison > 0) {
                totalDot += enemy.poison;
                enemy.poison -= 1;
                console.log(`[CombatScreen] ${enemy.name} poison: ${totalDot} dmg (${enemy.poison} left)`);
            }
            
            // Bleed
            if (enemy.bleed > 0) {
                totalDot += enemy.bleed;
                enemy.bleed -= 1;
                console.log(`[CombatScreen] ${enemy.name} bleed: ${enemy.bleed + 1} dmg (${enemy.bleed} left)`);
            }
            
            // Burn
            if (enemy.burn > 0) {
                totalDot += enemy.burn;
                enemy.burn = Math.floor(enemy.burn / 2);
                console.log(`[CombatScreen] ${enemy.name} burn: ${totalDot} dmg (${enemy.burn} left)`);
            }
            
            if (totalDot > 0) {
                enemy.currentHp = Math.max(0, enemy.currentHp - totalDot);
                game.eventBus.emit('enemy:dot', { enemy, amount: totalDot });
            }
            
            // Regen
            if (enemy.regen > 0) {
                enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + enemy.regen);
                enemy.regen -= 1;
            }
        });
        
        // Remove dead enemies from DoTs
        const deadFromDots = enemies.filter(e => e.currentHp <= 0);
        deadFromDots.forEach(e => {
            console.log(`[CombatScreen] ☠ ${e.name} killed by DoT!`);
            game.eventBus.emit('enemy:defeated', e);
        });
        
        // Filter out dead
        const alive = enemies.filter(e => e.currentHp > 0);
        enemies.length = 0;
        enemies.push(...alive);
        
        return enemies;
    }
    
    /**
     * Get stat bonus from equipped relics
     */
    function getRelicBonus(stat) {
        const artifacts = game.state.get('artifacts') || [];
        let bonus = 0;
        artifacts.forEach(a => {
            if (a.effects && a.effects[stat]) {
                bonus += a.effects[stat];
            }
        });
        return bonus;
    }
    
    /**
     * Apply relic combat-start effects
     */
    function applyRelicCombatStartEffects() {
        const artifacts = game.state.get('artifacts') || [];
        artifacts.forEach(a => {
            if (!a.effects) return;
            
            if (a.effects.startOfCombatStrength) {
                const str = game.state.get('combat.strength') || 0;
                game.state.set('combat.strength', str + a.effects.startOfCombatStrength);
                console.log(`[CombatScreen] Relic ${a.name}: +${a.effects.startOfCombatStrength} Strength`);
            }
            if (a.effects.startOfCombatDexterity) {
                const dex = game.state.get('combat.dexterity') || 0;
                game.state.set('combat.dexterity', dex + a.effects.startOfCombatDexterity);
                console.log(`[CombatScreen] Relic ${a.name}: +${a.effects.startOfCombatDexterity} Dexterity`);
            }
            if (a.effects.startOfCombatBlock) {
                const block = game.state.get('combat.block') || 0;
                game.state.set('combat.block', block + a.effects.startOfCombatBlock);
                console.log(`[CombatScreen] Relic ${a.name}: +${a.effects.startOfCombatBlock} Block`);
            }
            if (a.effects.maxEnergy) {
                const maxE = game.state.get('combat.maxEnergy') || 3;
                game.state.set('combat.maxEnergy', maxE + a.effects.maxEnergy);
                game.state.set('combat.energy', (game.state.get('combat.energy') || 3) + a.effects.maxEnergy);
                console.log(`[CombatScreen] Relic ${a.name}: +${a.effects.maxEnergy} Max Energy`);
            }
            if (a.effects.startOfCombatDraw) {
                for (let i = 0; i < a.effects.startOfCombatDraw; i++) {
                    drawCard();
                }
                console.log(`[CombatScreen] Relic ${a.name}: Draw ${a.effects.startOfCombatDraw} extra cards`);
            }
            if (a.effects.maxHp) {
                // maxHp bonus is permanent, applied outside combat
            }
        });
    }
    
    /**
     * Render player status icons in the HUD
     */
    function renderPlayerStatuses() {
        let container = document.getElementById('player-statuses');
        if (!container) {
            container = document.createElement('div');
            container.id = 'player-statuses';
            container.className = 'player-statuses-bar';
            const combatScreen = document.getElementById('combat-screen');
            if (combatScreen) combatScreen.appendChild(container);
        }
        
        const statusIcons = {
            strength:    { icon: '💪', color: '#ff4444', label: 'Strength', desc: '+{n} attack damage' },
            dexterity:   { icon: '🛡️', color: '#44ff44', label: 'Dexterity', desc: '+{n} block from cards' },
            vulnerable:  { icon: '🎯', color: '#ff6600', label: 'Vulnerable', desc: 'Take 50% more damage ({n} turns)' },
            weak:        { icon: '💫', color: '#888888', label: 'Weak', desc: 'Deal 25% less damage ({n} turns)' },
            frail:       { icon: '💔', color: '#9966cc', label: 'Frail', desc: 'Gain 25% less block ({n} turns)' },
            poison:      { icon: '☠️', color: '#00cc00', label: 'Poison', desc: 'Take {n} damage at end of turn' },
            bleed:       { icon: '🩸', color: '#cc0000', label: 'Bleed', desc: 'Take {n} damage at end of turn' },
            burn:        { icon: '🔥', color: '#ff4400', label: 'Burn', desc: 'Take {n} damage at end of turn' },
            regen:       { icon: '💚', color: '#00ff88', label: 'Regen', desc: 'Heal {n} at end of turn' },
            overheat:    { icon: '🌡️', color: '#ff4400', label: 'Overheat', desc: 'Heat: {n}/15. 5+: +2 dmg. 10+: -3 HP/turn. 15: Meltdown!' },
            rage:        { icon: '😤', color: '#ff0000', label: 'Rage', desc: '+{n} attack damage' },
            armor:       { icon: '🔩', color: '#888888', label: 'Armor', desc: 'Reduce incoming damage by {n}' },
            thorns:      { icon: '🌹', color: '#ff66cc', label: 'Thorns', desc: 'Deal {n} damage to attackers' },
            counter:     { icon: '⚔️', color: '#ffcc00', label: 'Counter', desc: 'Deal {n} back when hit (this turn)' },
            intangible:  { icon: '👻', color: '#aaaaff', label: 'Intangible', desc: 'All damage reduced to 1 ({n} turns)' },
        };
        
        const strength = game.state.get('combat.strength') || 0;
        const dexterity = game.state.get('combat.dexterity') || 0;
        const overheat = game.state.get('combat.overheat') || 0;
        const rage = game.state.get('combat.rage') || 0;
        const armorVal = game.state.get('combat.armor') || 0;
        const thorns = game.state.get('combat.thorns') || 0;
        const counter = game.state.get('combat.counter') || 0;
        const intangible = game.state.get('combat.intangible') || 0;
        
        let html = '';
        
        // Persistent buffs
        if (strength > 0) html += renderStatusBadge(statusIcons.strength, strength);
        if (dexterity > 0) html += renderStatusBadge(statusIcons.dexterity, dexterity);
        if (rage > 0) html += renderStatusBadge(statusIcons.rage, rage);
        if (armorVal > 0) html += renderStatusBadge(statusIcons.armor, armorVal);
        if (thorns > 0) html += renderStatusBadge(statusIcons.thorns, thorns);
        if (counter > 0) html += renderStatusBadge(statusIcons.counter, counter);
        if (intangible > 0) html += renderStatusBadge(statusIcons.intangible, intangible);
        
        // Overheat (Korvax) — show as special heat meter
        const heroId = game.state.get('hero.id') || 'korvax';
        if (heroId === 'korvax' || overheat > 0) {
            html += renderOverheatBadge(overheat);
        }
        
        // Duration/intensity debuffs & DoTs
        const debuffIds = ['vulnerable', 'weak', 'frail', 'poison', 'bleed', 'burn', 'regen'];
        debuffIds.forEach(id => {
            const val = getPlayerStatus(id);
            if (val > 0) {
                html += renderStatusBadge(statusIcons[id], val);
            }
        });
        
        container.innerHTML = html;
    }
    
    function renderOverheatBadge(heat) {
        const pct = Math.min(100, (heat / 15) * 100);
        const dangerClass = heat >= 10 ? 'overheat-danger' : heat >= 5 ? 'overheat-warm' : '';
        return `
            <div class="overheat-badge ${dangerClass}" title="Overheat: ${heat}/15&#10;5+: +2 damage&#10;10+: Take 3 damage/turn&#10;15: Meltdown!">
                <span class="overheat-icon">🌡️</span>
                <div class="overheat-mini-bar">
                    <div class="overheat-mini-fill" style="width: ${pct}%;"></div>
                </div>
                <span class="overheat-value">${heat}</span>
            </div>
        `;
    }
    
    /**
     * Render persistent hero resource HUD (overheat, rage, corruption)
     * Always visible during combat so player knows their resource state
     */
    function renderHeroResources() {
        let container = document.getElementById('hero-resource-hud');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hero-resource-hud';
            // CHANGE #3: Add 'hero-resources' class for collapsible mobile CSS
            container.className = 'hero-resource-hud hero-resources';
            const combatScreen = document.getElementById('combat-screen');
            if (combatScreen) combatScreen.appendChild(container);
            
            // Initialize collapsible toggle for mobile
            try {
                setupHeroResourcesToggle();
            } catch (e) {
                console.warn('[CombatScreen] HeroResourcesToggle setup failed (non-fatal):', e);
            }
        }
        
        const heroId = game.state.get('hero.id') || 'korvax';
        const corruption = game.state.get('corruption') || 0;
        let html = '';
        
        // Hero-specific resources
        if (heroId === 'korvax') {
            const overheat = game.state.get('combat.overheat') || 0;
            const rage = game.state.get('combat.rage') || 0;
            const heatPct = Math.min(100, (overheat / 15) * 100);
            const heatClass = overheat >= 10 ? 'threshold-danger' : overheat >= 5 ? 'threshold-warm' : '';
            const rageClass = rage > 0 ? 'has-stacks' : '';
            
            html += `
                <div class="hero-resource-row resource-overheat ${heatClass}" title="Overheat: ${overheat}/15&#10;5+: +2 damage&#10;10+: Take 3 damage/turn&#10;15: Meltdown!">
                    <span class="resource-icon">🌡️</span>
                    <span class="resource-label">Heat</span>
                    <div class="resource-bar"><div class="resource-bar-fill" style="width: ${heatPct}%;"></div></div>
                    <span class="resource-value">${overheat}</span>
                </div>
                <div class="hero-resource-row resource-rage ${rageClass}" title="Rage: +${rage} attack damage">
                    <span class="resource-icon">😤</span>
                    <span class="resource-label">Rage</span>
                    <span class="resource-value">${rage}</span>
                </div>
            `;
        } else if (heroId === 'lyria') {
            const astral = game.state.get('combat.astralCharge') || 0;
            const flux = game.state.get('combat.temporalFlux') || 0;
            html += `
                <div class="hero-resource-row resource-rage" title="Astral Charge: ${astral}" style="border-color: rgba(168,85,247,0.3);">
                    <span class="resource-icon">✨</span>
                    <span class="resource-label">Astral</span>
                    <span class="resource-value" style="color: #a855f7;">${astral}</span>
                </div>
                <div class="hero-resource-row resource-rage" title="Temporal Flux: ${flux}" style="border-color: rgba(56,189,248,0.3);">
                    <span class="resource-icon">⏳</span>
                    <span class="resource-label">Flux</span>
                    <span class="resource-value" style="color: #38bdf8;">${flux}</span>
                </div>
            `;
        }
        
        // Global corruption (all heroes)
        const corruptPct = Math.min(100, corruption);
        const corruptClass = corruption >= 75 ? 'threshold-consumed' : corruption >= 50 ? 'threshold-corrupted' : corruption >= 25 ? 'threshold-touched' : '';
        const corruptLabel = corruption >= 75 ? 'Consumed' : corruption >= 50 ? 'Corrupted' : corruption >= 25 ? 'Touched' : 'Pure';
        
        html += `
            <div class="hero-resource-row resource-corruption ${corruptClass}" title="Corruption: ${corruption}/100 (${corruptLabel})&#10;25+: Whispers begin&#10;50+: Corrupted cards appear&#10;75+: Reality fractures&#10;100: Transformation">
                <span class="resource-icon">👁️</span>
                <span class="resource-label">Corrupt</span>
                <div class="resource-bar"><div class="resource-bar-fill" style="width: ${corruptPct}%;"></div></div>
                <span class="resource-value">${corruption}</span>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    function renderStatusBadge(info, value) {
        const desc = info.desc ? info.desc.replace('{n}', value) : `${info.label}: ${value}`;
        const isBuff = !['vulnerable', 'weak', 'frail', 'poison', 'bleed', 'burn'].includes(info.label?.toLowerCase());
        const typeClass = isBuff ? 'status-badge-buff' : 'status-badge-debuff';
        return `
            <div class="player-status-badge ${typeClass}" title="${desc}" style="
                --status-color: ${info.color};
            ">
                <span class="status-badge-icon">${info.icon}</span>
                <span class="status-badge-value">${value}</span>
            </div>
        `;
    }
    
    function initializeCombatState(enemies, deck) {
        console.log('[CombatScreen] Initializing combat state...');
        
        game.state.set('combat.turn', 1);
        game.state.set('combat.playerTurn', true);
        game.state.set('combat.block', 0);
        game.state.set('combat.strength', 0);
        game.state.set('combat.dexterity', 0);
        
        // Reset all player statuses
        const statusIds = ['vulnerable', 'weak', 'frail', 'poison', 'bleed', 'burn', 'regen', 'stun', 'slow'];
        statusIds.forEach(id => game.state.set(`combat.status.${id}`, 0));
        
        // Reset Korvax-specific resources
        game.state.set('combat.overheat', 0);
        game.state.set('combat.rage', 0);
        game.state.set('combat.armor', 0);
        game.state.set('combat.thorns', 0);
        game.state.set('combat.counter', 0);
        game.state.set('combat.intangible', 0);
        
        // Power card triggers (persist for combat duration)
        game.state.set('combat.triggers', []);
        
        const maxEnergy = game.state.get('maxEnergy') || game.state.get('hero.maxEnergy') || game.state.get('hero.energy') || 3;
        game.state.set('combat.energy', maxEnergy);
        game.state.set('combat.maxEnergy', maxEnergy);
        
        enemies.forEach((enemy, i) => {
            enemy.index = i;
            if (!enemy.intent) {
                enemy.intent = generateIntent(enemy);
            }
        });
        game.state.set('combat.enemies', enemies);
        
        const shuffledDeck = [...deck].sort(() => Math.random() - 0.5);
        const handSize = 5;
        const hand = shuffledDeck.slice(0, handSize);
        const drawPile = shuffledDeck.slice(handSize);
        
        game.state.set('combat.hand', hand);
        game.state.set('combat.drawPile', drawPile);
        game.state.set('combat.discardPile', []);
        
        console.log(`[CombatScreen] Hand: ${hand.length} cards, Draw pile: ${drawPile.length} cards`);
        console.log(`[CombatScreen] Hand contents:`, hand.map(c => c.name));
        
        // ── Activate biome effect for this combat ──
        if (biomeEffects) {
            const effect = biomeEffects.onCombatStart();
            if (effect) {
                game.state.set('combat.biomeEffect', effect.id);
                console.log(`[CombatScreen] Biome effect active: ${effect.name}`);
            }
        }
        
        // ── Initialize corruption currency for this combat ──
        if (corruptionCurrency) {
            corruptionCurrency.onCombatStart();
        }
        
        // ── Initialize cascade systems for this combat ──
        if (game.corruptionCascade) game.corruptionCascade.onCombatStart();
        if (unreliableUI) unreliableUI.startAmbientDistortions();
        
        // ── Apply relic/artifact combat-start effects ──
        applyRelicCombatStartEffects();
        
        // ── Initialize Lyria-specific resources ──
        const heroId = game.state.get('hero.id');
        if (heroId === 'lyria') {
            game.state.set('combat.astralCharge', 0);
            game.state.set('combat.temporalFlux', 0);
            console.log('[CombatScreen] Lyria resources initialized (Astral Charge, Temporal Flux)');
        }
    }
    
    function renderCombatUI() {
        console.log('[CombatScreen] Rendering combat UI...');
        renderBiomeBanner();
        renderPlayer();
        renderEnemies();
        renderHand();
        renderEnergy();
        renderPileCounters();
        renderVoidPanel();
        renderPlayerStatuses();
        renderHeroResources();
        renderRelicBar();
        
        // ── Apply Inscryption-style UI distortions after render ──
        if (unreliableUI) {
            setTimeout(() => unreliableUI.applyDistortions(), 100);
        }
    }
    
    function renderPlayer() {
        const hp = game.state.get('hero.hp') || 80;
        const maxHp = game.state.get('hero.maxHp') || 80;
        const block = game.state.get('combat.block') || 0;
        
        const hpBar = document.getElementById('combat-hp-fill') || document.getElementById('player-hp-bar');
        const hpText = document.getElementById('combat-hp-text') || document.getElementById('player-hp-text');
        const blockDisplay = document.getElementById('combat-block') || document.getElementById('player-block');
        
        if (hpBar) hpBar.style.width = `${(hp / maxHp) * 100}%`;
        if (hpText) hpText.textContent = `${hp}/${maxHp}`;
        if (blockDisplay) {
            blockDisplay.textContent = block > 0 ? block : '0';
            blockDisplay.parentElement?.classList.toggle('has-block', block > 0);
        }
    }
    
    /**
     * Render enemies with depth-based first-person perspective positioning
     * Enemies get data-depth="front|mid|back" and left% for horizontal placement
     */
    function renderEnemies() {
        const container = document.getElementById('enemies-container') || document.getElementById('enemy-area');
        if (!container) {
            console.error('[CombatScreen] Enemy container not found!');
            return;
        }
        
        const enemies = game.state.get('combat.enemies') || [];
        
        // ── Depth layout maps based on enemy count ──
        // Each entry: { depth: 'front'|'mid'|'back', x: left% }
        const DEPTH_LAYOUTS = {
            1: [
                { depth: 'front', x: 50 }
            ],
            2: [
                { depth: 'front', x: 38 },
                { depth: 'front', x: 62 }
            ],
            3: [
                { depth: 'front', x: 50 },
                { depth: 'mid', x: 25 },
                { depth: 'mid', x: 75 }
            ],
            4: [
                { depth: 'front', x: 38 },
                { depth: 'front', x: 62 },
                { depth: 'back', x: 22 },
                { depth: 'back', x: 78 }
            ],
            5: [
                { depth: 'front', x: 50 },
                { depth: 'mid', x: 28 },
                { depth: 'mid', x: 72 },
                { depth: 'back', x: 15 },
                { depth: 'back', x: 85 }
            ]
        };
        
        const count = Math.min(enemies.length, 5);
        const layout = DEPTH_LAYOUTS[count] || DEPTH_LAYOUTS[3];
        
        container.innerHTML = enemies.map((enemy, i) => {
            const intentType = enemy.intent?.type || 'unknown';
            const intentClass = `intent-${intentType}`;
            const spritePath = getEnemySpritePath(enemy);
            const enemyType = enemy.type || 'normal';
            const pos = layout[i] || layout[layout.length - 1];
            
            return `
                <div class="enemy enemy-${enemyType}" 
                     data-index="${i}" 
                     data-enemy-id="${enemy.id || enemy.instanceId || i}"
                     data-depth="${pos.depth}"
                     style="left: ${pos.x}%;">
                    <div class="enemy-intent ${intentClass}">
                        ${renderIntentContent(enemy.intent)}
                    </div>
                    <div class="enemy-sprite">
                        <img src="${spritePath}" alt="${enemy.name || 'Enemy'}" class="enemy-sprite-img"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                        <div class="enemy-icon-fallback" style="display:none;">👁️</div>
                    </div>
                    <div class="enemy-name">${enemy.name || 'Enemy'}</div>
                    <div class="enemy-hp-bar-container">
                        <div class="enemy-hp-bar" style="width: ${(enemy.currentHp / enemy.maxHp) * 100}%"></div>
                    </div>
                    <div class="enemy-hp-text">${enemy.currentHp}/${enemy.maxHp}</div>
                    ${enemy.block > 0 ? `<div class="enemy-block">🛡️ ${enemy.block}</div>` : ''}
                    <div class="enemy-statuses">
                        ${enemy.strength > 0 ? `<div class="enemy-status-icon buff" title="Strength: +${enemy.strength} damage" style="--status-color: #ff4444;">💪<span>${enemy.strength}</span></div>` : ''}
                        ${enemy.vulnerable > 0 ? `<div class="enemy-status-icon debuff" title="Vulnerable: Take 50% more damage (${enemy.vulnerable} turns)" style="--status-color: #ff6600;">🎯<span>${enemy.vulnerable}</span></div>` : ''}
                        ${enemy.weak > 0 ? `<div class="enemy-status-icon debuff" title="Weak: Deal 25% less damage (${enemy.weak} turns)" style="--status-color: #888888;">💫<span>${enemy.weak}</span></div>` : ''}
                        ${enemy.poison > 0 ? `<div class="enemy-status-icon debuff" title="Poison: Take ${enemy.poison} damage at end of turn" style="--status-color: #00cc00;">☠️<span>${enemy.poison}</span></div>` : ''}
                        ${enemy.bleed > 0 ? `<div class="enemy-status-icon debuff" title="Bleed: Take ${enemy.bleed} damage at end of turn" style="--status-color: #cc0000;">🩸<span>${enemy.bleed}</span></div>` : ''}
                        ${enemy.burn > 0 ? `<div class="enemy-status-icon debuff" title="Burn: Take ${enemy.burn} damage at end of turn" style="--status-color: #ff4400;">🔥<span>${enemy.burn}</span></div>` : ''}
                        ${enemy.stun > 0 ? `<div class="enemy-status-icon debuff" title="Stunned: Cannot act (${enemy.stun} turn)" style="--status-color: #ffff00;">⭐<span>${enemy.stun}</span></div>` : ''}
                        ${enemy.slow > 0 ? `<div class="enemy-status-icon debuff" title="Slow: Skips actions (${enemy.slow} turns)" style="--status-color: #6666aa;">🐌<span>${enemy.slow}</span></div>` : ''}
                        ${enemy.regen > 0 ? `<div class="enemy-status-icon buff" title="Regen: Heals ${enemy.regen} at end of turn" style="--status-color: #00ff88;">💚<span>${enemy.regen}</span></div>` : ''}
                        ${enemy.thorns > 0 ? `<div class="enemy-status-icon buff" title="Thorns: Deal ${enemy.thorns} back when hit" style="--status-color: #ff66cc;">🌹<span>${enemy.thorns}</span></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // FIXED: Add click handlers for enemy targeting
        container.querySelectorAll('.enemy').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(el.dataset.index);
                console.log(`[CombatScreen] Enemy clicked: index ${index}`);
                handleEnemyClick(index);
            });
        });
    }
    
    /**
     * Handle enemy click for targeting
     */
    function handleEnemyClick(enemyIndex) {
        if (selectedCardIndex !== null) {
            console.log(`[CombatScreen] Playing card ${selectedCardIndex} on enemy ${enemyIndex}`);
            playCard(selectedCardIndex, enemyIndex);
        } else {
            console.log('[CombatScreen] No card selected, click a card first');
        }
    }
    
    function renderIntentContent(intent) {
        if (!intent) return '<span class="intent-icon">❓</span>';
        
        switch (intent.type) {
            case 'attack':
            case 'heavy_attack':
                if (intent.hits || intent.times) {
                    const hits = intent.hits || intent.times;
                    return `<span class="intent-icon">⚔️</span><span class="intent-value">${intent.damage || '?'}x${hits}</span>`;
                }
                return `<span class="intent-icon">⚔️</span><span class="intent-value">${intent.damage || '?'}</span>`;
            case 'multi_attack':
                return `<span class="intent-icon">⚔️</span><span class="intent-value">${intent.damage || '?'}x${intent.hits || intent.times || 2}</span>`;
            case 'attack_debuff':
                return `<span class="intent-icon">⚔️☠️</span><span class="intent-value">${intent.damage || '?'}</span>`;
            case 'defend':
            case 'block':
                return `<span class="intent-icon">🛡️</span><span class="intent-value">${intent.value || intent.block || '?'}</span>`;
            case 'buff':
                return `<span class="intent-icon">💪</span><span class="intent-value" style="color:#44ff44;">↑</span>`;
            case 'debuff':
                return `<span class="intent-icon">☠️</span><span class="intent-value" style="color:#aa44aa;">↓</span>`;
            case 'heal':
                return `<span class="intent-icon">💚</span><span class="intent-value" style="color:#44ff44;">${intent.value || intent.heal || '?'}</span>`;
            case 'summon':
                return `<span class="intent-icon">👥</span><span class="intent-value" style="color:#ffaa00;">+</span>`;
            default:
                return '<span class="intent-icon">❓</span>';
        }
    }
    
    function renderHand() {
        const handArea = document.getElementById('hand-area');
        const handByQuery = document.querySelector('#combat-screen .hand-area');
        const handByClass = document.querySelector('.hand-area');
        const container = handArea || handByQuery || handByClass || document.getElementById('hand-container') || document.getElementById('hand');
        
        if (!container) {
            console.error('[CombatScreen] Hand container not found!');
            return;
        }
        
        const hand = game.state.get('combat.hand') || [];
        const energy = game.state.get('combat.energy') || 0;
        
        container.innerHTML = hand.map((card, i) => {
            const affordable = card.cost <= energy;
            const typeClass = card.type || 'attack';
            const upgradedClass = card.upgraded ? 'card-upgraded' : '';
            const displayName = (card.upgraded && card.upgradedName) ? card.upgradedName : card.name;
            const flavorHtml = card.flavor ? `<div class="card-flavor" style="font-size: 0.6rem; font-style: italic; opacity: 0.6; margin-top: 2px;">${card.flavor}</div>` : '';
            return `
                <div class="combat-card card type-${typeClass} ${affordable ? 'playable' : 'unplayable'} ${upgradedClass}" data-index="${i}">
                    <div class="card-cost ${affordable ? '' : 'not-enough'} ${card._temporalFlux > 0 ? 'flux-increased' : ''} ${card._temporalFlux < 0 ? 'flux-decreased' : ''}">${card.cost}</div>
                    ${card._temporalFlux ? `<div class="flux-indicator ${card._temporalFlux > 0 ? 'up' : 'down'}">${card._temporalFlux > 0 ? '▲' : '▼'}</div>` : ''}
                    <div class="card-name">${displayName}${card.upgraded ? '+' : ''}</div>
                    <div class="card-type">${card.type || 'Attack'}</div>
                    <div class="card-description">${card.description || ''}</div>
                    ${flavorHtml}
                </div>
            `;
        }).join('');
        
        // Add click handlers for cards
        container.querySelectorAll('.combat-card').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(el.dataset.index);
                if (!el.classList.contains('unplayable')) {
                    selectCard(index);
                } else {
                    console.log('[CombatScreen] Card unplayable - not enough energy');
                }
            });
        });
        
        // ── VOID SYSTEMS: Add chain preview indicators to cards ──
        if (game.voidSystems) {
            try {
                game.voidSystems.addChainPreviewToCards();
            } catch (e) {
                // Silent fail - preview is cosmetic only
            }
        }
    }
    
    function renderEnergy() {
        const energy = game.state.get('combat.energy') || 0;
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        
        const energyCurrent = document.getElementById('energy-current');
        const energyMax = document.getElementById('energy-max');
        
        if (energyCurrent) energyCurrent.textContent = energy;
        if (energyMax) energyMax.textContent = maxEnergy;
        
        const display = document.getElementById('energy-display') || document.getElementById('energy');
        if (display && !energyCurrent) {
            display.innerHTML = `<span class="energy-current">${energy}</span>/<span class="energy-max">${maxEnergy}</span>`;
        }
        
        // Lyria resources now displayed in hero resource HUD
    }
    
    function renderPileCounters() {
        const drawPile = game.state.get('combat.drawPile') || [];
        const discardPile = game.state.get('combat.discardPile') || [];
        
        let drawCounter = document.getElementById('draw-pile-count');
        let discardCounter = document.getElementById('discard-pile-count');
        
        if (!drawCounter) {
            const drawPileEl = document.getElementById('draw-pile');
            if (drawPileEl) drawCounter = drawPileEl.querySelector('.pile-count');
        }
        if (!discardCounter) {
            const discardPileEl = document.getElementById('discard-pile');
            if (discardPileEl) discardCounter = discardPileEl.querySelector('.pile-count');
        }
        
        if (drawCounter) drawCounter.textContent = drawPile.length;
        if (discardCounter) discardCounter.textContent = discardPile.length;
    }
    
    // ═══════════════════════════════════════════
    // BIOME EFFECTS + VOID CHANNEL RENDERING
    // ═══════════════════════════════════════════
    
    function renderBiomeBanner() {
        if (!biomeEffects) return;
        
        // Remove existing banner
        const existing = document.getElementById('biome-banner');
        if (existing) existing.remove();
        
        const effect = biomeEffects.getActiveEffect();
        if (!effect) return;
        
        const banner = document.createElement('div');
        banner.id = 'biome-banner';
        banner.innerHTML = biomeEffects.renderBanner();
        
        // Insert at top of combat container
        const container = screen.querySelector('.combat-container') || screen;
        container.insertBefore(banner, container.firstChild);
        
        // Apply biome class to combat screen for background tint
        const classMap = {
            'scavengers_luck': 'biome-ironspine',
            'temporal_flux': 'biome-eclipse',
            'purifying_light': 'biome-radiant',
            'shifting_faces': 'biome-obsidian',
            'xalkoraths_gaze': 'biome-abyss'
        };
        screen.className = screen.className.replace(/biome-\w+/g, '').trim();
        if (classMap[effect.id]) {
            screen.classList.add(classMap[effect.id]);
        }
    }
    
    function renderVoidPanel() {
        if (!corruptionCurrency) return;
        
        // Remove existing panel
        const existing = document.getElementById('void-channel-panel');
        if (existing) existing.remove();
        
        const html = corruptionCurrency.renderPanel();
        if (!html) return;
        
        const panel = document.createElement('div');
        panel.id = 'void-channel-panel';
        panel.innerHTML = html;
        document.body.appendChild(panel);
        
        // Add click handlers for void abilities
        panel.querySelectorAll('.void-ability:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const abilityId = btn.dataset.ability;
                const result = corruptionCurrency.useAbility(abilityId);
                if (result) {
                    showCorruptionSpendVFX(btn, result);
                    renderCombatUI();
                }
            });
        });
    }
    
    function showCorruptionSpendVFX(element, result) {
        const rect = element.getBoundingClientRect();
        const vfx = document.createElement('div');
        vfx.className = 'corruption-spend-vfx';
        vfx.textContent = result.message || '👁️';
        vfx.style.left = `${rect.left}px`;
        vfx.style.top = `${rect.top}px`;
        document.body.appendChild(vfx);
        setTimeout(() => vfx.remove(), 800);
    }
    
    /**
     * Render relic/artifact bar showing collected relics during combat
     */
    function renderRelicBar() {
        const artifacts = game.state.get('artifacts') || [];
        
        let container = document.getElementById('combat-relic-bar');
        if (!container) {
            container = document.createElement('div');
            container.id = 'combat-relic-bar';
            container.style.cssText = `
                position: absolute; top: 8px; right: 10px;
                display: flex; gap: 4px; z-index: 96; flex-wrap: wrap;
                max-width: 200px; justify-content: flex-end;
            `;
            const combatScreen = document.getElementById('combat-screen');
            if (combatScreen) combatScreen.appendChild(container);
        }
        
        if (artifacts.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        const RELIC_ICONS = {
            thermal_regulator: '🔥', scrap_capacitor: '⚡', void_vial: '🌀',
            rust_heart: '❤️', signal_beacon: '📡', iron_plating: '🔩',
            void_lens: '👁️', chronos_shard: '⏳', radiant_sigil: '☀️',
            shadow_mask: '🎭'
        };
        
        container.innerHTML = artifacts.map(a => {
            const icon = RELIC_ICONS[a.id] || '💎';
            const effectSummary = a.effects ? Object.entries(a.effects)
                .map(([k, v]) => `${k}: +${v}`)
                .join(', ') : 'Passive';
            return `
                <div class="combat-relic-icon" title="${a.name || a.id}\n${a.description || effectSummary}" style="
                    width: 28px; height: 28px; background: rgba(0,0,0,0.7);
                    border: 1px solid rgba(255,215,0,0.5); border-radius: 4px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.9rem; cursor: help;
                    box-shadow: 0 0 4px rgba(255,215,0,0.2);
                ">${icon}</div>
            `;
        }).join('');
    }
    
    /**
     * Setup click handlers for viewing draw and discard piles
     */
    function setupPileViewers() {
        const drawPileEl = document.getElementById('draw-pile');
        const discardPileEl = document.getElementById('discard-pile');
        
        if (drawPileEl) {
            // Clone to remove old listeners
            const newDrawPile = drawPileEl.cloneNode(true);
            drawPileEl.parentNode.replaceChild(newDrawPile, drawPileEl);
            
            newDrawPile.addEventListener('click', () => {
                showPileModal('Draw Pile', game.state.get('combat.drawPile') || [], true);
            });
            newDrawPile.style.cursor = 'pointer';
            newDrawPile.title = 'Click to view draw pile';
        }
        
        if (discardPileEl) {
            const newDiscardPile = discardPileEl.cloneNode(true);
            discardPileEl.parentNode.replaceChild(newDiscardPile, discardPileEl);
            
            newDiscardPile.addEventListener('click', () => {
                showPileModal('Discard Pile', game.state.get('combat.discardPile') || [], false);
            });
            newDiscardPile.style.cursor = 'pointer';
            newDiscardPile.title = 'Click to view discard pile';
        }
        
        // Setup deck button if it exists
        const deckBtn = document.getElementById('btn-deck') || document.getElementById('btn-view-deck');
        if (deckBtn) {
            const newDeckBtn = deckBtn.cloneNode(true);
            deckBtn.parentNode.replaceChild(newDeckBtn, deckBtn);
            
            newDeckBtn.addEventListener('click', () => {
                showFullDeck();
            });
        }
        
        // Re-render pile counters after replacing elements
        renderPileCounters();
    }
    
    /**
     * Show the complete deck (all cards the player has)
     */
    function showFullDeck() {
        const deck = game.state.get('deck') || [];
        const drawPile = game.state.get('combat.drawPile') || [];
        const discardPile = game.state.get('combat.discardPile') || [];
        const hand = game.state.get('combat.hand') || [];
        
        // Combine all for display - show where each card currently is
        const allCards = [
            ...hand.map(c => ({ ...c, location: 'hand' })),
            ...drawPile.map(c => ({ ...c, location: 'draw' })),
            ...discardPile.map(c => ({ ...c, location: 'discard' }))
        ];
        
        showDeckOverlay('Your Deck', allCards);
    }
    
    /**
     * Show deck overlay with location info
     */
    function showDeckOverlay(title, cards) {
        const existing = document.getElementById('deck-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'deck-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            overflow-y: auto;
        `;
        
        // Group cards by location
        const byLocation = {
            hand: cards.filter(c => c.location === 'hand'),
            draw: cards.filter(c => c.location === 'draw'),
            discard: cards.filter(c => c.location === 'discard')
        };
        
        overlay.innerHTML = `
            <div style="max-width: 900px; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2 style="color: #00f5ff; margin: 0; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.1em;">${title}</h2>
                    <button id="close-deck-overlay" style="background: none; border: 1px solid #fff; color: #fff; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Close</button>
                </div>
                <div style="color: #888; margin-bottom: 1.5rem; display: flex; gap: 2rem;">
                    <span>📍 In Hand: ${byLocation.hand.length}</span>
                    <span>📚 Draw Pile: ${byLocation.draw.length}</span>
                    <span>🗑️ Discard: ${byLocation.discard.length}</span>
                    <span style="color: #00f5ff; font-weight: bold;">Total: ${cards.length}</span>
                </div>
                
                ${byLocation.hand.length > 0 ? `
                    <h3 style="color: #4ade80; margin: 1rem 0 0.5rem;">📍 Currently In Hand</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        ${renderDeckCards(byLocation.hand)}
                    </div>
                ` : ''}
                
                ${byLocation.draw.length > 0 ? `
                    <h3 style="color: #60a5fa; margin: 1rem 0 0.5rem;">📚 Draw Pile</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        ${renderDeckCards(byLocation.draw)}
                    </div>
                ` : ''}
                
                ${byLocation.discard.length > 0 ? `
                    <h3 style="color: #f87171; margin: 1rem 0 0.5rem;">🗑️ Discard Pile</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        ${renderDeckCards(byLocation.discard)}
                    </div>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('close-deck-overlay').addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
    
    /**
     * Render cards for deck overlay
     */
    function renderDeckCards(cards) {
        return cards.map(card => `
            <div style="background: linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%); border: 2px solid ${card.type === 'attack' ? '#ff2d55' : card.type === 'skill' ? '#00a5ff' : '#ffd700'}; border-radius: 8px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; color: #e8e8f0;">${card.name}${card.upgraded ? '+' : ''}</span>
                    <span style="background: #f5c542; color: #000; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;">${card.cost}</span>
                </div>
                <div style="font-size: 0.75rem; color: #888; margin-top: 0.25rem; text-transform: uppercase;">${card.type || 'attack'} ${card.rarity ? '• ' + card.rarity : ''}</div>
                <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #ccc;">${card.description || ''}</div>
            </div>
        `).join('');
    }
    
    /**
     * Show modal with pile contents
     */
    function showPileModal(title, cards, isDrawPile) {
        const modal = document.getElementById('deck-modal');
        const content = document.getElementById('deck-view-cards');
        const modalTitle = modal?.querySelector('h2');
        
        if (!modal || !content) {
            // Fallback: create a simple overlay
            showSimplePileOverlay(title, cards, isDrawPile);
            return;
        }
        
        if (modalTitle) modalTitle.textContent = title;
        
        if (cards.length === 0) {
            content.innerHTML = `<p style="text-align: center; color: var(--color-text-dim); padding: 2rem;">No cards in ${title.toLowerCase()}</p>`;
        } else {
            // For draw pile, we might want to hide the contents or shuffle display
            const displayCards = isDrawPile ? 
                cards.map(c => ({ ...c, hidden: false })) : // Show draw pile cards too
                cards;
            
            content.innerHTML = `
                <div class="pile-info" style="text-align: center; margin-bottom: 1rem; color: var(--color-text-secondary);">
                    ${cards.length} card${cards.length !== 1 ? 's' : ''}
                </div>
                <div class="card-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; padding: 1rem;">
                    ${displayCards.map(card => `
                        <div class="card type-${card.type || 'attack'} rarity-${card.rarity || 'common'}" style="padding: 0.75rem; border-radius: 8px;">
                            <div class="card-cost" style="font-weight: bold; color: var(--color-energy);">${card.cost}</div>
                            <div class="card-name" style="font-weight: bold; margin: 0.5rem 0;">${card.name}${card.upgraded ? '+' : ''}</div>
                            <div class="card-description" style="font-size: 0.75rem; opacity: 0.8;">${card.description || ''}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        modal.classList.add('active');
        
        // Setup close button
        const closeBtn = document.getElementById('btn-close-deck');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        }, { once: true });
    }
    
    /**
     * Simple overlay fallback for pile viewing
     */
    function showSimplePileOverlay(title, cards, isDrawPile) {
        // Remove any existing overlay
        const existing = document.getElementById('pile-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'pile-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            overflow-y: auto;
        `;
        
        overlay.innerHTML = `
            <div style="max-width: 800px; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2 style="color: var(--color-neon-cyan, #00f5ff); margin: 0;">${title}</h2>
                    <button id="close-pile-overlay" style="background: none; border: 1px solid #fff; color: #fff; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px;">Close</button>
                </div>
                <p style="color: #888; margin-bottom: 1rem;">${cards.length} card${cards.length !== 1 ? 's' : ''}</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;">
                    ${cards.length === 0 ? '<p style="color: #666;">Empty</p>' : cards.map(card => `
                        <div style="background: linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%); border: 2px solid ${card.type === 'attack' ? '#ff2d55' : card.type === 'skill' ? '#00a5ff' : '#ffd700'}; border-radius: 8px; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: bold;">${card.name}${card.upgraded ? '+' : ''}</span>
                                <span style="background: #f5c542; color: #000; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${card.cost}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #888; margin-top: 0.5rem;">${card.type || 'attack'}</div>
                            <div style="font-size: 0.8rem; margin-top: 0.5rem; color: #ccc;">${card.description || ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('close-pile-overlay').addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
    
    // Card selection and targeting state
    let selectedCardIndex = null;
    let targetingMode = false;
    
    /**
     * Show targeting mode message
     */
    function showTargetingMessage(show) {
        let msg = document.getElementById('targeting-message');
        
        if (show) {
            if (!msg) {
                msg = document.createElement('div');
                msg.id = 'targeting-message';
                msg.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(255, 45, 85, 0.9);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-family: 'Bebas Neue', sans-serif;
                    font-size: 1.2rem;
                    letter-spacing: 0.1em;
                    z-index: 1500;
                    animation: pulse 1s infinite;
                `;
                msg.innerHTML = `
                    <style>
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.7; }
                        }
                    </style>
                    ⚔️ SELECT AN ENEMY TO ATTACK ⚔️
                `;
                document.body.appendChild(msg);
            }
        } else {
            if (msg) msg.remove();
        }
    }
    
    /**
     * FIXED: Card selection with proper targeting flow
     */
    function selectCard(index) {
        const hand = game.state.get('combat.hand') || [];
        const card = hand[index];
        if (!card) {
            console.log('[CombatScreen] Invalid card index');
            return;
        }
        
        const energy = game.state.get('combat.energy') || 0;
        if (card.cost > energy) {
            console.log('[CombatScreen] Not enough energy to play this card');
            showNotEnoughEnergyFeedback();
            return;
        }
        
        console.log(`[CombatScreen] Selected card: ${card.name} (type: ${card.type}, cost: ${card.cost}, damage: ${card.damage || 0}, block: ${card.block || 0})`);
        
        // If clicking the same card, deselect
        if (selectedCardIndex === index) {
            deselectCard();
            return;
        }
        
        selectedCardIndex = index;
        
        // Update visual selection
        document.querySelectorAll('.combat-card').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        
        // Determine if card needs an enemy target (attacks + debuff skills)
        const needsTarget = cardNeedsEnemyTarget(card);
        const enemies = game.state.get('combat.enemies') || [];
        
        console.log(`[CombatScreen] Card needs target: ${needsTarget}, enemies: ${enemies.length}`);
        
        if (needsTarget && enemies.length > 0) {
            // Enter targeting mode
            targetingMode = true;
            
            // Add targeting visual to enemies
            document.querySelectorAll('.enemy').forEach(el => {
                el.classList.add('targetable');
                el.style.cursor = 'crosshair';
            });
            
            // If only one enemy, auto-target
            if (enemies.length === 1) {
                console.log('[CombatScreen] Single enemy - auto-targeting');
                playCard(index, 0);
            } else {
                console.log('[CombatScreen] Multiple enemies - waiting for target selection');
                showTargetingMessage(true);
            }
        } else {
            // Card doesn't need a target (skill, power, etc.)
            console.log('[CombatScreen] Card does not need target, playing immediately');
            playCard(index, null);
        }
    }
    
    /**
     * Show feedback when not enough energy
     */
    function showNotEnoughEnergyFeedback() {
        const existing = document.getElementById('energy-warning');
        if (existing) existing.remove();
        
        const warning = document.createElement('div');
        warning.id = 'energy-warning';
        warning.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 107, 53, 0.9);
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.5rem;
            z-index: 2000;
        `;
        warning.textContent = 'NOT ENOUGH ENERGY!';
        document.body.appendChild(warning);
        
        setTimeout(() => warning.remove(), 1000);
    }
    
    /**
     * Deselect current card and exit targeting mode
     */
    function deselectCard() {
        selectedCardIndex = null;
        targetingMode = false;
        
        showTargetingMessage(false);
        
        document.querySelectorAll('.combat-card').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.enemy').forEach(el => {
            el.classList.remove('targetable');
            el.style.cursor = '';
        });
    }
    
    /**
     * Play a card from hand
     */
    async function playCard(cardIndex, targetIndex) {
        // Check for victory state
        if (game.state.get('combat.victoryPending')) {
            console.log('[CombatScreen] Victory pending, ignoring card play');
            return;
        }
        
        const hand = game.state.get('combat.hand') || [];
        const card = hand[cardIndex];
        if (!card) {
            console.log('[CombatScreen] Card not found in hand');
            deselectCard();
            return;
        }
        
        const energy = game.state.get('combat.energy') || 0;
        if (card.cost > energy) {
            console.log('[CombatScreen] Not enough energy!');
            deselectCard();
            showNotEnoughEnergyFeedback();
            return;
        }
        
        // For attack/debuff cards, validate target
        const needsTarget = cardNeedsEnemyTarget(card);
        const enemies = game.state.get('combat.enemies') || [];
        
        if (needsTarget && enemies.length > 0) {
            // Validate target index
            if (targetIndex === null || targetIndex === undefined || targetIndex < 0 || targetIndex >= enemies.length) {
                console.log(`[CombatScreen] Invalid target index: ${targetIndex}, enemies: ${enemies.length}`);
                // If only one enemy, auto-target it
                if (enemies.length === 1) {
                    targetIndex = 0;
                } else {
                    console.log('[CombatScreen] Cannot play attack without valid target');
                    return;
                }
            }
        }
        
        console.log(`[CombatScreen] ▶ Playing: ${card.name} (target: ${targetIndex})`);
        
        // Clear targeting state BEFORE playing card
        deselectCard();
        
        // ── Card Play Animation ──
        if (cardAnimator) {
            try {
                await cardAnimator.animateCardPlay(cardIndex, targetIndex, card);
            } catch (e) {
                console.warn('[CombatScreen] Card animation failed (non-fatal):', e);
            }
        }
        
        // Spend energy
        game.state.set('combat.energy', energy - card.cost);
        
        // Handle card effects
        applyCardEffects(card, targetIndex);
        
        // Move card from hand to discard
        hand.splice(cardIndex, 1);
        game.state.set('combat.hand', hand);
        
        if (!card.exhaust) {
            const discard = game.state.get('combat.discardPile') || [];
            discard.push(card);
            game.state.set('combat.discardPile', discard);
        } else {
            console.log(`[CombatScreen] Card exhausted: ${card.name}`);
        }
        
        // Check for combat end and update UI
        checkCombatEnd();
        renderCombatUI();
    }
    
    /**
     * Apply all effects of a card
     */
    function applyCardEffects(card, targetIndex) {
        const enemies = game.state.get('combat.enemies') || [];
        
        // ── VOID SYSTEMS: Process chain multiplier for this card play (once per card) ──
        if (game.voidSystems) {
            try {
                game.voidSystems.chains.processCardPlay(card);
                game.voidSystems.fragments.onCardPlayed({ card });
            } catch (e) {
                console.warn('[CombatScreen] Void chain/fragment processing failed (non-fatal):', e);
            }
        }
        
        // Handle damage
        const hasDamage = card.damage && (card.damage > 0 || typeof card.damage === 'string');
        if (hasDamage) {
            // ── Resolve dynamic damage values ──
            let cardDamage = card.damage;
            if (card.damage === 'block') {
                cardDamage = game.state.get('combat.block') || 0;
                console.log(`[CombatScreen] Body Slam: damage = ${cardDamage} (current block)`);
            } else if (card.damage === 'corruption') {
                cardDamage = game.state.get('corruption') || 0;
                console.log(`[CombatScreen] Corruption Pulse: damage = ${cardDamage} (corruption)`);
            } else if (card.damage === 'overheat' || card.damageMultiplier === 'overheat') {
                const heat = game.state.get('combat.overheat') || 0;
                const mult = card.damagePerOverheat || card.multiplier || 3;
                cardDamage = heat * mult;
                console.log(`[CombatScreen] Overheat scaling: ${heat} heat × ${mult} = ${cardDamage} damage`);
            } else if (typeof card.damage !== 'number') {
                cardDamage = 0; // Unknown string type, default 0
            }
            
            // ── Damage scaling from status (Fuel the Fire: +overheat; Titan's Wrath: +rage*5) ──
            if (card._damageScaling) {
                const src = card._damageScaling.source;
                const mult = card._damageScaling.multiplier || 1;
                const srcVal = game.state.get(`combat.${src}`) || 0;
                cardDamage += srcVal * mult;
                if (srcVal > 0) console.log(`[CombatScreen] Scaling: +${srcVal}×${mult} from ${src} → ${cardDamage}`);
            }
            
            // ── Conditional damage override (Rage Spike: if took_damage_this_turn, deal 8 instead) ──
            if (card._damageConditional) {
                const cond = card._damageConditional;
                let condMet = false;
                if (cond.trigger === 'took_damage_this_turn') {
                    condMet = game.state.get('combat.tookDamageThisTurn') || false;
                } else if (cond.trigger === 'overheat_10') {
                    condMet = (game.state.get('combat.overheat') || 0) >= 10;
                }
                if (condMet) {
                    cardDamage = cond.value;
                    console.log(`[CombatScreen] Conditional met (${cond.trigger}): damage = ${cardDamage}`);
                }
            }
            
            let damage = calculatePlayerDamage(cardDamage);
            
            // ── Astral Charge scaling (Lyria) ──
            const hasAstralScaling = card.effects?.some(e => e.scaling === 'astral_charge');
            if (hasAstralScaling) {
                const astralCharges = game.state.get('combat.astralCharge') || 0;
                damage += astralCharges;
                if (astralCharges > 0) console.log(`[CombatScreen] Astral scaling: +${astralCharges} damage`);
            }
            
            // ── Biome damage modifier ──
            if (biomeEffects) {
                const biomeMult = biomeEffects.getDamageModifier(card);
                if (biomeMult !== 1.0) {
                    damage = Math.floor(damage * biomeMult);
                    console.log(`[CombatScreen] Biome damage modifier: x${biomeMult} → ${damage}`);
                }
            }
            
            // ── Empower bonus from corruption currency ──
            if (corruptionCurrency) {
                const empowerBonus = corruptionCurrency.getEmpowerBonus();
                if (empowerBonus > 0) {
                    damage += empowerBonus;
                    corruptionCurrency.consumeEmpower();
                    console.log(`[CombatScreen] Empower bonus: +${empowerBonus} → ${damage}`);
                }
            }
            
            // ── VOID SYSTEMS: Fragment Damage Modifiers + Chain Multiplier ──
            if (game.voidSystems) {
                try {
                    const firstTarget = enemies[targetIndex] || enemies[0];
                    if (firstTarget) {
                        const fragDmg = game.voidSystems.fragments.calculateDamageModifiers(card, damage, firstTarget);
                        if (fragDmg.flatBonus !== 0 || fragDmg.multiplier !== 1.0) {
                            damage += fragDmg.flatBonus;
                            damage = Math.floor(damage * fragDmg.multiplier);
                        }
                    }
                    const chainedDamage = game.voidSystems.chains.applyToValue(damage, false);
                    if (chainedDamage !== damage) damage = chainedDamage;
                } catch (e) {
                    console.warn('[CombatScreen] Void systems damage calc failed (non-fatal):', e);
                }
            }
            
            // ── Helper: Apply damage to a single enemy ──
            function applyDamageToEnemy(eIdx, dmg) {
                if (!enemies[eIdx] || enemies[eIdx].currentHp <= 0) return 0;
                // Vulnerable increases damage taken by 50%
                let finalDmg = dmg;
                if (enemies[eIdx].vulnerable > 0) finalDmg = Math.floor(finalDmg * 1.5);
                
                const hits = card.hits || 1;
                let totalDealt = 0;
                let totalBlocked = 0;
                for (let h = 0; h < hits; h++) {
                    if (!enemies[eIdx] || enemies[eIdx].currentHp <= 0) break;
                    const blocked = Math.min(enemies[eIdx].block || 0, finalDmg);
                    enemies[eIdx].block = Math.max(0, (enemies[eIdx].block || 0) - blocked);
                    const hpDamage = finalDmg - blocked;
                    enemies[eIdx].currentHp -= hpDamage;
                    totalDealt += hpDamage;
                    totalBlocked += blocked;
                    if (!Number.isFinite(enemies[eIdx].currentHp)) enemies[eIdx].currentHp = 0;
                }
                console.log(`[CombatScreen] ${enemies[eIdx].name}: ${totalDealt + totalBlocked} damage (${totalBlocked} blocked), HP: ${enemies[eIdx].currentHp}/${enemies[eIdx].maxHp}`);
                game.eventBus.emit('damage:dealt', { target: enemies[eIdx], amount: totalDealt + totalBlocked, blocked: totalBlocked, hits });
                
                // ── Lifesteal (Reaper) ──
                if (card.lifesteal && totalDealt > 0) {
                    const hp = game.state.get('hero.hp') || 50;
                    const maxHp = game.state.get('hero.maxHp') || 80;
                    const healed = Math.min(totalDealt, maxHp - hp);
                    game.state.set('hero.hp', Math.min(maxHp, hp + totalDealt));
                    if (healed > 0) console.log(`[CombatScreen] Lifesteal: healed ${healed} HP`);
                }
                
                return totalDealt;
            }
            
            // ── AoE vs Single Target ──
            if (card.targetAllDamage) {
                // Apply to ALL enemies
                for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
                    applyDamageToEnemy(eIdx, damage);
                }
                // Check deaths (iterate in reverse to safely splice)
                for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
                    if (enemies[eIdx] && enemies[eIdx].currentHp <= 0) {
                        console.log(`[CombatScreen] ☠ ${enemies[eIdx].name} defeated!`);
                        game.eventBus.emit('enemy:defeated', enemies[eIdx]);
                        enemies.splice(eIdx, 1);
                    }
                }
                game.state.set('combat.enemies', enemies);
            } else if (targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
                // Single target
                applyDamageToEnemy(targetIndex, damage);
                
                // Check for enemy death
                if (enemies[targetIndex] && enemies[targetIndex].currentHp <= 0) {
                    console.log(`[CombatScreen] ☠ ${enemies[targetIndex].name} defeated!`);
                    if (game.voidSystems) {
                        try {
                            const overkillDamage = Math.abs(enemies[targetIndex].currentHp);
                            const remaining = enemies.filter((e, idx) => idx !== targetIndex && e.currentHp > 0);
                            game.voidSystems.processEnemyKill(enemies[targetIndex], overkillDamage, remaining);
                        } catch (e) { /* non-fatal */ }
                    }
                    game.eventBus.emit('enemy:defeated', enemies[targetIndex]);
                    enemies.splice(targetIndex, 1);
                }
                game.state.set('combat.enemies', enemies);
            }
        }
        
        // Handle block
        const hasBlock = card.block && (card.block > 0 || typeof card.block === 'string');
        if (hasBlock) {
            let blockVal = card.block;
            // ── Dynamic block values ──
            if (card.block === 'overheat') {
                blockVal = game.state.get('combat.overheat') || 0;
                // Note: actual reset is handled by reset_status processing
            } else if (card.block === 'missing_hp') {
                const hp = game.state.get('hero.hp') || 50;
                const maxHp = game.state.get('hero.maxHp') || 80;
                blockVal = maxHp - hp;
            } else if (typeof card.block !== 'number') {
                blockVal = 0;
            }
            
            let block = calculatePlayerBlock(blockVal);
            
            // ── VOID SYSTEMS: Fragment Block Modifiers (chain already processed in damage section) ──
            if (game.voidSystems) {
                try {
                    const fragBlk = game.voidSystems.fragments.calculateBlockModifiers(card, block);
                    if (fragBlk.flatBonus !== 0) {
                        block += fragBlk.flatBonus;
                        console.log(`[CombatScreen] Void fragment block bonus: +${fragBlk.flatBonus} → ${block}`);
                    }
                    // Apply chain multiplier to block if chain is active
                    block = game.voidSystems.chains.applyToValue(block, true);
                } catch (e) {
                    console.warn('[CombatScreen] Void systems block calc failed (non-fatal):', e);
                }
            }
            
            const currentBlock = game.state.get('combat.block') || 0;
            game.state.set('combat.block', currentBlock + block);
            console.log(`[CombatScreen] Gained ${block} block (total: ${currentBlock + block})`);
            
            game.eventBus.emit('block:gained', { amount: block });
            
            // ── on_gain_block triggers (Juggernaut: deal 3 damage to random enemy) ──
            const blockTriggers = game.state.get('combat.triggers') || [];
            blockTriggers.forEach(trigger => {
                if (trigger.trigger !== 'on_gain_block' || !trigger.apply) return;
                const applyEffect = trigger.apply;
                if (applyEffect.type === 'damage') {
                    const enemies = game.state.get('combat.enemies') || [];
                    const alive = enemies.filter(e => e.currentHp > 0);
                    if (alive.length > 0) {
                        const target = alive[Math.floor(Math.random() * alive.length)];
                        target.currentHp = Math.max(0, target.currentHp - (applyEffect.value || 3));
                        console.log(`[CombatScreen] Juggernaut: ${applyEffect.value} damage to ${target.name}`);
                        game.state.set('combat.enemies', enemies);
                        if (target.currentHp <= 0) {
                            game.eventBus.emit('enemy:defeated', target);
                        }
                    }
                }
            });
        }
        
        // Handle draw
        if (card.draw && card.draw > 0) {
            for (let i = 0; i < card.draw; i++) {
                drawCard();
            }
            console.log(`[CombatScreen] Drew ${card.draw} card(s)`);
        }
        
        // Handle energy gain
        if (card.energyGain && card.energyGain > 0) {
            const currentEnergy = game.state.get('combat.energy') || 0;
            game.state.set('combat.energy', currentEnergy + card.energyGain);
            console.log(`[CombatScreen] Gained ${card.energyGain} energy`);
        }
        
        // Handle debuffs on enemy
        if (targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
            if (card.applyVulnerable) {
                enemies[targetIndex].vulnerable = (enemies[targetIndex].vulnerable || 0) + card.applyVulnerable;
                console.log(`[CombatScreen] Applied ${card.applyVulnerable} Vulnerable`);
                showStatusFloater('enemy', '🎯', `+${card.applyVulnerable} Vulnerable`, '#ff6600', targetIndex);
                game.state.set('combat.enemies', enemies);
            }
            
            if (card.applyWeak) {
                enemies[targetIndex].weak = (enemies[targetIndex].weak || 0) + card.applyWeak;
                console.log(`[CombatScreen] Applied ${card.applyWeak} Weak`);
                showStatusFloater('enemy', '💫', `+${card.applyWeak} Weak`, '#888888', targetIndex);
                game.state.set('combat.enemies', enemies);
            }
            
            // DoT effects on enemies
            if (card.applyPoison) {
                enemies[targetIndex].poison = (enemies[targetIndex].poison || 0) + card.applyPoison;
                console.log(`[CombatScreen] Applied ${card.applyPoison} Poison to ${enemies[targetIndex].name}`);
                showStatusFloater('enemy', '☠️', `+${card.applyPoison} Poison`, '#00cc00', targetIndex);
                game.state.set('combat.enemies', enemies);
            }
            if (card.applyBleed) {
                enemies[targetIndex].bleed = (enemies[targetIndex].bleed || 0) + card.applyBleed;
                console.log(`[CombatScreen] Applied ${card.applyBleed} Bleed to ${enemies[targetIndex].name}`);
                showStatusFloater('enemy', '🩸', `+${card.applyBleed} Bleed`, '#cc0000', targetIndex);
                game.state.set('combat.enemies', enemies);
            }
            if (card.applyBurn) {
                enemies[targetIndex].burn = (enemies[targetIndex].burn || 0) + card.applyBurn;
                console.log(`[CombatScreen] Applied ${card.applyBurn} Burn to ${enemies[targetIndex].name}`);
                showStatusFloater('enemy', '🔥', `+${card.applyBurn} Burn`, '#ff4400', targetIndex);
                game.state.set('combat.enemies', enemies);
            }
        }
        
        // Handle strength gain
        if (card.strengthGain) {
            const str = game.state.get('combat.strength') || 0;
            game.state.set('combat.strength', str + card.strengthGain);
            console.log(`[CombatScreen] Gained ${card.strengthGain} Strength (total: ${str + card.strengthGain})`);
            showStatusFloater('player', '💪', `+${card.strengthGain} Strength`, '#ff4444');
        }
        
        // Handle dexterity gain
        if (card.dexterityGain) {
            const dex = game.state.get('combat.dexterity') || 0;
            game.state.set('combat.dexterity', dex + card.dexterityGain);
            console.log(`[CombatScreen] Gained ${card.dexterityGain} Dexterity (total: ${dex + card.dexterityGain})`);
            showStatusFloater('player', '🛡️', `+${card.dexterityGain} Dexterity`, '#44ff44');
        }
        
        // Handle overheat gain (Korvax)
        if (card.overheatGain) {
            const heat = game.state.get('combat.overheat') || 0;
            const newHeat = Math.min(15, heat + card.overheatGain);
            game.state.set('combat.overheat', newHeat);
            console.log(`[CombatScreen] Overheat: ${heat} → ${newHeat}`);
            showStatusFloater('player', '🌡️', `+${card.overheatGain} Heat`, '#ff4400');
            
            // Check for meltdown at 15
            if (newHeat >= 15) {
                console.log('[CombatScreen] 🔥 MELTDOWN TRIGGERED!');
                triggerMeltdown(enemies);
            }
        }
        
        // Handle overheat reduce
        if (card.overheatReduce) {
            const heat = game.state.get('combat.overheat') || 0;
            const newHeat = Math.max(0, heat - card.overheatReduce);
            game.state.set('combat.overheat', newHeat);
            console.log(`[CombatScreen] Overheat reduced: ${heat} → ${newHeat}`);
            showStatusFloater('player', '❄️', `-${card.overheatReduce} Heat`, '#4488ff');
        }
        
        // Handle overheat reset (Meltdown card: damage = overheat * multiplier)
        if (card.resetOverheat) {
            const heat = game.state.get('combat.overheat') || 0;
            game.state.set('combat.overheat', 0);
            console.log(`[CombatScreen] Overheat reset from ${heat}`);
        }
        
        // Handle rage gain (Korvax)
        if (card.rageGain) {
            const rage = game.state.get('combat.rage') || 0;
            game.state.set('combat.rage', rage + card.rageGain);
            console.log(`[CombatScreen] Gained ${card.rageGain} Rage (total: ${rage + card.rageGain})`);
            showStatusFloater('player', '😤', `+${card.rageGain} Rage`, '#ff0000');
        }
        
        // Handle armor gain (Korvax)
        if (card.armorGain) {
            const arm = game.state.get('combat.armor') || 0;
            game.state.set('combat.armor', arm + card.armorGain);
            console.log(`[CombatScreen] Gained ${card.armorGain} Armor (total: ${arm + card.armorGain})`);
            showStatusFloater('player', '🔩', `+${card.armorGain} Armor`, '#888888');
        }
        
        // Handle thorns gain
        if (card.thornsGain) {
            const th = game.state.get('combat.thorns') || 0;
            game.state.set('combat.thorns', th + card.thornsGain);
            console.log(`[CombatScreen] Gained ${card.thornsGain} Thorns (total: ${th + card.thornsGain})`);
            showStatusFloater('player', '🌹', `+${card.thornsGain} Thorns`, '#ff66cc');
        }
        
        // Handle counter gain (Korvax)
        if (card.counterGain) {
            const ctr = game.state.get('combat.counter') || 0;
            game.state.set('combat.counter', ctr + card.counterGain);
            console.log(`[CombatScreen] Gained ${card.counterGain} Counter (total: ${ctr + card.counterGain})`);
            showStatusFloater('player', '⚔️', `+${card.counterGain} Counter`, '#ffcc00');
        }
        
        // Handle intangible (self)
        if (card.applyIntangible) {
            const current = game.state.get('combat.intangible') || 0;
            game.state.set('combat.intangible', current + card.applyIntangible);
            console.log(`[CombatScreen] Gained ${card.applyIntangible} Intangible`);
            showStatusFloater('player', '👻', `+${card.applyIntangible} Intangible`, '#aaaaff');
        }
        
        // Handle stun on enemy
        if (card.applyStun && targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
            enemies[targetIndex].stun = (enemies[targetIndex].stun || 0) + card.applyStun;
            console.log(`[CombatScreen] Applied ${card.applyStun} Stun to ${enemies[targetIndex].name}`);
            showStatusFloater('enemy', '⭐', `Stunned!`, '#ffff00', targetIndex);
            game.state.set('combat.enemies', enemies);
        }
        
        // Handle slow on enemy
        if (card.applySlow && targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
            enemies[targetIndex].slow = (enemies[targetIndex].slow || 0) + card.applySlow;
            console.log(`[CombatScreen] Applied ${card.applySlow} Slow to ${enemies[targetIndex].name}`);
            game.state.set('combat.enemies', enemies);
        }
        
        // Handle power card triggers (persist for combat)
        if (card.triggers && card.triggers.length > 0) {
            const triggers = game.state.get('combat.triggers') || [];
            triggers.push(...card.triggers);
            game.state.set('combat.triggers', triggers);
            console.log(`[CombatScreen] Registered ${card.triggers.length} combat trigger(s)`);
        }
        
        // Handle heal
        if (card.heal && card.heal > 0) {
            const hp = game.state.get('hero.hp') || 80;
            const maxHp = game.state.get('hero.maxHp') || 80;
            const newHp = Math.min(maxHp, hp + card.heal);
            game.state.set('hero.hp', newHp);
            game.state.set('hero.hp', newHp);
            console.log(`[CombatScreen] Healed ${card.heal} HP`);
            
            game.eventBus.emit('heal', { amount: card.heal });
        }
        
        // Handle self damage (for Korvax rage cards)
        if (card.selfDamage && card.selfDamage > 0) {
            const hp = game.state.get('hero.hp') || 80;
            const newHp = Math.max(1, hp - card.selfDamage); // Don't kill yourself
            game.state.set('hero.hp', newHp);
            console.log(`[CombatScreen] Took ${card.selfDamage} self damage`);
            
            // ── Process on_self_damage triggers (Rupture: gain Strength from self-damage) ──
            const selfDmgTriggers = game.state.get('combat.triggers') || [];
            selfDmgTriggers.forEach(trigger => {
                if (trigger.trigger !== 'on_self_damage' || !trigger.apply) return;
                const applyEffect = trigger.apply;
                if (applyEffect.type === 'status' && applyEffect.status === 'strength') {
                    const str = game.state.get('combat.strength') || 0;
                    game.state.set('combat.strength', str + (applyEffect.value || 1));
                    console.log(`[CombatScreen] Rupture: +${applyEffect.value} Strength from self-damage`);
                    showStatusFloater('player', '💪', `+${applyEffect.value} Str`, '#ff4444');
                }
            });
        }
        
        // Handle player self-applied statuses
        if (card.applyRegen) {
            addPlayerStatus('regen', card.applyRegen);
            console.log(`[CombatScreen] Gained ${card.applyRegen} Regen`);
        }
        if (card.applyFrail) {
            // Frail on self (some corrupted cards)
            addPlayerStatus('frail', card.applyFrail);
            console.log(`[CombatScreen] Applied ${card.applyFrail} Frail to self`);
        }
        
        // ── All-enemies debuff handling ──
        if (card.targetAllEnemies) {
            enemies.forEach((enemy, i) => {
                if (enemy.currentHp <= 0) return;
                if (card.applyVulnerable) {
                    enemy.vulnerable = (enemy.vulnerable || 0) + card.applyVulnerable;
                    showStatusFloater('enemy', '🎯', `+${card.applyVulnerable} Vulnerable`, '#ff6600', i);
                }
                if (card.applyWeak) {
                    enemy.weak = (enemy.weak || 0) + card.applyWeak;
                    showStatusFloater('enemy', '💫', `+${card.applyWeak} Weak`, '#888888', i);
                }
                if (card.applyPoison) {
                    enemy.poison = (enemy.poison || 0) + card.applyPoison;
                    showStatusFloater('enemy', '☠️', `+${card.applyPoison} Poison`, '#00cc00', i);
                }
                if (card.applyBurn) {
                    enemy.burn = (enemy.burn || 0) + card.applyBurn;
                    showStatusFloater('enemy', '🔥', `+${card.applyBurn} Burn`, '#ff4400', i);
                }
            });
            if (card.applyVulnerable || card.applyWeak || card.applyPoison || card.applyBurn) {
                game.state.set('combat.enemies', enemies);
                console.log(`[CombatScreen] Applied debuffs to ALL enemies`);
            }
        }
        
        // ── Self-targeted Vulnerable (Berserk side-effect applied at trigger, not here) ──
        if (card.applySelfVulnerable) {
            addPlayerStatus('vulnerable', card.applySelfVulnerable);
            console.log(`[CombatScreen] Applied ${card.applySelfVulnerable} Vulnerable to self`);
        }
        
        // ── Self-targeted Weak ──
        if (card.applySelfWeak) {
            addPlayerStatus('weak', card.applySelfWeak);
            console.log(`[CombatScreen] Applied ${card.applySelfWeak} Weak to self`);
        }
        
        // ── Artifact gain (Panacea) ──
        if (card.artifactGain) {
            addPlayerStatus('artifact', card.artifactGain);
            console.log(`[CombatScreen] Gained ${card.artifactGain} Artifact`);
            showStatusFloater('player', '🛡️', `+${card.artifactGain} Artifact`, '#ffcc00');
        }
        
        // ── Enemy strength debuff (Piercing Wail) ──
        if (card._enemyStrength && card._enemyStrength.length > 0) {
            card._enemyStrength.forEach(sBuff => {
                enemies.forEach((enemy, i) => {
                    if (enemy.currentHp <= 0) return;
                    enemy.strength = (enemy.strength || 0) + sBuff.value;
                    const absVal = Math.abs(sBuff.value);
                    showStatusFloater('enemy', '💪', `${sBuff.value > 0 ? '+' : '-'}${absVal} Strength`, '#ff4444', i);
                });
            });
            game.state.set('combat.enemies', enemies);
            console.log(`[CombatScreen] Applied enemy strength debuff`);
        }
        
        // ── Reset status (Vent Heat: reset overheat; Meltdown: reset overheat) ──
        if (card._resetStatuses && card._resetStatuses.length > 0) {
            card._resetStatuses.forEach(statusName => {
                const stateKey = `combat.${statusName}`;
                const oldVal = game.state.get(stateKey) || 0;
                game.state.set(stateKey, 0);
                console.log(`[CombatScreen] Reset ${statusName}: ${oldVal} → 0`);
                
                // Special: Vent Heat - if block value was 'overheat', block was already set via card.block
                // For Vent Heat, block = overheat value (already handled by the block section if card.block is numeric)
                // But card.block is 'overheat' (string), so we need to handle it here
                if (statusName === 'overheat' && card.effects) {
                    const blockEffect = card.effects.find(e => e.type === 'block' && e.value === 'overheat');
                    if (blockEffect && oldVal > 0) {
                        let block = calculatePlayerBlock(oldVal);
                        const currentBlock = game.state.get('combat.block') || 0;
                        game.state.set('combat.block', currentBlock + block);
                        console.log(`[CombatScreen] Vent Heat: Gained ${block} block from ${oldVal} overheat`);
                        showStatusFloater('player', '🛡️', `+${block} Block`, '#4488ff');
                    }
                }
                if (statusName === 'rage') {
                    showStatusFloater('player', '😤', `Rage reset`, '#ff0000');
                }
            });
        }
        
        // ── Double status (Limit Break: double strength) ──
        if (card._doubleStatuses && card._doubleStatuses.length > 0) {
            card._doubleStatuses.forEach(statusName => {
                const stateKey = `combat.${statusName}`;
                const current = game.state.get(stateKey) || 0;
                if (current > 0) {
                    game.state.set(stateKey, current * 2);
                    console.log(`[CombatScreen] Doubled ${statusName}: ${current} → ${current * 2}`);
                    showStatusFloater('player', '💪', `${statusName} doubled!`, '#ff4444');
                }
            });
        }
        
        // ── Upgrade all cards in combat (Apotheosis) ──
        if (card.upgradeAllCards) {
            const upgrader = game.cardUpgradeSystem;
            let upgraded = 0;
            // Upgrade hand
            const hand = game.state.get('combat.hand') || [];
            hand.forEach(c => { if (!c.upgraded && c !== card) { if (upgrader) upgrader.upgradeCard(c); else { c.upgraded = true; if (c.damage) c.damage = Math.floor(c.damage * 1.25); if (c.block) c.block = Math.floor(c.block * 1.25); } upgraded++; } });
            game.state.set('combat.hand', hand);
            // Upgrade draw pile
            const drawPile = game.state.get('combat.drawPile') || [];
            drawPile.forEach(c => { if (!c.upgraded) { if (upgrader) upgrader.upgradeCard(c); else { c.upgraded = true; if (c.damage) c.damage = Math.floor(c.damage * 1.25); if (c.block) c.block = Math.floor(c.block * 1.25); } upgraded++; } });
            game.state.set('combat.drawPile', drawPile);
            // Upgrade discard pile
            const discardPile = game.state.get('combat.discardPile') || [];
            discardPile.forEach(c => { if (!c.upgraded) { if (upgrader) upgrader.upgradeCard(c); else { c.upgraded = true; if (c.damage) c.damage = Math.floor(c.damage * 1.25); if (c.block) c.block = Math.floor(c.block * 1.25); } upgraded++; } });
            game.state.set('combat.discardPile', discardPile);
            console.log(`[CombatScreen] Apotheosis! Upgraded ${upgraded} cards`);
            showStatusFloater('player', '✨', `${upgraded} cards upgraded!`, '#ffd700');
        }
        
        // ── Max HP gain (Feed: if enemy died this card play) ──
        if (card.maxHpGain && card.maxHpGain > 0) {
            // Check if an enemy was killed by this card
            const enemiesNow = game.state.get('combat.enemies') || [];
            // This only applies on kill — handled via _conditionals below
        }
        
        // ── Conditional effects (Bloodlust: on enemy_dies gain rage; Feed: on enemy_dies gain maxHp) ──
        if (card._conditionals && card._conditionals.length > 0) {
            const enemiesAfter = game.state.get('combat.enemies') || [];
            const enemiesBefore = enemies; // captured at start of applyCardEffects
            // If fewer enemies now, something died
            const enemyDied = enemiesAfter.length < enemiesBefore.length || 
                              enemiesAfter.some(e => e.currentHp <= 0);
            
            card._conditionals.forEach(cond => {
                if (cond.trigger === 'enemy_dies' && enemyDied && cond.apply) {
                    const applyEffect = cond.apply;
                    if (applyEffect.type === 'status' && applyEffect.status === 'rage') {
                        const rage = game.state.get('combat.rage') || 0;
                        game.state.set('combat.rage', rage + (applyEffect.value || 1));
                        console.log(`[CombatScreen] Conditional: Enemy died → +${applyEffect.value} Rage`);
                        showStatusFloater('player', '😤', `+${applyEffect.value} Rage`, '#ff0000');
                    }
                    if (applyEffect.type === 'max_hp') {
                        const maxHp = game.state.get('hero.maxHp') || 80;
                        const hp = game.state.get('hero.hp') || 50;
                        game.state.set('hero.maxHp', maxHp + applyEffect.value);
                        game.state.set('hero.hp', hp + applyEffect.value);
                        console.log(`[CombatScreen] Conditional: Enemy died → +${applyEffect.value} Max HP`);
                        showStatusFloater('player', '❤️', `+${applyEffect.value} Max HP`, '#ff4488');
                    }
                    if (applyEffect.type === 'credits') {
                        const credits = game.state.get('credits') || 0;
                        game.state.set('credits', credits + applyEffect.value);
                        console.log(`[CombatScreen] Conditional: Enemy died → +${applyEffect.value} Credits`);
                        showStatusFloater('player', '💰', `+${applyEffect.value} Credits`, '#ffd700');
                    }
                }
            });
        }
        
        // Handle corruption gain from player cards
        if (card.corruptionGain && card.corruptionGain > 0) {
            let corruptionGain = card.corruptionGain;
            if (biomeEffects) corruptionGain = biomeEffects.modifyCorruptionGain(corruptionGain);
            const oldCorruption = game.state.get('corruption') || 0;
            const newCorruption = Math.min(100, oldCorruption + corruptionGain);
            game.state.set('corruption', newCorruption);
            console.log(`[CombatScreen] Gained ${corruptionGain} Corruption (total: ${newCorruption})`);
            showStatusFloater('player', '🌑', `+${corruptionGain} Corruption`, '#8800ff');
            // Emit for CorruptionSystem visuals (state already set, so emit 'corruption:changed' not 'corruption:gained')
            game.eventBus.emit('corruption:changed', newCorruption);
            // Cascade: check if threshold was crossed
            if (game.corruptionCascade) {
                game.corruptionCascade.checkAndTrigger(oldCorruption, newCorruption);
            }
        }
        
        // Handle judgment gain (Auren)
        if (card.judgmentGain && card.judgmentGain > 0) {
            const judgment = game.state.get('combat.judgment') || 0;
            game.state.set('combat.judgment', judgment + card.judgmentGain);
            console.log(`[CombatScreen] Gained ${card.judgmentGain} Judgment (total: ${judgment + card.judgmentGain})`);
            showStatusFloater('player', '⚖️', `+${card.judgmentGain} Judgment`, '#ffdd00');
        }
        
        // ── Lyria: Astral Charge and Temporal Flux from effects array ──
        if (card.effects && Array.isArray(card.effects)) {
            card.effects.forEach(effect => {
                if (effect.type === 'astral_charge') {
                    const current = game.state.get('combat.astralCharge') || 0;
                    game.state.set('combat.astralCharge', current + (effect.value || 1));
                    console.log(`[CombatScreen] Gained ${effect.value || 1} Astral Charge (total: ${current + (effect.value || 1)})`);
                }
                if (effect.type === 'temporal_flux') {
                    const current = game.state.get('combat.temporalFlux') || 0;
                    game.state.set('combat.temporalFlux', current + (effect.value || 1));
                    console.log(`[CombatScreen] Gained ${effect.value || 1} Temporal Flux (total: ${current + (effect.value || 1)})`);
                }
                if (effect.type === 'consume_astral' && targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
                    // Consume all Astral Charge for bonus damage
                    const charges = game.state.get('combat.astralCharge') || 0;
                    if (charges > 0) {
                        const bonusDamage = charges * (effect.multiplier || 3);
                        enemies[targetIndex].currentHp -= bonusDamage;
                        game.state.set('combat.astralCharge', 0);
                        game.state.set('combat.enemies', enemies);
                        console.log(`[CombatScreen] Consumed ${charges} Astral Charges for ${bonusDamage} bonus damage`);
                        game.eventBus.emit('damage:dealt', { target: enemies[targetIndex], amount: bonusDamage, blocked: 0 });
                    }
                }
            });
        }
        
        // ── Astral scaling on damage (adds astralCharge to damage for scaling cards) ──
        // This is handled in the main damage block above via scaling property check
    }
    
    function drawCard() {
        let drawPile = game.state.get('combat.drawPile') || [];
        const hand = game.state.get('combat.hand') || [];
        
        if (drawPile.length === 0) {
            const discard = game.state.get('combat.discardPile') || [];
            if (discard.length === 0) {
                console.log('[CombatScreen] No cards to draw');
                return;
            }
            console.log('[CombatScreen] Reshuffling discard pile into draw pile');
            drawPile = discard.sort(() => Math.random() - 0.5);
            game.state.set('combat.discardPile', []);
        }
        
        if (drawPile.length > 0 && hand.length < 10) {
            const card = drawPile.pop();
            hand.push(card);
            game.state.set('combat.drawPile', drawPile);
            game.state.set('combat.hand', hand);
            console.log(`[CombatScreen] Drew: ${card.name}`);
        }
    }
    
    /**
     * Trigger Korvax meltdown — deal massive damage to ALL enemies, reset overheat
     */
    function triggerMeltdown(enemies) {
        const heat = game.state.get('combat.overheat') || 15;
        const meltdownDamage = heat * 3;
        
        console.log(`[CombatScreen] 🔥 MELTDOWN! Dealing ${meltdownDamage} to all enemies!`);
        
        enemies.forEach(enemy => {
            if (enemy.currentHp <= 0) return;
            const blocked = Math.min(enemy.block || 0, meltdownDamage);
            enemy.block = Math.max(0, (enemy.block || 0) - blocked);
            enemy.currentHp -= (meltdownDamage - blocked);
            console.log(`[CombatScreen] Meltdown: ${enemy.name} takes ${meltdownDamage} (HP: ${enemy.currentHp})`);
            game.eventBus.emit('damage:dealt', { target: enemy, amount: meltdownDamage, blocked, meltdown: true });
        });
        
        // Self-damage from meltdown
        const selfDamage = Math.floor(heat * 0.5);
        const hp = game.state.get('hero.hp') || 50;
        game.state.set('hero.hp', Math.max(1, hp - selfDamage));
        game.state.set('hero.hp', Math.max(1, hp - selfDamage));
        console.log(`[CombatScreen] Meltdown self-damage: ${selfDamage}`);
        
        game.state.set('combat.overheat', 0);
        
        // Remove dead enemies
        const alive = enemies.filter(e => e.currentHp > 0);
        const dead = enemies.filter(e => e.currentHp <= 0);
        dead.forEach(e => {
            console.log(`[CombatScreen] ☠ ${e.name} killed by MELTDOWN!`);
            game.eventBus.emit('enemy:defeated', e);
        });
        enemies.length = 0;
        enemies.push(...alive);
        game.state.set('combat.enemies', enemies);
        
        // Visual feedback
        showMeltdownEffect();
        game.eventBus.emit('meltdown:triggered', { damage: meltdownDamage, selfDamage });
    }
    
    /**
     * Show meltdown VFX overlay
     */
    function showMeltdownEffect() {
        const overlay = document.createElement('div');
        overlay.className = 'meltdown-overlay';
        overlay.innerHTML = '<div class="meltdown-text">🔥 MELTDOWN 🔥</div>';
        document.getElementById('combat-screen')?.appendChild(overlay);
        setTimeout(() => overlay.remove(), 1500);
    }
    
    /**
     * Show floating status text when buffs/debuffs are applied
     */
    function showStatusFloater(targetType, icon, text, color, enemyIndex) {
        const floater = document.createElement('div');
        floater.className = 'status-floater';
        floater.style.cssText = `
            position: fixed; z-index: 2000; pointer-events: none;
            font-family: 'Bebas Neue', sans-serif; font-size: 1rem;
            color: ${color}; text-shadow: 0 0 6px ${color}80;
            animation: statusFloat 1.2s ease-out forwards;
            white-space: nowrap;
        `;
        floater.textContent = `${icon} ${text}`;
        
        if (targetType === 'player') {
            floater.style.left = '80px';
            floater.style.bottom = '200px';
        } else if (targetType === 'enemy') {
            const enemyEl = document.querySelector(`.enemy[data-index="${enemyIndex || 0}"]`);
            if (enemyEl) {
                const rect = enemyEl.getBoundingClientRect();
                floater.style.left = `${rect.left + rect.width / 2}px`;
                floater.style.top = `${rect.top}px`;
            } else {
                floater.style.left = '50%';
                floater.style.top = '40%';
            }
        }
        
        document.body.appendChild(floater);
        setTimeout(() => floater.remove(), 1200);
    }
    
    function endTurn() {
        if (game.state.get('combat.victoryPending')) {
            console.log('[CombatScreen] Victory pending, ignoring end turn');
            return;
        }
        
        console.log('[CombatScreen] ═══ Ending player turn... ═══');
        
        // NOTE: Block is NOT reset here - it persists to absorb enemy damage
        // Block will be reset at the START of the next player turn
        
        // Clear selection
        deselectCard();
        
        // Process player end-of-turn statuses (DoTs, regen, tick durations)
        const hpAfterDots = processPlayerEndOfTurnStatuses();
        if (hpAfterDots <= 0) {
            console.log('[CombatScreen] ☠ Player killed by DoT effects!');
            game.eventBus.emit('combat:defeat');
            game.eventBus.emit('player:death');
            return;
        }
        
        // ── Clean up temporary cascade card modifications ──
        if (game.corruptionCascade) game.corruptionCascade.onTurnEnd();
        
        enemyTurn();
    }
    
    function enemyTurn() {
        const enemies = game.state.get('combat.enemies') || [];
        let playerHp = game.state.get('hero.hp') || 50;
        let playerBlock = game.state.get('combat.block') || 0;
        
        console.log('[CombatScreen] ═══ Enemy turn ═══');
        console.log(`[CombatScreen] Player block going into enemy turn: ${playerBlock}`);
        
        // FIX: Reset enemy block at the START of their turn.
        enemies.forEach(e => { e.block = 0; });
        
        // ── Biome: Shifting Faces may change enemy intents ──
        if (biomeEffects) {
            const shifted = biomeEffects.applyShiftingFaces(enemies);
            if (shifted !== enemies) {
                enemies.length = 0;
                enemies.push(...shifted);
                game.state.set('combat.enemies', enemies);
            }
        }
        
        enemies.forEach((enemy, i) => {
            if (!enemy.intent) return;
            
            // Check if enemy is stunned
            if (enemy.stun > 0) {
                console.log(`[CombatScreen] ${enemy.name} is STUNNED and cannot act!`);
                // Stun will tick down after action block
                // Skip to intent generation
            } else {
            // ══════ BOSS PHASE TRANSITION CHECK ══════
            if (enemy.aiBehavior === 'phased' && enemy.phases && enemy.phases.length > 0) {
                const hpPercent = (enemy.currentHp / enemy.maxHp) * 100;
                const prevPhase = enemy._currentPhaseIndex || 0;
                let newPhaseIndex = 0;
                
                for (let p = enemy.phases.length - 1; p >= 0; p--) {
                    if (hpPercent <= enemy.phases[p].hpThreshold) {
                        newPhaseIndex = p;
                        break;
                    }
                }
                
                if (newPhaseIndex !== prevPhase) {
                    enemy._currentPhaseIndex = newPhaseIndex;
                    const phase = enemy.phases[newPhaseIndex];
                    console.log(`[CombatScreen] ⚡ BOSS PHASE CHANGE: ${enemy.name} → ${phase.name}`);
                    
                    if (phase.onEnter) {
                        if (phase.onEnter.type === 'buff') {
                            const effect = phase.onEnter.effect;
                            const value = phase.onEnter.value || 0;
                            if (effect === 'strength') {
                                enemy.strength = (enemy.strength || 0) + value;
                            } else if (effect === 'armor') {
                                enemy.block = (enemy.block || 0) + value;
                            } else if (effect === 'thorns') {
                                enemy.thorns = (enemy.thorns || 0) + value;
                            }
                        } else if (phase.onEnter.type === 'heal') {
                            enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + (phase.onEnter.value || 0));
                        }
                    }
                    
                    enemy.intentIndex = 0;
                    showBossPhaseTransition(enemy, phase);
                    game.eventBus.emit('boss:phaseChange', { enemy, phase, phaseIndex: newPhaseIndex });
                }
            }
            
            // ══════ Helper: apply single attack hit to player ══════
            function applyEnemyHit(baseDamage) {
                // Apply player vulnerable (increases incoming damage by 50%)
                let finalDamage = calculateIncomingDamage(baseDamage);
                
                // ── VOID SYSTEMS: Incoming damage modifier (Glass Cannon etc.) ──
                if (game.voidSystems) {
                    try {
                        finalDamage = game.voidSystems.processIncomingDamage(finalDamage);
                    } catch (e) {
                        console.warn('[CombatScreen] Void incoming damage failed (non-fatal):', e);
                    }
                }
                
                const blocked = Math.min(playerBlock, finalDamage);
                playerBlock -= blocked;
                const hpDamage = finalDamage - blocked;
                playerHp -= hpDamage;
                
                // Trigger on-hit effects if damage went through
                if (hpDamage > 0) {
                    // Track for conditional cards (Rage Spike)
                    game.state.set('combat.tookDamageThisTurn', true);
                    
                    // Thorns: deal damage back to attacker
                    const thorns = game.state.get('combat.thorns') || 0;
                    if (thorns > 0) {
                        enemy.currentHp = Math.max(0, enemy.currentHp - thorns);
                        console.log(`[CombatScreen] Thorns deals ${thorns} to ${enemy.name}`);
                        game.eventBus.emit('thorns:triggered', { damage: thorns, target: enemy });
                    }
                    
                    // Counter: deal damage back to attacker (resets each turn)
                    const counter = game.state.get('combat.counter') || 0;
                    if (counter > 0) {
                        enemy.currentHp = Math.max(0, enemy.currentHp - counter);
                        console.log(`[CombatScreen] Counter deals ${counter} to ${enemy.name}`);
                        game.eventBus.emit('counter:triggered', { damage: counter, target: enemy });
                    }
                    
                    // Rage gain on damage (Korvax)
                    const heroId = game.state.get('hero.id') || 'korvax';
                    // Process all on-damage-taken triggers (Rage Protocol, Rupture, etc.)
                    const triggers = game.state.get('combat.triggers') || [];
                    triggers.forEach(trigger => {
                        const matchesDamageTaken = trigger.on === 'take_damage' || 
                                                   trigger.trigger === 'on_damage_taken' ||
                                                   trigger.on === 'on_damage_taken';
                        if (!matchesDamageTaken || !trigger.apply) return;
                        
                        const applyEffect = trigger.apply;
                        if (applyEffect.type === 'rage' || (applyEffect.type === 'status' && applyEffect.status === 'rage')) {
                            const currentRage = game.state.get('combat.rage') || 0;
                            const rageGain = applyEffect.value || 1;
                            game.state.set('combat.rage', currentRage + rageGain);
                            console.log(`[CombatScreen] On-hit trigger: +${rageGain} Rage (total: ${currentRage + rageGain})`);
                        }
                        if (applyEffect.type === 'status' && applyEffect.status === 'strength') {
                            const currentStr = game.state.get('combat.strength') || 0;
                            game.state.set('combat.strength', currentStr + (applyEffect.value || 1));
                            console.log(`[CombatScreen] On-hit trigger: +${applyEffect.value} Strength (Rupture)`);
                        }
                    });
                }
                
                return { finalDamage, blocked, hpDamage };
            }
            
            // ══════ EXECUTE INTENT ══════
            if (enemy.intent.type === 'attack' || enemy.intent.type === 'heavy_attack') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                
                const hits = enemy.intent.hits || enemy.intent.times || 1;
                for (let h = 0; h < hits; h++) {
                    const result = applyEnemyHit(baseDamage);
                    console.log(`[CombatScreen] ${enemy.name} hit ${h+1}/${hits} for ${result.finalDamage} (${result.blocked} blocked, ${result.hpDamage} to HP)`);
                    game.eventBus.emit('player:damaged', { amount: result.finalDamage, blocked: result.blocked, hpDamage: result.hpDamage });
                }
                
                if (!Number.isFinite(playerHp)) {
                    playerHp = Math.max(0, (game.state.get('hero.hp') || 50) - baseDamage);
                }
                
            } else if (enemy.intent.type === 'multi_attack') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                const hits = enemy.intent.hits || enemy.intent.times || 2;
                for (let h = 0; h < hits; h++) {
                    const result = applyEnemyHit(baseDamage);
                    console.log(`[CombatScreen] ${enemy.name} multi-hit ${h+1}/${hits} for ${result.finalDamage} (${result.blocked} blocked)`);
                    game.eventBus.emit('player:damaged', { amount: result.finalDamage, blocked: result.blocked, hpDamage: result.hpDamage });
                }
                if (!Number.isFinite(playerHp)) playerHp = Math.max(0, (game.state.get('hero.hp') || 50) - baseDamage);
                
            } else if (enemy.intent.type === 'attack_debuff') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                const result = applyEnemyHit(baseDamage);
                console.log(`[CombatScreen] ${enemy.name} attack+debuff for ${result.finalDamage} (${result.blocked} blocked)`);
                game.eventBus.emit('player:damaged', { amount: result.finalDamage, blocked: result.blocked });
                // Apply the debuff
                applyEnemyDebuffToPlayer(enemy.intent.effect, enemy.intent.value || 1);
                if (!Number.isFinite(playerHp)) playerHp = Math.max(0, (game.state.get('hero.hp') || 50) - baseDamage);
                
            } else if (enemy.intent.type === 'block' || enemy.intent.type === 'defend') {
                const blockAmount = enemy.intent.value || enemy.intent.block || 5;
                enemy.block = (enemy.block || 0) + blockAmount;
                console.log(`[CombatScreen] ${enemy.name} gains ${blockAmount} block (total: ${enemy.block})`);
                
            } else if (enemy.intent.type === 'buff') {
                const effect = enemy.intent.effect;
                const value = enemy.intent.value || 1;
                if (effect === 'strength') {
                    enemy.strength = (enemy.strength || 0) + value;
                    console.log(`[CombatScreen] ${enemy.name} gains ${value} Strength (total: ${enemy.strength})`);
                } else if (effect === 'armor') {
                    enemy.block = (enemy.block || 0) + value;
                    console.log(`[CombatScreen] ${enemy.name} gains ${value} Armor`);
                }
                
            } else if (enemy.intent.type === 'debuff') {
                const effect = enemy.intent.effect;
                const value = enemy.intent.value || 1;
                applyEnemyDebuffToPlayer(effect, value);
                console.log(`[CombatScreen] ${enemy.name} applies ${value} ${effect} to player`);
                
            } else if (enemy.intent.type === 'heal') {
                const healAmount = enemy.intent.value || enemy.intent.heal || 5;
                enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + healAmount);
                console.log(`[CombatScreen] ${enemy.name} heals ${healAmount} HP`);
                
            } else if (enemy.intent.type === 'summon') {
                console.log(`[CombatScreen] ${enemy.name} attempts summon (not yet implemented)`);
            }
            
            } // end of stun else block
            
            // Generate next intent — phased bosses use phase-specific intents
            if (enemy.aiBehavior === 'phased' && enemy.phases) {
                const phaseIdx = enemy._currentPhaseIndex || 0;
                const phase = enemy.phases[phaseIdx];
                if (phase && phase.intents && phase.intents.length > 0) {
                    const idx = (enemy.intentIndex || 0) % phase.intents.length;
                    enemy.intent = { ...phase.intents[idx] };
                    enemy.intentIndex = (idx + 1);
                } else {
                    enemy.intent = generateIntent(enemy);
                }
            } else {
                enemy.intent = generateIntent(enemy);
            }
            
            // Tick down enemy debuffs AFTER they act (so debuffs affect this turn's actions)
            if (enemy.vulnerable > 0) {
                enemy.vulnerable--;
                console.log(`[CombatScreen] ${enemy.name} vulnerable ticks: ${enemy.vulnerable + 1} → ${enemy.vulnerable}`);
            }
            if (enemy.weak > 0) {
                enemy.weak--;
                console.log(`[CombatScreen] ${enemy.name} weak ticks: ${enemy.weak + 1} → ${enemy.weak}`);
            }
            if (enemy.stun > 0) {
                enemy.stun--;
            }
            if (enemy.slow > 0) {
                enemy.slow--;
            }
        });
        
        // Process enemy end-of-turn DoTs (poison, bleed, burn on enemies)
        processEnemyEndOfTurnStatuses(enemies);
        
        game.state.set('hero.hp', Math.max(0, playerHp));
        game.state.set('hero.hp', Math.max(0, playerHp));
        game.state.set('combat.block', playerBlock);
        game.state.set('combat.enemies', enemies);
        
        // Check for enemy deaths from DoTs
        checkCombatEnd();
        
        // Check for player death
        if (playerHp <= 0) {
            console.log('[CombatScreen] ☠ Player defeated!');
            game.eventBus.emit('combat:defeat');
            game.eventBus.emit('player:death');
            return;
        }
        
        // Start next player turn
        setTimeout(startPlayerTurn, 500);
    }
    
    /**
     * Apply a debuff from an enemy intent to the player
     */
    function applyEnemyDebuffToPlayer(effect, value) {
        if (!effect || !value) return;
        
        switch (effect) {
            case 'weak':
                addPlayerStatus('weak', value);
                break;
            case 'vulnerable':
                addPlayerStatus('vulnerable', value);
                break;
            case 'frail':
                addPlayerStatus('frail', value);
                break;
            case 'poison':
                addPlayerStatus('poison', value);
                break;
            case 'bleed':
                addPlayerStatus('bleed', value);
                break;
            case 'burn':
                addPlayerStatus('burn', value);
                break;
            case 'corruption':
                const corruption = game.state.get('corruption') || 0;
                let corruptionGain = value;
                if (biomeEffects) corruptionGain = biomeEffects.modifyCorruptionGain(corruptionGain);
                const newCorruption = Math.min(100, corruption + corruptionGain);
                game.state.set('corruption', newCorruption);
                // Emit changed (not gained) since state is already set — avoids double-add in CorruptionSystem
                game.eventBus.emit('corruption:changed', newCorruption);
                // ── Cascade: check if threshold was crossed ──
                if (game.corruptionCascade) {
                    game.corruptionCascade.checkAndTrigger(corruption, newCorruption);
                }
                break;
            default:
                console.log(`[CombatScreen] Unknown debuff from enemy: ${effect}`);
        }
    }
    
    /**
     * Show boss phase transition overlay with dialogue and screen shake
     */
    function showBossPhaseTransition(enemy, phase) {
        const dialogue = phase.dialogue || enemy.dialogue?.[`phase${(enemy._currentPhaseIndex || 0) + 1}`] || '';
        
        const existing = document.getElementById('phase-transition-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'phase-transition-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 1500;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
        `;
        
        overlay.innerHTML = `
            <div style="font-family: 'Bebas Neue', 'Courier New', monospace; font-size: 0.85rem;
                letter-spacing: 0.3em; color: #ff4444; margin-bottom: 0.5rem;
                text-transform: uppercase; animation: bossPhaseFlicker 1s ease-in-out infinite;">
                ⚠ PHASE SHIFT ⚠
            </div>
            <div style="font-family: 'Bebas Neue', 'Courier New', monospace; font-size: 1.6rem;
                letter-spacing: 0.1em; color: #ff6b00; margin-bottom: 1rem;
                text-shadow: 0 0 20px rgba(255, 107, 0, 0.5);">
                ${phase.name || 'New Phase'}
            </div>
            ${dialogue ? `<div style="font-style: italic; color: #e0e0e8; font-size: 1.1rem;
                max-width: 500px; text-align: center; line-height: 1.6;
                opacity: 0; animation: bossPhaseDialogue 0.6s ease-out 0.4s forwards;">
                "${dialogue}"
            </div>` : ''}
            <style>
                @keyframes bossPhaseFlicker { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
                @keyframes bossPhaseDialogue { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes bossScreenShake {
                    0%, 100% { transform: translate(0, 0); }
                    10% { transform: translate(-5px, -3px); }
                    20% { transform: translate(5px, 3px); }
                    30% { transform: translate(-3px, 5px); }
                    40% { transform: translate(3px, -5px); }
                    50% { transform: translate(-2px, 2px); }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
        
        // Screen shake
        const combatScreen = document.getElementById('combat-screen');
        if (combatScreen) {
            combatScreen.style.animation = 'none';
            combatScreen.offsetHeight; // force reflow
            combatScreen.style.animation = 'bossScreenShake 0.5s ease-out';
        }
        
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
        }, 2200);
    }
    
    function generateIntent(enemy) {
        if (enemy.intents && enemy.intents.length > 0) {
            const intentIndex = enemy.intentIndex || 0;
            const intent = { ...enemy.intents[intentIndex % enemy.intents.length] };
            enemy.intentIndex = (intentIndex + 1) % enemy.intents.length;
            return intent;
        }
        
        // Random fallback
        const types = ['attack', 'attack', 'block'];
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type,
            damage: type === 'attack' ? Math.floor(Math.random() * 5) + 6 : 0,
            value: type === 'block' ? Math.floor(Math.random() * 5) + 5 : 0
        };
    }
    
    function startPlayerTurn() {
        console.log('[CombatScreen] ═══ Player turn ═══');
        
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        game.state.set('combat.energy', maxEnergy);
        
        // ── Check for retain_block (Barricade power) ──
        const triggers = game.state.get('combat.triggers') || [];
        const hasRetainBlock = triggers.some(t => t.status === 'retain_block' || t.retainBlock);
        
        // Reset player block at start of NEW player turn (after enemies have attacked)
        if (!hasRetainBlock) {
            game.state.set('combat.block', 0);
        } else {
            console.log('[CombatScreen] Barricade: Block retained!');
        }
        
        // Discard hand
        const hand = game.state.get('combat.hand') || [];
        const discard = game.state.get('combat.discardPile') || [];
        
        // ── VOID SYSTEMS: Notify fragment system of end-of-turn discards (Discard Harvest) ──
        if (game.voidSystems && hand.length > 0) {
            try {
                for (let i = 0; i < hand.length; i++) {
                    game.voidSystems.fragments.onCardDiscarded({ card: hand[i] });
                }
                game.eventBus.emit('turn:end');
            } catch (e) {
                // Silent - cosmetic only
            }
        }
        
        discard.push(...hand);
        game.state.set('combat.discardPile', discard);
        game.state.set('combat.hand', []);
        
        // FIX: Enemy block is NOT reset here anymore.
        // Block gained during enemy turn persists through the player's turn
        // so the player must punch through it. It resets at the start of
        // the ENEMY turn instead (see enemyTurn()).
        
        // Draw new hand
        for (let i = 0; i < 5; i++) drawCard();
        
        // ── Biome: Apply Temporal Flux card cost changes ──
        if (biomeEffects) {
            let hand = game.state.get('combat.hand') || [];
            const modifiedHand = biomeEffects.onTurnStart(hand);
            if (modifiedHand !== hand) {
                game.state.set('combat.hand', modifiedHand);
            }
        }
        
        // ── Corruption Currency: Tick cooldowns ──
        if (corruptionCurrency) {
            corruptionCurrency.onTurnStart();
        }
        
        game.state.set('combat.turn', (game.state.get('combat.turn') || 1) + 1);
        
        // Reset per-turn tracking
        game.state.set('combat.tookDamageThisTurn', false);
        
        // ══════ PROCESS POWER CARD TRIGGERS: turn_start ══════
        if (triggers.length > 0) {
            const enemies = game.state.get('combat.enemies') || [];
            triggers.forEach(trigger => {
                if (trigger.trigger !== 'turn_start') return;
                try {
                    const applies = Array.isArray(trigger.apply) ? trigger.apply : [trigger.apply];
                    applies.forEach(applyEffect => {
                        if (!applyEffect) return;
                        switch (applyEffect.type) {
                            case 'block': {
                                const block = calculatePlayerBlock(applyEffect.value || 0);
                                const cb = game.state.get('combat.block') || 0;
                                game.state.set('combat.block', cb + block);
                                console.log(`[CombatScreen] Power trigger: +${block} Block (turn_start)`);
                                showStatusFloater('player', '🛡️', `+${block} Block`, '#4488ff');
                                break;
                            }
                            case 'energy': {
                                const ce = game.state.get('combat.energy') || 0;
                                game.state.set('combat.energy', ce + (applyEffect.value || 1));
                                console.log(`[CombatScreen] Power trigger: +${applyEffect.value} Energy (turn_start)`);
                                showStatusFloater('player', '⚡', `+${applyEffect.value} Energy`, '#00f5ff');
                                break;
                            }
                            case 'draw': {
                                for (let d = 0; d < (applyEffect.value || 1); d++) drawCard();
                                console.log(`[CombatScreen] Power trigger: Draw ${applyEffect.value} (turn_start)`);
                                break;
                            }
                            case 'status': {
                                const sName = applyEffect.status;
                                const sTarget = applyEffect.target || 'self';
                                if (sTarget === 'self' || sTarget === undefined) {
                                    const stateKey = `combat.${sName}`;
                                    const cv = game.state.get(stateKey) || 0;
                                    game.state.set(stateKey, cv + (applyEffect.value || 1));
                                    console.log(`[CombatScreen] Power trigger: +${applyEffect.value} ${sName} (turn_start)`);
                                    const icons = { strength: '💪', rage: '😤', dexterity: '🛡️', overheat: '🌡️', vulnerable: '🎯' };
                                    showStatusFloater('player', icons[sName] || '⬆', `+${applyEffect.value} ${sName}`, '#ff4444');
                                } else if (sTarget === 'self') {
                                    addPlayerStatus(sName, applyEffect.value || 1);
                                }
                                break;
                            }
                            case 'self_damage': {
                                const hp = game.state.get('hero.hp') || 50;
                                game.state.set('hero.hp', Math.max(1, hp - (applyEffect.value || 1)));
                                console.log(`[CombatScreen] Power trigger: -${applyEffect.value} HP (turn_start)`);
                                break;
                            }
                            default:
                                console.log(`[CombatScreen] Unhandled turn_start trigger apply type: ${applyEffect.type}`);
                        }
                    });
                } catch (e) {
                    console.warn('[CombatScreen] Turn start trigger failed:', e);
                }
            });
        }
        
        // ── VOID SYSTEMS: Emit turn:start for chain persistence + fragment triggers ──
        if (game.voidSystems) {
            try {
                game.eventBus.emit('turn:start');
            } catch (e) {
                // Silent
            }
        }
        
        renderCombatUI();
    }
    
    function checkCombatEnd() {
        const enemies = game.state.get('combat.enemies') || [];
        if (enemies.length === 0) {
            console.log('[CombatScreen] ═══ VICTORY! ═══');
            
            game.state.set('combat.victoryPending', true);
            
            setTimeout(() => {
                game.eventBus.emit('combat:victory');
                
                const rewards = {
                    credits: Math.floor(Math.random() * 20) + 15,
                    cardChoices: [],
                    claimed: { credits: false, card: false }
                };
                
                try {
                    const heroId = game.state.get('hero.id') || 'korvax';
                    const cards = game.dataLoader?.getCardsForHero?.(heroId) || [];
                    rewards.cardChoices = cards
                        .filter(c => c.rarity !== 'starter')
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 3)
                        .map(normalizeCard);
                } catch (e) {
                    console.warn('[CombatScreen] Card rewards failed:', e);
                }
                
                // ── Apply biome victory bonuses (Scavenger's Luck) ──
                if (biomeEffects) {
                    const modified = biomeEffects.onCombatVictory(rewards);
                    Object.assign(rewards, modified);
                }
                
                // ── Clean up combat systems ──
                if (biomeEffects) biomeEffects.onCombatEnd();
                if (corruptionCurrency) corruptionCurrency.onCombatEnd();
                if (unreliableUI) unreliableUI.stopAmbientDistortions();
                
                game.state.set('rewards.pending', rewards);
                game.mapGenerator?.completeCurrentNode?.();
                forceScreenTransition(game, 'reward-screen');
            }, 500);
        }
    }
    
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[CombatScreen] forceScreenTransition to: ${targetScreenId}`);
        
        // ── Clean up combat UI overlays ──
        const voidPanel = document.getElementById('void-channel-panel');
        if (voidPanel) voidPanel.remove();
        const biomeBanner = document.getElementById('biome-banner');
        if (biomeBanner) biomeBanner.remove();
        
        // ── Clean up CardPreview overlay if active ──
        if (cardPreview) {
            try { cardPreview.closePreview(); } catch(e) {}
        }
        
        const combatScreen = document.getElementById('combat-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[CombatScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        if (combatScreen) {
            combatScreen.classList.remove('active', 'fade-in');
            combatScreen.classList.add('fade-out');
            combatScreen.style.cssText = '';
        }
        
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
            }
        } catch (e) {
            console.error('[CombatScreen] screenManager.transitionTo failed:', e);
        }
        
        setTimeout(() => {
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== targetScreenId) {
                    screen.classList.remove('active', 'fade-in');
                    screen.style.cssText = '';
                }
            });
            
            targetScreen.classList.remove('fade-out');
            targetScreen.classList.add('active');
            targetScreen.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 1000 !important;
                pointer-events: auto !important;
            `;
            
            if (game.screenManager) {
                game.screenManager.previousScreen = game.screenManager.currentScreen;
                game.screenManager.currentScreen = targetScreenId;
                game.screenManager.transitioning = false;
            }
            
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'combat-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
            game.eventBus.emit('screen:change', targetScreenId);
        }, 100);
    }
    
    function setupCombatButtons() {
        const endTurnBtn = document.getElementById('btn-end-turn') || document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            const newBtn = endTurnBtn.cloneNode(true);
            endTurnBtn.parentNode.replaceChild(newBtn, endTurnBtn);
            newBtn.addEventListener('click', endTurn);
        }
    }
    
    // Add keyboard support
    document.addEventListener('keydown', (e) => {
        if (game.screenManager?.currentScreen !== 'combat-screen') return;
        
        // Escape to deselect
        if (e.key === 'Escape') {
            deselectCard();
        }
        
        // Number keys to select cards
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            const hand = game.state.get('combat.hand') || [];
            if (num <= hand.length) {
                selectCard(num - 1);
            }
        }
        
        // E to end turn
        if (e.key === 'e' || e.key === 'E') {
            endTurn();
        }
    });
    
    return { initializeCombat, renderCombatUI, endTurn, playCard, drawCard, selectCard, deselectCard };
}
