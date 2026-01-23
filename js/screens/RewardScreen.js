/**
 * RewardScreen - Handles post-combat reward selection
 */

export function setupRewardScreen(game) {
    const screen = document.getElementById('reward-screen');
    
    // Listen for reward events
    game.eventBus.on('reward:screen', (rewards) => displayRewards(rewards));
    
    function displayRewards(rewards) {
        // Credits are auto-collected, just show notification
        game.eventBus.emit('credits:gained', rewards.credits);
        
        // Display credits
        const goldReward = document.getElementById('gold-reward');
        if (goldReward) {
            goldReward.textContent = `+${rewards.credits} Credits`;
        }
        
        // Display card choices
        const cardChoices = document.getElementById('card-choices');
        if (cardChoices) {
            cardChoices.innerHTML = rewards.cards.map(card => `
                <div class="reward-card type-${card.type} rarity-${card.rarity}" 
                     data-card-id="${card.id}">
                    <div class="card-cost">${card.cost}</div>
                    <div class="card-type-badge">${card.type}</div>
                    <div class="card-art">${getCardIcon(card.type)}</div>
                    <div class="card-name">${card.name}</div>
                    <div class="card-description">${card.description}</div>
                    <div class="card-rarity">${card.rarity}</div>
                </div>
            `).join('');
            
            // Add click handlers
            cardChoices.querySelectorAll('.reward-card').forEach(el => {
                el.addEventListener('click', () => {
                    selectCard(el.dataset.cardId);
                });
            });
        }
        
        // Display artifact if present
        const artifactReward = document.getElementById('artifact-reward');
        if (artifactReward) {
            if (rewards.artifact) {
                artifactReward.innerHTML = `
                    <div class="artifact-item" data-artifact-id="${rewards.artifact.id}">
                        <div class="artifact-icon">💎</div>
                        <div class="artifact-name">${rewards.artifact.name}</div>
                        <div class="artifact-desc">${rewards.artifact.description}</div>
                    </div>
                `;
                artifactReward.style.display = 'block';
                
                // Auto-collect artifact
                const artifacts = game.state.get('artifacts') || [];
                artifacts.push(rewards.artifact);
                game.state.set('artifacts', artifacts);
                game.eventBus.emit('artifact:gained', rewards.artifact);
            } else {
                artifactReward.style.display = 'none';
            }
        }
    }
    
    function selectCard(cardId) {
        game.rewards.selectCardReward(cardId);
        completeRewards();
    }
    
    function getCardIcon(type) {
        const icons = { attack: '⚔️', skill: '🛡️', power: '⚡', corrupted: '👁️' };
        return icons[type] || '📜';
    }
    
    // Skip button
    const skipBtn = document.getElementById('skip-reward');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            game.rewards.skipCardReward();
            completeRewards();
        });
    }
    
    function completeRewards() {
        const node = game.state.get('currentNode');
        
        // Check if this was the boss
        if (node?.type === 'boss') {
            game.eventBus.emit('boss:defeated');
            game.screenManager.transitionTo('victory-screen');
        } else {
            game.mapGenerator.completeCurrentNode();
            game.screenManager.transitionTo('map-screen');
        }
    }
    
    return { displayRewards, selectCard };
}
