/**
 * CombatScreen - Handles turn-based combat
 * FIXED: Properly handles effects array format, empty deck, multiple state paths
 * FIXED: Added intent type CSS classes for proper styling
 * @version 0.2.6
 */

export function setupCombatScreen(game) {
    const screen = document.getElementById('combat-screen');
    
    console.log('[CombatScreen] Setting up combat screen');
    
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
        
        // Get enemies from multiple possible state paths
        let enemies = game.state.get('combat.enemies') 
                   || game.state.get('pendingCombat.enemies')
                   || game.state.get('enemies');
        
        if (!enemies || enemies.length === 0) {
            console.log('[CombatScreen] No enemies in state, generating encounter');
            enemies = generateEncounter();
        }
        
        console.log(`[CombatScreen] Combat with ${enemies.length} enemies:`, enemies.map(e => e.name));
        
        // CRITICAL: Get deck - try DataLoader first, then state, then fallback
        let deck = getDeckFromDataLoader();
        
        if (!deck || deck.length === 0) {
            console.log('[CombatScreen] DataLoader deck failed, trying state...');
            deck = getDeckFromState();
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
        
        // Initialize combat state
        initializeCombatState(enemies, deck);
        
        // FIXED: Wait for DOM to be ready before rendering
        // Use requestAnimationFrame + small delay to ensure screen transition is complete
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log('[CombatScreen] DOM should be ready, rendering UI...');
                renderCombatUI();
                setupCombatButtons();
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
                    console.log(`[CombatScreen] Got deck from DataLoader: ${deck.length} cards`);
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
        
        return null;
    }
    
    /**
     * Normalize card properties - convert effects array to direct properties
     * This ensures cards work with combat system regardless of format
     */
    function normalizeCard(card) {
        const normalized = { ...card };
        
        // Ensure instanceId exists
        if (!normalized.instanceId) {
            normalized.instanceId = `${card.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Parse effects array into direct properties
        if (card.effects && Array.isArray(card.effects)) {
            card.effects.forEach(effect => {
                switch (effect.type) {
                    case 'damage':
                        if (typeof effect.value === 'number') {
                            normalized.damage = effect.value;
                        }
                        break;
                    case 'block':
                        if (typeof effect.value === 'number') {
                            normalized.block = effect.value;
                        }
                        break;
                    case 'draw':
                        if (typeof effect.value === 'number') {
                            normalized.draw = effect.value;
                        }
                        break;
                    case 'energy':
                        if (typeof effect.value === 'number') {
                            normalized.energyGain = effect.value;
                        }
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
        
        // 5 Strikes
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
        
        // 4 Defends
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
        
        // 1 Bash
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
                // Try getRandomEncounter first
                if (typeof game.dataLoader.getRandomEncounter === 'function') {
                    const encounter = game.dataLoader.getRandomEncounter(act, 'normal');
                    if (encounter && encounter.length > 0) {
                        return encounter.map(normalizeEnemy);
                    }
                }
                // Fall back to getEnemiesForAct
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
        
        // Fallback enemy
        return [normalizeEnemy({
            id: 'wasteland_scavenger_' + Date.now(),
            name: 'Wasteland Scavenger',
            hp: 25,
            maxHp: 25,
            intents: [{type: 'attack', damage: 8}]
        })];
    }
    
    function normalizeEnemy(enemy) {
        return {
            ...enemy,
            currentHp: enemy.currentHp || enemy.hp || enemy.maxHp || 30,
            maxHp: enemy.maxHp || enemy.hp || 30,
            block: enemy.block || 0,
            intent: enemy.intent || (enemy.intents ? enemy.intents[0] : { type: 'attack', damage: 8 })
        };
    }
    
    function initializeCombatState(enemies, deck) {
        console.log('[CombatScreen] Initializing combat state...');
        
        game.state.set('combat.turn', 1);
        game.state.set('combat.playerTurn', true);
        game.state.set('combat.block', 0);
        game.state.set('combat.strength', 0);
        game.state.set('combat.dexterity', 0);
        
        // Energy
        const maxEnergy = game.state.get('maxEnergy') || game.state.get('hero.maxEnergy') || game.state.get('hero.energy') || 3;
        game.state.set('combat.energy', maxEnergy);
        game.state.set('combat.maxEnergy', maxEnergy);
        
        // Initialize enemies
        enemies.forEach((enemy, i) => {
            enemy.index = i;
            if (!enemy.intent) {
                enemy.intent = generateIntent(enemy);
            }
        });
        game.state.set('combat.enemies', enemies);
        
        // Shuffle deck and draw hand
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
        
        // Try multiple possible element IDs for compatibility
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
     * FIXED: Added intent type CSS class for proper styling
     */
    function renderEnemies() {
        const container = document.getElementById('enemies-container') || document.getElementById('enemy-area');
        if (!container) {
            console.error('[CombatScreen] Enemy container not found!');
            return;
        }
        
        const enemies = game.state.get('combat.enemies') || [];
        
        container.innerHTML = enemies.map((enemy, i) => {
            // FIX: Get intent type for CSS class
            const intentType = enemy.intent?.type || 'unknown';
            const intentClass = `intent-${intentType}`;
            
            return `
                <div class="enemy" data-index="${i}">
                    <div class="enemy-intent ${intentClass}">${getIntentIcon(enemy.intent)}</div>
                    <div class="enemy-sprite"><div class="enemy-icon">👁️</div></div>
                    <div class="enemy-name">${enemy.name || 'Enemy'}</div>
                    <div class="enemy-hp-bar-container">
                        <div class="enemy-hp-bar" style="width: ${(enemy.currentHp / enemy.maxHp) * 100}%"></div>
                    </div>
                    <div class="enemy-hp-text">${enemy.currentHp}/${enemy.maxHp}</div>
                    ${enemy.block > 0 ? `<div class="enemy-block">🛡️ ${enemy.block}</div>` : ''}
                    ${enemy.vulnerable > 0 ? `<div class="enemy-debuff">💔 ${enemy.vulnerable}</div>` : ''}
                    ${enemy.weak > 0 ? `<div class="enemy-debuff">😵 ${enemy.weak}</div>` : ''}
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.enemy').forEach(el => {
            el.addEventListener('click', () => selectTarget(parseInt(el.dataset.index)));
        });
    }
    
    function getIntentIcon(intent) {
        if (!intent) return '❓';
        switch (intent.type) {
            case 'attack': return `⚔️ ${intent.damage || '?'}`;
            case 'defend':
            case 'block': return `🛡️ ${intent.value || intent.block || '?'}`;
            case 'buff': return '⬆️';
            case 'debuff': return '⬇️';
            default: return '❓';
        }
    }
    
    function renderHand() {
        // DIAGNOSTIC: Log what we're looking for
        console.log('[CombatScreen] renderHand() called - searching for hand container...');
        
        // Check if combat screen exists and is active
        const combatScreen = document.getElementById('combat-screen');
        console.log('[CombatScreen] Combat screen element:', combatScreen ? 'FOUND' : 'NOT FOUND');
        if (combatScreen) {
            console.log('[CombatScreen] Combat screen classes:', combatScreen.className);
            console.log('[CombatScreen] Combat screen children:', combatScreen.children.length);
        }
        
        // Try to find hand-area specifically
        const handArea = document.getElementById('hand-area');
        console.log('[CombatScreen] hand-area by ID:', handArea ? 'FOUND' : 'NOT FOUND');
        
        // Try querySelector as fallback
        const handByQuery = document.querySelector('#combat-screen .hand-area');
        console.log('[CombatScreen] .hand-area by querySelector:', handByQuery ? 'FOUND' : 'NOT FOUND');
        
        // Also try without ID
        const handByClass = document.querySelector('.hand-area');
        console.log('[CombatScreen] .hand-area by class only:', handByClass ? 'FOUND' : 'NOT FOUND');
        
        // Use whatever we can find
        const container = handArea || handByQuery || handByClass || document.getElementById('hand-container') || document.getElementById('hand');
        
        if (!container) {
            console.error('[CombatScreen] Hand container not found! Listing all elements with "hand" in ID or class:');
            document.querySelectorAll('[id*="hand"], [class*="hand"]').forEach(el => {
                console.log(`  - ${el.tagName} id="${el.id}" class="${el.className}"`);
            });
            return;
        }
        
        console.log('[CombatScreen] Using container:', container.id || container.className);
        
        const hand = game.state.get('combat.hand') || [];
        const energy = game.state.get('combat.energy') || 0;
        
        container.innerHTML = hand.map((card, i) => {
            const affordable = card.cost <= energy;
            const typeClass = card.type || 'attack';
            return `
                <div class="combat-card card type-${typeClass} ${affordable ? '' : 'unplayable'}" data-index="${i}">
                    <div class="card-cost">${card.cost}</div>
                    <div class="card-name">${card.name}${card.upgraded ? '+' : ''}</div>
                    <div class="card-type">${card.type || 'Attack'}</div>
                    <div class="card-description">${card.description || ''}</div>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.combat-card').forEach(el => {
            el.addEventListener('click', () => {
                if (!el.classList.contains('unplayable')) {
                    selectCard(parseInt(el.dataset.index));
                }
            });
        });
    }
    
    function renderEnergy() {
        const energy = game.state.get('combat.energy') || 0;
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        
        // Try the separate elements first (matches HTML structure)
        const energyCurrent = document.getElementById('energy-current');
        const energyMax = document.getElementById('energy-max');
        
        if (energyCurrent) energyCurrent.textContent = energy;
        if (energyMax) energyMax.textContent = maxEnergy;
        
        // Fallback to combined display if exists
        const display = document.getElementById('energy-display') || document.getElementById('energy');
        if (display && !energyCurrent) {
            display.innerHTML = `<span class="energy-current">${energy}</span>/<span class="energy-max">${maxEnergy}</span>`;
        }
    }
    
    function renderPileCounters() {
        const drawPile = game.state.get('combat.drawPile') || [];
        const discardPile = game.state.get('combat.discardPile') || [];
        
        // Try direct IDs first, then fall back to querySelector within pile containers
        let drawCounter = document.getElementById('draw-pile-count');
        let discardCounter = document.getElementById('discard-pile-count');
        
        // If direct IDs don't exist, look for .pile-count inside the pile containers
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
    
    let selectedCardIndex = null;
    
    function selectCard(index) {
        const hand = game.state.get('combat.hand') || [];
        const card = hand[index];
        if (!card) return;
        
        selectedCardIndex = index;
        
        document.querySelectorAll('.combat-card').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        
        console.log(`[CombatScreen] Selected: ${card.name} (cost: ${card.cost}, damage: ${card.damage || 0}, block: ${card.block || 0})`);
        
        const needsTarget = card.type === 'attack' || card.targetRequired;
        const enemies = game.state.get('combat.enemies') || [];
        
        if (needsTarget) {
            if (enemies.length === 1) {
                playCard(index, 0);
            } else {
                document.querySelectorAll('.enemy').forEach(el => el.classList.add('targetable'));
            }
        } else {
            playCard(index, null);
        }
    }
    
    function selectTarget(targetIndex) {
        if (selectedCardIndex === null) return;
        document.querySelectorAll('.enemy').forEach(el => el.classList.remove('targetable'));
        playCard(selectedCardIndex, targetIndex);
    }
    
    function playCard(cardIndex, targetIndex) {
        const hand = game.state.get('combat.hand') || [];
        const card = hand[cardIndex];
        const energy = game.state.get('combat.energy') || 0;
        
        if (!card || card.cost > energy) return;
        
        console.log(`[CombatScreen] Playing: ${card.name} -> target: ${targetIndex}`);
        game.audioManager?.playSFX?.('card_play');
        
        game.state.set('combat.energy', energy - card.cost);
        applyCardEffect(card, targetIndex);
        
        hand.splice(cardIndex, 1);
        const discard = game.state.get('combat.discardPile') || [];
        discard.push(card);
        
        game.state.set('combat.hand', hand);
        game.state.set('combat.discardPile', discard);
        
        selectedCardIndex = null;
        
        renderHand();
        renderEnemies();
        renderEnergy();
        renderPlayer();
        renderPileCounters();
        
        checkCombatEnd();
    }
    
    function applyCardEffect(card, targetIndex) {
        const enemies = game.state.get('combat.enemies') || [];
        
        // Handle damage (from direct property or effects array)
        let damage = card.damage || 0;
        if (damage > 0 && targetIndex !== null && targetIndex !== undefined) {
            const target = enemies[targetIndex];
            if (target) {
                // Apply strength
                const strength = game.state.get('combat.strength') || 0;
                damage += strength;
                
                // Apply vulnerable (50% more damage)
                if (target.vulnerable > 0) {
                    damage = Math.floor(damage * 1.5);
                }
                
                // Apply block
                const blocked = Math.min(target.block || 0, damage);
                target.block -= blocked;
                damage -= blocked;
                
                target.currentHp -= damage;
                console.log(`[CombatScreen] Dealt ${damage} damage to ${target.name}`);
                
                if (target.currentHp <= 0) {
                    console.log(`[CombatScreen] ${target.name} defeated!`);
                    enemies.splice(targetIndex, 1);
                    enemies.forEach((e, i) => e.index = i);
                }
                
                game.state.set('combat.enemies', enemies);
            }
        }
        
        // Handle block
        let block = card.block || 0;
        if (block > 0) {
            const dex = game.state.get('combat.dexterity') || 0;
            block += dex;
            const current = game.state.get('combat.block') || 0;
            game.state.set('combat.block', current + block);
            console.log(`[CombatScreen] Gained ${block} block`);
        }
        
        // Handle draw
        if (card.draw > 0) {
            for (let i = 0; i < card.draw; i++) drawCard();
        }
        
        // Handle energy gain
        if (card.energyGain > 0) {
            const current = game.state.get('combat.energy') || 0;
            game.state.set('combat.energy', current + card.energyGain);
        }
        
        // Handle self damage
        if (card.selfDamage > 0) {
            const hp = game.state.get('hp') || 50;
            game.state.set('hp', hp - card.selfDamage);
            console.log(`[CombatScreen] Took ${card.selfDamage} self damage`);
        }
        
        // Handle strength gain
        if (card.strengthGain > 0) {
            const str = game.state.get('combat.strength') || 0;
            game.state.set('combat.strength', str + card.strengthGain);
        }
        
        // Handle apply vulnerable
        if (card.applyVulnerable > 0 && targetIndex !== null && enemies[targetIndex]) {
            enemies[targetIndex].vulnerable = (enemies[targetIndex].vulnerable || 0) + card.applyVulnerable;
            console.log(`[CombatScreen] Applied ${card.applyVulnerable} Vulnerable`);
        }
        
        // Handle apply weak
        if (card.applyWeak > 0 && targetIndex !== null && enemies[targetIndex]) {
            enemies[targetIndex].weak = (enemies[targetIndex].weak || 0) + card.applyWeak;
        }
        
        // Handle heal
        if (card.heal > 0) {
            const hp = game.state.get('hp') || 50;
            const maxHp = game.state.get('maxHp') || 80;
            game.state.set('hp', Math.min(maxHp, hp + card.heal));
        }
        
        game.state.set('combat.enemies', enemies);
    }
    
    function drawCard() {
        let drawPile = game.state.get('combat.drawPile') || [];
        let discard = game.state.get('combat.discardPile') || [];
        const hand = game.state.get('combat.hand') || [];
        
        if (drawPile.length === 0 && discard.length > 0) {
            drawPile = [...discard].sort(() => Math.random() - 0.5);
            discard = [];
        }
        
        if (drawPile.length > 0) {
            hand.push(drawPile.shift());
            game.state.set('combat.hand', hand);
            game.state.set('combat.drawPile', drawPile);
            game.state.set('combat.discardPile', discard);
            renderHand();
            renderPileCounters();
        }
    }
    
    function endTurn() {
        console.log('[CombatScreen] ═══ END TURN ═══');
        game.audioManager?.playSFX?.('ui_click');
        enemyTurn();
    }
    
    function enemyTurn() {
        game.state.set('combat.block', 0);
        
        const enemies = game.state.get('combat.enemies') || [];
        let playerHp = game.state.get('hp') || game.state.get('hero.hp') || 50;
        
        enemies.forEach(enemy => {
            if (!enemy.intent) return;
            
            if (enemy.vulnerable > 0) enemy.vulnerable--;
            if (enemy.weak > 0) enemy.weak--;
            
            if (enemy.intent.type === 'attack') {
                let damage = enemy.intent.damage || 5;
                if (enemy.weak > 0) damage = Math.floor(damage * 0.75);
                
                const block = game.state.get('combat.block') || 0;
                const blocked = Math.min(block, damage);
                game.state.set('combat.block', block - blocked);
                damage -= blocked;
                
                playerHp -= damage;
                console.log(`[CombatScreen] ${enemy.name} attacks for ${damage}`);
            } else if (enemy.intent.type === 'block' || enemy.intent.type === 'defend') {
                enemy.block = (enemy.block || 0) + (enemy.intent.value || enemy.intent.block || 5);
            }
            
            enemy.intent = generateIntent(enemy);
        });
        
        game.state.set('hp', Math.max(0, playerHp));
        game.state.set('hero.hp', Math.max(0, playerHp));
        game.state.set('combat.enemies', enemies);
        
        if (playerHp <= 0) {
            game.eventBus.emit('combat:defeat');
            game.eventBus.emit('player:death');
            return;
        }
        
        setTimeout(startPlayerTurn, 500);
    }
    
    function generateIntent(enemy) {
        if (enemy.intents && enemy.intents.length > 0) {
            return { ...enemy.intents[Math.floor(Math.random() * enemy.intents.length)] };
        }
        
        const types = ['attack', 'attack', 'block'];
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type,
            damage: type === 'attack' ? Math.floor(Math.random() * 5) + 6 : 0,
            value: type === 'block' ? Math.floor(Math.random() * 5) + 5 : 0
        };
    }
    
    function startPlayerTurn() {
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        game.state.set('combat.energy', maxEnergy);
        
        const hand = game.state.get('combat.hand') || [];
        const discard = game.state.get('combat.discardPile') || [];
        discard.push(...hand);
        game.state.set('combat.discardPile', discard);
        game.state.set('combat.hand', []);
        
        for (let i = 0; i < 5; i++) drawCard();
        
        game.state.set('combat.turn', (game.state.get('combat.turn') || 1) + 1);
        renderCombatUI();
    }
    
    function checkCombatEnd() {
        const enemies = game.state.get('combat.enemies') || [];
        if (enemies.length === 0) {
            console.log('[CombatScreen] ═══ VICTORY! ═══');
            
            // Prevent any further card plays or actions
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
                
                // Complete the node
                game.mapGenerator?.completeCurrentNode?.();
                
                // Use force transition instead of regular transition
                forceScreenTransition(game, 'reward-screen');
            }, 500);
        }
    }
    
    /**
     * Force screen transition (same as MapScreen version)
     */
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[CombatScreen] forceScreenTransition to: ${targetScreenId}`);
        
        const combatScreen = document.getElementById('combat-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[CombatScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // STEP 1: Immediately hide the combat screen
        if (combatScreen) {
            console.log('[CombatScreen] Hiding combat-screen immediately');
            combatScreen.classList.remove('active', 'fade-in');
            combatScreen.classList.add('fade-out');
            combatScreen.style.cssText = '';  // Clear inline styles
        }
        
        // STEP 2: Try normal ScreenManager transition
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
                console.log('[CombatScreen] ScreenManager.transitionTo called');
            }
        } catch (e) {
            console.error('[CombatScreen] screenManager.transitionTo failed:', e);
        }
        
        // STEP 3: ALWAYS force the transition after a delay
        setTimeout(() => {
            console.log(`[CombatScreen] Force-showing ${targetScreenId} (backup)`);
            
            // Hide ALL other screens first
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== targetScreenId) {
                    screen.classList.remove('active', 'fade-in');
                    screen.style.cssText = '';
                }
            });
            
            // Force show the target screen
            targetScreen.classList.remove('fade-out');
            targetScreen.classList.add('active');
            
            // Apply aggressive inline styles to guarantee visibility
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
            
            // Update ScreenManager state
            if (game.screenManager) {
                game.screenManager.previousScreen = game.screenManager.currentScreen;
                game.screenManager.currentScreen = targetScreenId;
                game.screenManager.transitioning = false;
            }
            
            // Emit events so screen handlers initialize
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'combat-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
            game.eventBus.emit('screen:change', targetScreenId);
            
            console.log(`[CombatScreen] Force transition complete.`);
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
    
    return { initializeCombat, renderCombatUI, endTurn, playCard, drawCard };
}
