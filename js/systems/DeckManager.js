/**
 * DeckManager - Handles all deck-related operations
 */
class DeckManager {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.deck = [];        // Full deck
        this.drawPile = [];    // Cards available to draw
        this.hand = [];        // Current hand
        this.discardPile = []; // Discarded cards
        this.exhaustPile = []; // Exhausted cards (removed from combat)
        
        this.handSize = 5;
        this.maxHandSize = 10;
    }

    /**
     * Initialize deck from state
     */
    initializeDeck(cards) {
        this.deck = cards.map(card => ({ ...card, instanceId: this.generateId() }));
        this.state.set('deck', this.deck);
        console.log(`[DeckManager] Initialized deck with ${this.deck.length} cards`);
    }

    /**
     * Start combat - shuffle deck into draw pile
     */
    startCombat() {
        this.drawPile = this.shuffleArray([...this.deck]);
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];
        
        this.updateUI();
        this.eventBus.emit('deck:combat:start');
    }

    /**
     * Draw starting hand
     */
    drawStartingHand() {
        this.drawCards(this.handSize);
    }

    /**
     * Draw cards from draw pile
     */
    drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (this.hand.length >= this.maxHandSize) {
                console.log('[DeckManager] Hand is full');
                break;
            }
            
            // Reshuffle discard if draw pile is empty
            if (this.drawPile.length === 0) {
                this.reshuffleDiscard();
            }
            
            if (this.drawPile.length > 0) {
                const card = this.drawPile.pop();
                this.hand.push(card);
                this.eventBus.emit('card:drawn', card);
            }
        }
        
        this.updateUI();
    }

    /**
     * Play a card from hand
     */
    playCard(instanceId) {
        const cardIndex = this.hand.findIndex(c => c.instanceId === instanceId);
        if (cardIndex === -1) {
            console.warn('[DeckManager] Card not found in hand:', instanceId);
            return null;
        }
        
        const card = this.hand.splice(cardIndex, 1)[0];
        
        // Check if card exhausts
        if (card.exhaust) {
            this.exhaustPile.push(card);
            this.eventBus.emit('card:exhausted', card);
        } else {
            this.discardPile.push(card);
            this.eventBus.emit('card:discarded', card);
        }
        
        this.eventBus.emit('card:played', card);
        this.updateUI();
        
        return card;
    }

    /**
     * Discard a card from hand
     */
    discardCard(instanceId) {
        const cardIndex = this.hand.findIndex(c => c.instanceId === instanceId);
        if (cardIndex === -1) return null;
        
        const card = this.hand.splice(cardIndex, 1)[0];
        this.discardPile.push(card);
        
        this.eventBus.emit('card:discarded', card);
        this.updateUI();
        
        return card;
    }

    /**
     * Discard entire hand
     */
    discardHand() {
        while (this.hand.length > 0) {
            const card = this.hand.pop();
            this.discardPile.push(card);
            this.eventBus.emit('card:discarded', card);
        }
        this.updateUI();
    }

    /**
     * Exhaust a card
     */
    exhaustCard(instanceId, fromPile = 'hand') {
        let card = null;
        
        if (fromPile === 'hand') {
            const index = this.hand.findIndex(c => c.instanceId === instanceId);
            if (index !== -1) {
                card = this.hand.splice(index, 1)[0];
            }
        } else if (fromPile === 'discard') {
            const index = this.discardPile.findIndex(c => c.instanceId === instanceId);
            if (index !== -1) {
                card = this.discardPile.splice(index, 1)[0];
            }
        }
        
        if (card) {
            this.exhaustPile.push(card);
            this.eventBus.emit('card:exhausted', card);
            this.updateUI();
        }
        
        return card;
    }

    /**
     * Reshuffle discard pile into draw pile
     */
    reshuffleDiscard() {
        this.drawPile = this.shuffleArray([...this.discardPile]);
        this.discardPile = [];
        this.eventBus.emit('deck:reshuffled');
        this.updateUI();
    }

    /**
     * Add a card to the deck
     */
    addCardToDeck(card) {
        const newCard = { ...card, instanceId: this.generateId() };
        this.deck.push(newCard);
        this.state.set('deck', this.deck);
        this.eventBus.emit('card:added', newCard);
        return newCard;
    }

    /**
     * Remove a card from the deck
     */
    removeCardFromDeck(instanceId) {
        const index = this.deck.findIndex(c => c.instanceId === instanceId);
        if (index !== -1) {
            const card = this.deck.splice(index, 1)[0];
            this.state.set('deck', this.deck);
            this.eventBus.emit('card:removed', card);
            return card;
        }
        return null;
    }

    /**
     * Upgrade a card
     */
    upgradeCard(instanceId) {
        const card = this.deck.find(c => c.instanceId === instanceId);
        if (card && !card.upgraded) {
            card.upgraded = true;
            card.name = card.name + '+';
            
            // Apply upgrades based on card type
            if (card.damage) card.damage = Math.floor(card.damage * 1.5);
            if (card.block) card.block = Math.floor(card.block * 1.5);
            if (card.cost > 0 && Math.random() < 0.3) card.cost -= 1;
            
            this.state.set('deck', this.deck);
            this.eventBus.emit('card:upgraded', card);
            return card;
        }
        return null;
    }

    /**
     * Get current hand
     */
    getHand() {
        return [...this.hand];
    }

    /**
     * Get card from hand by instance ID
     */
    getCardFromHand(instanceId) {
        return this.hand.find(c => c.instanceId === instanceId);
    }

    /**
     * Get full deck
     */
    getDeck() {
        return [...this.deck];
    }

    /**
     * Get pile counts
     */
    getPileCounts() {
        return {
            draw: this.drawPile.length,
            hand: this.hand.length,
            discard: this.discardPile.length,
            exhaust: this.exhaustPile.length
        };
    }

    /**
     * Update UI elements
     */
    updateUI() {
        const counts = this.getPileCounts();
        
        // Update pile counts
        const drawCount = document.querySelector('#draw-pile .pile-count');
        const discardCount = document.querySelector('#discard-pile .pile-count');
        
        if (drawCount) drawCount.textContent = counts.draw;
        if (discardCount) discardCount.textContent = counts.discard;
        
        this.eventBus.emit('hand:updated', this.hand);
    }

    /**
     * Shuffle an array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * End combat cleanup
     */
    endCombat() {
        this.hand = [];
        this.drawPile = [];
        this.discardPile = [];
        this.exhaustPile = [];
        this.updateUI();
    }
}

export { DeckManager };
