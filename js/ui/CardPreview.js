/**
 * CardPreview - Mobile-friendly card interaction system
 * Implements: Tap to Preview → Confirm to Play pattern
 * Prevents accidental card plays on touch devices
 * 
 * FIX v1.1.0:
 *   - PLAY button now delegates to CombatScreen's selectCard() which handles
 *     all targeting logic natively (single-enemy auto-target, multi-enemy
 *     targeting mode, non-targeted auto-play).
 *   - Removed broken in-overlay enemy targeting that was blocked by the backdrop.
 *   - Fixed game.combatAPI access (was game.combat which was never set).
 *   - Preview is now purely a "confirm you want to play this card" gate.
 * 
 * @version 1.1.0
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
        this.createOverlay();
        this.attachHandListeners();
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.previewActive) {
                this.closePreview();
            }
        });
        
        console.log('[CardPreview] Initialized v1.1.0. Touch device:', this.isTouchDevice);
    }
    
    /**
     * Create the preview overlay DOM structure
     */
    createOverlay() {
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
        
        // Play button — delegates to CombatScreen's selectCard which handles
        // all targeting (single enemy auto-target, multi-enemy mode, non-targeted auto-play)
        this.overlay.querySelector('#preview-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.confirmPlay();
        });
    }
    
    /**
     * Attach delegated click listeners to the hand area.
     * Intercepts clicks on cards and opens preview instead of playing directly.
     */
    attachHandListeners() {
        const handArea = document.getElementById('hand-area');
        if (!handArea) {
            setTimeout(() => this.attachHandListeners(), 500);
            return;
        }
        
        // Use capture phase to intercept before CombatScreen's own handlers
        handArea.addEventListener('click', (e) => {
            // Only intercept on touch devices
            if (!this.isTouchDevice && !this.forcePreviewMode) return;
            
            const cardEl = e.target.closest('.combat-card, .card-in-hand, .card');
            if (!cardEl) return;
            
            // Don't intercept unplayable cards
            if (cardEl.classList.contains('unplayable')) return;
            
            // Prevent the default play action
            e.stopPropagation();
            e.preventDefault();
            
            // Get card index from the hand
            const cards = Array.from(handArea.querySelectorAll('.combat-card, .card-in-hand, .card'));
            const cardIndex = cards.indexOf(cardEl);
            
            if (cardIndex === -1) return;
            
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
        
        // Try to get card data from the game state
        let cardData = null;
        try {
            const hand = this.game.state?.get('combat.hand') || [];
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
        clone.style.transform = '';
        clone.style.margin = '0';
        clone.style.position = 'relative';
        clone.style.zIndex = '';
        
        previewCardContainer.innerHTML = '';
        previewCardContainer.appendChild(clone);
        
        // Always show the PLAY button — CombatScreen's selectCard handles targeting
        const playBtn = this.overlay.querySelector('#preview-play-btn');
        playBtn.style.display = 'flex';
        
        // Show the overlay
        this.overlay.classList.add('active');
        
        // Highlight the selected card in hand
        const handArea = document.getElementById('hand-area');
        if (handArea) {
            handArea.querySelectorAll('.combat-card, .card-in-hand, .card').forEach((c, i) => {
                c.classList.toggle('preview-selected', i === cardIndex);
            });
        }
        
        try { this.game.audioManager?.playSFX('ui_click'); } catch(e) {}
        
        console.log(`[CardPreview] Preview opened for card ${cardIndex}:`, cardData?.name || 'Unknown');
    }
    
    /**
     * Confirm playing the selected card.
     * Delegates entirely to CombatScreen's selectCard() which handles:
     *   - Energy checks
     *   - Single-enemy auto-targeting
     *   - Multi-enemy targeting mode
     *   - Non-targeted card auto-play
     */
    confirmPlay() {
        if (this.selectedCardIndex === null) return;
        
        const cardIndex = this.selectedCardIndex;
        
        // Close the preview overlay first
        this.closePreview();
        
        // Delegate to CombatScreen's selectCard via the exposed API
        try {
            if (this.game.combatAPI && typeof this.game.combatAPI.selectCard === 'function') {
                console.log(`[CardPreview] Delegating card ${cardIndex} to CombatScreen.selectCard`);
                this.game.combatAPI.selectCard(cardIndex);
            } else {
                console.error('[CardPreview] game.combatAPI.selectCard not available — card play failed');
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
