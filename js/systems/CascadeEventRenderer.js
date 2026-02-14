/**
 * CascadeEventRenderer — Visual display for corruption cascade events
 * 
 * Listens for 'cascade:triggered' events and renders a cinematic banner
 * showing the cascade name, icon, flavor text, and result.
 * Also handles screen flash and corruption tint overlay.
 * 
 * Integration:
 *   import CascadeEventRenderer from '../systems/CascadeEventRenderer.js';
 *   const renderer = new CascadeEventRenderer(game.eventBus);
 *   // It self-registers on cascade:triggered events
 * 
 * @version 1.0.0
 */

class CascadeEventRenderer {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.queue = [];
        this.isShowing = false;
        
        // Auto-register for cascade events
        this.eventBus.on('cascade:triggered', (data) => {
            this.showCascade(data);
        });
        
        console.log('[CascadeEventRenderer] Initialized, listening for cascade events');
    }

    /**
     * Show a cascade event banner
     * @param {Object} data - { event: { name, icon, color, flavor }, result: { description }, corruption }
     */
    showCascade(data) {
        if (!data || !data.event) return;
        
        // Queue if already showing
        if (this.isShowing) {
            this.queue.push(data);
            return;
        }
        
        this.isShowing = true;
        const { event, result, corruption } = data;
        
        // Screen flash
        this._showFlash(event.color);
        
        // Banner
        this._showBanner(event, result);
        
        // Update corruption tint
        this._updateCorruptionTint(corruption);
        
        // Sound effect
        this._playCascadeSound(event.color);
        
        // Auto-dismiss and process queue
        setTimeout(() => {
            this.isShowing = false;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                setTimeout(() => this.showCascade(next), 300);
            }
        }, 2500);
    }

    /**
     * Show the cascade banner
     */
    _showBanner(event, result) {
        // Remove any existing banner
        const existing = document.querySelector('.cascade-event-banner');
        if (existing) existing.remove();
        
        const banner = document.createElement('div');
        banner.className = 'cascade-event-banner';
        banner.style.setProperty('--cascade-color', event.color || '#a855f7');
        
        banner.innerHTML = `
            <span class="cascade-event-icon">${event.icon || '🌀'}</span>
            <div class="cascade-event-name">${event.name || 'Void Event'}</div>
            <div class="cascade-event-flavor">${event.flavor || ''}</div>
            ${result ? `<div class="cascade-event-result">${result.description || ''}</div>` : ''}
        `;
        
        document.body.appendChild(banner);
        
        // Clean up after animation completes
        setTimeout(() => banner.remove(), 2800);
    }

    /**
     * Show screen flash
     */
    _showFlash(color) {
        const flash = document.createElement('div');
        flash.className = 'cascade-flash';
        flash.style.setProperty('--cascade-color', color || '#a855f7');
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);
    }

    /**
     * Update the corruption tint overlay on the combat screen
     */
    _updateCorruptionTint(corruption) {
        const screen = document.getElementById('combat-screen');
        if (!screen) return;
        
        let tint = screen.querySelector('.combat-corruption-tint');
        if (!tint) {
            tint = document.createElement('div');
            tint.className = 'combat-corruption-tint';
            screen.appendChild(tint);
        }
        
        // Set tier class
        tint.classList.remove('tier-low', 'tier-mid', 'tier-high');
        if (corruption >= 75) {
            tint.classList.add('tier-high');
        } else if (corruption >= 50) {
            tint.classList.add('tier-mid');
        } else if (corruption >= 25) {
            tint.classList.add('tier-low');
        }
    }

    /**
     * Play procedural cascade sound
     */
    _playCascadeSound(color) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Ethereal sweep sound
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.value = 200;
            osc1.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.3);
            
            osc2.type = 'triangle';
            osc2.frequency.value = 300;
            osc2.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.4);
            
            gain.gain.value = 0.06;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.5);
            osc2.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            // Audio is non-fatal
        }
    }
}

export default CascadeEventRenderer;
