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
 * @version 0.3.0
 */

export function setupCombatScreen(game) {
    const screen = document.getElementById('combat-screen');
    
    console.log('[CombatScreen] Setting up combat screen v0.2.9');
    
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
                renderCombatUI();
                setupCombatButtons();
                setupPileViewers();
                console.log('[CombatScreen] Combat initialization complete');
            }, 50);
        });
    }
    
    /**
     * Try to get deck from DataLoader.getStarterDeck()
     */
    function getDeckFromDataLoader() {
        const heroId = game.state.get('heroId') || game.state.get('hero.id') || 'korvax';
        
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
    function normalizeCard(card) {
        const normalized = { ...card };
        
        if (!normalized.instanceId) {
            normalized.instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        if (card.effects && Array.isArray(card.effects)) {
            card.effects.forEach(effect => {
                switch (effect.type) {
                    case 'damage':
                        if (typeof effect.value === 'number') normalized.damage = effect.value;
                        break;
                    case 'block':
                        if (typeof effect.value === 'number') normalized.block = effect.value;
                        break;
                    case 'draw':
                        if (typeof effect.value === 'number') normalized.draw = effect.value;
                        break;
                    case 'energy':
                        if (typeof effect.value === 'number') normalized.energyGain = effect.value;
                        break;
                    case 'self_damage':
                        normalized.selfDamage = effect.value;
                        break;
                    case 'vulnerable':
                        normalized.applyVulnerable = effect.value;
                        break;
                    case 'weak':
                        normalized.applyWeak = effect.value;
                        break;
                    case 'strength':
                        normalized.strengthGain = effect.value;
                        break;
                    case 'heal':
                        normalized.heal = effect.value;
                        break;
                }
            });
        }
        
        return normalized;
    }
    
    /**
     * Generate a starter deck as fallback
     */
    function generateStarterDeck() {
        const heroId = game.state.get('heroId') || game.state.get('hero.id') || 'korvax';
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
    
    function initializeCombatState(enemies, deck) {
        console.log('[CombatScreen] Initializing combat state...');
        
        game.state.set('combat.turn', 1);
        game.state.set('combat.playerTurn', true);
        game.state.set('combat.block', 0);
        game.state.set('combat.strength', 0);
        game.state.set('combat.dexterity', 0);
        
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
    }
    
    function renderCombatUI() {
        console.log('[CombatScreen] Rendering combat UI...');
        renderPlayer();
        renderEnemies();
        renderHand();
        renderEnergy();
        renderPileCounters();
    }
    
    function renderPlayer() {
        const hp = game.state.get('hp') || game.state.get('hero.hp') || 80;
        const maxHp = game.state.get('maxHp') || game.state.get('hero.maxHp') || 80;
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
     * Render enemies with click handlers for targeting
     */
    function renderEnemies() {
        const container = document.getElementById('enemies-container') || document.getElementById('enemy-area');
        if (!container) {
            console.error('[CombatScreen] Enemy container not found!');
            return;
        }
        
        const enemies = game.state.get('combat.enemies') || [];
        
        container.innerHTML = enemies.map((enemy, i) => {
            const intentType = enemy.intent?.type || 'unknown';
            const intentClass = `intent-${intentType}`;
            
            return `
                <div class="enemy" data-index="${i}" data-enemy-id="${enemy.id || enemy.instanceId || i}">
                    <div class="enemy-intent ${intentClass}">
                        ${renderIntentContent(enemy.intent)}
                    </div>
                    <div class="enemy-sprite"><div class="enemy-icon">👁️</div></div>
                    <div class="enemy-name">${enemy.name || 'Enemy'}</div>
                    <div class="enemy-hp-bar-container">
                        <div class="enemy-hp-bar" style="width: ${(enemy.currentHp / enemy.maxHp) * 100}%"></div>
                    </div>
                    <div class="enemy-hp-text">${enemy.currentHp}/${enemy.maxHp}</div>
                    ${enemy.block > 0 ? `<div class="enemy-block">🛡️ ${enemy.block}</div>` : ''}
                    ${enemy.strength > 0 ? `<div class="enemy-buff strength-buff">💪 ${enemy.strength}</div>` : ''}
                    ${enemy.vulnerable > 0 ? `<div class="enemy-debuff vulnerable">💔 ${enemy.vulnerable}</div>` : ''}
                    ${enemy.weak > 0 ? `<div class="enemy-debuff weak">😵 ${enemy.weak}</div>` : ''}
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
            return `
                <div class="combat-card card type-${typeClass} ${affordable ? 'playable' : 'unplayable'}" data-index="${i}">
                    <div class="card-cost ${affordable ? '' : 'not-enough'}">${card.cost}</div>
                    <div class="card-name">${card.name}${card.upgraded ? '+' : ''}</div>
                    <div class="card-type">${card.type || 'Attack'}</div>
                    <div class="card-description">${card.description || ''}</div>
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
        
        // Determine if card needs a target
        const needsTarget = card.type === 'attack' || card.damage > 0 || card.targetRequired;
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
    function playCard(cardIndex, targetIndex) {
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
        
        // For attack cards, validate target
        const needsTarget = card.type === 'attack' || card.damage > 0 || card.targetRequired;
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
        
        // Handle damage
        if (card.damage && card.damage > 0) {
            if (targetIndex !== null && targetIndex >= 0 && enemies[targetIndex]) {
                let damage = card.damage;
                const strength = game.state.get('combat.strength') || 0;
                damage += strength;
                
                // Vulnerable increases damage taken by 50%
                if (enemies[targetIndex].vulnerable > 0) {
                    damage = Math.floor(damage * 1.5);
                }
                
                // Apply damage (block first)
                const blocked = Math.min(enemies[targetIndex].block || 0, damage);
                enemies[targetIndex].block = Math.max(0, (enemies[targetIndex].block || 0) - blocked);
                damage -= blocked;
                
                enemies[targetIndex].currentHp -= damage;
                
                // NaN protection
                if (!Number.isFinite(enemies[targetIndex].currentHp)) {
                    console.warn(`[CombatScreen] NaN detected in enemy HP after damage! Resetting.`);
                    enemies[targetIndex].currentHp = enemies[targetIndex].maxHp - damage;
                    if (!Number.isFinite(enemies[targetIndex].currentHp)) {
                        enemies[targetIndex].currentHp = 0;
                    }
                }
                
                console.log(`[CombatScreen] Dealt ${damage + blocked} damage to ${enemies[targetIndex].name} (${blocked} blocked), HP: ${enemies[targetIndex].currentHp}/${enemies[targetIndex].maxHp}`);
                
                // Emit damage event for VFX
                game.eventBus.emit('damage:dealt', { target: enemies[targetIndex], amount: damage + blocked, blocked });
                
                // Check for enemy death
                if (enemies[targetIndex].currentHp <= 0) {
                    console.log(`[CombatScreen] ☠ ${enemies[targetIndex].name} defeated!`);
                    game.eventBus.emit('enemy:defeated', enemies[targetIndex]);
                    enemies.splice(targetIndex, 1);
                }
                
                game.state.set('combat.enemies', enemies);
            }
        }
        
        // Handle block
        if (card.block && card.block > 0) {
            let block = card.block;
            const dex = game.state.get('combat.dexterity') || 0;
            block += dex;
            
            const currentBlock = game.state.get('combat.block') || 0;
            game.state.set('combat.block', currentBlock + block);
            console.log(`[CombatScreen] Gained ${block} block (total: ${currentBlock + block})`);
            
            game.eventBus.emit('block:gained', { amount: block });
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
                game.state.set('combat.enemies', enemies);
            }
            
            if (card.applyWeak) {
                enemies[targetIndex].weak = (enemies[targetIndex].weak || 0) + card.applyWeak;
                console.log(`[CombatScreen] Applied ${card.applyWeak} Weak`);
                game.state.set('combat.enemies', enemies);
            }
        }
        
        // Handle strength gain
        if (card.strengthGain) {
            const str = game.state.get('combat.strength') || 0;
            game.state.set('combat.strength', str + card.strengthGain);
            console.log(`[CombatScreen] Gained ${card.strengthGain} Strength`);
        }
        
        // Handle heal
        if (card.heal && card.heal > 0) {
            const hp = game.state.get('hp') || game.state.get('hero.hp') || 80;
            const maxHp = game.state.get('maxHp') || game.state.get('hero.maxHp') || 80;
            const newHp = Math.min(maxHp, hp + card.heal);
            game.state.set('hp', newHp);
            game.state.set('hero.hp', newHp);
            console.log(`[CombatScreen] Healed ${card.heal} HP`);
            
            game.eventBus.emit('heal', { amount: card.heal });
        }
        
        // Handle self damage (for Korvax rage cards)
        if (card.selfDamage && card.selfDamage > 0) {
            const hp = game.state.get('hp') || game.state.get('hero.hp') || 80;
            const newHp = Math.max(1, hp - card.selfDamage); // Don't kill yourself
            game.state.set('hp', newHp);
            game.state.set('hero.hp', newHp);
            console.log(`[CombatScreen] Took ${card.selfDamage} self damage`);
        }
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
        
        enemyTurn();
    }
    
    function enemyTurn() {
        const enemies = game.state.get('combat.enemies') || [];
        let playerHp = game.state.get('hp') || game.state.get('hero.hp') || 50;
        let playerBlock = game.state.get('combat.block') || 0;
        
        console.log('[CombatScreen] ═══ Enemy turn ═══');
        console.log(`[CombatScreen] Player block going into enemy turn: ${playerBlock}`);
        
        // FIX: Reset enemy block at the START of their turn.
        // Block gained last enemy turn is cleared, but block they gain
        // THIS turn will persist through the player's next turn.
        enemies.forEach(e => { e.block = 0; });
        
        enemies.forEach((enemy, i) => {
            if (!enemy.intent) return;
            
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
                    
                    // Apply phase onEnter effects
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
                    
                    // Reset intent index for new phase pattern
                    enemy.intentIndex = 0;
                    
                    // Show phase transition overlay
                    showBossPhaseTransition(enemy, phase);
                    
                    // Emit phase change event for VFX/audio
                    game.eventBus.emit('boss:phaseChange', { enemy, phase, phaseIndex: newPhaseIndex });
                }
            }
            
            // Tick down debuffs
            if (enemy.vulnerable > 0) enemy.vulnerable--;
            if (enemy.weak > 0) enemy.weak--;
            
            // ══════ EXECUTE INTENT ══════
            if (enemy.intent.type === 'attack' || enemy.intent.type === 'heavy_attack') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                
                const hits = enemy.intent.hits || enemy.intent.times || 1;
                for (let h = 0; h < hits; h++) {
                    const blocked = Math.min(playerBlock, baseDamage);
                    playerBlock -= blocked;
                    const hpDamage = baseDamage - blocked;
                    playerHp -= hpDamage;
                    console.log(`[CombatScreen] ${enemy.name} hit ${h+1}/${hits} for ${baseDamage} (${blocked} blocked, ${hpDamage} to HP)`);
                    game.eventBus.emit('player:damaged', { amount: baseDamage, blocked, hpDamage });
                }
                
                if (!Number.isFinite(playerHp)) {
                    console.warn(`[CombatScreen] NaN detected in player HP! Resetting.`);
                    playerHp = Math.max(0, (game.state.get('hp') || 50) - baseDamage);
                }
                
            } else if (enemy.intent.type === 'multi_attack') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                const hits = enemy.intent.hits || enemy.intent.times || 2;
                for (let h = 0; h < hits; h++) {
                    const blocked = Math.min(playerBlock, baseDamage);
                    playerBlock -= blocked;
                    const hpDamage = baseDamage - blocked;
                    playerHp -= hpDamage;
                    console.log(`[CombatScreen] ${enemy.name} multi-hit ${h+1}/${hits} for ${baseDamage} (${blocked} blocked)`);
                    game.eventBus.emit('player:damaged', { amount: baseDamage, blocked, hpDamage });
                }
                if (!Number.isFinite(playerHp)) playerHp = Math.max(0, (game.state.get('hp') || 50) - baseDamage);
                
            } else if (enemy.intent.type === 'attack_debuff') {
                let baseDamage = Number(enemy.intent.damage) || 5;
                baseDamage += (enemy.strength || 0);
                if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75);
                const blocked = Math.min(playerBlock, baseDamage);
                playerBlock -= blocked;
                playerHp -= (baseDamage - blocked);
                console.log(`[CombatScreen] ${enemy.name} attack+debuff for ${baseDamage} (${blocked} blocked)`);
                game.eventBus.emit('player:damaged', { amount: baseDamage, blocked });
                // Apply debuff
                if (enemy.intent.effect === 'corruption') {
                    const corruption = game.state.get('corruption') || 0;
                    game.state.set('corruption', Math.min(100, corruption + (enemy.intent.value || 1)));
                    game.eventBus.emit('corruption:gained', enemy.intent.value || 1);
                }
                if (!Number.isFinite(playerHp)) playerHp = Math.max(0, (game.state.get('hp') || 50) - baseDamage);
                
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
                if (effect === 'corruption') {
                    const corruption = game.state.get('corruption') || 0;
                    game.state.set('corruption', Math.min(100, corruption + value));
                    game.eventBus.emit('corruption:gained', value);
                } else if (effect === 'weak') {
                    // TODO: track player weak status
                } else if (effect === 'vulnerable') {
                    // TODO: track player vulnerable status
                }
                console.log(`[CombatScreen] ${enemy.name} applies ${value} ${effect}`);
                
            } else if (enemy.intent.type === 'heal') {
                const healAmount = enemy.intent.value || enemy.intent.heal || 5;
                enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + healAmount);
                console.log(`[CombatScreen] ${enemy.name} heals ${healAmount} HP`);
                
            } else if (enemy.intent.type === 'summon') {
                console.log(`[CombatScreen] ${enemy.name} attempts summon (not yet implemented)`);
            }
            
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
        });
        
        game.state.set('hp', Math.max(0, playerHp));
        game.state.set('hero.hp', Math.max(0, playerHp));
        game.state.set('combat.block', playerBlock);
        game.state.set('combat.enemies', enemies);
        
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
        
        // Reset player block at start of NEW player turn (after enemies have attacked)
        game.state.set('combat.block', 0);
        
        // Discard hand
        const hand = game.state.get('combat.hand') || [];
        const discard = game.state.get('combat.discardPile') || [];
        discard.push(...hand);
        game.state.set('combat.discardPile', discard);
        game.state.set('combat.hand', []);
        
        // FIX: Enemy block is NOT reset here anymore.
        // Block gained during enemy turn persists through the player's turn
        // so the player must punch through it. It resets at the start of
        // the ENEMY turn instead (see enemyTurn()).
        
        // Draw new hand
        for (let i = 0; i < 5; i++) drawCard();
        
        game.state.set('combat.turn', (game.state.get('combat.turn') || 1) + 1);
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
                    const heroId = game.state.get('heroId') || 'korvax';
                    const cards = game.dataLoader?.getCardsForHero?.(heroId) || [];
                    rewards.cardChoices = cards
                        .filter(c => c.rarity !== 'starter')
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 3)
                        .map(normalizeCard);
                } catch (e) {
                    console.warn('[CombatScreen] Card rewards failed:', e);
                }
                
                game.state.set('rewards.pending', rewards);
                game.mapGenerator?.completeCurrentNode?.();
                forceScreenTransition(game, 'reward-screen');
            }, 500);
        }
    }
    
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[CombatScreen] forceScreenTransition to: ${targetScreenId}`);
        
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
