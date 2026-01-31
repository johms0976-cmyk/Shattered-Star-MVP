/**
 * DeckManager - Handles all deck-related operations
 * FIXED VERSION: Proper hand management, card drawing, and pile handling
 * @version 0.2.2
 */
class DeckManager {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.deck = [];        // Full deck (master copy)
        this.drawPile = [];    // Cards available to draw
        this.hand = [];        // Current hand
        this.discardPile = []; // Discarded cards
        this.exhaustPile = []; // Exhausted cards (removed from combat)
        
        this.handSize = 5;
        this.maxHandSize = 10;
        
        this.cardIdCounter = 0;
    }

    /**
     * Generate unique card instance ID
     */
    generateId() {
        return `card_${Date.now()}_${this.cardIdCounter++}`;
    }

    /**
     * Initialize deck from state or card list
     */
    initializeDeck(cards) {
        if (!cards || cards.length === 0) {
            console.warn('[DeckManager] No cards provided, using empty deck');
            this.deck = [];
            return;
        }
        
        // Create deck with unique instance IDs
        this.deck = cards.map(card => ({
            ...card,
            instanceId: this.generateId()
        }));
        
        // Save to state
        this.state.set('deck', this.deck);
        
        console.log(`[DeckManager] Initialized deck with ${this.deck.length} cards`);
    }

    /**
     * Start combat - shuffle deck into draw pile
     */
    startCombat() {
        console.log('[DeckManager] Starting combat, shuffling deck...');
        
        // Get current deck from state if not already loaded
        if (this.deck.length === 0) {
            const stateDeck = this.state.get('deck');
            if (stateDeck && stateDeck.length > 0) {
                this.deck = stateDeck.map(card => ({
                    ...card,
                    instanceId: card.instanceId || this.generateId()
                }));
            }
        }
        
        // Shuffle deck into draw pile
        this.drawPile = this.shuffleArray([...this.deck]);
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];
        
        console.log(`[DeckManager] Draw pile has ${this.drawPile.length} cards`);
        
        this.eventBus.emit('deck:combat:start');
    }

    /**
     * Shuffle an array (Fisher-Yates algorithm)
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
     * Draw starting hand for turn
     */
    drawStartingHand() {
        // Discard current hand first if any
        if (this.hand.length > 0) {
            this.discardHand();
        }
        
        this.drawCards(this.handSize);
    }

    /**
     * Draw cards from draw pile
     */
    drawCards(count) {
        console.log(`[DeckManager] Drawing ${count} cards...`);
        
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
                this.eventBus.emit('card:drawn', { card });
            } else {
                console.log('[DeckManager] No more cards to draw');
                break;
            }
        }
        
        console.log(`[DeckManager] Hand now has ${this.hand.length} cards`);
        this.eventBus.emit('hand:updated');
    }

    /**
     * Reshuffle discard pile into draw pile
     */
    reshuffleDiscard() {
        if (this.discardPile.length === 0) {
            console.log('[DeckManager] No cards in discard to reshuffle');
            return;
        }
        
        console.log(`[DeckManager] Reshuffling ${this.discardPile.length} cards from discard`);
        
        this.drawPile = this.shuffleArray([...this.discardPile]);
        this.discardPile = [];
        
        this.eventBus.emit('deck:reshuffled');
    }

    /**
     * Play a card from hand
     */
    playCard(cardIdOrIndex) {
        let cardIndex;
        
        // Handle both instance ID and index
        if (typeof cardIdOrIndex === 'number') {
            cardIndex = cardIdOrIndex;
        } else {
            cardIndex = this.hand.findIndex(c => c.instanceId === cardIdOrIndex);
        }
        
        if (cardIndex < 0 || cardIndex >= this.hand.length) {
            console.warn('[DeckManager] Invalid card index:', cardIdOrIndex);
            return null;
        }
        
        const card = this.hand.splice(cardIndex, 1)[0];
        
        // Move to discard unless exhausted
        if (!card.exhaust) {
            this.discardPile.push(card);
        } else {
            this.exhaustPile.push(card);
            this.eventBus.emit('card:exhausted', { card });
        }
        
        console.log(`[DeckManager] Played card: ${card.name}`);
        this.eventBus.emit('hand:updated');
        
        return card;
    }

    /**
     * Discard entire hand
     */
    discardHand() {
        console.log(`[DeckManager] Discarding ${this.hand.length} cards from hand`);
        
        while (this.hand.length > 0) {
            const card = this.hand.pop();
            this.discardPile.push(card);
        }
        
        this.eventBus.emit('hand:updated');
    }

    /**
     * Exhaust a specific card
     */
    exhaustCard(cardIdOrIndex) {
        let cardIndex;
        
        if (typeof cardIdOrIndex === 'number') {
            cardIndex = cardIdOrIndex;
        } else {
            cardIndex = this.hand.findIndex(c => c.instanceId === cardIdOrIndex);
        }
        
        if (cardIndex >= 0 && cardIndex < this.hand.length) {
            const card = this.hand.splice(cardIndex, 1)[0];
            this.exhaustPile.push(card);
            this.eventBus.emit('card:exhausted', { card });
            this.eventBus.emit('hand:updated');
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
     * Get draw pile count
     */
    getDrawPileCount() {
        return this.drawPile.length;
    }

    /**
     * Get discard pile count
     */
    getDiscardPileCount() {
        return this.discardPile.length;
    }

    /**
     * Get exhaust pile count
     */
    getExhaustPileCount() {
        return this.exhaustPile.length;
    }

    /**
     * Add card to deck (permanent)
     */
    addCardToDeck(card) {
        const newCard = {
            ...card,
            instanceId: this.generateId()
        };
        
        this.deck.push(newCard);
        this.state.set('deck', this.deck);
        
        this.eventBus.emit('card:added', { card: newCard });
        
        return newCard;
    }

    /**
     * Remove card from deck (permanent)
     */
    removeCardFromDeck(cardId) {
        const index = this.deck.findIndex(c => c.id === cardId || c.instanceId === cardId);
        
        if (index > -1) {
            const card = this.deck.splice(index, 1)[0];
            this.state.set('deck', this.deck);
            this.eventBus.emit('card:removed', { card });
            return card;
        }
        
        return null;
    }

    /**
     * Upgrade a card in deck
     */
    upgradeCard(cardId) {
        const card = this.deck.find(c => c.id === cardId || c.instanceId === cardId);
        
        if (card && !card.upgraded) {
            card.upgraded = true;
            card.name = card.name + '+';
            
            // Apply upgrade bonuses
            if (card.damage) card.damage += 2;
            if (card.block) card.block += 2;
            if (card.cost > 0) card.cost = Math.max(0, card.cost - 1);
            
            this.state.set('deck', this.deck);
            this.eventBus.emit('card:upgraded', { card });
            
            return card;
        }
        
        return null;
    }

    /**
     * Get full deck
     */
    getDeck() {
        return [...this.deck];
    }

    /**
     * Get draw pile (for viewing)
     */
    getDrawPile() {
        return [...this.drawPile];
    }

    /**
     * Get discard pile (for viewing)
     */
    getDiscardPile() {
        return [...this.discardPile];
    }

    /**
     * End combat - cleanup
     */
    endCombat() {
        this.hand = [];
        this.drawPile = [];
        this.discardPile = [];
        this.exhaustPile = [];
        
        this.eventBus.emit('deck:combat:end');
    }

    /**
     * Get state for saving
     */
    getState() {
        return {
            deck: this.deck,
            drawPile: this.drawPile,
            hand: this.hand,
            discardPile: this.discardPile,
            exhaustPile: this.exhaustPile
        };
    }

    /**
     * Restore state from save
     */
    restoreState(savedState) {
        if (!savedState) return;
        
        this.deck = savedState.deck || [];
        this.drawPile = savedState.drawPile || [];
        this.hand = savedState.hand || [];
        this.discardPile = savedState.discardPile || [];
        this.exhaustPile = savedState.exhaustPile || [];
        
        this.eventBus.emit('hand:updated');
    }
}

export { DeckManager };
