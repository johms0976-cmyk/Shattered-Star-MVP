/**
 * RewardSystem - Handles combat and event rewards
 */
class RewardSystem {
    constructor(state, eventBus, dataLoader) {
        this.state = state;
        this.eventBus = eventBus;
        this.dataLoader = dataLoader;
        
        this.currentRewards = null;
        
        this.rewardConfig = {
            combat: {
                credits: { min: 10, max: 20 },
                cardChoices: 3,
                cardRarityWeights: {
                    common: 70,
                    uncommon: 25,
                    rare: 5
                }
            },
            elite: {
                credits: { min: 25, max: 40 },
                cardChoices: 3,
                artifactChance: 1.0,
                cardRarityWeights: {
                    common: 40,
                    uncommon: 45,
                    rare: 15
                }
            },
            boss: {
                credits: { min: 50, max: 75 },
                cardChoices: 3,
                artifactChance: 1.0,
                rareArtifact: true,
                cardRarityWeights: {
                    common: 20,
                    uncommon: 50,
                    rare: 30
                }
            }
        };
    }

    /**
     * Generate combat rewards
     */
    generateCombatRewards(nodeType = 'combat') {
        const config = this.rewardConfig[nodeType] || this.rewardConfig.combat;
        const heroId = this.state.get('hero.id');
        
        const rewards = {
            type: nodeType,
            credits: this.randomRange(config.credits.min, config.credits.max),
            cards: [],
            artifact: null
        };
        
        // Generate card choices
        for (let i = 0; i < config.cardChoices; i++) {
            const rarity = this.rollRarity(config.cardRarityWeights);
            const cardPool = this.dataLoader.getCardRewardPool(heroId, rarity);
            
            if (cardPool.length > 0) {
                const randomCard = cardPool[Math.floor(Math.random() * cardPool.length)];
                // Avoid duplicates
                if (!rewards.cards.find(c => c.id === randomCard.id)) {
                    rewards.cards.push({ ...randomCard });
                }
            }
        }
        
        // Maybe generate artifact for elite/boss
        if (config.artifactChance && Math.random() < config.artifactChance) {
            const rarity = config.rareArtifact ? 'rare' : 'common';
            rewards.artifact = this.dataLoader.getRandomArtifact(rarity);
        }
        
        this.currentRewards = rewards;
        this.displayRewards(rewards);
        
        return rewards;
    }

    /**
     * Generate boss rewards
     */
    generateBossRewards(act) {
        return this.generateCombatRewards('boss');
    }

    /**
     * Roll for card rarity
     */
    rollRarity(weights) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        
        for (const [rarity, weight] of Object.entries(weights)) {
            roll -= weight;
            if (roll <= 0) return rarity;
        }
        
        return 'common';
    }

    /**
     * Random range helper
     */
    randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Display rewards UI
     */
    displayRewards(rewards) {
        // Update credits reward
        const creditsReward = document.getElementById('gold-reward');
        if (creditsReward) {
            creditsReward.textContent = `+${rewards.credits} Credits`;
        }
        
        // Display card choices
        const cardChoicesContainer = document.getElementById('card-choices');
        if (cardChoicesContainer) {
            cardChoicesContainer.innerHTML = rewards.cards.map(card => `
                <div class="reward-card type-${card.type} rarity-${card.rarity}" 
                     data-card-id="${card.id}">
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
            
            // Add click handlers
            cardChoicesContainer.querySelectorAll('.reward-card').forEach(el => {
                el.addEventListener('click', () => {
                    this.selectCardReward(el.dataset.cardId);
                });
            });
        }
        
        // Show artifact if present
        if (rewards.artifact) {
            // TODO: Add artifact display
        }
        
        this.eventBus.emit('reward:screen', rewards);
    }

    /**
     * Select a card reward
     */
    selectCardReward(cardId) {
        const card = this.currentRewards.cards.find(c => c.id === cardId);
        if (!card) return;
        
        // Get hero ID and full card data
        const heroId = this.state.get('hero.id');
        const fullCard = this.dataLoader.getCard(heroId, cardId);
        
        if (fullCard) {
            // Add to deck via event
            this.eventBus.emit('card:added', fullCard);
            
            // Update deck in state
            const deck = this.state.get('deck') || [];
            deck.push({ ...fullCard, instanceId: `card_${Date.now()}` });
            this.state.set('deck', deck);
        }
        
        this.eventBus.emit('reward:selected', { type: 'card', card });
        
        // Collect credits
        this.collectCredits();
        
        // Clear rewards
        this.currentRewards = null;
    }

    /**
     * Skip card reward
     */
    skipCardReward() {
        this.collectCredits();
        this.eventBus.emit('reward:skipped');
        this.currentRewards = null;
    }

    /**
     * Collect credits from current rewards
     */
    collectCredits() {
        if (!this.currentRewards) return;
        
        const currentCredits = this.state.get('credits') || 0;
        this.state.set('credits', currentCredits + this.currentRewards.credits);
        
        this.eventBus.emit('credits:gained', this.currentRewards.credits);
    }

    /**
     * Get card icon
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
     * Generate event rewards
     */
    generateEventRewards(effects) {
        effects.forEach(effect => {
            switch (effect.type) {
                case 'hp':
                    const currentHp = this.state.get('hp');
                    const maxHp = this.state.get('maxHp');
                    this.state.set('hp', Math.max(0, Math.min(maxHp, currentHp + effect.value)));
                    this.eventBus.emit('hp:changed', { 
                        current: this.state.get('hp'), 
                        max: maxHp,
                        change: effect.value 
                    });
                    break;
                    
                case 'credits':
                    const credits = this.state.get('credits') || 0;
                    this.state.set('credits', credits + effect.value);
                    this.eventBus.emit('credits:gained', effect.value);
                    break;
                    
                case 'corruption':
                    this.eventBus.emit('corruption:gained', effect.value);
                    break;
                    
                case 'heal':
                    const hp = this.state.get('hp');
                    const max = this.state.get('maxHp');
                    this.state.set('hp', Math.min(max, hp + effect.value));
                    this.eventBus.emit('heal', effect.value);
                    break;
                    
                case 'addCard':
                    // TODO: Handle card addition from events
                    break;
                    
                case 'artifact':
                    const artifact = this.dataLoader.getArtifact(effect.artifact);
                    if (artifact) {
                        const artifacts = this.state.get('artifacts') || [];
                        artifacts.push(artifact);
                        this.state.set('artifacts', artifacts);
                        this.eventBus.emit('artifact:gained', artifact);
                    }
                    break;
                    
                case 'faction':
                    const factionRep = this.state.get(`factions.${effect.faction}`) || 0;
                    this.state.set(`factions.${effect.faction}`, factionRep + effect.value);
                    this.eventBus.emit('faction:rep:changed', {
                        faction: effect.faction,
                        change: effect.value,
                        total: factionRep + effect.value
                    });
                    break;
            }
        });
    }
}

export { RewardSystem };
