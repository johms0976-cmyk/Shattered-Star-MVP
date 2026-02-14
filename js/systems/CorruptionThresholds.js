/**
 * CorruptionThresholds.js - Corruption Threshold Micro-Event System
 * Shattered Star - Sci-Fi Noir Cosmic Horror Deckbuilder
 * 
 * Monitors corruption level and triggers forced micro-events at
 * 25%, 50%, and 75% thresholds. Events become progressively darker
 * and more dangerous as corruption rises.
 * 
 * @version 1.0.0
 */

export default class CorruptionThresholds {
    constructor(game) {
        this.game = game;
        this.state = game.state;
        this.eventBus = game.eventBus;
        
        // Track which thresholds have fired this run
        this.firedThresholds = new Set();
        
        // Threshold definitions
        this.thresholds = [
            { level: 25, id: 'void_notices', name: 'The Void Notices' },
            { level: 50, id: 'void_speaks', name: 'The Void Speaks' },
            { level: 75, id: 'void_claims', name: 'The Void Claims' }
        ];
        
        // Micro-event pools for each threshold
        this.microEvents = {
            void_notices: [
                {
                    title: 'The Void Notices',
                    text: 'A cold awareness prickles at the edge of your mind. Something vast has turned its attention toward you. Your reflection in a darkened screen moves half a second too late.',
                    choices: [
                        {
                            text: 'Embrace the gaze',
                            effects: { corruption: 5, maxHp: 5 },
                            result: 'The void\'s attention settles like a second skin. You feel... expanded.'
                        },
                        {
                            text: 'Shield your thoughts',
                            effects: { corruption: -3, hp: -5 },
                            result: 'You force the presence back, but the effort costs you. A nosebleed drips onto the floor.'
                        }
                    ]
                },
                {
                    title: 'Whispers in the Wiring',
                    text: 'The station\'s electrical hum shifts to something almost musical. You could swear the lights are blinking in a pattern meant just for you.',
                    choices: [
                        {
                            text: 'Listen to the pattern',
                            effects: { corruption: 8, drawCard: true },
                            result: 'The rhythm resolves into... instructions? A technique you\'ve never learned surfaces in your mind.'
                        },
                        {
                            text: 'Cover your ears and move on',
                            effects: { corruption: 0 },
                            result: 'You push through. The humming fades, but your hands won\'t stop trembling for hours.'
                        }
                    ]
                }
            ],
            void_speaks: [
                {
                    title: 'The Void Speaks',
                    text: 'Reality hiccups. For one sickening instant, you see the station from outside—a tiny metal shell floating in something that is definitely not space. A voice that bypasses your ears entirely says: "CLOSER."',
                    choices: [
                        {
                            text: '"Show me more."',
                            effects: { corruption: 10, strength: 1 },
                            result: 'The vision expands. You see the seams of reality. When it ends, your hands crackle with stolen energy.'
                        },
                        {
                            text: 'Scream and run',
                            effects: { corruption: 3, hp: -8 },
                            result: 'You flee, but the voice echoes in your skull for hours. You collide with a bulkhead. Blood and clarity.'
                        },
                        {
                            text: 'Bargain: "What do you want?"',
                            effects: { corruption: 15, credits: 100 },
                            result: 'A pause. Then laughter that reshapes your neurons. When you come to, your pockets are heavy with credits that weren\'t there before.'
                        }
                    ]
                },
                {
                    title: 'The Mirror Cracks',
                    text: 'Every reflective surface on the station shows the wrong thing. Your reflection is mouthing words you can\'t hear. Then it stops mouthing and starts screaming.',
                    choices: [
                        {
                            text: 'Read its lips',
                            effects: { corruption: 12, drawCard: true, cardType: 'corrupted' },
                            result: 'The reflection teaches you something terrible. A technique that shouldn\'t exist. It burns going in.'
                        },
                        {
                            text: 'Smash the nearest mirror',
                            effects: { corruption: 5, hp: -3 },
                            result: 'Glass bites your knuckles. The reflections go quiet. For now.'
                        }
                    ]
                }
            ],
            void_claims: [
                {
                    title: 'The Void Claims',
                    text: 'Your body moves without your permission. You watch your own hand reach into a maintenance panel and pull out a pulsing mass of something that looks like crystallized screaming. Your mouth says "THANK YOU" in a voice that isn\'t yours.',
                    choices: [
                        {
                            text: 'Let it happen',
                            effects: { corruption: 15, maxHp: -10, strength: 2, dexterity: 1 },
                            result: 'The crystal sinks into your chest. Pain beyond description, then a terrible clarity. You are more than you were. And less.'
                        },
                        {
                            text: 'Fight for control',
                            effects: { corruption: 8, hp: -15 },
                            result: 'You wrestle your own body for what feels like hours. You win—barely. The crystal shatters. Something inside you shatters too.'
                        }
                    ]
                },
                {
                    title: 'The Price of Seeing',
                    text: 'You can see it now. The thing behind reality. It has no shape your mind can hold, so your brain fills in the gaps with the worst thing you\'ve ever seen, played on infinite repeat. You can\'t unsee it. But the seeing comes with... gifts.',
                    choices: [
                        {
                            text: 'Accept the gift',
                            effects: { corruption: 20, energy: 1, drawCard: true, cardType: 'corrupted' },
                            result: 'Your mind breaks and reforms in a shape that can hold more. The cost was your ability to sleep without screaming. Fair trade.'
                        },
                        {
                            text: 'Gouge out the seeing',
                            effects: { corruption: 5, hp: -20, purgeCorruptedCard: true },
                            result: 'You tear the vision out by force. Something tears with it—but it takes the worst of the corruption too. Blood runs from your nose, ears, eyes.'
                        },
                        {
                            text: 'Stare back',
                            effects: { corruption: 25, maxHp: -15, strength: 3, dexterity: 2 },
                            result: 'You hold its gaze. It blinks first. You\'ll never be afraid again. You\'ll never be entirely human again either.'
                        }
                    ]
                }
            ]
        };
        
        this.setupListeners();
        console.log('[CorruptionThresholds] ✓ System initialized');
    }
    
    setupListeners() {
        // Listen for corruption changes
        this.eventBus.on('corruption:gained', (amount) => {
            this.checkThresholds();
        });
        
        this.eventBus.on('corruption:changed', (level) => {
            this.checkThresholds();
        });
        
        // Reset thresholds on new run
        this.eventBus.on('run:start', () => {
            this.firedThresholds.clear();
            console.log('[CorruptionThresholds] Thresholds reset for new run');
        });
    }
    
    checkThresholds() {
        const corruption = this.state.get('corruption') || 0;
        
        for (const threshold of this.thresholds) {
            if (corruption >= threshold.level && !this.firedThresholds.has(threshold.level)) {
                this.firedThresholds.add(threshold.level);
                console.log(`[CorruptionThresholds] ⚡ Threshold crossed: ${threshold.level}% — ${threshold.name}`);
                
                // Small delay so it doesn't collide with whatever caused the corruption
                setTimeout(() => this.triggerMicroEvent(threshold), 800);
                
                // Only fire one threshold per check
                return;
            }
        }
    }
    
    triggerMicroEvent(threshold) {
        const pool = this.microEvents[threshold.id];
        if (!pool || pool.length === 0) return;
        
        // Pick random event from pool
        const event = pool[Math.floor(Math.random() * pool.length)];
        
        // Show the overlay
        this.showMicroEventOverlay(event, threshold);
    }
    
    showMicroEventOverlay(event, threshold) {
        // Remove any existing overlay
        const existing = document.getElementById('corruption-threshold-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'corruption-threshold-overlay';
        overlay.className = `threshold-${threshold.id}`;
        
        // Corruption intensity for visual scaling
        const intensity = threshold.level / 100;
        const glitchAmount = Math.floor(intensity * 5);
        
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.92); z-index: 2000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.5s ease;
            font-family: 'Courier New', monospace;
        `;
        
        const warningColor = threshold.level >= 75 ? '#ff0040' : 
                            threshold.level >= 50 ? '#bf00ff' : '#ff6600';
        
        let choicesHtml = event.choices.map((choice, i) => `
            <button class="threshold-choice" data-choice-index="${i}" style="
                display: block; width: 100%; padding: 12px 16px; margin: 6px 0;
                background: rgba(${threshold.level >= 75 ? '60,0,20' : threshold.level >= 50 ? '40,0,60' : '40,20,0'}, 0.8);
                border: 1px solid ${warningColor}44; border-radius: 4px;
                color: #e0e0e8; font-family: 'Courier New', monospace; font-size: 0.9rem;
                cursor: pointer; text-align: left; transition: all 0.2s ease;
            " onmouseover="this.style.borderColor='${warningColor}'; this.style.background='rgba(${threshold.level >= 75 ? '80,0,30' : threshold.level >= 50 ? '60,0,80' : '60,30,0'}, 0.9)'"
               onmouseout="this.style.borderColor='${warningColor}44'; this.style.background='rgba(${threshold.level >= 75 ? '60,0,20' : threshold.level >= 50 ? '40,0,60' : '40,20,0'}, 0.8)'"
            >${choice.text}</button>
        `).join('');
        
        overlay.innerHTML = `
            <div style="max-width: 500px; text-align: center; padding: 20px;">
                <div style="font-size: 0.7rem; letter-spacing: 0.4em; color: ${warningColor};
                    text-transform: uppercase; margin-bottom: 8px;
                    animation: thresholdFlicker 1.5s ease-in-out infinite;">
                    ⚠ CORRUPTION ${threshold.level}% ⚠
                </div>
                <div style="font-size: 1.4rem; color: ${warningColor}; margin-bottom: 16px;
                    text-shadow: 0 0 20px ${warningColor}80;
                    font-weight: bold; letter-spacing: 0.05em;">
                    ${event.title}
                </div>
                <div style="color: #c0c0d0; font-size: 0.95rem; line-height: 1.7;
                    margin-bottom: 24px; font-style: italic;">
                    ${event.text}
                </div>
                <div class="threshold-choices" style="text-align: left;">
                    ${choicesHtml}
                </div>
            </div>
            <style>
                @keyframes thresholdFlicker {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                    73% { opacity: 0.4; }
                    77% { opacity: 0.9; }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
        
        // Wire up choice buttons
        overlay.querySelectorAll('.threshold-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                const choiceIndex = parseInt(btn.dataset.choiceIndex);
                this.resolveChoice(event, choiceIndex, overlay, threshold);
            });
        });
        
        // Fade in
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });
        
        // Void whisper — intensity scales with corruption
        this.emitVoidWhisper(threshold.level);
    }
    
    resolveChoice(event, choiceIndex, overlay, threshold) {
        const choice = event.choices[choiceIndex];
        if (!choice) return;
        
        // Apply effects
        const effects = choice.effects || {};
        
        if (effects.corruption) {
            const current = this.state.get('corruption') || 0;
            this.state.set('corruption', Math.max(0, Math.min(100, current + effects.corruption)));
            if (effects.corruption > 0) {
                this.eventBus.emit('corruption:gained', effects.corruption);
            }
        }
        
        if (effects.hp) {
            const current = this.state.get('hero.hp') || 50;
            const newHp = Math.max(1, current + effects.hp);
            this.state.set('hero.hp', newHp);
            this.state.set('hero.hp', newHp);
        }
        
        if (effects.maxHp) {
            const currentMax = this.state.get('hero.maxHp') || 50;
            const newMax = Math.max(10, currentMax + effects.maxHp);
            this.state.set('hero.maxHp', newMax);
            this.state.set('hero.maxHp', newMax);
            
            // If maxHp increased, also heal that amount
            if (effects.maxHp > 0) {
                const hp = this.state.get('hero.hp') || 50;
                this.state.set('hero.hp', Math.min(newMax, hp + effects.maxHp));
                this.state.set('hero.hp', Math.min(newMax, hp + effects.maxHp));
            }
        }
        
        if (effects.credits) {
            const current = this.state.get('credits') || 0;
            this.state.set('credits', current + effects.credits);
        }
        
        if (effects.strength) {
            const current = this.state.get('combat.strength') || 0;
            this.state.set('combat.strength', current + effects.strength);
        }
        
        if (effects.dexterity) {
            const current = this.state.get('combat.dexterity') || 0;
            this.state.set('combat.dexterity', current + effects.dexterity);
        }
        
        if (effects.energy) {
            const current = this.state.get('combat.maxEnergy') || 3;
            this.state.set('combat.maxEnergy', current + effects.energy);
        }
        
        console.log(`[CorruptionThresholds] Choice resolved:`, effects);
        
        // Show result text
        this.showResult(choice.result, overlay, threshold);
    }
    
    showResult(resultText, overlay, threshold) {
        const warningColor = threshold.level >= 75 ? '#ff0040' : 
                            threshold.level >= 50 ? '#bf00ff' : '#ff6600';
        
        const inner = overlay.querySelector('div');
        if (inner) {
            inner.innerHTML = `
                <div style="color: ${warningColor}; font-size: 0.7rem; letter-spacing: 0.4em;
                    text-transform: uppercase; margin-bottom: 16px;">
                    ${threshold.name}
                </div>
                <div style="color: #d0d0e0; font-size: 1rem; line-height: 1.8;
                    font-style: italic; margin-bottom: 24px;">
                    ${resultText}
                </div>
                <button id="threshold-continue" style="
                    padding: 10px 30px; background: transparent;
                    border: 1px solid ${warningColor}66; border-radius: 4px;
                    color: ${warningColor}; font-family: 'Courier New', monospace;
                    font-size: 0.85rem; cursor: pointer; letter-spacing: 0.1em;
                    transition: all 0.2s ease;
                " onmouseover="this.style.borderColor='${warningColor}'; this.style.background='${warningColor}22'"
                   onmouseout="this.style.borderColor='${warningColor}66'; this.style.background='transparent'"
                >Continue</button>
            `;
            
            document.getElementById('threshold-continue')?.addEventListener('click', () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 500);
            });
        }
    }
    
    emitVoidWhisper(corruptionLevel) {
        const whispers = {
            25: [
                "it sees you now",
                "the hull remembers what it held",
                "don't look at the walls too long"
            ],
            50: [
                "you're almost ready",
                "the void is patient but you are not",
                "your bones know the frequency"
            ],
            75: [
                "welcome home",
                "there is no going back",
                "you and it are the same now"
            ]
        };
        
        const pool = whispers[corruptionLevel] || whispers[25];
        const whisper = pool[Math.floor(Math.random() * pool.length)];
        
        this.eventBus.emit('void:whisper', { 
            text: whisper, 
            intensity: corruptionLevel / 100 
        });
    }
    
    /**
     * Serialize for save/load
     */
    serialize() {
        return {
            firedThresholds: Array.from(this.firedThresholds)
        };
    }
    
    /**
     * Restore from saved state
     */
    deserialize(data) {
        if (data && data.firedThresholds) {
            this.firedThresholds = new Set(data.firedThresholds);
        }
    }
}
