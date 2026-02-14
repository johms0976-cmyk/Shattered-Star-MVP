/**
 * VoidSystemsIntegration.js
 * 
 * Bridge module that wires VoidFragmentSystem, ChainMultiplierSystem,
 * and MetaCorruptionSystem into the existing CombatScreen rendering pipeline.
 * 
 * This module:
 * 1. Initializes and connects all three systems
 * 2. Renders Fragment UI panel during combat
 * 3. Renders Chain Multiplier display
 * 4. Renders Meta Corruption effects (whispers, tremors, tells)
 * 5. Hooks into card play pipeline for modifier calculation
 * 
 * INTEGRATION POINT: Import this in main.js and call init() after game setup.
 * Then call hookIntoCombat() from CombatScreen setup.
 * 
 * @version 1.0.0
 */

import { VoidFragmentSystem } from '../systems/VoidFragmentSystem.js';
import { ChainMultiplierSystem } from '../systems/ChainMultiplierSystem.js';
import { MetaCorruptionSystem } from '../systems/MetaCorruptionSystem.js';

class VoidSystemsIntegration {
    constructor(game) {
        this.game = game;
        this.state = game.state;
        this.eventBus = game.eventBus;
        
        // Initialize the three systems
        this.fragments = new VoidFragmentSystem(this.state, this.eventBus);
        this.chains = new ChainMultiplierSystem(this.state, this.eventBus, this.fragments);
        this.metaCorruption = new MetaCorruptionSystem(this.state, this.eventBus);
        
        // Expose systems on game object for access from other modules
        game.voidFragments = this.fragments;
        game.chainMultiplier = this.chains;
        game.metaCorruption = this.metaCorruption;
        
        // UI element references (created on first render)
        this.uiElements = {
            fragmentPanel: null,
            chainDisplay: null,
            corruptionOverlay: null,
            whisperContainer: null
        };
        
        // Load fragment data
        this.loadFragmentData();
        
        // Setup UI event listeners
        this.setupUIListeners();
        
        console.log('[VoidSystems] All three systems initialized and integrated');
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Load fragment database from JSON
     */
    async loadFragmentData() {
        // Try multiple paths to find void_fragments.json
        const paths = ['./data/void_fragments.json', './js/data/void_fragments.json'];
        
        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const data = await response.json();
                    this.fragments.loadFragmentData(data);
                    console.log(`[VoidSystems] Loaded fragment data from ${path}`);
                    return;
                }
            } catch (e) {
                // Try next path
            }
        }
        
        console.warn('[VoidSystems] Could not load void_fragments.json, using fallback');
        this.loadFallbackFragments();
    }

    /**
     * Fallback fragment data if JSON file isn't available
     */
    loadFallbackFragments() {
        // Minimal set for testing
        this.fragments.loadFragmentData({
            fragments: [
                {
                    id: 'void_suffering_echo', name: 'Suffering Echo', rarity: 'common',
                    description: 'Whenever you take damage, your next Attack deals +3 damage.',
                    corruptionPerCombat: 1, type: 'reactive',
                    effect: { trigger: 'onPlayerDamaged', condition: 'always', bonus: { nextAttackBonus: 3 } },
                    lore: 'Pain echoes outward.'
                },
                {
                    id: 'void_chain_resonance', name: 'Chain Resonance', rarity: 'uncommon',
                    description: 'Chain multiplier starts at x1.2 instead of x1.0.',
                    corruptionPerCombat: 2, type: 'chain',
                    effect: { trigger: 'passive', condition: 'always', bonus: { chainBaseMultiplier: 1.2 } },
                    lore: 'Every repetition strengthens the signal.'
                },
                {
                    id: 'void_glass_cannon', name: 'Glass Cannon', rarity: 'uncommon',
                    description: 'All damage dealt +25%. All damage received +25%.',
                    corruptionPerCombat: 3, type: 'damage',
                    effect: { trigger: 'passive', condition: 'always', bonus: { allDamageDealtMultiplier: 1.25, allDamageReceivedMultiplier: 1.25 } },
                    lore: 'The void strips away armor.'
                }
            ]
        });
    }

    /**
     * Setup event listeners for UI rendering
     */
    setupUIListeners() {
        // Fragment triggers - flash the fragment slot
        this.eventBus.on('fragments:triggered', (data) => {
            this.flashFragmentSlot(data.fragmentId);
        });
        
        // Chain events - update chain display
        this.eventBus.on('chain:grow', (data) => this.updateChainDisplay(data));
        this.eventBus.on('chain:break', (data) => this.onChainBreak(data));
        this.eventBus.on('chain:start', (data) => this.updateChainDisplay(data));
        
        // Meta corruption - render effects
        this.eventBus.on('meta:whisper', (data) => this.renderWhisper(data));
        this.eventBus.on('meta:uiTremor', (data) => this.applyTremor(data));
        this.eventBus.on('meta:falseIntent', (data) => this.renderFalseIntent(data));
        this.eventBus.on('meta:intentCorrected', (data) => this.correctIntent(data));
        this.eventBus.on('meta:energyGhost', (data) => this.renderEnergyGhost(data));
        this.eventBus.on('meta:energyCorrected', (data) => this.correctEnergy(data));
        this.eventBus.on('meta:falseCost', (data) => this.renderFalseCost(data));
        this.eventBus.on('meta:costCorrected', (data) => this.correctCost(data));
        this.eventBus.on('meta:cardLeak', (data) => this.renderCardLeak(data));
        this.eventBus.on('meta:cardLeakFade', (data) => this.fadeCardLeak(data));
        
        // Combat lifecycle
        this.eventBus.on('screen:changed', (data) => {
            const screenId = typeof data === 'string' ? data : data?.screen;
            if (screenId === 'combat') {
                this.createCombatUI();
            } else {
                this.hideCombatUI();
            }
        });
        
        // Corruption tier changes
        this.eventBus.on('meta:tierChanged', (data) => {
            this.updateCorruptionOverlay(data.corruption);
        });
    }

    // ==========================================
    // COMBAT PIPELINE HOOKS
    // ==========================================

    /**
     * CRITICAL: Hook into the card play pipeline.
     * Call this from your applyCardEffect function in CombatScreen.js
     * 
     * @param {Object} card - Card being played
     * @param {number} baseDamage - Damage before modifiers
     * @param {Object} target - Target enemy
     * @returns {Object} { finalDamage, finalBlock, chainResult, damageNumberLie }
     */
    processCardPlay(card, baseDamage, baseBlock, target) {
        // 1. Process chain multiplier
        const chainResult = this.chains.processCardPlay(card);
        
        // 2. Get fragment damage modifiers
        const fragDmg = this.fragments.calculateDamageModifiers(card, baseDamage, target);
        const fragBlk = this.fragments.calculateBlockModifiers(card, baseBlock);
        
        // 3. Calculate final damage
        let finalDamage = baseDamage;
        if (finalDamage > 0) {
            finalDamage += fragDmg.flatBonus;
            finalDamage = Math.floor(finalDamage * fragDmg.multiplier);
            finalDamage = this.chains.applyToValue(finalDamage, false);
        }
        
        // 4. Calculate final block
        let finalBlock = baseBlock;
        if (finalBlock > 0) {
            finalBlock += fragBlk.flatBonus;
            finalBlock = this.chains.applyToValue(finalBlock, true);
        }
        
        // 5. Check for meta corruption damage number lie
        const damageNumberLie = this.metaCorruption.tryDamageNumberLie(finalDamage);
        
        // 6. Notify fragment system
        this.fragments.onCardPlayed({ card });
        
        // 7. Emit for UI
        this.eventBus.emit('card:played', { card });
        
        return {
            finalDamage: Math.max(0, finalDamage),
            finalBlock: Math.max(0, finalBlock),
            chainResult,
            damageNumberLie
        };
    }

    /**
     * Hook for incoming damage to player (for Glass Cannon etc.)
     */
    processIncomingDamage(rawDamage) {
        const modifiedDamage = this.fragments.calculateIncomingDamageModifier(rawDamage);
        this.fragments.onDamageTaken({ amount: modifiedDamage });
        return modifiedDamage;
    }

    /**
     * Hook for card cost modification (for Entropy Tax etc.)
     */
    getModifiedCardCost(card) {
        const baseCost = card.cost || 0;
        const modifiedCost = this.fragments.modifyCardCost(card, baseCost);
        
        // Also check meta corruption cost lie for display
        const cardId = card.instanceId || card.id;
        const displayData = this.metaCorruption.getDisplayCost(cardId, modifiedCost);
        
        return {
            actualCost: modifiedCost,
            displayCost: displayData.cost,
            isCorrupted: displayData.isCorrupted
        };
    }

    /**
     * Hook for enemy kill (for Lethal Siphon, Overkill Cascade, etc.)
     */
    processEnemyKill(enemy, overkillDamage, remainingEnemies) {
        this.fragments.onEnemyKilled({ enemy, overkillDamage, remainingEnemies });
    }

    /**
     * Get chain preview for card hover
     */
    getChainPreview(card) {
        return this.chains.previewCardPlay(card);
    }

    // ==========================================
    // UI CREATION
    // ==========================================

    createCombatUI() {
        this.createFragmentPanel();
        this.createChainDisplay();
        this.createCorruptionOverlay();
        this.createWhisperContainer();
    }

    hideCombatUI() {
        if (this.uiElements.fragmentPanel) {
            this.uiElements.fragmentPanel.classList.add('hidden');
        }
        if (this.uiElements.chainDisplay) {
            this.uiElements.chainDisplay.classList.add('hidden');
        }
    }

    // --- Fragment Panel ---

    createFragmentPanel() {
        let panel = document.getElementById('void-fragment-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'void-fragment-panel';
            panel.className = 'void-fragment-panel';
            document.body.appendChild(panel);
        }
        this.uiElements.fragmentPanel = panel;
        this.renderFragmentPanel();
    }

    renderFragmentPanel() {
        const panel = this.uiElements.fragmentPanel;
        if (!panel) return;
        
        const uiData = this.fragments.getUIData();
        
        panel.innerHTML = uiData.slots.map((slot, i) => {
            if (!slot.unlocked) {
                return `<div class="fragment-slot locked" data-slot="${i}">
                    <div class="fragment-tooltip">
                        <div class="fragment-tooltip-desc">Unlocks at ${slot.unlockThreshold}% corruption</div>
                    </div>
                </div>`;
            }
            
            if (!slot.fragment) {
                return `<div class="fragment-slot" data-slot="${i}">
                    <div class="fragment-icon">◇</div>
                    <div class="fragment-name">Empty</div>
                </div>`;
            }
            
            const f = slot.fragment;
            const rarityClass = `rarity-${f.rarity || 'common'}`;
            const icon = this.getFragmentIcon(f);
            
            return `<div class="fragment-slot equipped ${rarityClass}" 
                         data-slot="${i}" data-fragment-id="${f.id}">
                <div class="fragment-corruption-cost">+${f.corruptionPerCombat}</div>
                <div class="fragment-icon">${icon}</div>
                <div class="fragment-name">${f.name}</div>
                <div class="fragment-tooltip">
                    <div class="fragment-tooltip-name">${f.name}</div>
                    <div class="fragment-tooltip-desc">${f.description}</div>
                    <div class="fragment-tooltip-corruption">+${f.corruptionPerCombat} corruption per combat</div>
                    ${f.lore ? `<div class="fragment-tooltip-lore">${f.lore}</div>` : ''}
                </div>
            </div>`;
        }).join('');
        
        // Show total corruption cost
        if (uiData.totalCorruptionCost > 0) {
            panel.innerHTML += `<div style="color: #ff6688; font-size: 9px; 
                align-self: center; padding: 0 4px;">
                +${uiData.totalCorruptionCost}/combat
            </div>`;
        }
        
        panel.classList.remove('hidden');
    }

    getFragmentIcon(fragment) {
        const icons = {
            'sequencing': '🔗',
            'precision': '🎯',
            'chain': '⛓️',
            'reactive': '⚡',
            'damage': '💥',
            'economy': '💎',
            'corruption': '🌀',
            'information': '👁️'
        };
        return icons[fragment.type] || '◆';
    }

    flashFragmentSlot(fragmentId) {
        const slot = document.querySelector(`[data-fragment-id="${fragmentId}"]`);
        if (slot) {
            slot.classList.add('triggered');
            setTimeout(() => slot.classList.remove('triggered'), 500);
        }
    }

    // --- Chain Multiplier Display ---

    createChainDisplay() {
        let display = document.getElementById('chain-display');
        if (!display) {
            display = document.createElement('div');
            display.id = 'chain-display';
            display.className = 'chain-display hidden';
            display.innerHTML = `
                <div class="chain-multiplier-value">×1.0</div>
                <div class="chain-type-label"></div>
                <div class="chain-pips"></div>
            `;
            document.body.appendChild(display);
        }
        this.uiElements.chainDisplay = display;
    }

    updateChainDisplay(data) {
        const display = this.uiElements.chainDisplay;
        if (!display) return;
        
        const info = this.chains.getChainInfo();
        
        if (!info.active) {
            display.classList.add('hidden');
            display.classList.remove('active');
            return;
        }
        
        display.classList.remove('hidden');
        display.classList.add('active');
        display.setAttribute('data-chain-type', info.type || 'attack');
        
        const valueEl = display.querySelector('.chain-multiplier-value');
        const labelEl = display.querySelector('.chain-type-label');
        const pipsEl = display.querySelector('.chain-pips');
        
        if (valueEl) {
            valueEl.textContent = `×${info.multiplier.toFixed(1)}`;
            valueEl.classList.add('growing');
            setTimeout(() => valueEl.classList.remove('growing'), 300);
        }
        
        if (labelEl) {
            labelEl.textContent = `${info.type} chain`;
        }
        
        if (pipsEl) {
            const maxPips = 7;
            pipsEl.innerHTML = Array.from({ length: maxPips }, (_, i) => 
                `<div class="chain-pip ${i < info.length ? 'filled' : ''}"></div>`
            ).join('');
        }
        
        // Add explosive class at high chains
        if (info.isExplosive) {
            display.classList.add('explosive');
            setTimeout(() => display.classList.remove('explosive'), 600);
        }
    }

    onChainBreak(data) {
        const display = this.uiElements.chainDisplay;
        if (!display) return;
        
        if (data.previousLength >= 2) {
            display.classList.add('breaking');
            setTimeout(() => {
                display.classList.remove('breaking');
                display.classList.add('hidden');
            }, 500);
        }
    }

    // --- Corruption Overlay ---

    createCorruptionOverlay() {
        let overlay = document.getElementById('meta-corruption-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'meta-corruption-overlay';
            overlay.className = 'meta-corruption-overlay tier-0';
            document.body.appendChild(overlay);
        }
        this.uiElements.corruptionOverlay = overlay;
        this.updateCorruptionOverlay(this.state.get('corruption') || 0);
    }

    updateCorruptionOverlay(corruption) {
        const overlay = this.uiElements.corruptionOverlay;
        if (!overlay) return;
        
        overlay.className = 'meta-corruption-overlay';
        if (corruption >= 100) overlay.classList.add('tier-100');
        else if (corruption >= 75) overlay.classList.add('tier-75');
        else if (corruption >= 50) overlay.classList.add('tier-50');
        else if (corruption >= 25) overlay.classList.add('tier-25');
        else overlay.classList.add('tier-0');
    }

    // --- Whisper Container ---

    createWhisperContainer() {
        let container = document.getElementById('whisper-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'whisper-container';
            container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300;';
            document.body.appendChild(container);
        }
        this.uiElements.whisperContainer = container;
    }

    // ==========================================
    // META CORRUPTION UI RENDERS
    // ==========================================

    renderWhisper(data) {
        const container = this.uiElements.whisperContainer;
        if (!container) return;
        
        const whisper = document.createElement('div');
        whisper.className = `meta-whisper pos-${data.position.replace(/\s/g, '-')}`;
        whisper.textContent = data.message;
        whisper.style.animationDuration = `${data.duration}ms`;
        container.appendChild(whisper);
        
        setTimeout(() => whisper.remove(), data.duration + 200);
    }

    applyTremor(data) {
        const el = document.getElementById(data.target) || 
                    document.querySelector(`.${data.target}`);
        if (!el) return;
        
        const cls = data.tell === 'chromatic' ? 'ui-tremor-chromatic' : 'ui-tremor';
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), data.duration || 300);
    }

    renderFalseIntent(data) {
        const { enemy, fakeIntent } = data;
        // Find the enemy intent element
        const intentEl = document.querySelector(
            `[data-enemy-id="${enemy.id || enemy.name}"] .enemy-intent, .enemy-intent`
        );
        if (!intentEl) return;
        
        intentEl.classList.add('corrupted-intent');
        
        // Show fake intent icon/value
        const iconEl = intentEl.querySelector('.intent-icon') || intentEl;
        if (iconEl && fakeIntent) {
            iconEl.setAttribute('data-real-content', iconEl.textContent);
            const fakeIcon = this.getIntentDisplay(fakeIntent);
            iconEl.innerHTML = fakeIcon;
        }
    }

    correctIntent(data) {
        const { enemy, realIntent } = data;
        const intentEl = document.querySelector(
            `[data-enemy-id="${enemy.id || enemy.name}"] .enemy-intent, .enemy-intent`
        );
        if (!intentEl) return;
        
        intentEl.classList.remove('corrupted-intent');
        intentEl.classList.add('intent-correcting');
        setTimeout(() => intentEl.classList.remove('intent-correcting'), 400);
        
        // Restore real intent
        const iconEl = intentEl.querySelector('.intent-icon') || intentEl;
        if (iconEl) {
            const realIcon = this.getIntentDisplay(realIntent);
            iconEl.innerHTML = realIcon;
        }
    }

    getIntentDisplay(intent) {
        const icons = {
            'attack': `⚔️ ${intent.value || ''}`,
            'defend': `🛡️ ${intent.value || ''}`,
            'buff': '⬆️',
            'debuff': '⬇️',
            'special': '❓'
        };
        return icons[intent.type] || `${intent.type} ${intent.value || ''}`;
    }

    renderEnergyGhost(data) {
        const energyEl = document.getElementById('energy-current') || 
                          document.querySelector('.energy-current');
        const displayEl = document.querySelector('.energy-display') || 
                          document.getElementById('energy-display');
        
        if (energyEl) {
            energyEl.setAttribute('data-real-energy', energyEl.textContent);
            energyEl.textContent = data.fakeEnergy;
        }
        if (displayEl) {
            displayEl.classList.add('energy-ghost');
        }
    }

    correctEnergy(data) {
        const energyEl = document.getElementById('energy-current') || 
                          document.querySelector('.energy-current');
        const displayEl = document.querySelector('.energy-display') || 
                          document.getElementById('energy-display');
        
        if (energyEl) {
            const real = energyEl.getAttribute('data-real-energy');
            if (real !== null) energyEl.textContent = real;
        }
        if (displayEl) {
            displayEl.classList.remove('energy-ghost');
        }
    }

    renderFalseCost(data) {
        const cardEls = document.querySelectorAll('.combat-card');
        cardEls.forEach(el => {
            const idx = parseInt(el.dataset.index);
            const hand = this.state.get('combat.hand') || [];
            if (hand[idx] && (hand[idx].instanceId === data.card.instanceId || 
                              hand[idx].id === data.card.id)) {
                el.classList.add('cost-corrupted');
                const costEl = el.querySelector('.card-cost');
                if (costEl) {
                    costEl.setAttribute('data-real-cost', costEl.textContent);
                    costEl.textContent = data.fakeCost;
                }
            }
        });
    }

    correctCost(data) {
        const cardEls = document.querySelectorAll('.combat-card.cost-corrupted');
        cardEls.forEach(el => {
            el.classList.remove('cost-corrupted');
            const costEl = el.querySelector('.card-cost');
            if (costEl) {
                const real = costEl.getAttribute('data-real-cost');
                if (real !== null) costEl.textContent = real;
            }
        });
    }

    renderCardLeak(data) {
        const handContainer = document.getElementById('hand-area') || 
                               document.querySelector('.hand-area');
        if (!handContainer) return;
        
        const phantom = document.createElement('div');
        phantom.className = 'combat-card card phantom-card';
        phantom.innerHTML = `
            <div class="card-cost">${data.card.cost || 0}</div>
            <div class="card-name">${data.card.name || 'Void Echo'}</div>
            <div class="card-type">${data.card.type || 'Attack'}</div>
            <div class="card-description">${data.card.description || ''}</div>
        `;
        phantom.setAttribute('data-phantom', 'true');
        handContainer.appendChild(phantom);
        
        // Auto-remove
        setTimeout(() => phantom.remove(), data.duration || 3000);
    }

    fadeCardLeak(data) {
        const phantoms = document.querySelectorAll('.phantom-card');
        phantoms.forEach(p => {
            p.style.animation = 'phantomFloat 0.5s ease-out forwards';
            p.style.opacity = '0';
            setTimeout(() => p.remove(), 500);
        });
    }

    // ==========================================
    // CARD HOVER CHAIN PREVIEW
    // ==========================================

    /**
     * Call this when rendering cards to add chain preview indicators
     */
    addChainPreviewToCards() {
        const hand = this.state.get('combat.hand') || [];
        const cardEls = document.querySelectorAll('.combat-card');
        
        cardEls.forEach((el, i) => {
            if (!hand[i]) return;
            
            const preview = this.chains.previewCardPlay(hand[i]);
            
            // Remove old classes
            el.classList.remove('chain-continues', 'chain-breaks');
            el.removeAttribute('data-chain-preview');
            
            if (this.chains.chain.active && this.chains.chain.length >= 2) {
                if (preview.wouldContinue) {
                    el.classList.add('chain-continues');
                    el.setAttribute('data-chain-preview', `×${preview.nextMultiplier.toFixed(1)}`);
                } else {
                    el.classList.add('chain-breaks');
                }
            }
        });
    }

    // ==========================================
    // SAVE / LOAD
    // ==========================================

    getSaveData() {
        return {
            fragments: this.fragments.getSaveData(),
            chains: this.chains.getSaveData()
        };
    }

    loadSaveData(data) {
        if (!data) return;
        if (data.fragments) this.fragments.loadSaveData(data.fragments);
        if (data.chains) this.chains.loadSaveData(data.chains);
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        this.metaCorruption.destroy();
        
        // Remove UI elements
        Object.values(this.uiElements).forEach(el => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    }
}

export { VoidSystemsIntegration };
