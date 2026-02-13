/**
 * CardAnimator - Card play animation system
 * Makes cards whoosh to targets, enemies flash on hit,
 * block pulses, and power cards glow.
 * 
 * Integration:
 *   In CombatScreen.js playCard(), call:
 *     await cardAnimator.animateCardPlay(cardIndex, targetIndex, card);
 *   BEFORE applying card effects and removing from hand.
 * 
 * @version 1.0.0
 */

class CardAnimator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.animating = false;
        
        // Wire up event-based triggers
        if (eventBus) {
            eventBus.on('damage:dealt', (data) => this.onDamageDealt(data));
            eventBus.on('block:gained', (data) => this.onBlockGained(data));
            eventBus.on('card:upgraded', (data) => this.onCardUpgraded(data));
        }
        
        console.log('[CardAnimator] Initialized');
    }

    /**
     * Main animation: card flies from hand to target
     * @param {number} cardIndex - Index of card in hand
     * @param {number|null} targetIndex - Enemy index (null for self-targeting)
     * @param {Object} card - Card data
     * @returns {Promise} Resolves when animation completes
     */
    async animateCardPlay(cardIndex, targetIndex, card) {
        if (this.animating) return;
        this.animating = true;

        try {
            const cardEl = document.querySelector(`.combat-card[data-index="${cardIndex}"]`);
            if (!cardEl) {
                this.animating = false;
                return;
            }

            const cardRect = cardEl.getBoundingClientRect();
            
            // Determine target position
            let targetPos;
            const isAttack = card.type === 'attack' || card.damage > 0;
            const isBlock = card.block > 0 && !card.damage;
            const isPower = card.type === 'power';

            if (isAttack && targetIndex !== null && targetIndex !== undefined) {
                // Fly to enemy
                const enemyEl = document.querySelector(`.enemy[data-index="${targetIndex}"]`) ||
                                document.querySelectorAll('.enemy')[targetIndex];
                if (enemyEl) {
                    const enemyRect = enemyEl.getBoundingClientRect();
                    targetPos = {
                        x: enemyRect.left + enemyRect.width / 2,
                        y: enemyRect.top + enemyRect.height / 2
                    };
                }
            }

            if (!targetPos) {
                // Self-target: fly toward player HUD area (bottom center)
                const hud = document.querySelector('.combat-hud') || document.querySelector('.hud-center');
                if (hud) {
                    const hudRect = hud.getBoundingClientRect();
                    targetPos = {
                        x: hudRect.left + hudRect.width / 2,
                        y: hudRect.top + hudRect.height / 2
                    };
                } else {
                    targetPos = {
                        x: window.innerWidth / 2,
                        y: window.innerHeight - 100
                    };
                }
            }

            // ── Step 1: Lift the card ──
            cardEl.classList.add('card-played-lift');
            await this._wait(150);

            // ── Step 2: Create flying clone ──
            const flyCard = cardEl.cloneNode(true);
            flyCard.className = 'card-flying';
            flyCard.style.width = `${cardRect.width}px`;
            flyCard.style.height = `${cardRect.height}px`;
            flyCard.style.left = `${cardRect.left}px`;
            flyCard.style.top = `${cardRect.top - 20}px`; // Account for lift

            document.body.appendChild(flyCard);

            // Hide original immediately
            cardEl.style.opacity = '0';
            cardEl.style.pointerEvents = 'none';

            // ── Step 3: Fly to target ──
            const flyDuration = 300;
            const startX = cardRect.left;
            const startY = cardRect.top - 20;
            const deltaX = targetPos.x - cardRect.width / 2 - startX;
            const deltaY = targetPos.y - cardRect.height / 2 - startY;

            flyCard.style.transition = `left ${flyDuration}ms cubic-bezier(0.2, 0.9, 0.3, 1.0), 
                                        top ${flyDuration}ms cubic-bezier(0.2, 0.9, 0.3, 1.0),
                                        transform ${flyDuration}ms cubic-bezier(0.2, 0.9, 0.3, 1.0),
                                        opacity ${flyDuration}ms ease-in`;

            // Force reflow
            flyCard.offsetHeight;

            flyCard.style.left = `${startX + deltaX}px`;
            flyCard.style.top = `${startY + deltaY}px`;
            flyCard.style.transform = 'scale(0.3) rotate(-5deg)';
            flyCard.style.opacity = '0';

            await this._wait(flyDuration);

            // ── Step 4: Impact effects ──
            if (isAttack) {
                this._triggerImpact(targetIndex);
            } else if (isBlock) {
                this._triggerBlockGain();
            } else if (isPower) {
                this._triggerPowerActivation();
            }

            // ── Step 5: Energy flash ──
            this._triggerEnergySpend();

            // Cleanup
            flyCard.remove();

        } catch (err) {
            console.warn('[CardAnimator] Animation error:', err);
        }

        this.animating = false;
    }

    /**
     * Impact effect on enemy hit
     */
    _triggerImpact(targetIndex) {
        const enemyEl = document.querySelector(`.enemy[data-index="${targetIndex}"]`) ||
                        document.querySelectorAll('.enemy')[targetIndex];
        
        if (enemyEl) {
            // White flash
            enemyEl.classList.add('enemy-impact-flash');
            setTimeout(() => enemyEl.classList.remove('enemy-impact-flash'), 250);

            // Recoil
            enemyEl.classList.add('enemy-hit-recoil');
            setTimeout(() => enemyEl.classList.remove('enemy-hit-recoil'), 300);
        }

        // Screen shake for big hits
        this._screenShake();
    }

    /**
     * Block gain pulse on HUD
     */
    _triggerBlockGain() {
        const blockDisplay = document.querySelector('.stat-block') ||
                             document.querySelector('.hud-center .stat-block');
        if (blockDisplay) {
            blockDisplay.classList.add('block-gain-pulse');
            setTimeout(() => blockDisplay.classList.remove('block-gain-pulse'), 400);
        }
    }

    /**
     * Power card golden glow
     */
    _triggerPowerActivation() {
        const screen = document.getElementById('combat-screen');
        if (screen) {
            screen.classList.add('power-activate-glow');
            setTimeout(() => screen.classList.remove('power-activate-glow'), 600);
        }
    }

    /**
     * Energy spend flash
     */
    _triggerEnergySpend() {
        const energyDisplay = document.querySelector('.energy-display') ||
                              document.getElementById('energy-display');
        if (energyDisplay) {
            energyDisplay.classList.add('energy-spend-flash');
            setTimeout(() => energyDisplay.classList.remove('energy-spend-flash'), 300);
        }
    }

    /**
     * Screen shake (respects settings)
     */
    _screenShake() {
        try {
            const settings = JSON.parse(localStorage.getItem('shattered-star-settings') || '{}');
            if (settings.screenShake === false) return;
        } catch (e) { /* Safari private browsing */ }

        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 200);
    }

    // ═══════════════════════════════════════════
    // EVENT-DRIVEN REACTIONS
    // ═══════════════════════════════════════════

    /**
     * React to damage dealt (called via eventBus)
     */
    onDamageDealt({ target, amount, blocked }) {
        if (blocked > 0 && target) {
            // If block was broken, show shatter
            if ((target.block || 0) <= 0 && blocked > 0) {
                const enemyEl = document.querySelector(`[data-enemy-id="${target.id || target.instanceId}"]`);
                if (enemyEl) {
                    enemyEl.classList.add('block-shatter');
                    setTimeout(() => enemyEl.classList.remove('block-shatter'), 500);
                }
            }
        }
    }

    /**
     * React to block gained
     */
    onBlockGained({ amount }) {
        this._triggerBlockGain();
    }

    /**
     * Card upgrade shimmer
     */
    onCardUpgraded(card) {
        // Find the card element if visible
        const cardEls = document.querySelectorAll('.card');
        cardEls.forEach(el => {
            if (el.textContent.includes(card.name)) {
                el.classList.add('card-upgrade-shimmer');
                setTimeout(() => el.classList.remove('card-upgrade-shimmer'), 1000);
            }
        });
    }

    /**
     * Animate new cards appearing in hand (call after draw)
     */
    animateDrawnCards() {
        const cards = document.querySelectorAll('.combat-card');
        cards.forEach((card, i) => {
            card.style.animationDelay = `${i * 60}ms`;
            card.classList.add('card-draw-appear');
        });

        // Clean up classes after animation
        setTimeout(() => {
            cards.forEach(card => {
                card.classList.remove('card-draw-appear');
                card.style.animationDelay = '';
            });
        }, cards.length * 60 + 300);
    }

    /**
     * Player hit effect (called when player takes damage)
     */
    playerHitEffect() {
        const hud = document.querySelector('.combat-hud');
        if (hud) {
            hud.classList.add('player-hit-flash');
            setTimeout(() => hud.classList.remove('player-hit-flash'), 300);
        }
        this._screenShake();
    }

    /**
     * Corruption gain vignette
     */
    corruptionPulse() {
        const screen = document.getElementById('combat-screen');
        if (screen) {
            screen.classList.add('corruption-vignette-pulse');
            setTimeout(() => screen.classList.remove('corruption-vignette-pulse'), 800);
        }
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default CardAnimator;
