/**
 * CardPreview - Mobile-friendly card interaction system
 * Implements: Tap to Preview → Confirm to Play pattern
 * Prevents accidental card plays on touch devices
 * @version 1.0.0
 */

export class CardPreview {
    constructor(game) {
        this.game = game;
        this.previewActive = false;
        this.selectedCardIndex = null;
        this.selectedCardData = null;
        this.overlay = null;
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        this.init();
    }
    
    init() {
        // Create the preview overlay element (hidden by default)
        this.createOverlay();
        
        // Intercept card clicks in the hand area
        this.attachHandListeners();
        
        // Close preview on backdrop tap / Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.previewActive) {
                this.closePreview();
            }
        });
        
        console.log('[CardPreview] Initialized. Touch device:', this.isTouchDevice);
    }
    
    /**
     * Create the preview overlay DOM structure
     */
    createOverlay() {
        // Don't duplicate
        if (document.getElementById('card-preview-overlay')) {
            this.overlay = document.getElementById('card-preview-overlay');
            return;
        }
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'card-preview-overlay';
        this.overlay.className = 'card-preview-overlay';
        this.overlay.innerHTML = `
            <div class="card-preview-backdrop"></div>
            <div class="card-preview-content">
                <div class="card-preview-card" id="preview-card"></div>
                <div class="card-preview-actions">
                    <button class="card-preview-btn play-btn" id="preview-play-btn">
                        <span class="btn-icon">⚔️</span>
                        <span class="btn-text">PLAY</span>
                    </button>
                    <button class="card-preview-btn cancel-btn" id="preview-cancel-btn">
                        <span class="btn-icon">✕</span>
                        <span class="btn-text">CANCEL</span>
                    </button>
                </div>
                <div class="card-preview-hint">Tap an enemy to target, or press PLAY</div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        
        // Backdrop closes preview
        this.overlay.querySelector('.card-preview-backdrop').addEventListener('click', () => {
            this.closePreview();
        });
        
        // Cancel button
        this.overlay.querySelector('#preview-cancel-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closePreview();
        });
        
        // Play button (for non-targeted cards)
        this.overlay.querySelector('#preview-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.confirmPlay();
        });
    }
    
    /**
     * Attach delegated click listeners to the hand area
     * Intercepts clicks on cards and opens preview instead of playing
     */
    attachHandListeners() {
        const handArea = document.getElementById('hand-area');
        if (!handArea) {
            // Retry after a delay (hand area may not exist yet)
            setTimeout(() => this.attachHandListeners(), 500);
            return;
        }
        
        // Use capture phase to intercept before game's own handlers
        handArea.addEventListener('click', (e) => {
            // Only intercept on touch devices or when preview system is active
            if (!this.isTouchDevice && !this.forcePreviewMode) return;
            
            const cardEl = e.target.closest('.combat-card, .card-in-hand, .card');
            if (!cardEl) return;
            
            // Don't intercept if card is unplayable
            if (cardEl.classList.contains('unplayable')) return;
            
            // Prevent the default play action
            e.stopPropagation();
            e.preventDefault();
            
            // Get card index from the hand
            const cards = Array.from(handArea.querySelectorAll('.combat-card, .card-in-hand, .card'));
            const cardIndex = cards.indexOf(cardEl);
            
            if (cardIndex === -1) return;
            
            // Open preview for this card
            this.openPreview(cardIndex, cardEl);
            
        }, true); // capture phase
    }
    
    /**
     * Open the card preview overlay
     */
    openPreview(cardIndex, cardEl) {
        if (this.previewActive) {
            this.closePreview();
        }
        
        this.selectedCardIndex = cardIndex;
        this.previewActive = true;
        
        // Try to get card data from the game
        let cardData = null;
        try {
            const hand = this.game.combat?.hand || this.game.state?.get('combat.hand') || [];
            cardData = hand[cardIndex];
        } catch (e) {
            console.warn('[CardPreview] Could not get card data:', e);
        }
        this.selectedCardData = cardData;
        
        // Clone the card element for the preview display
        const previewCardContainer = this.overlay.querySelector('#preview-card');
        const clone = cardEl.cloneNode(true);
        clone.className = clone.className.replace(/\bunplayable\b/, '').trim();
        clone.classList.add('preview-enlarged');
        // Remove any inline transform/margin from hand layout
        clone.style.transform = '';
        clone.style.margin = '0';
        clone.style.position = 'relative';
        clone.style.zIndex = '';
        
        previewCardContainer.innerHTML = '';
        previewCardContainer.appendChild(clone);
        
        // Determine if this card needs a target
        const needsTarget = this.cardNeedsTarget(cardData);
        const hintEl = this.overlay.querySelector('.card-preview-hint');
        const playBtn = this.overlay.querySelector('#preview-play-btn');
        
        if (needsTarget) {
            hintEl.textContent = 'Tap an enemy to target';
            hintEl.style.display = 'block';
            playBtn.style.display = 'none';
            this.enableEnemyTargeting();
        } else {
            hintEl.style.display = 'none';
            playBtn.style.display = 'flex';
        }
        
        // Show the overlay
        this.overlay.classList.add('active');
        
        // Highlight the selected card in hand
        const handArea = document.getElementById('hand-area');
        if (handArea) {
            handArea.querySelectorAll('.combat-card, .card-in-hand, .card').forEach((c, i) => {
                c.classList.toggle('preview-selected', i === cardIndex);
            });
        }
        
        // Play a UI sound
        try { this.game.audioManager?.playSFX('ui_click'); } catch(e) {}
        
        console.log(`[CardPreview] Preview opened for card ${cardIndex}:`, cardData?.name || 'Unknown');
    }
    
    /**
     * Check if a card requires an enemy target
     */
    cardNeedsTarget(cardData) {
        if (!cardData) return true; // default to needing target
        
        const type = cardData.type || '';
        const target = cardData.target || cardData.targetType || '';
        
        // Attack cards need targets
        if (type === 'attack') return true;
        
        // If explicitly marked as targeting
        if (target === 'enemy' || target === 'single_enemy') return true;
        
        // Skills and powers typically don't need targets
        if (type === 'skill' || type === 'power') return false;
        
        // If target is self or all or none
        if (target === 'self' || target === 'all' || target === 'all_enemies' || target === 'none') {
            return false;
        }
        
        // Default: check if there are enemies
        const enemies = this.game.combat?.enemies || [];
        return enemies.length > 1; // only need targeting if multiple enemies
    }
    
    /**
     * Enable enemy targeting mode while preview is active
     */
    enableEnemyTargeting() {
        const enemyArea = document.getElementById('enemy-area');
        if (!enemyArea) return;
        
        enemyArea.querySelectorAll('.enemy').forEach(enemyEl => {
            enemyEl.classList.add('targetable');
            
            const handler = (e) => {
                e.stopPropagation();
                const targetId = enemyEl.dataset.enemyId;
                this.confirmPlay(targetId);
            };
            
            // Store reference for cleanup
            enemyEl._previewClickHandler = handler;
            enemyEl.addEventListener('click', handler);
        });
    }
    
    /**
     * Disable enemy targeting mode
     */
    disableEnemyTargeting() {
        const enemyArea = document.getElementById('enemy-area');
        if (!enemyArea) return;
        
        enemyArea.querySelectorAll('.enemy').forEach(enemyEl => {
            enemyEl.classList.remove('targetable');
            if (enemyEl._previewClickHandler) {
                enemyEl.removeEventListener('click', enemyEl._previewClickHandler);
                delete enemyEl._previewClickHandler;
            }
        });
    }
    
    /**
     * Confirm playing the selected card
     */
    confirmPlay(targetId) {
        if (this.selectedCardIndex === null) return;
        
        const cardIndex = this.selectedCardIndex;
        
        // Close the preview first
        this.closePreview();
        
        // Actually play the card through the game's combat system
        try {
            if (this.game.combat && typeof this.game.combat.playCard === 'function') {
                // If no targetId given and there are enemies, use first enemy
                if (!targetId) {
                    const enemies = this.game.combat.enemies || [];
                    const aliveEnemies = enemies.filter(e => e.hp > 0);
                    targetId = aliveEnemies.length > 0 ? aliveEnemies[0].id : null;
                }
                
                console.log(`[CardPreview] Playing card ${cardIndex} on target ${targetId}`);
                this.game.combat.playCard(cardIndex, targetId);
            }
        } catch (e) {
            console.error('[CardPreview] Error playing card:', e);
        }
    }
    
    /**
     * Close the preview overlay
     */
    closePreview() {
        this.previewActive = false;
        this.selectedCardIndex = null;
        this.selectedCardData = null;
        
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
        
        // Remove highlight from hand cards
        const handArea = document.getElementById('hand-area');
        if (handArea) {
            handArea.querySelectorAll('.preview-selected').forEach(c => {
                c.classList.remove('preview-selected');
            });
        }
        
        // Disable enemy targeting
        this.disableEnemyTargeting();
    }
    
    /**
     * Destroy the preview system (cleanup)
     */
    destroy() {
        this.closePreview();
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}

export default CardPreview;
