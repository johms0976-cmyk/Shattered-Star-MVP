/**
 * VoidMerchant - Corruption-as-choice shop system
 * Shattered Star
 * 
 * Adds a "Void Merchant" tab to shops with powerful but corrupting items.
 * The Void Merchant offers:
 * - Corrupted cards at reduced credit cost
 * - Corrupted artifacts that are stronger but add corruption
 * - Dark bargains: trade HP/corruption for power
 * 
 * Appears in shops starting from node 5+, with increasing inventory as corruption rises.
 */

class VoidMerchant {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.inventory = null;
        this.isRevealed = false;
        
        // Void Merchant dialogue lines
        this.greetings = [
            "The void sees what you need... and offers it freely.",
            "Everything has a price. Mine are simply... different.",
            "You feel it, don't you? The hunger for more.",
            "Others sell trinkets. I sell transcendence.",
            "The corruption isn't a cost. It's an awakening."
        ];
        
        this.purchaseLines = [
            "Wise choice. You'll feel the difference immediately.",
            "The darkness suits you.",
            "Another step closer to what you're becoming.",
            "Can you feel it settling in? Good.",
            "The void remembers those who accept its gifts."
        ];
        
        this.highCorruptionGreetings = [
            "You return. Of course you do.",
            "The void has marked you as its own. Prices are... adjusted.",
            "You're almost there. Just a few more steps.",
            "I can barely tell where you end and the void begins.",
            "Welcome home."
        ];
        
        // Corrupted cards for sale
        this.voidCards = [
            {
                id: 'void_strike',
                name: 'Void Strike',
                type: 'attack',
                rarity: 'corrupted',
                cost: 1,
                damage: 14,
                description: 'Deal 14 damage. Gain 3 Corruption.',
                price: 30, // Cheap for its power
                corruptionCost: 3,
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
                price: 25,
                corruptionCost: 2,
                flavorText: 'Protection at a price you cannot see.'
            },
            {
                id: 'whisper_of_power',
                name: 'Whisper of Power',
                type: 'power',
                rarity: 'corrupted',
                cost: 2,
                description: 'Gain 2 Strength permanently. Start of turn: gain 1 Corruption.',
                price: 45,
                corruptionCost: 1,
                flavorText: 'It promises everything. It takes everything.'
            },
            {
                id: 'abyssal_drain',
                name: 'Abyssal Drain',
                type: 'attack',
                rarity: 'corrupted',
                cost: 2,
                damage: 10,
                description: 'Deal 10 damage. Heal equal to damage dealt. Gain 4 Corruption.',
                price: 40,
                corruptionCost: 4,
                flavorText: 'Hunger without end.'
            },
            {
                id: 'reality_fracture',
                name: 'Reality Fracture',
                type: 'skill',
                rarity: 'corrupted',
                cost: 0,
                description: 'Draw 3 cards. Gain 5 Corruption.',
                price: 55,
                corruptionCost: 5,
                flavorText: 'The world bends. You see through it.'
            },
            {
                id: 'dark_resonance',
                name: 'Dark Resonance',
                type: 'power',
                rarity: 'corrupted',
                cost: 3,
                description: 'Attacks deal +4 damage. Gain 1 Corruption per Attack played.',
                price: 60,
                corruptionCost: 0,
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
                price: 35,
                corruptionCost: 3,
                flavorText: 'They had something you needed.'
            },
            {
                id: 'void_armor',
                name: 'Void Armor',
                type: 'skill',
                rarity: 'corrupted',
                cost: 2,
                block: 20,
                description: 'Gain 20 Block. All enemies gain 1 Strength. Gain 3 Corruption.',
                price: 30,
                corruptionCost: 3,
                flavorText: 'The void protects, but it also feeds.'
            }
        ];
        
        // Corrupted artifacts
        this.voidArtifacts = [
            {
                id: 'eye_of_the_abyss',
                name: 'Eye of the Abyss',
                rarity: 'cosmic',
                description: 'At combat start, draw 2 extra cards. Gain 2 Corruption per combat.',
                price: 120,
                corruptionCost: 5,
                flavorText: 'It watches. It learns. It hungers.'
            },
            {
                id: 'void_heart',
                name: 'Void Heart',
                rarity: 'cosmic',
                description: 'Corrupted cards cost 1 less Energy. Gain 1 Corruption at end of each combat.',
                price: 150,
                corruptionCost: 8,
                flavorText: 'Your heartbeat sounds different now.'
            },
            {
                id: 'whispering_pendant',
                name: 'Whispering Pendant',
                rarity: 'cosmic',
                description: '+15% damage when Corruption > 25. +30% when > 50.',
                price: 100,
                corruptionCost: 3,
                flavorText: 'It tells you secrets about the things you kill.'
            },
            {
                id: 'entropy_shard',
                name: 'Entropy Shard',
                rarity: 'cosmic',
                description: 'Gain 3 Block at the start of each turn for every 10 Corruption.',
                price: 90,
                corruptionCost: 5,
                flavorText: 'Decay can be a shield, if you let it.'
            }
        ];
        
        // Dark bargains - trade HP or other resources for power
        this.darkBargains = [
            {
                id: 'bargain_max_hp',
                name: 'Sacrifice Vitality',
                description: 'Lose 5 Max HP permanently. Gain 10 Corruption cleansing.',
                icon: '💀',
                cost: 0, // Free in credits
                effects: { maxHpLoss: 5, corruptionRemove: 10 }
            },
            {
                id: 'bargain_power',
                name: 'Embrace the Dark',
                description: 'Gain 15 Corruption. Gain a random Rare card.',
                icon: '🌑',
                cost: 0,
                effects: { corruptionGain: 15, giveRareCard: true }
            },
            {
                id: 'bargain_health',
                name: 'Blood for Credits',
                description: 'Lose 15 HP. Gain 80 Credits.',
                icon: '🩸',
                cost: 0,
                effects: { hpLoss: 15, creditsGain: 80 }
            },
            {
                id: 'bargain_upgrade',
                name: 'Void Infusion',
                description: 'Gain 8 Corruption. Upgrade a random card in your deck.',
                icon: '⬆',
                cost: 0,
                effects: { corruptionGain: 8, upgradeRandom: true }
            }
        ];
    }
    
    /**
     * Check if Void Merchant should appear in this shop
     */
    shouldAppear() {
        const nodesVisited = this.state.get('map.visitedNodes')?.length || 0;
        const corruption = this.state.get('corruption') || 0;
        
        // Appears after node 4, with higher chance at higher corruption
        if (nodesVisited < 4) return false;
        
        const baseChance = 0.4;
        const corruptionBonus = corruption / 200;
        
        return Math.random() < (baseChance + corruptionBonus);
    }
    
    /**
     * Generate Void Merchant inventory
     */
    generateInventory() {
        const corruption = this.state.get('corruption') || 0;
        const deck = this.state.get('deck') || [];
        const ownedCardIds = new Set(deck.map(c => c.id));
        
        this.inventory = {
            cards: [],
            artifacts: [],
            bargains: []
        };
        
        // Select 2-3 corrupted cards (more at higher corruption)
        const cardCount = corruption >= 50 ? 3 : 2;
        const availableCards = this.voidCards.filter(c => !ownedCardIds.has(c.id));
        const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
        this.inventory.cards = shuffled.slice(0, cardCount).map(c => ({
            ...c,
            // Discount at higher corruption
            price: corruption >= 50 ? Math.floor(c.price * 0.7) : c.price
        }));
        
        // Select 1 artifact (if corruption > 20)
        if (corruption >= 20) {
            const artifacts = this.state.get('artifacts') || [];
            const ownedArtifactIds = new Set(artifacts.map(a => a.id));
            const availableArtifacts = this.voidArtifacts.filter(a => !ownedArtifactIds.has(a.id));
            if (availableArtifacts.length > 0) {
                const artifact = availableArtifacts[Math.floor(Math.random() * availableArtifacts.length)];
                this.inventory.artifacts.push({
                    ...artifact,
                    price: corruption >= 50 ? Math.floor(artifact.price * 0.7) : artifact.price
                });
            }
        }
        
        // Select 1-2 dark bargains
        const bargainCount = corruption >= 40 ? 2 : 1;
        const shuffledBargains = [...this.darkBargains].sort(() => Math.random() - 0.5);
        this.inventory.bargains = shuffledBargains.slice(0, bargainCount);
        
        // Select 1-2 void fragments (if VoidFragmentSystem is available)
        this.inventory.fragments = [];
        try {
            const fragmentSystem = this.state.get('_game')?.voidSystems?.fragments
                || window.game?.voidSystems?.fragments;
            if (fragmentSystem) {
                const fragPool = corruption >= 40 ? 'common,uncommon,rare' : 'common,uncommon';
                const fragCount = corruption >= 50 ? 2 : 1;
                const frags = fragmentSystem.getRandomFragment(fragPool, fragCount);
                this.inventory.fragments = frags.map(f => ({
                    ...f,
                    price: this.getFragmentPrice(f, corruption)
                }));
                console.log(`[VoidMerchant] ${this.inventory.fragments.length} fragments available`);
            }
        } catch (e) {
            console.warn('[VoidMerchant] Fragment inventory generation failed:', e);
        }
        
        this.isRevealed = true;
        return this.inventory;
    }
    
    /**
     * Get appropriate greeting
     */
    getGreeting() {
        const corruption = this.state.get('corruption') || 0;
        const pool = corruption >= 50 ? this.highCorruptionGreetings : this.greetings;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    /**
     * Get purchase dialogue line
     */
    getPurchaseLine() {
        return this.purchaseLines[Math.floor(Math.random() * this.purchaseLines.length)];
    }
    
    /**
     * Purchase a void card
     */
    purchaseCard(index) {
        if (!this.inventory || index >= this.inventory.cards.length) return null;
        
        const card = this.inventory.cards[index];
        const credits = this.state.get('credits') || 0;
        
        if (credits < card.price) return null;
        
        // Deduct credits
        this.state.set('credits', credits - card.price);
        
        // Add corruption
        const corruption = this.state.get('corruption') || 0;
        this.state.set('corruption', Math.min(100, corruption + card.corruptionCost));
        
        // Add card to deck
        const deck = this.state.get('deck') || [];
        deck.push({ ...card, instanceId: `card_${Date.now()}` });
        this.state.set('deck', deck);
        
        // Remove from inventory
        this.inventory.cards.splice(index, 1);
        
        // Emit events
        this.eventBus.emit('card:purchased', card);
        this.eventBus.emit('corruption:gained', card.corruptionCost);
        this.eventBus.emit('void:whisper', {
            text: this.getPurchaseLine(),
            intensity: 'medium'
        });
        
        return card;
    }
    
    /**
     * Purchase a void artifact
     */
    purchaseArtifact(index) {
        if (!this.inventory || index >= this.inventory.artifacts.length) return null;
        
        const artifact = this.inventory.artifacts[index];
        const credits = this.state.get('credits') || 0;
        
        if (credits < artifact.price) return null;
        
        // Deduct credits
        this.state.set('credits', credits - artifact.price);
        
        // Add corruption
        const corruption = this.state.get('corruption') || 0;
        this.state.set('corruption', Math.min(100, corruption + artifact.corruptionCost));
        
        // Add artifact
        const artifacts = this.state.get('artifacts') || [];
        artifacts.push(artifact);
        this.state.set('artifacts', artifacts);
        
        // Remove from inventory
        this.inventory.artifacts.splice(index, 1);
        
        // Emit events
        this.eventBus.emit('artifact:purchased', artifact);
        this.eventBus.emit('corruption:gained', artifact.corruptionCost);
        this.eventBus.emit('void:whisper', {
            text: this.getPurchaseLine(),
            intensity: 'high'
        });
        
        return artifact;
    }
    
    /**
     * Accept a dark bargain
     */
    acceptBargain(index) {
        if (!this.inventory || index >= this.inventory.bargains.length) return null;
        
        const bargain = this.inventory.bargains[index];
        const effects = bargain.effects;
        
        // Apply effects
        if (effects.maxHpLoss) {
            const maxHp = this.state.get('hero.maxHp') || 80;
            this.state.set('hero.maxHp', maxHp - effects.maxHpLoss);
            const hp = this.state.get('hero.hp') || maxHp;
            this.state.set('hero.hp', Math.min(hp, maxHp - effects.maxHpLoss));
        }
        
        if (effects.hpLoss) {
            const hp = this.state.get('hero.hp') || 80;
            this.state.set('hero.hp', Math.max(1, hp - effects.hpLoss));
        }
        
        if (effects.corruptionRemove) {
            const corruption = this.state.get('corruption') || 0;
            this.state.set('corruption', Math.max(0, corruption - effects.corruptionRemove));
            this.eventBus.emit('corruption:lost', effects.corruptionRemove);
        }
        
        if (effects.corruptionGain) {
            const corruption = this.state.get('corruption') || 0;
            this.state.set('corruption', Math.min(100, corruption + effects.corruptionGain));
            this.eventBus.emit('corruption:gained', effects.corruptionGain);
        }
        
        if (effects.creditsGain) {
            const credits = this.state.get('credits') || 0;
            this.state.set('credits', credits + effects.creditsGain);
        }
        
        // Remove from inventory
        this.inventory.bargains.splice(index, 1);
        
        this.eventBus.emit('void:whisper', {
            text: "The bargain is sealed.",
            intensity: 'high'
        });
        
        return bargain;
    }
    
    /**
     * Get price for a void fragment based on rarity and corruption
     */
    getFragmentPrice(fragment, corruption) {
        const basePrices = { common: 60, uncommon: 100, rare: 175, legendary: 250 };
        const base = basePrices[fragment.rarity] || 100;
        return corruption >= 50 ? Math.floor(base * 0.7) : base;
    }
    
    /**
     * Purchase a void fragment
     */
    purchaseFragment(index) {
        if (!this.inventory || !this.inventory.fragments || index >= this.inventory.fragments.length) return null;
        
        const fragment = this.inventory.fragments[index];
        const credits = this.state.get('credits') || 0;
        
        if (credits < fragment.price) return null;
        
        // Deduct credits
        this.state.set('credits', credits - fragment.price);
        
        // Add corruption (fragment's per-combat cost as one-time acquisition cost)
        const corruptionCost = (fragment.corruptionPerCombat || 1) * 2;
        const corruption = this.state.get('corruption') || 0;
        this.state.set('corruption', Math.min(100, corruption + corruptionCost));
        
        // Collect and auto-equip fragment
        const fragmentSystem = this.state.get('_game')?.voidSystems?.fragments
            || window.game?.voidSystems?.fragments;
        if (fragmentSystem) {
            fragmentSystem.collectFragment(fragment.id);
            const unlocked = fragmentSystem.getUnlockedSlots();
            if (fragmentSystem.equippedFragments.length < unlocked) {
                fragmentSystem.equipFragment(fragment.id);
            }
        }
        
        // Remove from inventory
        this.inventory.fragments.splice(index, 1);
        
        // Emit events
        this.eventBus.emit('fragment:acquired', { fragment, source: 'void_merchant' });
        this.eventBus.emit('corruption:gained', corruptionCost);
        this.eventBus.emit('void:whisper', {
            text: this.getPurchaseLine(),
            intensity: 'high'
        });
        
        return fragment;
    }
    
    /**
     * Render Void Merchant tab HTML
     */
    renderVoidTab(credits) {
        if (!this.inventory) return '';
        
        const corruption = this.state.get('corruption') || 0;
        const greeting = this.getGreeting();
        
        let html = `
            <div class="void-merchant-tab">
                <div class="void-merchant-header">
                    <div class="void-merchant-icon">👁</div>
                    <div class="void-merchant-title">THE VOID MERCHANT</div>
                </div>
                <div class="void-merchant-greeting">"${greeting}"</div>
                ${corruption >= 50 ? '<div class="void-discount-notice">⬇ Prices reduced for the faithful</div>' : ''}
        `;
        
        // Corrupted cards
        if (this.inventory.cards.length > 0) {
            html += `<div class="void-section-label">Corrupted Cards</div>`;
            html += this.inventory.cards.map((card, i) => `
                <div class="shop-item void-item ${credits < card.price ? 'unaffordable' : ''}" 
                     data-type="void-card" data-index="${i}">
                    <div class="item-icon">👁️</div>
                    <div class="item-details">
                        <div class="item-name void-name">${card.name}</div>
                        <div class="item-desc">${card.description}</div>
                        <div class="void-corruption-cost">+${card.corruptionCost} Corruption</div>
                    </div>
                    <div class="item-price void-price">${card.price} ◈</div>
                </div>
            `).join('');
        }
        
        // Corrupted artifacts
        if (this.inventory.artifacts.length > 0) {
            html += `<div class="void-section-label">Void Relics</div>`;
            html += this.inventory.artifacts.map((artifact, i) => `
                <div class="shop-item void-item ${credits < artifact.price ? 'unaffordable' : ''}" 
                     data-type="void-artifact" data-index="${i}">
                    <div class="item-icon">🔮</div>
                    <div class="item-details">
                        <div class="item-name void-name">${artifact.name}</div>
                        <div class="item-desc">${artifact.description}</div>
                        <div class="void-corruption-cost">+${artifact.corruptionCost} Corruption</div>
                    </div>
                    <div class="item-price void-price">${artifact.price} ◈</div>
                </div>
            `).join('');
        }
        
        // Dark bargains
        if (this.inventory.bargains.length > 0) {
            html += `<div class="void-section-label">Dark Bargains</div>`;
            html += this.inventory.bargains.map((bargain, i) => `
                <div class="shop-item void-item bargain-item" 
                     data-type="void-bargain" data-index="${i}">
                    <div class="item-icon">${bargain.icon}</div>
                    <div class="item-details">
                        <div class="item-name void-name">${bargain.name}</div>
                        <div class="item-desc">${bargain.description}</div>
                    </div>
                    <div class="item-price bargain-price">FREE</div>
                </div>
            `).join('');
        }
        
        // Void Fragments
        if (this.inventory.fragments && this.inventory.fragments.length > 0) {
            html += `<div class="void-section-label">Void Fragments <span style="color: #888; font-size: 0.75rem;">(Slottable Combat Modifiers)</span></div>`;
            html += this.inventory.fragments.map((frag, i) => {
                const rarityColors = { common: '#8a8a9a', uncommon: '#00f5ff', rare: '#ffd700', legendary: '#bf00ff' };
                const color = rarityColors[frag.rarity] || '#8a8a9a';
                return `
                    <div class="shop-item void-item fragment-item ${credits < frag.price ? 'unaffordable' : ''}" 
                         data-type="void-fragment" data-index="${i}"
                         style="border-left: 3px solid ${color};">
                        <div class="item-icon">👁️</div>
                        <div class="item-details">
                            <div class="item-name void-name" style="color: ${color};">${frag.name}</div>
                            <div class="item-desc">${frag.description}</div>
                            <div class="void-corruption-cost">+${(frag.corruptionPerCombat || 1) * 2} Corruption on purchase · +${frag.corruptionPerCombat || 0}/combat while equipped</div>
                            <div style="font-size: 0.7rem; color: ${color}; text-transform: uppercase; margin-top: 2px;">${frag.rarity}</div>
                        </div>
                        <div class="item-price void-price">${frag.price} ◈</div>
                    </div>
                `;
            }).join('');
        }
        
        html += `</div>`;
        return html;
    }
}

export default VoidMerchant;
