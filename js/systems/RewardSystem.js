/**
 * RewardSystem - Enhanced with rarity shimmer, corrupted rewards, and reward variance
 * Shattered Star
 * 
 * Features:
 * - Tiered reward screens with visual rarity indicators
 * - Corrupted card offerings alongside clean ones (Feature 3)
 * - Shimmer/glow effects on rare+ cards
 * - Sound cue hooks for reward reveals
 * - Skip reward option
 */

class RewardSystem {
    constructor(state, eventBus, dataLoader) {
        this.state = state;
        this.eventBus = eventBus;
        this.dataLoader = dataLoader;
        
        this.currentRewards = null;
        
        // Reward configuration per encounter type
        this.rewardConfig = {
            combat: {
                credits: { min: 10, max: 20 },
                cardChoices: 3,
                cardRarityWeights: { common: 70, uncommon: 25, rare: 5 },
                corruptedChance: 0.0, // No corrupted in basic combat
                artifactChance: 0.0
            },
            elite: {
                credits: { min: 25, max: 40 },
                cardChoices: 3,
                cardRarityWeights: { common: 30, uncommon: 50, rare: 15, legendary: 5 },
                corruptedChance: 0.25, // 25% chance of a corrupted option
                artifactChance: 1.0
            },
            boss: {
                credits: { min: 50, max: 75 },
                cardChoices: 3,
                cardRarityWeights: { common: 10, uncommon: 40, rare: 40, legendary: 10 },
                corruptedChance: 0.5, // 50% chance of corrupted option
                artifactChance: 1.0,
                rareArtifact: true
            },
            treasure: {
                credits: { min: 30, max: 60 },
                cardChoices: 2,
                cardRarityWeights: { common: 50, uncommon: 35, rare: 15 },
                corruptedChance: 0.15,
                artifactChance: 0.3
            }
        };

        // Corrupted card pool - powerful but dangerous
        this.corruptedCards = [
            {
                id: 'void_strike',
                name: 'Void Strike',
                type: 'attack',
                rarity: 'corrupted',
                cost: 1,
                damage: 14,
                description: 'Deal 14 damage. Gain 3 Corruption.',
                effects: { corruption: 3 },
                flavorText: 'The darkness cuts deeper than steel.'
            },
            {
                id: 'entropic_shield',
                name: 'Entropic Shield',
                type: 'skill',
                rarity: 'corrupted',
                cost: 1,
                block: 16,
                description: 'Gain 16 Block. Gain 2 Corruption.',
                effects: { corruption: 2 },
                flavorText: 'Protection at a price you cannot see.'
            },
            {
                id: 'whisper_of_power',
                name: 'Whisper of Power',
                type: 'power',
                rarity: 'corrupted',
                cost: 2,
                description: 'Gain 2 Strength. At the start of each turn, gain 1 Corruption.',
                effects: { corruption: 1, strength: 2 },
                flavorText: 'It promises everything. It takes everything.'
            },
            {
                id: 'abyssal_drain',
                name: 'Abyssal Drain',
                type: 'attack',
                rarity: 'corrupted',
                cost: 2,
                damage: 10,
                description: 'Deal 10 damage. Heal for damage dealt. Gain 4 Corruption.',
                effects: { corruption: 4, lifesteal: true },
                flavorText: 'Hunger without end.'
            },
            {
                id: 'reality_fracture',
                name: 'Reality Fracture',
                type: 'skill',
                rarity: 'corrupted',
                cost: 0,
                description: 'Draw 3 cards. Gain 5 Corruption.',
                effects: { corruption: 5, draw: 3 },
                flavorText: 'The world bends. You see through it.'
            },
            {
                id: 'dark_resonance',
                name: 'Dark Resonance',
                type: 'power',
                rarity: 'corrupted',
                cost: 3,
                description: 'Whenever you play an Attack, deal 4 additional damage. Gain 1 Corruption per Attack played.',
                effects: { corruption: 0 },
                flavorText: 'Every blow echoes in the void.'
            },
            {
                id: 'consume_essence',
                name: 'Consume Essence',
                type: 'attack',
                rarity: 'corrupted',
                cost: 1,
                damage: 8,
                description: 'Deal 8 damage. If this kills, gain 1 Energy. Gain 3 Corruption.',
                effects: { corruption: 3 },
                flavorText: 'They had something you needed.'
            },
            {
                id: 'void_armor',
                name: 'Void Armor',
                type: 'skill',
                rarity: 'corrupted',
                cost: 2,
                block: 20,
                description: 'Gain 20 Block. Enemies gain 1 Strength. Gain 3 Corruption.',
                effects: { corruption: 3 },
                flavorText: 'The void protects, but it also feeds.'
            }
        ];
    }

    /**
     * Generate combat rewards based on encounter type
     */
    generateCombatRewards(nodeType = 'combat') {
        const config = this.rewardConfig[nodeType] || this.rewardConfig.combat;
        const heroId = this.state.get('hero.id');
        const corruption = this.state.get('corruption') || 0;
        
        const rewards = {
            type: nodeType,
            credits: this.randomRange(config.credits.min, config.credits.max),
            cards: [],
            corruptedCard: null,
            artifact: null,
            hasRareOrBetter: false
        };
        
        // Generate standard card choices
        const usedIds = new Set();
        for (let i = 0; i < config.cardChoices; i++) {
            const rarity = this.rollRarity(config.cardRarityWeights);
            const card = this.getUniqueCard(heroId, rarity, usedIds);
            if (card) {
                usedIds.add(card.id);
                rewards.cards.push({ ...card });
                if (rarity === 'rare' || rarity === 'legendary') {
                    rewards.hasRareOrBetter = true;
                }
            }
        }
        
        // Maybe offer a corrupted card alongside standard choices
        const corruptedRoll = Math.random();
        const corruptionBonus = corruption / 200; // Higher corruption = more corrupted offerings
        if (corruptedRoll < (config.corruptedChance + corruptionBonus)) {
            const available = this.corruptedCards.filter(c => !usedIds.has(c.id));
            if (available.length > 0) {
                rewards.corruptedCard = { ...available[Math.floor(Math.random() * available.length)] };
            }
        }
        
        // Maybe generate artifact
        if (config.artifactChance && Math.random() < config.artifactChance) {
            const rarity = config.rareArtifact ? 'rare' : 'common';
            try {
                rewards.artifact = this.dataLoader.getRandomArtifact(rarity);
            } catch (e) {
                console.warn('[RewardSystem] Failed to get artifact:', e);
            }
        }
        
        this.currentRewards = rewards;
        this.displayRewards(rewards);
        
        return rewards;
    }

    /**
     * Generate boss rewards with narrative hook
     */
    generateBossRewards(act) {
        const rewards = this.generateCombatRewards('boss');
        // Boss always offers a corrupted option
        if (!rewards.corruptedCard) {
            const available = this.corruptedCards.filter(c => !rewards.cards.find(r => r.id === c.id));
            if (available.length > 0) {
                rewards.corruptedCard = { ...available[Math.floor(Math.random() * available.length)] };
            }
        }
        return rewards;
    }

    /**
     * Get a unique card not already in the reward set
     */
    getUniqueCard(heroId, rarity, usedIds) {
        try {
            const pool = this.dataLoader.getCardRewardPool(heroId, rarity);
            const available = pool.filter(c => !usedIds.has(c.id));
            if (available.length > 0) {
                return available[Math.floor(Math.random() * available.length)];
            }
            // Fallback: try any rarity
            const anyPool = this.dataLoader.getCardRewardPool(heroId, 'common');
            const anyAvailable = anyPool.filter(c => !usedIds.has(c.id));
            if (anyAvailable.length > 0) {
                return anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
            }
        } catch (e) {
            console.warn('[RewardSystem] Card pool fetch failed:', e);
        }
        return null;
    }

    /**
     * Roll for card rarity with weighted distribution
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
     * Display rewards UI with shimmer effects
     */
    displayRewards(rewards) {
        // Update credits display
        const creditsReward = document.getElementById('gold-reward');
        if (creditsReward) {
            creditsReward.textContent = `+${rewards.credits} Credits`;
            creditsReward.classList.add('credits-reveal');
        }
        
        // Auto-add credits to state
        const currentCredits = this.state.get('credits') || 0;
        this.state.set('credits', currentCredits + rewards.credits);
        
        // Build card choices container
        const cardChoicesContainer = document.getElementById('card-choices');
        if (cardChoicesContainer) {
            let cardsHtml = '';
            
            // Standard card choices
            cardsHtml += rewards.cards.map(card => this.renderRewardCard(card, false)).join('');
            
            // Corrupted card option (if available)
            if (rewards.corruptedCard) {
                cardsHtml += this.renderRewardCard(rewards.corruptedCard, true);
            }
            
            cardChoicesContainer.innerHTML = cardsHtml;
            
            // Add click handlers
            cardChoicesContainer.querySelectorAll('.reward-card-container').forEach(el => {
                el.addEventListener('click', () => {
                    const cardId = el.dataset.cardId;
                    const isCorrupted = el.dataset.corrupted === 'true';
                    
                    // Visual feedback: pulse the selected card
                    el.classList.add('card-selected');
                    
                    if (isCorrupted) {
                        this.selectCorruptedReward(cardId);
                    } else {
                        this.selectCardReward(cardId);
                    }
                });
            });
            
            // Staggered reveal animation
            this.animateCardReveal(cardChoicesContainer);
        }
        
        // Show artifact if present
        const artifactContainer = document.getElementById('artifact-reward');
        if (artifactContainer) {
            if (rewards.artifact) {
                artifactContainer.innerHTML = `
                    <div class="artifact-reward-item rarity-${rewards.artifact.rarity || 'common'}" 
                         data-artifact-id="${rewards.artifact.id}">
                        <div class="artifact-icon-large">💎</div>
                        <div class="artifact-info">
                            <div class="artifact-name">${rewards.artifact.name}</div>
                            <div class="artifact-desc">${rewards.artifact.description}</div>
                        </div>
                    </div>
                `;
                artifactContainer.style.display = 'block';
                
                // Auto-collect artifact
                const artifacts = this.state.get('artifacts') || [];
                artifacts.push(rewards.artifact);
                this.state.set('artifacts', artifacts);
                this.eventBus.emit('artifact:gained', rewards.artifact);
            } else {
                artifactContainer.style.display = 'none';
            }
        }
        
        this.eventBus.emit('reward:screen', rewards);
    }

    /**
     * Render a single reward card with flip ceremony
     * Card starts face-down (card back), then flips to reveal
     */
    renderRewardCard(card, isCorrupted) {
        const rarityClass = isCorrupted ? 'corrupted' : (card.rarity || 'common');
        const shimmerClass = (rarityClass === 'rare' || rarityClass === 'legendary' || rarityClass === 'corrupted') 
            ? 'has-shimmer' : '';
        
        const typeIcon = this.getCardIcon(card.type);
        const corruptedBadge = isCorrupted 
            ? `<div class="corrupted-badge">⚠ CORRUPTED</div>` 
            : '';
        const corruptionWarning = isCorrupted && card.effects?.corruption
            ? `<div class="corruption-warning">+${card.effects.corruption} Corruption</div>`
            : '';
        const flavorText = card.flavorText 
            ? `<div class="card-flavor">${card.flavorText}</div>` 
            : '';
        
        return `
            <div class="reward-card-container" data-card-id="${card.id}" data-corrupted="${isCorrupted}">
                <div class="reward-card-flipper">
                    <!-- CARD BACK (visible initially) -->
                    <div class="reward-card-back rarity-${rarityClass}">
                        <div class="card-back-pattern">
                            <div class="card-back-symbol">✦</div>
                            <div class="card-back-label">SHATTERED STAR</div>
                        </div>
                    </div>
                    <!-- CARD FACE (revealed on flip) -->
                    <div class="reward-card-face type-${card.type} rarity-${rarityClass} ${shimmerClass}">
                        <div class="card-shimmer-overlay"></div>
                        <div class="card-rarity-border"></div>
                        <div class="card-header">
                            <div class="card-cost">${card.cost}</div>
                            <div class="card-type-badge">${card.type}</div>
                        </div>
                        <div class="card-art">${typeIcon}</div>
                        ${corruptedBadge}
                        <div class="card-name">${card.name}</div>
                        <div class="card-description">${card.description}</div>
                        ${corruptionWarning}
                        ${flavorText}
                        <div class="card-rarity-indicator rarity-${rarityClass}">
                            ${this.getRarityLabel(rarityClass)}
                        </div>
                    </div>
                </div>
                <!-- Rarity glow burst (hidden until flip) -->
                <div class="rarity-glow-burst rarity-${rarityClass}"></div>
            </div>
        `;
    }

    /**
     * Staggered card flip ceremony
     * Cards slide in face-down, pause, then flip one at a time with rarity bursts
     */
    animateCardReveal(container) {
        const cards = container.querySelectorAll('.reward-card-container');
        
        cards.forEach((cardContainer, index) => {
            const flipper = cardContainer.querySelector('.reward-card-flipper');
            const glowBurst = cardContainer.querySelector('.rarity-glow-burst');
            const face = cardContainer.querySelector('.reward-card-face');
            
            // Start invisible
            cardContainer.style.opacity = '0';
            cardContainer.style.transform = 'translateY(40px)';
            
            // Phase 1: Slide in face-down (staggered)
            setTimeout(() => {
                cardContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                cardContainer.style.opacity = '1';
                cardContainer.style.transform = 'translateY(0)';
                
                // Phase 2: Flip to reveal after a dramatic pause
                setTimeout(() => {
                    flipper.classList.add('flipped');
                    
                    // Phase 3: Rarity glow burst on flip for rare+
                    const isSpecial = face && (
                        face.classList.contains('rarity-rare') ||
                        face.classList.contains('rarity-legendary') ||
                        face.classList.contains('rarity-corrupted')
                    );
                    
                    if (isSpecial && glowBurst) {
                        setTimeout(() => {
                            glowBurst.classList.add('active');
                            this.eventBus.emit('sfx:play', { sound: 'rare_reveal' });
                            setTimeout(() => glowBurst.classList.remove('active'), 800);
                        }, 250);
                    }
                }, 500); // Half-second pause before flip
                
            }, 300 + (index * 400)); // Stagger each card by 400ms
        });
    }

    /**
     * Get card type icon
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
     * Get rarity display label
     */
    getRarityLabel(rarity) {
        const labels = {
            common: '● COMMON',
            uncommon: '●● UNCOMMON',
            rare: '★ RARE',
            legendary: '★★ LEGENDARY',
            corrupted: '◆ CORRUPTED'
        };
        return labels[rarity] || '● COMMON';
    }

    /**
     * Select a standard card reward
     */
    selectCardReward(cardId) {
        if (!this.currentRewards) return;
        
        const card = this.currentRewards.cards.find(c => c.id === cardId);
        if (!card) return;
        
        // Get full card data
        const heroId = this.state.get('hero.id');
        let fullCard = null;
        try {
            fullCard = this.dataLoader.getCard(heroId, cardId);
        } catch (e) {
            fullCard = card; // Use reward data as fallback
        }
        
        if (fullCard) {
            const deck = this.state.get('deck') || [];
            deck.push({ ...fullCard, instanceId: `card_${Date.now()}` });
            this.state.set('deck', deck);
            this.eventBus.emit('card:added', fullCard);
        }
        
        this.eventBus.emit('reward:selected', { type: 'card', card });
        this.currentRewards = null;
    }

    /**
     * Select a corrupted card reward
     */
    selectCorruptedReward(cardId) {
        if (!this.currentRewards) return;
        
        const card = this.currentRewards.corruptedCard;
        if (!card || card.id !== cardId) return;
        
        // Add corruption
        const corruptionGain = card.effects?.corruption || 3;
        const currentCorruption = this.state.get('corruption') || 0;
        this.state.set('corruption', Math.min(100, currentCorruption + corruptionGain));
        this.eventBus.emit('corruption:gained', corruptionGain);
        
        // Add card to deck
        const deck = this.state.get('deck') || [];
        deck.push({ ...card, instanceId: `card_${Date.now()}` });
        this.state.set('deck', deck);
        this.eventBus.emit('card:added', card);
        
        // Void whisper feedback
        this.eventBus.emit('void:whisper', {
            text: card.flavorText || 'The darkness welcomes you.',
            intensity: 'high'
        });
        
        this.eventBus.emit('reward:selected', { type: 'corrupted_card', card });
        this.currentRewards = null;
    }

    /**
     * Skip card reward entirely
     */
    skipCardReward() {
        this.eventBus.emit('reward:skipped');
        this.currentRewards = null;
    }

    /**
     * Collect credits (called when leaving reward screen)
     */
    collectCredits() {
        // Credits are auto-collected in displayRewards now
    }
}

export default RewardSystem;
