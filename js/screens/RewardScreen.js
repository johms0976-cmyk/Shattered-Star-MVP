/**
 * RewardScreen - Handles post-combat reward selection
 * @version 0.2.2
 */

export function setupRewardScreen(game) {
    console.log('[RewardScreen] Setting up reward screen...');
    
    const screen = document.getElementById('reward-screen');
    
    // Listen for screen transitions
    game.eventBus.on('screen:changed', (data) => {
        const screenId = typeof data === 'string' ? data : (data?.to || data);
        if (screenId === 'reward-screen') {
            console.log('[RewardScreen] Screen changed to reward-screen');
            initRewardScreen(game);
        }
    });
    
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'reward-screen') {
            initRewardScreen(game);
        }
    });
    
    // Listen for reward events
    game.eventBus.on('rewards:show', (rewards) => {
        console.log('[RewardScreen] Showing rewards:', rewards);
        displayRewards(game, rewards);
    });
    
    // Skip button
    const skipBtn = document.getElementById('skip-reward') || document.getElementById('btn-skip-reward');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            try { game.audioManager.playSFX('ui_click'); } catch(e) {}
            completeRewards(game);
        });
    }
    
    // Proceed button (alternative name)
    const proceedBtn = document.getElementById('btn-proceed') || document.getElementById('btn-continue-reward');
    if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
            try { game.audioManager.playSFX('ui_click'); } catch(e) {}
            completeRewards(game);
        });
    }
    
    console.log('[RewardScreen] Setup complete');
}

/**
 * Initialize reward screen with current rewards
 */
function initRewardScreen(game) {
    console.log('[RewardScreen] Initializing...');
    
    // Get rewards from state or generate new ones
    let rewards = game.state.get('currentRewards');
    
    if (!rewards) {
        // Generate rewards based on node type
        const nodeType = game.state.get('currentNodeType') || 'combat';
        rewards = generateRewards(game, nodeType);
        game.state.set('currentRewards', rewards);
    }
    
    displayRewards(game, rewards);
}

/**
 * Generate rewards based on encounter type
 */
function generateRewards(game, nodeType) {
    const act = game.state.get('act') || 1;
    
    // Base credits
    let credits = 15 + Math.floor(Math.random() * 15);
    
    // Adjust by node type
    if (nodeType === 'elite') {
        credits = 25 + Math.floor(Math.random() * 25);
    } else if (nodeType === 'boss') {
        credits = 50 + Math.floor(Math.random() * 50);
    }
    
    // Scale by act
    credits = Math.floor(credits * (1 + (act - 1) * 0.2));
    
    // Get card choices
    let cards = [];
    try {
        if (game.rewards && typeof game.rewards.generateCardRewards === 'function') {
            cards = game.rewards.generateCardRewards(3);
        } else if (game.dataLoader) {
            cards = getRandomCardRewards(game, 3);
        }
    } catch (e) {
        console.warn('[RewardScreen] Failed to generate card rewards:', e);
        cards = getFallbackCardRewards();
    }
    
    // Chance for artifact (higher for elite/boss)
    let artifact = null;
    const artifactChance = nodeType === 'boss' ? 1.0 : nodeType === 'elite' ? 0.5 : 0.1;
    
    if (Math.random() < artifactChance) {
        try {
            if (game.dataLoader && typeof game.dataLoader.getRandomArtifact === 'function') {
                const rarity = nodeType === 'boss' ? 'rare' : nodeType === 'elite' ? 'uncommon' : 'common';
                artifact = game.dataLoader.getRandomArtifact(rarity);
            }
        } catch (e) {
            console.warn('[RewardScreen] Failed to get artifact:', e);
        }
    }
    
    return {
        credits,
        cards,
        artifact,
        nodeType
    };
}

/**
 * Get random card rewards from data loader
 */
function getRandomCardRewards(game, count) {
    const cards = [];
    const heroId = game.state.get('hero.id') || 'korvax';
    
    for (let i = 0; i < count; i++) {
        try {
            const card = game.dataLoader.getRandomCard?.(heroId) || 
                         game.dataLoader.getRandomCardForHero?.(heroId);
            if (card) {
                cards.push(card);
            }
        } catch (e) {
            // Use fallback
        }
    }
    
    if (cards.length < count) {
        return getFallbackCardRewards();
    }
    
    return cards;
}

/**
 * Fallback card rewards if data loader fails
 */
function getFallbackCardRewards() {
    return [
        { 
            id: 'power_strike', 
            name: 'Power Strike', 
            type: 'attack', 
            cost: 2, 
            damage: 12, 
            rarity: 'common',
            description: 'Deal 12 damage.' 
        },
        { 
            id: 'shield_bash', 
            name: 'Shield Bash', 
            type: 'attack', 
            cost: 1, 
            damage: 4, 
            block: 4,
            rarity: 'common',
            description: 'Deal 4 damage. Gain 4 Block.' 
        },
        { 
            id: 'overclock', 
            name: 'Overclock', 
            type: 'skill', 
            cost: 0, 
            draw: 2,
            overheat: 2,
            rarity: 'uncommon',
            description: 'Draw 2 cards. Gain 2 Overheat.' 
        }
    ];
}

/**
 * Display rewards on screen
 */
function displayRewards(game, rewards) {
    if (!rewards) {
        console.warn('[RewardScreen] No rewards to display');
        return;
    }
    
    console.log('[RewardScreen] Displaying rewards:', rewards);
    
    // Update credits
    const currentCredits = game.state.get('credits') || 0;
    game.state.set('credits', currentCredits + rewards.credits);
    
    // Display credits reward
    const creditsEl = document.getElementById('gold-reward') || 
                      document.getElementById('credits-reward') ||
                      document.getElementById('reward-credits');
    if (creditsEl) {
        creditsEl.textContent = `+${rewards.credits} Credits`;
        creditsEl.classList.add('show');
    }
    
    // Display card choices
    const cardChoices = document.getElementById('card-choices') || 
                        document.getElementById('reward-cards');
    if (cardChoices && rewards.cards && rewards.cards.length > 0) {
        cardChoices.innerHTML = rewards.cards.map(card => `
            <div class="reward-card type-${card.type || 'skill'} rarity-${card.rarity || 'common'}" 
                 data-card-id="${card.id}">
                <div class="card-cost">${card.cost || 0}</div>
                <div class="card-type-badge">${card.type || 'skill'}</div>
                <div class="card-art">${getCardIcon(card.type)}</div>
                <div class="card-name">${card.name || 'Unknown Card'}</div>
                <div class="card-description">${card.description || ''}</div>
                <div class="card-rarity">${card.rarity || 'common'}</div>
            </div>
        `).join('');
        
        // Add click handlers
        cardChoices.querySelectorAll('.reward-card').forEach(el => {
            el.addEventListener('click', () => {
                try { game.audioManager.playSFX('card_select'); } catch(e) {}
                selectCard(game, el.dataset.cardId, rewards.cards);
            });
        });
    }
    
    // Display artifact if present
    const artifactEl = document.getElementById('artifact-reward') || 
                       document.getElementById('reward-artifact');
    if (artifactEl) {
        if (rewards.artifact) {
            artifactEl.innerHTML = `
                <div class="artifact-item" data-artifact-id="${rewards.artifact.id}">
                    <div class="artifact-icon">${rewards.artifact.icon || '💎'}</div>
                    <div class="artifact-info">
                        <div class="artifact-name">${rewards.artifact.name}</div>
                        <div class="artifact-desc">${rewards.artifact.description || ''}</div>
                    </div>
                </div>
            `;
            artifactEl.style.display = 'block';
            
            // Auto-collect artifact
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(rewards.artifact);
            game.state.set('artifacts', artifacts);
            game.eventBus.emit('artifact:gained', { artifact: rewards.artifact });
        } else {
            artifactEl.style.display = 'none';
        }
    }
    
    // Show title based on node type
    const titleEl = document.getElementById('reward-title');
    if (titleEl) {
        const titles = {
            combat: 'VICTORY!',
            elite: 'ELITE DEFEATED!',
            boss: 'BOSS VANQUISHED!',
            treasure: 'TREASURE FOUND!'
        };
        titleEl.textContent = titles[rewards.nodeType] || 'REWARDS';
    }
}

/**
 * Handle card selection
 */
function selectCard(game, cardId, cards) {
    const card = cards.find(c => c.id === cardId);
    if (!card) {
        console.warn('[RewardScreen] Card not found:', cardId);
        return;
    }
    
    console.log('[RewardScreen] Selected card:', card.name);
    
    // Add card to deck
    if (game.deck && typeof game.deck.addCardToDeck === 'function') {
        game.deck.addCardToDeck(card);
    } else {
        // Manual add to state
        const deck = game.state.get('deck') || [];
        deck.push({ ...card, instanceId: `card_${Date.now()}` });
        game.state.set('deck', deck);
    }
    
    game.eventBus.emit('card:added', { card });
    
    // Visual feedback
    const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardEl) {
        cardEl.classList.add('selected');
        cardEl.style.transform = 'scale(1.1)';
        cardEl.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.8)';
    }
    
    // Disable other cards
    document.querySelectorAll('.reward-card').forEach(el => {
        if (el.dataset.cardId !== cardId) {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
        }
    });
    
    // Complete rewards after short delay
    setTimeout(() => completeRewards(game), 500);
}

/**
 * Get card icon by type
 */
function getCardIcon(type) {
    const icons = {
        attack: '⚔️',
        skill: '🛡️',
        power: '⚡',
        corrupted: '👁️',
        curse: '💀'
    };
    return icons[type] || '📜';
}

/**
 * Complete rewards and return to map
 */
function completeRewards(game) {
    console.log('[RewardScreen] Completing rewards...');
    
    // Clear current rewards
    game.state.set('currentRewards', null);
    
    // Get node info
    const nodeType = game.state.get('currentNodeType');
    
    // Check if this was the boss
    if (nodeType === 'boss') {
        const act = game.state.get('act') || 1;
        
        if (act >= 3) {
            // Game complete!
            console.log('[RewardScreen] Game complete!');
            game.eventBus.emit('game:victory');
            game.screenManager.transitionTo('victory-screen');
        } else {
            // Advance to next act
            console.log('[RewardScreen] Advancing to act', act + 1);
            game.state.set('act', act + 1);
            
            // Generate new map
            if (game.mapGenerator) {
                game.mapGenerator.generateAct(act + 1);
            }
            
            game.screenManager.transitionTo('map-screen');
        }
    } else {
        // Complete current node and return to map
        if (game.mapGenerator && typeof game.mapGenerator.completeCurrentNode === 'function') {
            game.mapGenerator.completeCurrentNode();
        }
        
        game.eventBus.emit('map:updated');
        game.screenManager.transitionTo('map-screen');
    }
}
