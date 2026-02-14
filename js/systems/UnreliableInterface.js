/**
 * UnreliableInterface — "The game lies to you"
 * 
 * At high corruption levels, UI elements become subtly untrustworthy.
 * Card costs flicker to wrong values before correcting.
 * Enemy intents glitch and show distorted numbers.
 * Energy counter stutters.
 * Card descriptions gain unsettling addendums.
 * 
 * CRITICAL: The CORRECT information always resolves within ~300ms.
 * This is psychological horror, not unfair gameplay.
 * 
 * Inspired by Inscryption's meta-horror and fourth-wall breaking.
 * 
 * Integration:
 *   import UnreliableInterface from '../systems/UnreliableInterface.js';
 *   const unreliable = new UnreliableInterface(game.state, game.eventBus);
 *   // Call after each renderCombatUI():
 *   unreliable.applyDistortions();
 * 
 * @version 1.0.0
 */

// ═══════════════════════════════════════════
// WHISPER TEXTS — appended to card descriptions at high corruption
// ═══════════════════════════════════════════
const WHISPER_ADDITIONS = {
    // Corruption 25-49: Subtle unease
    low: [
        ' ...probably.',
        ' (Are you sure?)',
        '',  // Sometimes nothing, which is scarier
        '',
        ''
    ],
    // Corruption 50-74: Overt wrongness
    mid: [
        ' The void watches.',
        ' (This used to do something else.)',
        ' It remembers you.',
        ' Are those the right numbers?',
        ' (Was it always this color?)',
        ''
    ],
    // Corruption 75+: Hostile interface
    high: [
        ' DO NOT PLAY THIS.',
        ' (This card is lying to you.)',
        ' It wants to be played. Don\'t let it.',
        ' THE NUMBERS ARE WRONG.',
        ' You\'ve played this before. It ended badly.',
        ' (The void wrote this description.)',
        ' Why are you still fighting?'
    ]
};

// ═══════════════════════════════════════════
// CARD NAME CORRUPTIONS — names that glitch at 75+
// ═══════════════════════════════════════════
const NAME_GLITCHES = {
    'Strike': ['S̷t̷r̷i̷k̷e̷', 'Strike', 'Str1ke', 'S█rike'],
    'Defend': ['D̷e̷f̷e̷n̷d̷', 'Def3nd', 'De█end', 'Defend'],
    'Thermal Vent': ['Th̷e̷r̷m̷a̷l̷ Vent', 'T̷h̷e̷rmal V̶e̶nt', 'Thermal Vent'],
    'Void Siphon': ['V̸o̸i̸d̸ Siphon', 'Vo1d S1phon', 'V█id Sip█on'],
    'Quick Patch': ['Qu1ck P̷a̷t̷c̷h̷', 'Quick █atch', 'Qu̶i̶ck Patch']
};

class UnreliableInterface {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.distortionInterval = null;
        this.activeDistortions = [];
        this.whisperInterval = null;
        
        // Track which elements are currently distorted to prevent stacking
        this.distortedElements = new WeakSet();
        
        console.log('[UnreliableInterface] System initialized');
    }

    /**
     * Get current corruption tier for distortion intensity
     */
    _getTier() {
        const corruption = this.state.get('corruption') || 0;
        if (corruption >= 75) return 'high';
        if (corruption >= 50) return 'mid';
        if (corruption >= 25) return 'low';
        return 'none';
    }

    /**
     * Apply all distortions based on current corruption level.
     * Call this after every renderCombatUI().
     */
    applyDistortions() {
        const tier = this._getTier();
        if (tier === 'none') return;

        const corruption = this.state.get('corruption') || 0;

        // ── Tier: low (25+) — Subtle whispers on cards ──
        if (tier === 'low' || tier === 'mid' || tier === 'high') {
            this._addCardWhispers(tier);
        }

        // ── Tier: mid (50+) — Intent flickers ──
        if (tier === 'mid' || tier === 'high') {
            this._flickerIntents(corruption);
        }

        // ── Tier: high (75+) — Full unreliability ──
        if (tier === 'high') {
            this._flickerCardCosts();
            this._flickerEnergy();
            this._glitchCardNames();
            this._distortHpDisplay();
            this._addInterfaceNoise();
        }
    }

    /**
     * Add whisper text to card descriptions
     */
    _addCardWhispers(tier) {
        const cards = document.querySelectorAll('.card .card-description, .card .card-desc');
        const whispers = WHISPER_ADDITIONS[tier] || WHISPER_ADDITIONS.low;
        
        cards.forEach(descEl => {
            if (this.distortedElements.has(descEl)) return;
            if (Math.random() > 0.3) return; // Only affect ~30% of cards
            
            this.distortedElements.add(descEl);
            const whisper = whispers[Math.floor(Math.random() * whispers.length)];
            if (whisper) {
                const whisperSpan = document.createElement('span');
                whisperSpan.className = 'card-whisper';
                whisperSpan.textContent = whisper;
                descEl.appendChild(whisperSpan);
            }
        });
    }

    /**
     * Make enemy intent numbers flicker to wrong values before correcting
     */
    _flickerIntents(corruption) {
        const intents = document.querySelectorAll('.intent-value');
        
        intents.forEach(intentEl => {
            if (this.distortedElements.has(intentEl)) return;
            if (Math.random() > 0.4) return; // 40% chance per intent
            
            this.distortedElements.add(intentEl);
            const realValue = intentEl.textContent;
            const realNum = parseInt(realValue);
            
            if (isNaN(realNum)) return;
            
            // Show a wrong number briefly
            const offset = Math.floor(Math.random() * 8) - 4; // ±4
            const wrongValue = Math.max(0, realNum + offset);
            
            intentEl.textContent = wrongValue;
            intentEl.classList.add('intent-glitch');
            
            // Correct after a brief flicker
            const correctionDelay = 150 + Math.random() * 300;
            setTimeout(() => {
                intentEl.textContent = realValue;
                intentEl.classList.remove('intent-glitch');
                intentEl.classList.add('intent-corrected');
                setTimeout(() => {
                    intentEl.classList.remove('intent-corrected');
                    this.distortedElements.delete(intentEl);
                }, 200);
            }, correctionDelay);
        });
    }

    /**
     * Make card cost numbers flicker (75+ corruption)
     */
    _flickerCardCosts() {
        const costs = document.querySelectorAll('.card .card-cost, .card .energy-cost');
        
        costs.forEach(costEl => {
            if (this.distortedElements.has(costEl)) return;
            if (Math.random() > 0.25) return; // 25% of cards
            
            this.distortedElements.add(costEl);
            const realCost = costEl.textContent;
            const realNum = parseInt(realCost);
            
            if (isNaN(realNum)) return;
            
            // Show wrong cost
            const wrongCost = Math.max(0, realNum + (Math.random() > 0.5 ? 1 : -1));
            costEl.textContent = wrongCost;
            costEl.classList.add('cost-glitch');
            
            // Quick correction
            setTimeout(() => {
                costEl.textContent = realCost;
                costEl.classList.remove('cost-glitch');
                this.distortedElements.delete(costEl);
            }, 200 + Math.random() * 200);
        });
    }

    /**
     * Make the energy counter stutter (75+ corruption)
     */
    _flickerEnergy() {
        const energyEls = document.querySelectorAll('#combat-energy, .energy-display, .energy-current');
        
        energyEls.forEach(el => {
            if (this.distortedElements.has(el)) return;
            if (Math.random() > 0.2) return;
            
            this.distortedElements.add(el);
            el.classList.add('energy-glitch');
            
            setTimeout(() => {
                el.classList.remove('energy-glitch');
                this.distortedElements.delete(el);
            }, 300);
        });
    }

    /**
     * Glitch card names with zalgo/corrupted text (75+ corruption)
     */
    _glitchCardNames() {
        const names = document.querySelectorAll('.card .card-name, .card .card-title');
        
        names.forEach(nameEl => {
            if (this.distortedElements.has(nameEl)) return;
            if (Math.random() > 0.15) return; // Rare — 15%
            
            const realName = nameEl.textContent;
            const glitchOptions = NAME_GLITCHES[realName];
            
            if (!glitchOptions) return;
            
            this.distortedElements.add(nameEl);
            const glitched = glitchOptions[Math.floor(Math.random() * glitchOptions.length)];
            nameEl.textContent = glitched;
            nameEl.classList.add('name-glitch');
            
            // Correct
            setTimeout(() => {
                nameEl.textContent = realName;
                nameEl.classList.remove('name-glitch');
                this.distortedElements.delete(nameEl);
            }, 400 + Math.random() * 300);
        });
    }

    /**
     * Briefly distort the HP display (75+ corruption)
     */
    _distortHpDisplay() {
        const hpText = document.getElementById('combat-hp-text') || document.getElementById('player-hp-text');
        if (!hpText || this.distortedElements.has(hpText)) return;
        if (Math.random() > 0.15) return;
        
        this.distortedElements.add(hpText);
        const realText = hpText.textContent;
        
        // Parse "45/80" format
        const match = realText.match(/(\d+)\/(\d+)/);
        if (!match) return;
        
        const realHp = parseInt(match[1]);
        const maxHp = parseInt(match[2]);
        
        // Show a slightly wrong HP (always lower, to create anxiety)
        const wrongHp = Math.max(1, realHp - Math.floor(Math.random() * 5) - 1);
        hpText.textContent = `${wrongHp}/${maxHp}`;
        hpText.classList.add('hp-glitch');
        
        setTimeout(() => {
            hpText.textContent = realText;
            hpText.classList.remove('hp-glitch');
            this.distortedElements.delete(hpText);
        }, 250);
    }

    /**
     * Add visual noise artifacts to the combat screen (75+)
     */
    _addInterfaceNoise() {
        if (Math.random() > 0.1) return; // Rare
        
        const screen = document.getElementById('combat-screen');
        if (!screen) return;
        
        const noise = document.createElement('div');
        noise.className = 'interface-noise';
        
        // Random position, random size
        noise.style.left = `${Math.random() * 100}%`;
        noise.style.top = `${Math.random() * 100}%`;
        noise.style.width = `${20 + Math.random() * 80}px`;
        noise.style.height = `${2 + Math.random() * 4}px`;
        
        screen.appendChild(noise);
        
        setTimeout(() => noise.remove(), 150 + Math.random() * 200);
    }

    /**
     * Start periodic ambient distortions during combat
     * Call on combat start, stop on combat end
     */
    startAmbientDistortions() {
        this.stopAmbientDistortions();
        
        const tier = this._getTier();
        if (tier === 'none') return;
        
        // Interval based on corruption severity
        const intervals = { low: 8000, mid: 4000, high: 2000 };
        const interval = intervals[tier] || 8000;
        
        this.distortionInterval = setInterval(() => {
            this.applyDistortions();
        }, interval);

        // At high corruption, add ambient whispers in the void
        if (tier === 'high') {
            this._startVoidWhispers();
        }
        
        console.log(`[UnreliableInterface] Ambient distortions active (tier: ${tier}, interval: ${interval}ms)`);
    }

    /**
     * Stop periodic distortions
     */
    stopAmbientDistortions() {
        if (this.distortionInterval) {
            clearInterval(this.distortionInterval);
            this.distortionInterval = null;
        }
        this._stopVoidWhispers();
    }

    /**
     * Periodic whisper text that appears and fades in the combat area
     */
    _startVoidWhispers() {
        this._stopVoidWhispers();
        
        const VOID_WHISPERS = [
            'you\'ve been here before',
            'this isn\'t real',
            'the cards remember',
            'stop playing',
            'it sees you',
            'the numbers are wrong',
            'you already lost',
            'keep going',
            'don\'t trust the interface',
            'corruption is a gift'
        ];
        
        this.whisperInterval = setInterval(() => {
            if (Math.random() > 0.3) return;
            
            const screen = document.getElementById('combat-screen');
            if (!screen) return;
            
            const whisper = document.createElement('div');
            whisper.className = 'void-whisper-text';
            whisper.textContent = VOID_WHISPERS[Math.floor(Math.random() * VOID_WHISPERS.length)];
            whisper.style.left = `${10 + Math.random() * 80}%`;
            whisper.style.top = `${10 + Math.random() * 60}%`;
            whisper.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 40}px`);
            
            screen.appendChild(whisper);
            
            setTimeout(() => whisper.remove(), 3000);
        }, 5000);
    }

    _stopVoidWhispers() {
        if (this.whisperInterval) {
            clearInterval(this.whisperInterval);
            this.whisperInterval = null;
        }
        // Clean up any remaining whispers
        document.querySelectorAll('.void-whisper-text').forEach(el => el.remove());
    }

    /**
     * Clean up everything
     */
    destroy() {
        this.stopAmbientDistortions();
        document.querySelectorAll('.interface-noise, .void-whisper-text').forEach(el => el.remove());
    }
}

export default UnreliableInterface;
