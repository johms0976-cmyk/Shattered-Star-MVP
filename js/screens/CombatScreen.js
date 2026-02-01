/**
 * CombatScreen - Handles turn-based combat
 * FIXED: Now properly initializes when screen becomes visible
 */

export function setupCombatScreen(game) {
    const screen = document.getElementById('combat-screen');
    
    console.log('[CombatScreen] Setting up combat screen');
    
    // FIXED: Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'combat-screen') {
            console.log('[CombatScreen] Screen shown, initializing...');
            initializeCombat();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'combat-screen') {
            console.log('[CombatScreen] Screen changed to combat, initializing...');
            initializeCombat();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('combat:start', () => {
        console.log('[CombatScreen] combat:start event received');
        initializeCombat();
    });
    
    function initializeCombat() {
        console.log('[CombatScreen] Initializing combat...');
        
        // Get enemies from state (set by MapScreen)
        let enemies = game.state.get('combat.enemies');
        
        if (!enemies || enemies.length === 0) {
            console.log('[CombatScreen] No enemies in state, generating encounter');
            enemies = generateEncounter();
            game.state.set('combat.enemies', enemies);
        }
        
        console.log(`[CombatScreen] Combat with ${enemies.length} enemies`);
        
        // Initialize combat system
        try {
            if (game.combat && typeof game.combat.initCombat === 'function') {
                game.combat.initCombat(enemies);
            } else {
                console.warn('[CombatScreen] Combat system not initialized, using fallback');
                initCombatFallback(enemies);
            }
        } catch (e) {
            console.error('[CombatScreen] Combat init failed:', e);
            initCombatFallback(enemies);
        }
        
        // Render combat UI
        renderCombatUI();
        setupCombatButtons();
    }
    
    function generateEncounter() {
        const act = game.state.get('act') || 1;
        
        try {
            const encounter = game.dataLoader?.getRandomEncounter?.(act, 'normal');
            if (encounter && encounter.length > 0) {
                return encounter;
            }
        } catch (e) {
            console.warn('[CombatScreen] Failed to get encounter:', e);
        }
        
        // Fallback enemies
        return [
            {
                id: 'scavenger_' + Date.now(),
                name: 'Wasteland Scavenger',
                hp: 25,
                maxHp: 25,
                intent: { type: 'attack', damage: 8 },
                block: 0
            }
        ];
    }
    
    function initCombatFallback(enemies) {
        console.log('[CombatScreen] Using fallback combat initialization');
        
        // Set up basic combat state
        game.state.set('combat.turn', 1);
        game.state.set('combat.playerTurn', true);
        game.state.set('combat.energy', game.state.get('maxEnergy') || 3);
        game.state.set('combat.maxEnergy', game.state.get('maxEnergy') || 3);
        game.state.set('combat.block', 0);
        
        // Initialize enemy states
        enemies.forEach((enemy, i) => {
            enemy.currentHp = enemy.hp || enemy.maxHp || 30;
            enemy.maxHp = enemy.maxHp || 30;
            enemy.block = enemy.block || 0;
            enemy.index = i;
        });
        
        game.state.set('combat.enemies', enemies);
        
        // Draw initial hand
        drawHand();
    }
    
    function drawHand() {
        const deck = game.state.get('deck') || [];
        const drawPile = [...deck].sort(() => Math.random() - 0.5);
        const handSize = 5;
        const hand = drawPile.slice(0, handSize);
        
        game.state.set('combat.hand', hand);
        game.state.set('combat.drawPile', drawPile.slice(handSize));
        game.state.set('combat.discardPile', []);
        
        console.log(`[CombatScreen] Drew ${hand.length} cards`);
    }
    
    function renderCombatUI() {
        renderPlayer();
        renderEnemies();
        renderHand();
        renderEnergy();
        updateUI();
    }
    
    function renderPlayer() {
        const hp = game.state.get('hp') || 50;
        const maxHp = game.state.get('maxHp') || 80;
        const block = game.state.get('combat.block') || 0;
        
        const hpBar = document.getElementById('player-hp-bar');
        const hpText = document.getElementById('player-hp-text');
        const blockDisplay = document.getElementById('player-block');
        
        if (hpBar) {
            hpBar.style.width = `${(hp / maxHp) * 100}%`;
        }
        if (hpText) {
            hpText.textContent = `${hp}/${maxHp}`;
        }
        if (blockDisplay) {
            blockDisplay.textContent = block > 0 ? `🛡️ ${block}` : '';
            blockDisplay.style.display = block > 0 ? 'block' : 'none';
        }
    }
    
    function renderEnemies() {
        const container = document.getElementById('enemies-container');
        if (!container) return;
        
        const enemies = game.state.get('combat.enemies') || [];
        
        container.innerHTML = enemies.map((enemy, i) => `
            <div class="enemy" data-index="${i}">
                <div class="enemy-intent">${getIntentIcon(enemy.intent)}</div>
                <div class="enemy-sprite">
                    <div class="enemy-icon">👁️</div>
                </div>
                <div class="enemy-name">${enemy.name || 'Enemy'}</div>
                <div class="enemy-hp-bar-container">
                    <div class="enemy-hp-bar" style="width: ${((enemy.currentHp || enemy.hp) / enemy.maxHp) * 100}%"></div>
                </div>
                <div class="enemy-hp-text">${enemy.currentHp || enemy.hp}/${enemy.maxHp}</div>
                ${enemy.block > 0 ? `<div class="enemy-block">🛡️ ${enemy.block}</div>` : ''}
            </div>
        `).join('');
        
        // Add click handlers to enemies
        container.querySelectorAll('.enemy').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                selectTarget(index);
            });
        });
    }
    
    function getIntentIcon(intent) {
        if (!intent) return '❓';
        switch (intent.type) {
            case 'attack': return `⚔️ ${intent.damage || '?'}`;
            case 'defend': return `🛡️ ${intent.block || '?'}`;
            case 'buff': return '⬆️';
            case 'debuff': return '⬇️';
            default: return '❓';
        }
    }
    
    function renderHand() {
        const container = document.getElementById('hand-container');
        if (!container) return;
        
        const hand = game.state.get('combat.hand') || [];
        const energy = game.state.get('combat.energy') || 0;
        
        container.innerHTML = hand.map((card, i) => {
            const affordable = card.cost <= energy;
            return `
                <div class="combat-card type-${card.type || 'attack'} ${affordable ? '' : 'unplayable'}" data-index="${i}">
                    <div class="card-cost">${card.cost}</div>
                    <div class="card-name">${card.name}${card.upgraded ? '+' : ''}</div>
                    <div class="card-type">${card.type || 'Attack'}</div>
                    <div class="card-description">${card.description || ''}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.combat-card').forEach(el => {
            el.addEventListener('click', () => {
                if (el.classList.contains('unplayable')) return;
                const index = parseInt(el.dataset.index);
                selectCard(index);
            });
        });
    }
    
    function renderEnergy() {
        const energy = game.state.get('combat.energy') || 0;
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        
        const display = document.getElementById('energy-display');
        if (display) {
            display.textContent = `⚡ ${energy}/${maxEnergy}`;
        }
    }
    
    let selectedCardIndex = null;
    let selectedTargetIndex = null;
    
    function selectCard(index) {
        const hand = game.state.get('combat.hand') || [];
        const card = hand[index];
        
        if (!card) return;
        
        selectedCardIndex = index;
        
        // Highlight selected card
        document.querySelectorAll('.combat-card').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
        
        console.log(`[CombatScreen] Selected card: ${card.name}`);
        
        // If card needs a target, wait for target selection
        if (card.type === 'attack' || card.targetRequired) {
            const enemies = game.state.get('combat.enemies') || [];
            if (enemies.length === 1) {
                // Auto-target single enemy
                playCard(index, 0);
            }
            // Otherwise wait for target click
        } else {
            // Skill/power cards don't need a target
            playCard(index, null);
        }
    }
    
    function selectTarget(targetIndex) {
        if (selectedCardIndex === null) return;
        playCard(selectedCardIndex, targetIndex);
    }
    
    function playCard(cardIndex, targetIndex) {
        const hand = game.state.get('combat.hand') || [];
        const card = hand[cardIndex];
        const energy = game.state.get('combat.energy') || 0;
        
        if (!card || card.cost > energy) {
            console.log('[CombatScreen] Cannot play card');
            return;
        }
        
        console.log(`[CombatScreen] Playing card: ${card.name}`);
        game.audioManager?.playSFX?.('card_play');
        
        // Spend energy
        game.state.set('combat.energy', energy - card.cost);
        
        // Apply card effect
        applyCardEffect(card, targetIndex);
        
        // Remove from hand, add to discard
        hand.splice(cardIndex, 1);
        const discard = game.state.get('combat.discardPile') || [];
        discard.push(card);
        
        game.state.set('combat.hand', hand);
        game.state.set('combat.discardPile', discard);
        
        // Clear selection
        selectedCardIndex = null;
        selectedTargetIndex = null;
        
        // Update UI
        renderHand();
        renderEnemies();
        renderEnergy();
        
        // Check for victory
        checkCombatEnd();
    }
    
    function applyCardEffect(card, targetIndex) {
        const enemies = game.state.get('combat.enemies') || [];
        
        if (card.damage && targetIndex !== null) {
            const target = enemies[targetIndex];
            if (target) {
                let damage = card.damage;
                
                // Apply strength
                const strength = game.state.get('combat.strength') || 0;
                damage += strength;
                
                // Apply block
                const blocked = Math.min(target.block || 0, damage);
                target.block = (target.block || 0) - blocked;
                damage -= blocked;
                
                // Apply damage
                target.currentHp = (target.currentHp || target.hp) - damage;
                
                console.log(`[CombatScreen] Dealt ${damage} damage to ${target.name}`);
                
                // Check if dead
                if (target.currentHp <= 0) {
                    console.log(`[CombatScreen] ${target.name} defeated!`);
                    enemies.splice(targetIndex, 1);
                }
                
                game.state.set('combat.enemies', enemies);
            }
        }
        
        if (card.block) {
            let block = card.block;
            const dex = game.state.get('combat.dexterity') || 0;
            block += dex;
            
            const current = game.state.get('combat.block') || 0;
            game.state.set('combat.block', current + block);
            
            console.log(`[CombatScreen] Gained ${block} block`);
            renderPlayer();
        }
        
        // Handle other effects
        if (card.effects) {
            card.effects.forEach(effect => {
                applyEffect(effect);
            });
        }
    }
    
    function applyEffect(effect) {
        switch (effect.type) {
            case 'strength':
                const str = game.state.get('combat.strength') || 0;
                game.state.set('combat.strength', str + effect.value);
                break;
            case 'draw':
                // Draw cards
                for (let i = 0; i < effect.value; i++) {
                    drawCard();
                }
                renderHand();
                break;
            case 'energy':
                const energy = game.state.get('combat.energy') || 0;
                game.state.set('combat.energy', energy + effect.value);
                renderEnergy();
                break;
        }
    }
    
    function drawCard() {
        let drawPile = game.state.get('combat.drawPile') || [];
        let discard = game.state.get('combat.discardPile') || [];
        const hand = game.state.get('combat.hand') || [];
        
        if (drawPile.length === 0 && discard.length > 0) {
            // Shuffle discard into draw
            drawPile = discard.sort(() => Math.random() - 0.5);
            discard = [];
        }
        
        if (drawPile.length > 0) {
            const card = drawPile.shift();
            hand.push(card);
            game.state.set('combat.hand', hand);
            game.state.set('combat.drawPile', drawPile);
            game.state.set('combat.discardPile', discard);
        }
    }
    
    function endTurn() {
        console.log('[CombatScreen] Ending player turn');
        game.audioManager?.playSFX?.('ui_click');
        
        // Enemy turn
        enemyTurn();
    }
    
    function enemyTurn() {
        console.log('[CombatScreen] Enemy turn');
        
        // Reset player block
        game.state.set('combat.block', 0);
        
        const enemies = game.state.get('combat.enemies') || [];
        let playerHp = game.state.get('hp') || 50;
        const maxHp = game.state.get('maxHp') || 80;
        
        enemies.forEach(enemy => {
            if (enemy.intent?.type === 'attack') {
                let damage = enemy.intent.damage || 5;
                
                // Apply player block
                const block = game.state.get('combat.block') || 0;
                const blocked = Math.min(block, damage);
                game.state.set('combat.block', block - blocked);
                damage -= blocked;
                
                playerHp -= damage;
                console.log(`[CombatScreen] ${enemy.name} attacks for ${damage} damage`);
            } else if (enemy.intent?.type === 'defend') {
                enemy.block = (enemy.block || 0) + (enemy.intent.block || 5);
            }
            
            // Generate new intent
            enemy.intent = generateIntent(enemy);
        });
        
        game.state.set('hp', Math.max(0, playerHp));
        game.state.set('combat.enemies', enemies);
        
        // Check for defeat
        if (playerHp <= 0) {
            console.log('[CombatScreen] Player defeated!');
            game.eventBus.emit('combat:defeat');
            return;
        }
        
        // Start new player turn
        startPlayerTurn();
    }
    
    function generateIntent(enemy) {
        const types = ['attack', 'attack', 'defend'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        return {
            type,
            damage: type === 'attack' ? Math.floor(Math.random() * 5) + 6 : 0,
            block: type === 'defend' ? Math.floor(Math.random() * 5) + 5 : 0
        };
    }
    
    function startPlayerTurn() {
        console.log('[CombatScreen] Starting player turn');
        
        // Reset energy
        const maxEnergy = game.state.get('combat.maxEnergy') || 3;
        game.state.set('combat.energy', maxEnergy);
        
        // Draw cards
        const hand = game.state.get('combat.hand') || [];
        // Discard current hand
        const discard = game.state.get('combat.discardPile') || [];
        discard.push(...hand);
        game.state.set('combat.discardPile', discard);
        game.state.set('combat.hand', []);
        
        // Draw new hand
        for (let i = 0; i < 5; i++) {
            drawCard();
        }
        
        // Increment turn
        const turn = (game.state.get('combat.turn') || 1) + 1;
        game.state.set('combat.turn', turn);
        
        // Update UI
        renderCombatUI();
    }
    
    function checkCombatEnd() {
        const enemies = game.state.get('combat.enemies') || [];
        
        if (enemies.length === 0) {
            console.log('[CombatScreen] Victory!');
            setTimeout(() => {
                game.eventBus.emit('combat:victory');
                
                // Generate rewards
                try {
                    game.rewards?.generateCombatRewards?.('normal');
                } catch (e) {
                    console.warn('[CombatScreen] Failed to generate rewards:', e);
                }
                
                game.screenManager.transitionTo('reward-screen');
            }, 500);
        }
    }
    
    function setupCombatButtons() {
        const endTurnBtn = document.getElementById('btn-end-turn');
        if (endTurnBtn) {
            const newBtn = endTurnBtn.cloneNode(true);
            endTurnBtn.parentNode.replaceChild(newBtn, endTurnBtn);
            newBtn.addEventListener('click', endTurn);
        }
        
        const deckBtn = document.getElementById('btn-combat-deck');
        if (deckBtn) {
            deckBtn.addEventListener('click', () => {
                game.openDeckModal?.();
            });
        }
    }
    
    function updateUI() {
        renderPlayer();
        renderEnemies();
        renderHand();
        renderEnergy();
    }
    
    return { initializeCombat, updateUI };
}
