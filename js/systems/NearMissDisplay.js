/**
 * NearMissDisplay — "You were SO close"
 * 
 * After death, shows the player exactly how close they were to winning.
 * This is the Candy Crush near-miss psychology adapted for roguelikes.
 * 
 * Displays:
 * - How much HP the last enemy had left
 * - How close corruption was to the next threshold/unlock
 * - What cascade events happened during the run
 * - Cards that would have saved them (from draw pile)
 * - A "what if" calculation showing they were X damage from victory
 * 
 * Integration:
 *   import NearMissDisplay from '../systems/NearMissDisplay.js';
 *   const nearMiss = new NearMissDisplay(game.state, game.eventBus);
 *   // Call when player dies:
 *   nearMiss.show(deathContext);
 * 
 * @version 1.0.0
 */

class NearMissDisplay {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Track stats during the run for the death screen
        this.runStats = {
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            cardsPlayed: 0,
            cascadesTriggered: 0,
            closestCall: Infinity, // Lowest HP reached
            enemiesDefeated: 0,
            combatsWon: 0,
            corruptionPeak: 0,
            turnsPlayed: 0
        };
        
        this._setupTracking();
        console.log('[NearMissDisplay] System initialized');
    }

    /**
     * Hook into game events to track run statistics
     */
    _setupTracking() {
        this.eventBus.on('damage:dealt', (data) => {
            this.runStats.totalDamageDealt += (data.amount || 0);
        });
        
        this.eventBus.on('player:damaged', (data) => {
            this.runStats.totalDamageTaken += (data.amount || 0);
            const hp = this.state.get('hero.hp') || 0;
            if (hp < this.runStats.closestCall) {
                this.runStats.closestCall = hp;
            }
        });
        
        this.eventBus.on('enemy:defeated', () => {
            this.runStats.enemiesDefeated++;
        });
        
        this.eventBus.on('combat:victory', () => {
            this.runStats.combatsWon++;
        });
        
        this.eventBus.on('cascade:triggered', () => {
            this.runStats.cascadesTriggered++;
        });
        
        // Track corruption peak
        this.eventBus.on('corruption:changed', (data) => {
            const corruption = data?.value || this.state.get('corruption') || 0;
            if (corruption > this.runStats.corruptionPeak) {
                this.runStats.corruptionPeak = corruption;
            }
        });
    }

    /**
     * Show the near-miss death screen
     * 
     * @param {Object} context - Death context
     * @param {Array} context.remainingEnemies - Enemies still alive when player died
     * @param {Array} context.drawPile - Cards remaining in draw pile
     * @param {Array} context.hand - Cards in hand at death
     * @param {number} context.corruption - Corruption level at death
     * @param {number} context.floor - Map floor/node number
     */
    show(context = {}) {
        const existing = document.getElementById('near-miss-overlay');
        if (existing) existing.remove();

        const enemies = context.remainingEnemies || this.state.get('combat.enemies') || [];
        const drawPile = context.drawPile || this.state.get('combat.drawPile') || [];
        const hand = context.hand || this.state.get('combat.hand') || [];
        const corruption = context.corruption || this.state.get('corruption') || 0;
        const floor = context.floor || this.state.get('currentNode') || this.state.get('floor') || '?';

        // Calculate near-miss metrics
        const nearMissData = this._calculateNearMiss(enemies, drawPile, hand, corruption);

        // Build the overlay
        const overlay = document.createElement('div');
        overlay.id = 'near-miss-overlay';
        overlay.className = 'near-miss-overlay';
        
        overlay.innerHTML = `
            <div class="near-miss-container">
                <div class="near-miss-header">
                    <div class="near-miss-static"></div>
                    <h1 class="near-miss-title">SIGNAL LOST</h1>
                    <div class="near-miss-subtitle">Connection terminated at node ${floor}</div>
                </div>

                <div class="near-miss-body">
                    ${this._renderSoCloseSection(nearMissData)}
                    ${this._renderRunStatsSection()}
                    ${this._renderCorruptionSection(corruption)}
                    ${this._renderSalvageSection(nearMissData)}
                </div>

                <div class="near-miss-footer">
                    <div class="near-miss-quote">${this._getDeathQuote(corruption)}</div>
                    <button class="near-miss-btn near-miss-btn-retry" id="near-miss-retry">
                        JACK BACK IN
                    </button>
                    <button class="near-miss-btn near-miss-btn-menu" id="near-miss-menu">
                        DISCONNECT
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animate entrance
        requestAnimationFrame(() => {
            overlay.classList.add('near-miss-enter');
            this._animateNumbers(overlay);
        });

        // Wire up buttons
        overlay.querySelector('#near-miss-retry')?.addEventListener('click', () => {
            overlay.classList.add('near-miss-exit');
            setTimeout(() => {
                overlay.remove();
                this.eventBus.emit('game:restart');
            }, 400);
        });

        overlay.querySelector('#near-miss-menu')?.addEventListener('click', () => {
            overlay.classList.add('near-miss-exit');
            setTimeout(() => {
                overlay.remove();
                this.eventBus.emit('game:mainMenu');
            }, 400);
        });
    }

    /**
     * Calculate how close the player was to winning
     */
    _calculateNearMiss(enemies, drawPile, hand, corruption) {
        const data = {};

        // Total remaining enemy HP
        data.totalEnemyHpLeft = enemies.reduce((sum, e) => sum + Math.max(0, e.currentHp || 0), 0);
        data.totalEnemyMaxHp = enemies.reduce((sum, e) => sum + (e.maxHp || 0), 0);
        data.enemyHpPercent = data.totalEnemyMaxHp > 0 
            ? Math.round((data.totalEnemyHpLeft / data.totalEnemyMaxHp) * 100) 
            : 0;

        // Weakest remaining enemy
        const weakest = enemies.reduce((min, e) => 
            (e.currentHp > 0 && e.currentHp < (min?.currentHp || Infinity)) ? e : min, null);
        data.weakestEnemy = weakest ? { name: weakest.name, hp: weakest.currentHp } : null;

        // Could any card in draw pile have saved them?
        const potentialDamage = drawPile
            .filter(c => c.damage && c.damage > 0)
            .sort((a, b) => b.damage - a.damage);
        
        data.bestDrawCard = potentialDamage.length > 0 ? potentialDamage[0] : null;
        data.couldHaveSaved = data.bestDrawCard && data.weakestEnemy 
            && data.bestDrawCard.damage >= data.weakestEnemy.hp;

        // Damage needed to kill weakest enemy
        data.damageNeeded = data.weakestEnemy ? data.weakestEnemy.hp : 0;

        // Cards in hand that could have helped
        data.unusedAttacks = hand.filter(c => c.damage && c.damage > 0);
        data.unusedBlock = hand.filter(c => c.block && c.block > 0);

        // Corruption distance to next unlock
        const thresholds = [25, 50, 75, 100];
        data.nextCorruptionThreshold = thresholds.find(t => t > corruption) || 100;
        data.corruptionToNextThreshold = data.nextCorruptionThreshold - corruption;

        return data;
    }

    /**
     * Render the "SO CLOSE" section with near-miss metrics
     */
    _renderSoCloseSection(data) {
        let content = '';

        if (data.weakestEnemy && data.totalEnemyHpLeft > 0) {
            const isVeryClose = data.enemyHpPercent <= 15;
            const closeClass = isVeryClose ? 'near-miss-highlight' : '';
            
            content += `
                <div class="near-miss-section near-miss-so-close ${closeClass}">
                    <div class="near-miss-section-title">
                        ${isVeryClose ? '⚠️ SO CLOSE' : '📊 FINAL STATE'}
                    </div>
                    <div class="near-miss-enemy-remaining">
                        <div class="near-miss-big-number" data-count-to="${data.totalEnemyHpLeft}">0</div>
                        <div class="near-miss-big-label">ENEMY HP REMAINING</div>
                    </div>
                    ${data.weakestEnemy ? `
                        <div class="near-miss-detail">
                            ${data.weakestEnemy.name} had only 
                            <span class="near-miss-emphasis">${data.weakestEnemy.hp} HP</span> left
                        </div>
                    ` : ''}
                    ${data.couldHaveSaved ? `
                        <div class="near-miss-detail near-miss-cruel">
                            <span class="near-miss-emphasis">${data.bestDrawCard.name}</span> 
                            (${data.bestDrawCard.damage} damage) was 
                            ${Math.random() > 0.5 ? 'next in your draw pile' : 'waiting in your deck'}.
                        </div>
                    ` : ''}
                    ${data.damageNeeded > 0 && data.damageNeeded <= 6 ? `
                        <div class="near-miss-detail near-miss-cruel">
                            You needed just <span class="near-miss-emphasis">${data.damageNeeded} more damage</span>.
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return content;
    }

    /**
     * Render run statistics
     */
    _renderRunStatsSection() {
        const stats = this.runStats;
        
        return `
            <div class="near-miss-section near-miss-stats">
                <div class="near-miss-section-title">📋 RUN STATS</div>
                <div class="near-miss-stat-grid">
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value" data-count-to="${stats.totalDamageDealt}">0</div>
                        <div class="near-miss-stat-label">Damage Dealt</div>
                    </div>
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value" data-count-to="${stats.enemiesDefeated}">0</div>
                        <div class="near-miss-stat-label">Enemies Killed</div>
                    </div>
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value" data-count-to="${stats.combatsWon}">0</div>
                        <div class="near-miss-stat-label">Combats Won</div>
                    </div>
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value" data-count-to="${stats.cascadesTriggered}">0</div>
                        <div class="near-miss-stat-label">Void Cascades</div>
                    </div>
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value">${stats.closestCall === Infinity ? '—' : stats.closestCall}</div>
                        <div class="near-miss-stat-label">Lowest HP</div>
                    </div>
                    <div class="near-miss-stat">
                        <div class="near-miss-stat-value" data-count-to="${stats.cardsPlayed}">0</div>
                        <div class="near-miss-stat-label">Cards Played</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render corruption section with near-threshold info
     */
    _renderCorruptionSection(corruption) {
        const thresholds = [
            { level: 25, name: 'Touched', desc: 'Whispers begin' },
            { level: 50, name: 'Corrupted', desc: 'Corrupted cards appear' },
            { level: 75, name: 'Consumed', desc: 'Reality fractures' },
            { level: 100, name: 'Lost', desc: 'Transformation' }
        ];
        
        const nextThreshold = thresholds.find(t => t.level > corruption);
        const reachedThresholds = thresholds.filter(t => t.level <= corruption);
        
        return `
            <div class="near-miss-section near-miss-corruption">
                <div class="near-miss-section-title">👁️ CORRUPTION: ${corruption}%</div>
                <div class="near-miss-corruption-bar">
                    <div class="near-miss-corruption-fill" style="width: ${corruption}%"></div>
                    ${thresholds.map(t => `
                        <div class="near-miss-corruption-marker ${corruption >= t.level ? 'reached' : ''}" 
                             style="left: ${t.level}%"
                             title="${t.name}: ${t.desc}">
                        </div>
                    `).join('')}
                </div>
                ${nextThreshold ? `
                    <div class="near-miss-detail">
                        <span class="near-miss-emphasis">${nextThreshold.level - corruption} points</span> 
                        from "${nextThreshold.name}" — ${nextThreshold.desc}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render the "salvage" section — what was in their hand/deck
     */
    _renderSalvageSection(data) {
        const items = [];
        
        if (data.unusedAttacks.length > 0) {
            items.push(`${data.unusedAttacks.length} unplayed attack${data.unusedAttacks.length > 1 ? 's' : ''} in hand`);
        }
        if (data.unusedBlock.length > 0) {
            items.push(`${data.unusedBlock.length} unplayed block card${data.unusedBlock.length > 1 ? 's' : ''} in hand`);
        }
        
        if (items.length === 0) return '';
        
        return `
            <div class="near-miss-section near-miss-salvage">
                <div class="near-miss-section-title">🃏 UNPLAYED HAND</div>
                ${items.map(item => `<div class="near-miss-detail">${item}</div>`).join('')}
            </div>
        `;
    }

    /**
     * Animate number counting effects
     */
    _animateNumbers(overlay) {
        const countElements = overlay.querySelectorAll('[data-count-to]');
        
        countElements.forEach((el, index) => {
            const target = parseInt(el.dataset.countTo) || 0;
            const startDelay = 300 + index * 150; // Stagger
            const duration = Math.min(1500, 500 + target * 2); // Longer for bigger numbers
            
            setTimeout(() => {
                const startTime = performance.now();
                
                function tick(now) {
                    const elapsed = now - startTime;
                    const progress = Math.min(1, elapsed / duration);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    el.textContent = Math.round(target * eased);
                    
                    if (progress < 1) {
                        requestAnimationFrame(tick);
                    } else {
                        el.textContent = target;
                        el.classList.add('near-miss-counted');
                    }
                }
                
                requestAnimationFrame(tick);
            }, startDelay);
        });
    }

    /**
     * Get a thematic death quote based on corruption level
     */
    _getDeathQuote(corruption) {
        if (corruption >= 75) {
            const quotes = [
                '"The void doesn\'t kill. It absorbs."',
                '"You were already gone. This was just the formality."',
                '"Corruption is not death. It\'s becoming."'
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }
        if (corruption >= 50) {
            const quotes = [
                '"The signal breaks. The static remains."',
                '"Not everyone comes back from Vharos."',
                '"The stars watched. They did not help."'
            ];
            return quotes[Math.floor(Math.random() * quotes.length)];
        }
        const quotes = [
            '"Another frequency goes silent."',
            '"The wasteland claims another."',
            '"Vharos remembers. Even if no one else will."'
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }

    /**
     * Reset stats for a new run
     */
    resetRunStats() {
        this.runStats = {
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            cardsPlayed: 0,
            cascadesTriggered: 0,
            closestCall: Infinity,
            enemiesDefeated: 0,
            combatsWon: 0,
            corruptionPeak: 0,
            turnsPlayed: 0
        };
    }
}

export default NearMissDisplay;
