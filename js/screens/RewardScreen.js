/**
 * RewardScreen - Handles post-combat and treasure rewards
 * FIXED: Now properly initializes when screen becomes visible
 */

export function setupRewardScreen(game) {
    const screen = document.getElementById('reward-screen');
    
    console.log('[RewardScreen] Setting up reward screen');
    
    // FIXED: Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'reward-screen') {
            console.log('[RewardScreen] Screen shown, initializing...');
            initializeRewards();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'reward-screen') {
            console.log('[RewardScreen] Screen changed to rewards, initializing...');
            initializeRewards();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('rewards:show', () => {
        console.log('[RewardScreen] rewards:show event received');
        initializeRewards();
    });
    
    function initializeRewards() {
        console.log('[RewardScreen] Initializing rewards...');
        
        // Get rewards from state (set by combat or treasure)
        let rewards = game.state.get('rewards.pending');
        
        if (!rewards || Object.keys(rewards).length === 0) {
            console.log('[RewardScreen] No rewards in state, generating default');
            rewards = generateDefaultRewards();
            game.state.set('rewards.pending', rewards);
        }
        
        renderRewards(rewards);
        setupProceedButton();
    }
    
    function generateDefaultRewards() {
        const act = game.state.get('act') || 1;
        
        // Basic combat rewards
        const credits = Math.floor(Math.random() * 20) + 10 + (act * 5);
        
        // Card selection
        let cardChoices = [];
        try {
            const heroId = game.state.get('heroId') || 'korvax';
            const allCards = game.dataLoader?.getCardsForHero?.(heroId) || [];
            const eligibleCards = allCards.filter(c => c.rarity !== 'starter');
            cardChoices = eligibleCards
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
        } catch (e) {
            console.warn('[RewardScreen] Failed to get cards:', e);
            cardChoices = getFallbackCards();
        }
        
        return {
            credits,
            cardChoices,
            claimed: {
                credits: false,
                card: false
            }
        };
    }
    
    function getFallbackCards() {
        return [
            { id: 'strike_plus', name: 'Strike+', type: 'attack', cost: 1, damage: 9, rarity: 'common', description: 'Deal 9 damage.' },
            { id: 'defend_plus', name: 'Defend+', type: 'skill', cost: 1, block: 8, rarity: 'common', description: 'Gain 8 Block.' },
            { id: 'quick_slash', name: 'Quick Slash', type: 'attack', cost: 1, damage: 8, rarity: 'uncommon', description: 'Deal 8 damage. Draw 1 card.' }
        ];
    }
    
    function renderRewards(rewards) {
        const container = document.getElementById('rewards');
        if (!container) {
            console.error('[RewardScreen] Rewards container not found');
            return;
        }
        
        container.innerHTML = '';
        
        // Credits reward
        if (rewards.credits && !rewards.claimed?.credits) {
            const creditsEl = document.createElement('div');
            creditsEl.className = 'reward-item credits-reward';
            creditsEl.innerHTML = `
                <div class="reward-icon">💰</div>
                <div class="reward-text">${rewards.credits} Credits</div>
            `;
            creditsEl.addEventListener('click', () => {
                claimCredits(rewards.credits);
                creditsEl.classList.add('claimed');
                creditsEl.style.opacity = '0.5';
                creditsEl.style.pointerEvents = 'none';
            });
            container.appendChild(creditsEl);
        }
        
        // Card reward
        if (rewards.cardChoices && rewards.cardChoices.length > 0 && !rewards.claimed?.card) {
            const cardRewardEl = document.createElement('div');
            cardRewardEl.className = 'reward-item card-reward';
            cardRewardEl.innerHTML = `
                <div class="reward-icon">🃏</div>
                <div class="reward-text">Add a Card</div>
            `;
            cardRewardEl.addEventListener('click', () => {
                showCardSelection(rewards.cardChoices);
            });
            container.appendChild(cardRewardEl);
        }
        
        // Artifact reward (if any)
        if (rewards.artifact && !rewards.claimed?.artifact) {
            const artifactEl = document.createElement('div');
            artifactEl.className = 'reward-item artifact-reward';
            artifactEl.innerHTML = `
                <div class="reward-icon">🔮</div>
                <div class="reward-text">${rewards.artifact.name}</div>
            `;
            artifactEl.addEventListener('click', () => {
                claimArtifact(rewards.artifact);
                artifactEl.classList.add('claimed');
                artifactEl.style.opacity = '0.5';
                artifactEl.style.pointerEvents = 'none';
            });
            container.appendChild(artifactEl);
        }
        
        console.log('[RewardScreen] Rendered rewards');
    }
    
    function claimCredits(amount) {
        console.log(`[RewardScreen] Claiming ${amount} credits`);
        game.audioManager?.playSFX?.('coin');
        
        const current = game.state.get('credits') || 0;
        game.state.set('credits', current + amount);
        game.eventBus.emit('credits:gained', amount);
        
        const rewards = game.state.get('rewards.pending') || {};
        rewards.claimed = rewards.claimed || {};
        rewards.claimed.credits = true;
        game.state.set('rewards.pending', rewards);
    }
    
    function showCardSelection(cards) {
        console.log('[RewardScreen] Showing card selection');
        
        const modal = document.getElementById('deck-modal');
        const content = document.getElementById('deck-view-cards') || document.getElementById('deck-cards');
        
        if (content) {
            content.innerHTML = `
                <h3 style="color: var(--color-highlight); margin-bottom: 1rem;">Choose a Card to Add</h3>
                <div class="card-selection" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    ${cards.map(card => `
                        <div class="reward-card card type-${card.type || 'attack'}" data-id="${card.id}" style="cursor: pointer; padding: 1rem; border: 1px solid var(--color-accent); border-radius: 8px; min-width: 150px;">
                            <div class="card-cost" style="color: var(--color-energy);">${card.cost}</div>
                            <div class="card-name" style="font-weight: bold;">${card.name}</div>
                            <div class="card-rarity" style="font-size: 0.7em; opacity: 0.7;">${card.rarity || 'common'}</div>
                            <div class="card-description" style="font-size: 0.8em; margin-top: 0.5rem;">${card.description || ''}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="skip-btn" style="margin-top: 1rem; padding: 0.5rem 1rem;">Skip</button>
            `;
            
            // Card click handlers
            content.querySelectorAll('.reward-card').forEach(el => {
                el.addEventListener('click', () => {
                    const cardId = el.dataset.id;
                    addCardToDeck(cardId, cards);
                    game.screenManager.hideModal('deck-modal');
                    
                    // Update rewards display
                    const rewards = game.state.get('rewards.pending') || {};
                    rewards.claimed = rewards.claimed || {};
                    rewards.claimed.card = true;
                    game.state.set('rewards.pending', rewards);
                    renderRewards(rewards);
                });
            });
            
            // Skip button
            const skipBtn = content.querySelector('.skip-btn');
            if (skipBtn) {
                skipBtn.addEventListener('click', () => {
                    game.screenManager.hideModal('deck-modal');
                    
                    const rewards = game.state.get('rewards.pending') || {};
                    rewards.claimed = rewards.claimed || {};
                    rewards.claimed.card = true;
                    game.state.set('rewards.pending', rewards);
                    renderRewards(rewards);
                });
            }
        }
        
        game.screenManager.showModal('deck-modal');
    }
    
    function addCardToDeck(cardId, cards) {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;
        
        console.log(`[RewardScreen] Adding card to deck: ${card.name}`);
        game.audioManager?.playSFX?.('card_draw');
        
        // Create instance with unique ID
        const instanceCard = {
            ...card,
            instanceId: `${cardId}_${Date.now()}`
        };
        
        const deck = game.state.get('deck') || [];
        deck.push(instanceCard);
        game.state.set('deck', deck);
        
        game.eventBus.emit('card:obtained', instanceCard);
    }
    
    function claimArtifact(artifact) {
        console.log(`[RewardScreen] Claiming artifact: ${artifact.name}`);
        game.audioManager?.playSFX?.('artifact_obtain');
        
        const artifacts = game.state.get('artifacts') || [];
        artifacts.push(artifact);
        game.state.set('artifacts', artifacts);
        
        game.eventBus.emit('artifact:gained', artifact);
        
        const rewards = game.state.get('rewards.pending') || {};
        rewards.claimed = rewards.claimed || {};
        rewards.claimed.artifact = true;
        game.state.set('rewards.pending', rewards);
    }
    
    function setupProceedButton() {
        const proceedBtn = document.getElementById('btn-proceed');
        if (proceedBtn) {
            // Remove old listeners
            const newBtn = proceedBtn.cloneNode(true);
            proceedBtn.parentNode.replaceChild(newBtn, proceedBtn);
            
            newBtn.addEventListener('click', () => {
                console.log('[RewardScreen] Proceeding');
                game.audioManager?.playSFX?.('ui_click');
                proceed();
            });
        }
    }
    
    function proceed() {
        // Clear pending rewards
        game.state.set('rewards.pending', null);
        
        // Complete current node
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
        
        // Return to map
        game.screenManager.transitionTo('map-screen');
    }
    
    return { initializeRewards, renderRewards };
}
