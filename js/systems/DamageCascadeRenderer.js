/**
 * DamageCascadeRenderer — Balatro-style sequential damage visualization
 * 
 * Instead of instantly resolving "deal 14 damage", this system breaks the
 * damage calculation into visible steps that tick up one by one:
 *   Base 8 → +Strength 2 → ×Vulnerable 1.5 → +Relic 1 → TOTAL: 16
 * 
 * Each step has escalating visual intensity, screen shake, and sound pitch.
 * This is what makes Balatro feel incredible — watching numbers climb.
 * 
 * Integration:
 *   import DamageCascadeRenderer from '../systems/DamageCascadeRenderer.js';
 *   const renderer = new DamageCascadeRenderer(game.eventBus);
 *   // Replace instant damage display with:
 *   await renderer.showDamageCascade(targetEl, steps, finalDamage);
 * 
 * @version 1.0.0
 */

class DamageCascadeRenderer {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isAnimating = false;
        this.container = null;
        
        // Audio context for escalating pitch
        this.audioCtx = null;
        this._initAudio();
        
        console.log('[DamageCascade] Renderer initialized');
    }

    _initAudio() {
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[DamageCascade] Web Audio not available');
        }
    }

    /**
     * Build the cascade steps from a card play context.
     * Call this INSTEAD of calculatePlayerDamage — it returns the same final number
     * but also gives you the visual breakdown.
     * 
     * @param {number} baseDamage - The card's base damage
     * @param {Object} modifiers - All active modifiers
     * @returns {{ steps: Array, finalDamage: number }}
     */
    buildDamageSteps(baseDamage, modifiers = {}) {
        const steps = [];
        let running = baseDamage;

        // Step 1: Base damage
        steps.push({
            label: 'Base',
            icon: '⚔️',
            value: baseDamage,
            running: running,
            type: 'base',
            color: '#e2e8f0'
        });

        // Step 2: Strength
        if (modifiers.strength && modifiers.strength > 0) {
            running += modifiers.strength;
            steps.push({
                label: 'Strength',
                icon: '💪',
                value: `+${modifiers.strength}`,
                running: running,
                type: 'add',
                color: '#ef4444'
            });
        }

        // Step 3: Rage (Korvax)
        if (modifiers.rage && modifiers.rage > 0) {
            running += modifiers.rage;
            steps.push({
                label: 'Rage',
                icon: '😤',
                value: `+${modifiers.rage}`,
                running: running,
                type: 'add',
                color: '#f97316'
            });
        }

        // Step 4: Overheat bonus (Korvax)
        if (modifiers.overheatBonus && modifiers.overheatBonus > 0) {
            running += modifiers.overheatBonus;
            steps.push({
                label: 'Overheat',
                icon: '🌡️',
                value: `+${modifiers.overheatBonus}`,
                running: running,
                type: 'add',
                color: '#ff4400'
            });
        }

        // Step 5: Astral Charge (Lyria)
        if (modifiers.astralCharge && modifiers.astralCharge > 0) {
            running += modifiers.astralCharge;
            steps.push({
                label: 'Astral',
                icon: '✨',
                value: `+${modifiers.astralCharge}`,
                running: running,
                type: 'add',
                color: '#a855f7'
            });
        }

        // Step 6: Relic bonuses
        if (modifiers.relicBonus && modifiers.relicBonus > 0) {
            running += modifiers.relicBonus;
            steps.push({
                label: 'Relic',
                icon: '💎',
                value: `+${modifiers.relicBonus}`,
                running: running,
                type: 'add',
                color: '#fbbf24'
            });
        }

        // Step 7: Biome modifier
        if (modifiers.biomeMultiplier && modifiers.biomeMultiplier !== 1.0) {
            const oldRunning = running;
            running = Math.floor(running * modifiers.biomeMultiplier);
            steps.push({
                label: 'Biome',
                icon: '🌍',
                value: `×${modifiers.biomeMultiplier}`,
                running: running,
                type: 'multiply',
                color: '#22d3ee'
            });
        }

        // Step 8: Corruption empower
        if (modifiers.empowerBonus && modifiers.empowerBonus > 0) {
            running += modifiers.empowerBonus;
            steps.push({
                label: 'Void',
                icon: '👁️',
                value: `+${modifiers.empowerBonus}`,
                running: running,
                type: 'add',
                color: '#7c3aed'
            });
        }

        // Step 9: Weak penalty (reduces by 25%)
        if (modifiers.weak) {
            const oldRunning = running;
            running = Math.floor(running * 0.75);
            steps.push({
                label: 'Weak',
                icon: '💫',
                value: '×0.75',
                running: running,
                type: 'multiply',
                color: '#6b7280',
                negative: true
            });
        }

        // Step 10: Vulnerable bonus (target takes +50%)
        if (modifiers.vulnerable) {
            const oldRunning = running;
            running = Math.floor(running * 1.5);
            steps.push({
                label: 'Vulnerable',
                icon: '🎯',
                value: '×1.5',
                running: running,
                type: 'multiply',
                color: '#f59e0b'
            });
        }

        return { steps, finalDamage: Math.max(0, running) };
    }

    /**
     * Animate the damage cascade on screen
     * 
     * @param {HTMLElement} targetEl - The enemy element to anchor the display to
     * @param {Array} steps - From buildDamageSteps()
     * @param {number} finalDamage - Final damage number
     * @param {Object} options - { skipIfSimple: true } to skip animation for basic hits
     * @returns {Promise} Resolves when animation completes
     */
    async showDamageCascade(targetEl, steps, finalDamage, options = {}) {
        // Skip cascade animation for simple hits (just base damage, no modifiers)
        if (options.skipIfSimple && steps.length <= 1) {
            this._showSimpleDamage(targetEl, finalDamage);
            return;
        }

        // Skip if already animating
        if (this.isAnimating) {
            this._showSimpleDamage(targetEl, finalDamage);
            return;
        }

        this.isAnimating = true;

        // Create cascade container
        const cascade = this._createCascadeOverlay(targetEl);

        try {
            // Animate each step sequentially
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const intensity = i / Math.max(1, steps.length - 1); // 0→1
                const isLast = i === steps.length - 1;

                await this._animateStep(cascade, step, i, intensity, isLast);
                
                // Escalating screen shake
                if (i > 0) {
                    this._screenShake(2 + intensity * 6);
                }
                
                // Escalating audio pitch
                this._playTick(i, steps.length);
            }

            // Final impact
            await this._showFinalDamage(cascade, finalDamage, targetEl);
            
        } finally {
            // Clean up
            setTimeout(() => {
                cascade.remove();
                this.isAnimating = false;
            }, 400);
        }
    }

    /**
     * Create the overlay container anchored to a target element
     */
    _createCascadeOverlay(targetEl) {
        // Remove any existing cascade
        const existing = document.getElementById('damage-cascade-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'damage-cascade-overlay';
        overlay.className = 'damage-cascade-overlay';

        // Position relative to target enemy
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            overlay.style.left = `${rect.left + rect.width / 2}px`;
            overlay.style.top = `${rect.top - 20}px`;
        } else {
            overlay.style.left = '50%';
            overlay.style.top = '30%';
        }

        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * Animate a single step in the cascade
     */
    _animateStep(container, step, index, intensity, isLast) {
        return new Promise(resolve => {
            const stepEl = document.createElement('div');
            stepEl.className = `cascade-step cascade-step-${step.type} ${step.negative ? 'cascade-negative' : ''}`;
            stepEl.style.setProperty('--step-color', step.color);
            stepEl.style.setProperty('--step-index', index);
            stepEl.style.animationDelay = '0ms';

            stepEl.innerHTML = `
                <span class="cascade-step-icon">${step.icon}</span>
                <span class="cascade-step-label">${step.label}</span>
                <span class="cascade-step-value">${step.value}</span>
                <span class="cascade-step-arrow">→</span>
                <span class="cascade-step-running">${step.running}</span>
            `;

            container.appendChild(stepEl);

            // Trigger entrance animation
            requestAnimationFrame(() => {
                stepEl.classList.add('cascade-step-enter');
            });

            // Update the running total display with a counting effect
            const runningEl = stepEl.querySelector('.cascade-step-running');
            if (index > 0 && runningEl) {
                const prevRunning = container.querySelector(`.cascade-step:nth-child(${index}) .cascade-step-running`);
                const startVal = prevRunning ? parseInt(prevRunning.textContent) : 0;
                this._countUp(runningEl, startVal, step.running, 200);
            }

            // Duration scales with cascade position — later steps are faster
            const duration = Math.max(200, 400 - index * 40);
            setTimeout(resolve, duration);
        });
    }

    /**
     * Count up animation for numbers
     */
    _countUp(element, from, to, duration) {
        const startTime = performance.now();
        const diff = to - from;

        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            // Ease out
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + diff * eased);
            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        }

        requestAnimationFrame(tick);
    }

    /**
     * Show the final damage number with impact effect
     */
    _showFinalDamage(container, finalDamage, targetEl) {
        return new Promise(resolve => {
            // Clear step details
            const steps = container.querySelectorAll('.cascade-step');
            steps.forEach(s => s.classList.add('cascade-step-fade'));

            // Show big final number
            const finalEl = document.createElement('div');
            finalEl.className = 'cascade-final-damage';
            finalEl.innerHTML = `
                <span class="cascade-final-number">${finalDamage}</span>
                <span class="cascade-final-label">DAMAGE</span>
            `;
            container.appendChild(finalEl);

            requestAnimationFrame(() => {
                finalEl.classList.add('cascade-final-enter');
                this._screenShake(8);
                this._playImpact();
            });

            // Also show traditional floating damage number on the enemy
            if (targetEl) {
                this._showEnemyDamageNumber(targetEl, finalDamage);
            }

            setTimeout(resolve, 500);
        });
    }

    /**
     * Simple damage number for non-cascaded hits
     */
    _showSimpleDamage(targetEl, damage) {
        if (targetEl) {
            this._showEnemyDamageNumber(targetEl, damage);
        }
    }

    /**
     * Show floating damage number on enemy
     */
    _showEnemyDamageNumber(targetEl, damage) {
        const numEl = document.createElement('div');
        numEl.className = 'cascade-enemy-damage';
        numEl.textContent = `-${damage}`;
        
        const rect = targetEl.getBoundingClientRect();
        numEl.style.left = `${rect.left + rect.width / 2}px`;
        numEl.style.top = `${rect.top + rect.height * 0.3}px`;
        
        document.body.appendChild(numEl);
        
        requestAnimationFrame(() => numEl.classList.add('cascade-enemy-damage-animate'));
        setTimeout(() => numEl.remove(), 1000);
    }

    /**
     * Screen shake with configurable intensity
     */
    _screenShake(intensity) {
        const combatScreen = document.getElementById('combat-screen');
        if (!combatScreen) return;

        combatScreen.style.transition = 'none';
        
        const shakes = [
            { x: -intensity, y: intensity * 0.5 },
            { x: intensity, y: -intensity * 0.3 },
            { x: -intensity * 0.5, y: intensity * 0.3 },
            { x: 0, y: 0 }
        ];

        shakes.forEach((shake, i) => {
            setTimeout(() => {
                combatScreen.style.transform = `translate(${shake.x}px, ${shake.y}px)`;
            }, i * 40);
        });

        setTimeout(() => {
            combatScreen.style.transition = 'transform 0.1s ease-out';
            combatScreen.style.transform = 'translate(0, 0)';
        }, shakes.length * 40);
    }

    /**
     * Play escalating tick sound
     */
    _playTick(stepIndex, totalSteps) {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            // Pitch escalates with each step
            const baseFreq = 220;
            const maxFreq = 880;
            const freq = baseFreq + (maxFreq - baseFreq) * (stepIndex / Math.max(1, totalSteps - 1));
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.08 + stepIndex * 0.02;
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
            osc.stop(this.audioCtx.currentTime + 0.15);
        } catch (e) {
            // Audio failures are non-fatal
        }
    }

    /**
     * Play impact sound for final damage
     */
    _playImpact() {
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.value = 80;
            gain.gain.value = 0.15;
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start();
            osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
            osc.stop(this.audioCtx.currentTime + 0.3);
        } catch (e) {
            // Non-fatal
        }
    }

    /**
     * Build a BLOCK cascade (same visual pattern for defense cards)
     */
    buildBlockSteps(baseBlock, modifiers = {}) {
        const steps = [];
        let running = baseBlock;

        steps.push({
            label: 'Base',
            icon: '🛡️',
            value: baseBlock,
            running: running,
            type: 'base',
            color: '#60a5fa'
        });

        if (modifiers.dexterity && modifiers.dexterity > 0) {
            running += modifiers.dexterity;
            steps.push({
                label: 'Dexterity',
                icon: '🏃',
                value: `+${modifiers.dexterity}`,
                running: running,
                type: 'add',
                color: '#34d399'
            });
        }

        if (modifiers.relicBonus && modifiers.relicBonus > 0) {
            running += modifiers.relicBonus;
            steps.push({
                label: 'Relic',
                icon: '💎',
                value: `+${modifiers.relicBonus}`,
                running: running,
                type: 'add',
                color: '#fbbf24'
            });
        }

        if (modifiers.frail) {
            running = Math.floor(running * 0.75);
            steps.push({
                label: 'Frail',
                icon: '🦴',
                value: '×0.75',
                running: running,
                type: 'multiply',
                color: '#6b7280',
                negative: true
            });
        }

        return { steps, finalBlock: Math.max(0, running) };
    }
}

export default DamageCascadeRenderer;
