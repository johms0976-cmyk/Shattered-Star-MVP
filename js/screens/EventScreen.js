/**
 * EventScreen.js - Enhanced Narrative Event System
 * 
 * Features:
 * - Typewriter text effects for atmosphere
 * - Dread-aware presentation
 * - Void whisper integration
 * - Weighted choices with visible consequences
 * - Atmospheric sound hooks
 * - Void Fragment rewards via fragment effect type
 * 
 * Event System v2 Integration:
 * - Layer 1: Event history tracking (no repeats)
 * - Layer 2: Flag-gated choices (locked until prerequisites met)
 * - Layer 3: Event chain unlocking (choices unlock future events)
 * - Layer 4: Enhanced effects processing (insight buffs, flags, unlocks)
 * - Layer 5: Every choice has mechanical consequences
 * 
 * "Every choice is a scar. Every scar tells a story."
 */

import { showFragmentReward } from '../ui/FragmentRewardOverlay.js';

export function setupEventScreen(game) {
    const screen = document.getElementById('event-screen');
    
    console.log('[EventScreen] Initializing enhanced narrative system...');
    
    // Typewriter state
    let typewriterInterval = null;
    let skipTypewriter = false;
    
    // Current event state
    let currentEvent = null;
    let atmosphereText = null;
    
    // Guard to prevent double initialization (same pattern as CombatScreen)
    let isInitializing = false;
    let lastInitTime = 0;
    
    // Listen for screen transitions
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'event-screen') {
            console.log('[EventScreen] Screen shown, initializing...');
            safeInitializeEvent();
        }
    });
    
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'event-screen') {
            safeInitializeEvent();
        }
    });
    
    // Listen for narrative atmosphere updates
    game.eventBus.on('narrative:atmosphere', (text) => {
        atmosphereText = text;
    });
    
    /**
     * Safe wrapper to prevent double initialization
     */
    function safeInitializeEvent() {
        const now = Date.now();
        if (isInitializing || (now - lastInitTime) < 500) {
            console.log('[EventScreen] Skipping duplicate initialization');
            return;
        }
        isInitializing = true;
        lastInitTime = now;
        
        try {
            initializeEventScreen();
        } finally {
            isInitializing = false;
        }
    }
    
    /**
     * Initialize the event screen
     */
    function initializeEventScreen() {
        console.log('[EventScreen] Initializing event...');
        skipTypewriter = false;
        
        // Clear any existing typewriter
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        
        // Get current event from state
        currentEvent = game.state.get('event.currentEvent');
        
        if (!currentEvent) {
            console.log('[EventScreen] No event in state, generating random event');
            currentEvent = generateRandomEvent();
            game.state.set('event.currentEvent', currentEvent);
        }
        
        if (currentEvent) {
            renderEventWithAtmosphere(currentEvent);
        } else {
            console.error('[EventScreen] No event to display');
            completeEvent();
        }
    }
    
    /**
     * Generate a random event based on game state
     */
    function generateRandomEvent() {
        const act = game.state.get('act') || 1;
        const corruption = game.state.get('corruption') || 0;
        const hero = game.state.get('hero.id') || 'korvax';
        
        try {
            // Try to get event from data loader (pass eventManager for v2 selection)
            const event = game.dataLoader?.getRandomEvent?.(act, corruption, hero, game.eventManager);
            if (event) return event;
        } catch (e) {
            console.warn('[EventScreen] Failed to get event from loader:', e);
        }
        
        return getFallbackEvent(corruption);
    }
    
    /**
     * Get a fallback event with horror atmosphere
     */
    function getFallbackEvent(corruption) {
        const dread = game.narrativeSystem?.dread || 0;
        
        // Events scaled to corruption/dread
        const fallbackEvents = [
            // Low corruption events
            {
                id: 'dying_traveler',
                name: 'The Last Breath',
                description: 'A figure lies against the rusted hull of a collapsed transport. Their breathing is shallow, their eyes unfocused. They clutch something to their chest—a data chip, glowing faintly with residual power.',
                image: null,
                minCorruption: 0,
                choices: [
                    {
                        text: 'Help them (Lose 5 HP)',
                        outcome: {
                            type: 'mixed',
                            description: 'You bind their wounds with scraps from your own supplies. Their eyes focus on you for a moment of terrible clarity. "The Heralds..." they whisper. "They\'re not guards. They\'re prisons." The data chip contains coordinates—and warnings.',
                            hp: -5,
                            lore: 'herald_truth',
                            card: null
                        }
                    },
                    {
                        text: 'Take the data chip',
                        outcome: {
                            type: 'reward',
                            description: 'You pry the chip from their weakening grip. Their eyes follow your hand, understanding and despair mingling in their final gaze. The chip hums with encrypted secrets.',
                            credits: 40
                        }
                    },
                    {
                        text: 'Walk away',
                        outcome: {
                            type: 'safe',
                            description: 'Some stories end without your participation. You walk on, but their labored breathing echoes in your mind. In the distance, something laughs.'
                        }
                    }
                ]
            },
            
            // Medium events
            {
                id: 'void_reflection',
                name: 'The Mirror That Lies',
                description: 'A pool of absolute darkness fills a crater in your path. Your reflection stares back—but it moves independently, mirroring gestures you haven\'t made yet. It holds out its hand, offering something that shifts between a card and a wound.',
                image: null,
                minCorruption: 10,
                choices: [
                    {
                        text: 'Reach into the reflection',
                        outcome: {
                            type: 'corruption_reward',
                            description: 'Your hand passes through the surface like cold fire. For an instant, you ARE the reflection—seeing yourself from the outside, a puppet made of meat and denial. When you pull back, something new lives in your deck. And something new lives in your mind.',
                            corruption: 8,
                            card: 'void_fragment'
                        }
                    },
                    {
                        text: 'Shatter the mirror',
                        outcome: {
                            type: 'damage',
                            description: 'You drive your fist into the pool. Reality SCREAMS. Glass that doesn\'t exist cuts you in places that shouldn\'t bleed. When you look again, the pool is gone—but you can still see it. In every reflection. Watching.',
                            damage: 12
                        }
                    },
                    {
                        text: 'Close your eyes and pass',
                        outcome: {
                            type: 'safe',
                            description: 'You navigate by sound and memory, eyes sealed shut. The reflection\'s whispered protests fade behind you. But when you finally look back, you swear you see it wave goodbye. With your hand.'
                        }
                    }
                ]
            },
            
            // High corruption events
            {
                id: 'void_offering',
                name: 'The Generous Dark',
                description: 'The shadows peel away from the walls, coalescing into something almost-human. It speaks without a mouth: "You\'ve come so far. Let us help you go further." Its hand opens to reveal power made manifest—a card that burns with void-light.',
                image: null,
                minCorruption: 25,
                choices: [
                    {
                        text: 'Accept the gift',
                        outcome: {
                            type: 'corruption_reward',
                            description: 'The power flows into you like liquid night. Your vision fractures—for a moment you see yourself from THEIR perspective, so small, so temporary, so... appetizing. But the power is real. The power is yours. For now.',
                            corruption: 15,
                            card: 'void_embrace'
                        }
                    },
                    {
                        text: 'Demand more',
                        outcome: {
                            type: 'gamble',
                            description: 'Greed speaks to greed. The shadow-thing LAUGHS—a sound like reality tearing. "We like you," it says. "We\'ll give you everything. Eventually." The power that floods into you is vast. The price will be vaster.',
                            corruption: 25,
                            card: 'void_pact',
                            maxHp: 5
                        }
                    },
                    {
                        text: 'Reject the void',
                        outcome: {
                            type: 'purify',
                            description: 'You turn away, and the shadow-thing\'s almost-face twists with something like respect. Or hunger. "We\'ll wait," it promises. "We always do." The corruption in you recoils from your defiance, weakening its grip.',
                            corruption: -10
                        }
                    }
                ]
            },
            
            // Void Fragment event (corruption encounter offering a fragment)
            {
                id: 'void_fragment_discovery',
                name: 'The Singing Shard',
                description: 'A crystalline fragment hovers in the air, suspended by invisible forces. It pulses with a violet light that beats like a second heart. As you approach, you hear it—a frequency below sound, a vibration in your bones. The shard wants to be held. The shard wants to be used.',
                image: null,
                minCorruption: 15,
                choices: [
                    {
                        text: 'Take the shard',
                        outcome: {
                            type: 'corruption_reward',
                            description: 'The moment your fingers close around it, the shard dissolves into your skin. For an instant you see the world in new dimensions—numbers behind the matter, equations beneath the light. A new fragment of the void has bound itself to your essence.',
                            corruption: 5,
                            fragment: 'random'
                        }
                    },
                    {
                        text: 'Study it carefully',
                        outcome: {
                            type: 'lore',
                            description: 'You observe without touching. The shard\'s patterns are Architect-made—a deliberate tool, not a natural formation. It was designed to augment consciousness. To make the bearer more. Or less. The knowledge alone is valuable.',
                            corruption: 2,
                            lore: 'void_fragment_lore',
                            credits: 30
                        }
                    },
                    {
                        text: 'Destroy it',
                        outcome: {
                            type: 'purify',
                            description: 'You crush the shard beneath your boot. It screams—a sound like glass and grief—and shatters into harmless dust. The void\'s grip on this place weakens slightly. Sometimes the bravest choice is refusal.',
                            corruption: -5
                        }
                    }
                ]
            },
            
            // Environmental mystery
            {
                id: 'architects_echo',
                name: 'Echoes of the Builders',
                description: 'An ancient terminal flickers to life as you approach, displaying symbols in a language that predates humanity. The screen shows a diagram—a planet, four marks around it, and something vast beneath. A recording begins to play, corrupted but partially comprehensible.',
                image: null,
                minCorruption: 0,
                choices: [
                    {
                        text: 'Listen to the full recording',
                        outcome: {
                            type: 'lore',
                            description: '"...the Seals are not prisons," the ancient voice says. "They are... lobotomies. We cut away pieces of the Pattern\'s mind. But consciousness... finds ways. The Heralds are not guards. They are the wounds we made, infected and aware. We thought we were saving a world. We were only... delaying..." The recording dissolves into static. Into whispers.',
                            corruption: 3,
                            lore: 'architect_warning'
                        }
                    },
                    {
                        text: 'Download tactical data only',
                        outcome: {
                            type: 'reward',
                            description: 'You filter the feed for combat-relevant data. Maps, weak points, patrol patterns. The Architects knew how to fight—they just forgot how to win. One of your techniques sharpens with their ancient knowledge.',
                            upgrade: 'random'
                        }
                    },
                    {
                        text: 'Destroy the terminal',
                        outcome: {
                            type: 'safe',
                            description: 'Some knowledge is better left buried. You reduce the terminal to sparking scrap. But as it dies, you could swear the screen displayed one final message: "TOO LATE."',
                            credits: 25
                        }
                    }
                ]
            },
            
            // Faction encounter
            {
                id: 'rustborn_judgment',
                name: 'Trial by Rust',
                description: 'Rustborn warriors emerge from the scrap, surrounding you. Their leader—scarred, augmented, ancient—studies you with eyes like corroded coins. "Outsider walks the Titan\'s grave," they intone. "Outsider must prove worth. Or feed the rust."',
                image: null,
                minCorruption: 0,
                choices: [
                    {
                        text: 'Accept their trial (Fight)',
                        outcome: {
                            type: 'combat',
                            description: 'You nod. The circle parts, and a champion steps forward—half human, half machine, all violence. Win or lose, the Tribes will remember how you fought.',
                            combat: 'rustborn_champion',
                            reputation: { rustborn: 2 }
                        }
                    },
                    {
                        text: 'Offer tribute (50 credits)',
                        outcome: {
                            type: 'payment',
                            description: 'Credits change hands. The leader\'s expression doesn\'t change, but their warriors part. "Outsider buys passage. Passage is not respect." You walk through, feeling their stares like knife-points on your back.',
                            credits: -50,
                            reputation: { rustborn: 0 }
                        },
                        requirement: { minCredits: 50 }
                    },
                    {
                        text: 'Invoke the old laws',
                        outcome: {
                            type: 'special',
                            description: 'You speak a phrase from before the Fall—words the Architects used when treating with the first Rustborn. The warriors freeze. The leader\'s eyes widen. "You... know the Words." They bow, once, stiffly. "Walk free, Word-keeper. Walk careful."',
                            reputation: { rustborn: 3 },
                            requirement: { lore: 'architect_protocol' }
                        }
                    }
                ]
            }
        ];
        
        // Filter events by corruption requirement
        const availableEvents = fallbackEvents.filter(e => 
            (e.minCorruption || 0) <= corruption
        );
        
        // Weight toward higher corruption events if applicable
        if (corruption > 25 && availableEvents.some(e => e.minCorruption >= 10)) {
            const highCorruptionEvents = availableEvents.filter(e => e.minCorruption >= 10);
            if (Math.random() < 0.6) {
                return highCorruptionEvents[Math.floor(Math.random() * highCorruptionEvents.length)];
            }
        }
        
        return availableEvents[Math.floor(Math.random() * availableEvents.length)];
    }
    
    /**
     * Render event with atmospheric introduction
     */
    function renderEventWithAtmosphere(event) {
        console.log(`[EventScreen] Rendering event: ${event.name || event.id}`);
        
        const titleEl = document.getElementById('event-title');
        const descEl = document.getElementById('event-text');
        const imageEl = document.getElementById('event-image');
        const choicesEl = document.getElementById('event-choices');
        
        // Clear existing content
        if (titleEl) titleEl.textContent = '';
        if (descEl) descEl.innerHTML = '';
        if (choicesEl) choicesEl.innerHTML = '';
        
        // Set event image/atmosphere
        if (imageEl) {
            imageEl.style.display = 'block';
            // Add atmospheric gradient based on dread
            const dread = game.narrativeSystem?.dread || 0;
            const voidTint = Math.min(0.5, dread / 200);
            imageEl.style.background = `linear-gradient(180deg, 
                rgba(10, 10, 26, 0.8) 0%, 
                rgba(${Math.floor(100 * voidTint)}, 0, ${Math.floor(150 * voidTint)}, ${0.3 + voidTint}) 100%)`;
        }
        
        // Play atmosphere sound
        game.audioManager?.playSFX?.('event_appear');
        
        // Add dread class to container
        const container = document.querySelector('.event-container');
        if (container) {
            container.className = 'event-container dread-' + (game.narrativeSystem?.getDreadLevel?.() || 'calm');
        }
        
        // Build content sequence
        const sequence = [];
        
        // Add atmospheric intro if available
        if (atmosphereText) {
            sequence.push({
                element: descEl,
                text: atmosphereText,
                class: 'atmosphere-text',
                delay: 0
            });
            sequence.push({ pause: 1500 });
        }
        
        // Add title
        sequence.push({
            element: titleEl,
            text: event.name || 'Unknown Event',
            class: 'event-title-text',
            delay: 0,
            instant: true
        });
        
        // Add main description
        sequence.push({
            element: descEl,
            text: event.description || event.text || '',
            class: 'event-description',
            delay: 500,
            append: true
        });
        
        // Execute sequence
        executeTypewriterSequence(sequence, () => {
            // Show choices after text completes
            renderChoices(event.choices || [], choicesEl);
        });
        
        // Allow skipping typewriter
        screen.onclick = () => {
            skipTypewriter = true;
        };
    }
    
    /**
     * Execute a sequence of typewriter effects
     */
    function executeTypewriterSequence(sequence, onComplete) {
        let currentIndex = 0;
        
        function processNext() {
            if (currentIndex >= sequence.length) {
                onComplete?.();
                return;
            }
            
            const item = sequence[currentIndex];
            currentIndex++;
            
            if (item.pause) {
                if (skipTypewriter) {
                    processNext();
                } else {
                    setTimeout(processNext, item.pause);
                }
                return;
            }
            
            if (item.instant || skipTypewriter) {
                if (item.append && item.element.innerHTML) {
                    item.element.innerHTML += `<p class="${item.class || ''}">${item.text}</p>`;
                } else if (item.append) {
                    item.element.innerHTML = `<p class="${item.class || ''}">${item.text}</p>`;
                } else {
                    item.element.innerHTML = `<span class="${item.class || ''}">${item.text}</span>`;
                }
                setTimeout(processNext, 100);
                return;
            }
            
            // Typewriter effect
            setTimeout(() => {
                typewriterText(item.element, item.text, item.class, item.append, () => {
                    setTimeout(processNext, 300);
                });
            }, item.delay || 0);
        }
        
        processNext();
    }
    
    /**
     * Typewriter text effect
     */
    function typewriterText(element, text, className, append, onComplete) {
        if (!element || !text) {
            onComplete?.();
            return;
        }
        
        // Create container for this text
        const wrapper = document.createElement(append ? 'p' : 'span');
        wrapper.className = className || '';
        
        if (append) {
            element.appendChild(wrapper);
        } else {
            element.innerHTML = '';
            element.appendChild(wrapper);
        }
        
        let charIndex = 0;
        const speed = 20; // ms per character
        
        // Clear any existing interval
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
        }
        
        typewriterInterval = setInterval(() => {
            if (skipTypewriter) {
                wrapper.textContent = text;
                clearInterval(typewriterInterval);
                typewriterInterval = null;
                onComplete?.();
                return;
            }
            
            if (charIndex < text.length) {
                wrapper.textContent += text[charIndex];
                charIndex++;
                
                // Play subtle typing sound occasionally
                if (charIndex % 5 === 0) {
                    game.audioManager?.playSFX?.('text_tick', 0.1);
                }
            } else {
                clearInterval(typewriterInterval);
                typewriterInterval = null;
                onComplete?.();
            }
        }, speed);
    }
    
    /**
     * Render choice buttons with hover effects
     */
    function renderChoices(choices, container) {
        if (!container) return;
        
        container.innerHTML = '';
        container.style.opacity = '0';
        
        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'event-choice';
            
            // Check requirements (delegates to EventManager for flag checks)
            const meetsRequirements = checkRequirements(choice.requirement || choice.requirements);
            
            if (!meetsRequirements) {
                button.classList.add('disabled', 'choice-locked');
                button.disabled = true;
            }
            
            // Add consequence hints
            const consequenceHint = getConsequenceHint(choice);
            
            // Build lock hint for flag-gated choices
            let lockHint = '';
            if (!meetsRequirements && (choice.requirement || choice.requirements)) {
                const req = choice.requirement || choice.requirements;
                lockHint = getRequirementHint(req);
            }
            
            // Check for flag-bonus indicator (choice enhanced by prior knowledge)
            let bonusHtml = '';
            const em = game.eventManager;
            if (em && choice.flagBonus && em.hasFlag(choice.flagBonus)) {
                bonusHtml = '<span class="choice-bonus">✦ Enhanced by prior knowledge</span>';
            }
            
            button.innerHTML = `
                <span class="choice-text">${choice.text}</span>
                ${consequenceHint ? `<span class="choice-hint">${consequenceHint}</span>` : ''}
                ${bonusHtml}
                ${lockHint ? `<span class="choice-locked-hint">🔒 ${lockHint}</span>` : ''}
            `;
            
            button.addEventListener('click', () => {
                if (!meetsRequirements) return;
                
                game.audioManager?.playSFX?.('ui_click');
                
                // Remove click handler from screen
                screen.onclick = null;
                
                // Disable all buttons
                container.querySelectorAll('.event-choice').forEach(btn => {
                    btn.disabled = true;
                    if (btn !== button) btn.classList.add('not-chosen');
                });
                button.classList.add('chosen');
                
                // Process choice after brief delay
                setTimeout(() => handleChoice(choice), 500);
            });
            
            // Staggered appearance
            button.style.opacity = '0';
            button.style.transform = 'translateY(10px)';
            container.appendChild(button);
            
            setTimeout(() => {
                button.style.transition = 'opacity 0.3s, transform 0.3s';
                button.style.opacity = '1';
                button.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        });
        
        // Fade in container
        setTimeout(() => {
            container.style.transition = 'opacity 0.5s';
            container.style.opacity = '1';
        }, 50);
    }
    
    /**
     * Check if requirements are met
     */
    function checkRequirements(req) {
        if (!req) return true;
        
        // Delegate to EventManager for comprehensive requirement checking (v2)
        const em = game.eventManager;
        if (em) {
            return em.checkRequirements(req);
        }
        
        // Legacy fallback if EventManager not available
        if (req.minCredits) {
            const credits = game.state.get('credits') || 0;
            if (credits < req.minCredits) return false;
        }
        
        if (req.minCorruption) {
            const corruption = game.state.get('corruption') || 0;
            if (corruption < req.minCorruption) return false;
        }
        
        if (req.maxCorruption) {
            const corruption = game.state.get('corruption') || 0;
            if (corruption > req.maxCorruption) return false;
        }
        
        if (req.hero) {
            const hero = game.state.get('hero.id');
            if (hero !== req.hero) return false;
        }
        
        if (req.lore) {
            const discovered = game.narrativeSystem?.loreDiscovered || new Set();
            if (!discovered.has(req.lore)) return false;
        }
        
        if (req.deckSize) {
            const deck = game.state.get('deck') || [];
            if (deck.length < req.deckSize) return false;
        }
        
        // Flag requirements (legacy without EventManager)
        if (req.flags) {
            const flags = game.state.get('flags') || {};
            if (!req.flags.every(f => flags[f])) return false;
        }
        
        return true;
    }
    
    /**
     * Get consequence hint for choice
     */
    function getConsequenceHint(choice) {
        const outcome = choice.outcome || choice.effects || {};
        const hints = [];
        
        // Check both direct effects and outcome effects
        const effects = { ...choice.effects, ...outcome };
        
        if (effects.hp && effects.hp < 0) hints.push(`${effects.hp} HP`);
        if (effects.damage) hints.push(`-${effects.damage} HP`);
        if (effects.heal) hints.push(`+${effects.heal} HP`);
        if (effects.healPercent) hints.push(`+${effects.healPercent}% HP`);
        if (effects.credits > 0) hints.push(`+${effects.credits}◈`);
        if (effects.credits < 0) hints.push(`${effects.credits}◈`);
        if (effects.corruption > 0) hints.push(`+${effects.corruption} Corruption`);
        if (effects.corruption < 0) hints.push(`${effects.corruption} Corruption`);
        if (effects.card) hints.push('+Card');
        if (effects.artifact) hints.push('+Relic');
        if (effects.fragment) hints.push('👁️ +Void Fragment');
        if (effects.upgrade) hints.push('Upgrade');
        if (effects.removeCard) hints.push('Remove Card');
        if (effects.maxHp > 0) hints.push(`+${effects.maxHp} Max HP`);
        if (effects.maxHp < 0) hints.push(`${effects.maxHp} Max HP`);
        if (effects.combat) hints.push('⚔️ Combat');
        // v2: New effect type hints
        if (effects.lore) hints.push('📖 Knowledge');
        if (effects.insight) hints.push(`⚡+${effects.insight} Insight`);
        if (effects.block) hints.push(`🛡️+${effects.block} Block`);
        if (effects.viewNextNodes) hints.push('🗺️ Reveal Map');
        if (effects.status) {
            Object.entries(effects.status).forEach(([s, v]) => {
                hints.push(`⚡+${v} ${s.charAt(0).toUpperCase() + s.slice(1)}`);
            });
        }
        
        return hints.length > 0 ? `[${hints.join(', ')}]` : '';
    }
    
    /**
     * Get human-readable hint about why a choice is locked (v2)
     */
    function getRequirementHint(req) {
        if (!req) return '';
        
        if (req.flags && req.flags.length > 0) {
            return `Requires: ${req.flags.map(f => f.replace(/_/g, ' ')).join(', ')}`;
        }
        if (req.minCredits) {
            return `Requires ${req.minCredits} credits`;
        }
        if (req.minCorruption) {
            return `Requires ${req.minCorruption}+ corruption`;
        }
        if (req.minReputation) {
            const entries = Object.entries(req.minReputation);
            return entries.map(([f, v]) => `Requires ${f} rep ${v}+`).join(', ');
        }
        if (req.lore) {
            return `Requires: ${req.lore.replace(/_/g, ' ')}`;
        }
        if (req.eventSeen) {
            return 'Requires completing a prior event';
        }
        if (req.deckSize) {
            return `Requires ${req.deckSize}+ cards in deck`;
        }
        
        return 'Requirements not met';
    }
    
    /**
     * Handle player choice
     */
    function handleChoice(choice) {
        const outcome = choice.outcome || {};
        const effects = choice.effects || {};
        
        // Combine effects from both structures
        const allEffects = { ...effects, ...outcome };
        
        console.log(`[EventScreen] Processing choice: ${choice.text}`);
        
        // ── v2: Process EventManager effects (flags, unlocks, insights) ──
        const em = game.eventManager;
        if (em) {
            // Record choice
            const choiceIndex = currentEvent?.choices?.indexOf(choice) ?? -1;
            
            // Set flags from this choice
            if (allEffects.setsFlags) {
                const flags = Array.isArray(allEffects.setsFlags) 
                    ? allEffects.setsFlags : [allEffects.setsFlags];
                flags.forEach(flag => em.setFlag(flag));
            }
            
            // Unlock chain events
            if (allEffects.unlocks) {
                const unlocks = Array.isArray(allEffects.unlocks)
                    ? allEffects.unlocks : [allEffects.unlocks];
                unlocks.forEach(id => em.unlockEvent(id));
            }
            
            // Queue insight buffs for next combat
            if (allEffects.insight) {
                em.addInsight({
                    label: allEffects.insightLabel || choice.text,
                    strength: allEffects.insight.strength || 0,
                    block: allEffects.insight.block || 0,
                    draw: allEffects.insight.draw || 0,
                    source: currentEvent?.id || 'unknown'
                });
            }
        }
        
        // Get narrative-enhanced description
        let resultText = outcome.description || outcome.result || allEffects.result || 
                        'The choice is made. The consequences unfold.';
        
        // Add void flavor if appropriate
        resultText = game.narrativeSystem?.getOutcomeNarrative?.(
            { description: resultText }, 
            choice
        ) || resultText;
        
        // Process mechanical effects (hp, credits, corruption, etc.)
        processEffects(allEffects);
        
        // Check for combat trigger
        if (allEffects.combat || allEffects.type === 'combat') {
            showOutcomeWithCombat(resultText, allEffects);
            return;
        }
        
        // Show outcome with effect summary
        showOutcome(resultText, allEffects);
    }
    
    /**
     * Process event effects
     */
    function processEffects(effects) {
        // HP changes
        if (effects.hp) {
            const currentHp = game.state.get('hero.hp') || 50;
            const maxHp = game.state.get('hero.maxHp') || 80;
            const newHp = Math.min(maxHp, Math.max(0, currentHp + effects.hp));
            game.state.set('hero.hp', newHp);
            
            if (effects.hp < 0) {
                game.eventBus.emit('player:damage', Math.abs(effects.hp));
            } else {
                game.eventBus.emit('heal', effects.hp);
            }
            game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
        }
        
        if (effects.damage) {
            const currentHp = game.state.get('hero.hp') || 50;
            const maxHp = game.state.get('hero.maxHp') || 80;
            const newHp = Math.max(0, currentHp - effects.damage);
            game.state.set('hero.hp', newHp);
            game.eventBus.emit('player:damage', effects.damage);
            game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
            
            if (newHp <= 0) {
                setTimeout(() => game.eventBus.emit('player:death'), 1500);
            }
        }
        
        if (effects.heal) {
            const currentHp = game.state.get('hero.hp') || 50;
            const maxHp = game.state.get('hero.maxHp') || 80;
            const newHp = Math.min(maxHp, currentHp + effects.heal);
            game.state.set('hero.hp', newHp);
            game.eventBus.emit('heal', effects.heal);
            game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
        }
        
        if (effects.healPercent) {
            const maxHp = game.state.get('hero.maxHp') || 80;
            const healAmount = Math.floor(maxHp * (effects.healPercent / 100));
            const currentHp = game.state.get('hero.hp') || 50;
            const newHp = Math.min(maxHp, currentHp + healAmount);
            game.state.set('hero.hp', newHp);
            game.eventBus.emit('heal', healAmount);
            game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
        }
        
        // Max HP changes
        if (effects.maxHp) {
            const currentMax = game.state.get('hero.maxHp') || 80;
            const newMax = Math.max(1, currentMax + effects.maxHp);
            game.state.set('hero.maxHp', newMax);
            
            // Also adjust current HP if maxHp decreased
            const currentHp = game.state.get('hero.hp') || 50;
            if (currentHp > newMax) {
                game.state.set('hero.hp', newMax);
            }
            
            game.eventBus.emit('maxHp:changed', { max: newMax });
        }
        
        // Credits
        if (effects.credits) {
            const current = game.state.get('credits') || 0;
            const newCredits = Math.max(0, current + effects.credits);
            game.state.set('credits', newCredits);
            
            if (effects.credits > 0) {
                game.eventBus.emit('credits:gained', effects.credits);
            } else {
                game.eventBus.emit('credits:spent', Math.abs(effects.credits));
            }
        }
        
        // Corruption
        if (effects.corruption) {
            const current = game.state.get('corruption') || 0;
            const newCorruption = Math.max(0, Math.min(100, current + effects.corruption));
            game.state.set('corruption', newCorruption);
            game.eventBus.emit('corruption:changed', { 
                current: newCorruption, 
                previous: current,
                delta: effects.corruption
            });
            
            // Corruption gain triggers void response
            if (effects.corruption > 0 && game.narrativeSystem) {
                game.narrativeSystem.addDread(Math.floor(effects.corruption / 2));
            }
        }
        
        // Card rewards
        if (effects.card) {
            console.log('[EventScreen] Card reward:', effects.card);
            const heroId = game.state.get('hero.id') || 'korvax';
            let fullCard = null;
            
            // Try to look up the full card data
            try {
                fullCard = game.dataLoader?.getCard?.(heroId, effects.card) 
                        || game.dataLoader?.getCard?.(effects.card);
            } catch (e) {
                console.warn('[EventScreen] Failed to look up card:', e);
            }
            
            if (fullCard) {
                // Add instance ID and push to deck
                fullCard.instanceId = `${fullCard.id}_event_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                const deck = game.state.get('deck') || [];
                deck.push(fullCard);
                game.state.set('deck', deck);
                console.log(`[EventScreen] Added card to deck: ${fullCard.name}`);
                game.eventBus.emit('card:obtained', fullCard);
            } else {
                // Fallback: emit event and let other systems handle it
                console.warn(`[EventScreen] Card '${effects.card}' not found in data, emitting event`);
                game.eventBus.emit('card:obtained', { id: effects.card });
            }
        }
        
        // Artifact rewards
        if (effects.artifact) {
            let enrichedArtifact = { id: effects.artifact };
            
            // Try to enrich the artifact with full data (name, description, effects)
            try {
                // Method 1: Use RewardSystem's enrichArtifact (has the effects table)
                if (game.rewards?.enrichArtifact) {
                    enrichedArtifact = game.rewards.enrichArtifact({ id: effects.artifact });
                }
                
                // Method 2: If still no name, try DataLoader
                if (!enrichedArtifact.name && game.dataLoader?.getArtifact) {
                    const fromData = game.dataLoader.getArtifact(effects.artifact);
                    if (fromData) {
                        // Merge: keep effects from RewardSystem if available, else use DataLoader data
                        enrichedArtifact = {
                            ...fromData,
                            effects: enrichedArtifact.effects || fromData.effects || {}
                        };
                    }
                }
                
                // Method 3: If still no name, try the RewardSystem effects table directly
                if (!enrichedArtifact.name && game.rewards?.artifactEffects?.[effects.artifact]) {
                    const known = game.rewards.artifactEffects[effects.artifact];
                    enrichedArtifact = {
                        id: effects.artifact,
                        name: known.name,
                        description: known.description,
                        rarity: known.rarity,
                        effects: known.effects || {}
                    };
                }
            } catch (e) {
                console.warn('[EventScreen] Failed to enrich artifact:', e);
            }
            
            // Ensure artifact has at minimum an id and name
            if (!enrichedArtifact.name) {
                enrichedArtifact.name = effects.artifact.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                enrichedArtifact.description = 'A mysterious relic from the void.';
                enrichedArtifact.effects = enrichedArtifact.effects || {};
            }
            
            // Add to player artifacts
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(enrichedArtifact);
            game.state.set('artifacts', artifacts);
            
            // Apply immediate artifact effects (like maxHp)
            if (game.rewards?.applyImmediateArtifactEffects) {
                game.rewards.applyImmediateArtifactEffects(enrichedArtifact);
            } else if (enrichedArtifact.effects?.maxHp) {
                // Fallback: apply maxHp manually
                const currentMax = game.state.get('hero.maxHp') || 80;
                const newMax = currentMax + enrichedArtifact.effects.maxHp;
                game.state.set('hero.maxHp', newMax);
                const currentHp = game.state.get('hero.hp') || 50;
                game.state.set('hero.hp', Math.min(newMax, currentHp + enrichedArtifact.effects.maxHp));
            }
            
            console.log(`[EventScreen] Artifact gained: ${enrichedArtifact.name}`, enrichedArtifact.effects);
            game.eventBus.emit('artifact:gained', enrichedArtifact);
        }
        
        // Lore discovery
        if (effects.lore) {
            game.narrativeSystem?.discoverLore?.(effects.lore);
            // v2: Also set as EventManager flag for requirement checking
            const em = game.eventManager;
            if (em) em.setFlag(effects.lore);
        }
        
        // Void Fragment rewards
        if (effects.fragment) {
            console.log('[EventScreen] Fragment reward triggered:', effects.fragment);
            
            // If a specific fragment ID is given, collect it directly
            if (typeof effects.fragment === 'string' && effects.fragment !== 'random') {
                const fragmentSystem = game.voidSystems?.fragments;
                if (fragmentSystem) {
                    fragmentSystem.collectFragment(effects.fragment);
                    const unlocked = fragmentSystem.getUnlockedSlots();
                    if (fragmentSystem.equippedFragments.length < unlocked) {
                        fragmentSystem.equipFragment(effects.fragment);
                    }
                    game.eventBus.emit('fragment:acquired', { 
                        fragment: fragmentSystem.fragmentDatabase[effects.fragment], 
                        source: 'event' 
                    });
                    console.log(`[EventScreen] Fragment collected: ${effects.fragment}`);
                }
            } else {
                // Show pick-one-of-three overlay
                const pool = effects.fragmentPool || 'common,uncommon';
                setTimeout(() => {
                    showFragmentReward(game, {
                        pool,
                        count: 3,
                        source: 'event',
                        allowSkip: true,
                        onComplete: () => {} // Event continues normally
                    });
                }, 300);
            }
        }
        
        // Faction reputation
        if (effects.reputation) {
            Object.entries(effects.reputation).forEach(([faction, change]) => {
                const key = `factions.${faction}`;
                const current = game.state.get(key) || 0;
                game.state.set(key, current + change);
                game.eventBus.emit('faction:changed', { faction, change, current: current + change });
            });
        }
        
        // ── v2: Additional effect types ──────────────────────────────
        
        // Direct block gain (applied at event, not combat)
        if (effects.block && typeof effects.block === 'number') {
            const currentBlock = game.state.get('hero.block') || 0;
            game.state.set('hero.block', currentBlock + effects.block);
            game.eventBus.emit('block:gained', effects.block);
        }
        
        // Status effects (applied next combat start)
        if (effects.status && typeof effects.status === 'object') {
            // Queue as insight-like buff for next combat
            const em = game.eventManager;
            if (em) {
                em.addInsight({
                    label: 'Event status effect',
                    status: effects.status,
                    source: 'event'
                });
            }
        }
        
        // Card upgrade (random card in deck)
        if (effects.upgrade) {
            console.log('[EventScreen] Card upgrade triggered:', effects.upgrade);
            
            // Show card selection for upgrade after a short delay
            // (so the outcome text is visible first)
            setTimeout(() => {
                showEventUpgradeSelection(effects.upgrade);
            }, 300);
        }
        
        // Card removal
        if (effects.removeCard) {
            game.eventBus.emit('card:remove', { target: effects.removeCard });
            console.log('[EventScreen] Card removal triggered:', effects.removeCard);
        }
        
        // Map reveal
        if (effects.viewNextNodes) {
            game.eventBus.emit('map:reveal', { count: effects.viewNextNodes });
            console.log('[EventScreen] Map reveal triggered');
        }
        
        // Random effect (one of several outcomes)
        if (effects.random && Array.isArray(effects.random)) {
            const pick = effects.random[Math.floor(Math.random() * effects.random.length)];
            console.log('[EventScreen] Random effect picked:', pick);
            processEffects(pick);
        }
    }
    
    /**
     * Show outcome text
     */
    function showOutcome(text, effects = {}) {
        const descEl = document.getElementById('event-text');
        const choicesEl = document.getElementById('event-choices');
        
        // Build effect summary (v2)
        const summaryHtml = buildEffectSummary(effects);
        
        if (descEl) {
            descEl.innerHTML = `<p class="event-outcome">${text}</p>${summaryHtml}`;
        }
        
        if (choicesEl) {
            choicesEl.innerHTML = '';
            
            const continueBtn = document.createElement('button');
            continueBtn.className = 'event-choice continue-btn';
            continueBtn.innerHTML = '<span class="choice-text">Continue</span>';
            continueBtn.addEventListener('click', () => {
                game.audioManager?.playSFX?.('ui_click');
                completeEvent();
            });
            
            // Fade in
            continueBtn.style.opacity = '0';
            choicesEl.appendChild(continueBtn);
            setTimeout(() => {
                continueBtn.style.transition = 'opacity 0.3s';
                continueBtn.style.opacity = '1';
            }, 500);
        }
    }
    
    /**
     * Build color-coded effect summary HTML (v2)
     */
    function buildEffectSummary(effects) {
        if (!effects) return '';
        const parts = [];
        
        if (effects.hp && effects.hp > 0) parts.push(`<span class="effect-positive">+${effects.hp} HP</span>`);
        if (effects.hp && effects.hp < 0) parts.push(`<span class="effect-negative">${effects.hp} HP</span>`);
        if (effects.heal) parts.push(`<span class="effect-positive">+${effects.heal} HP</span>`);
        if (effects.healPercent) parts.push(`<span class="effect-positive">+${effects.healPercent}% HP</span>`);
        if (effects.damage) parts.push(`<span class="effect-negative">-${effects.damage} HP</span>`);
        if (effects.maxHp > 0) parts.push(`<span class="effect-positive">+${effects.maxHp} Max HP</span>`);
        if (effects.maxHp < 0) parts.push(`<span class="effect-negative">${effects.maxHp} Max HP</span>`);
        if (effects.credits > 0) parts.push(`<span class="effect-positive">+${effects.credits}◈</span>`);
        if (effects.credits < 0) parts.push(`<span class="effect-negative">${effects.credits}◈</span>`);
        if (effects.corruption > 0) parts.push(`<span class="effect-corruption">+${effects.corruption} Corruption</span>`);
        if (effects.corruption < 0) parts.push(`<span class="effect-cleanse">${effects.corruption} Corruption</span>`);
        if (effects.card) parts.push(`<span class="effect-positive">+Card</span>`);
        if (effects.artifact) parts.push(`<span class="effect-positive">+Relic</span>`);
        if (effects.lore) parts.push(`<span class="effect-positive">📖 Knowledge gained</span>`);
        if (effects.insight) parts.push(`<span class="effect-positive">⚡ Insight for next combat</span>`);
        if (effects.reputation) {
            Object.entries(effects.reputation).forEach(([f, v]) => {
                const cls = v > 0 ? 'effect-positive' : 'effect-negative';
                parts.push(`<span class="${cls}">${v > 0 ? '+' : ''}${v} ${f} rep</span>`);
            });
        }
        
        if (parts.length === 0) return '';
        return `<div class="event-effect-summary">${parts.join('')}</div>`;
    }
    
    /**
     * Show outcome then transition to combat
     */
    function showOutcomeWithCombat(text, effects) {
        const descEl = document.getElementById('event-text');
        const choicesEl = document.getElementById('event-choices');
        
        if (descEl) {
            descEl.innerHTML = `<p class="event-outcome">${text}</p>`;
        }
        
        if (choicesEl) {
            choicesEl.innerHTML = `
                <div class="combat-warning">
                    <span class="warning-icon">⚔️</span>
                    <span class="warning-text">COMBAT IMMINENT</span>
                </div>
            `;
        }
        
        // Setup combat
        setTimeout(() => {
            const act = game.state.get('act') || 1;
            let enemies;
            
            try {
                if (effects.combat && typeof effects.combat === 'string') {
                    // Specific enemy
                    enemies = game.dataLoader?.getEnemy?.(effects.combat) || [getDefaultEnemy()];
                    if (!Array.isArray(enemies)) enemies = [enemies];
                } else {
                    enemies = game.dataLoader?.getRandomEncounter?.(act, 'normal') || [getDefaultEnemy()];
                }
            } catch (e) {
                enemies = [getDefaultEnemy()];
            }
            
            game.state.set('combat.enemies', enemies);
            game.state.set('event.currentEvent', null);
            forceScreenTransition(game, 'combat-screen');
        }, 2000);
    }
    
    /**
     * Get default enemy
     */
    function getDefaultEnemy() {
        return {
            id: 'event_enemy',
            name: 'Hostile Entity',
            hp: 35,
            maxHp: 35,
            intent: { type: 'attack', damage: 10 }
        };
    }
    
    /**
     * Show card selection overlay for event-granted upgrades
     */
    function showEventUpgradeSelection(upgradeTarget) {
        const deck = game.state.get('deck') || [];
        
        // Filter to upgradeable cards
        let upgradeable = deck.filter(c => !c.upgraded);
        
        // If upgradeTarget is 'random', auto-pick a random card
        if (upgradeTarget === 'random' || upgradeTarget === true) {
            if (upgradeable.length > 0) {
                const randomCard = upgradeable[Math.floor(Math.random() * upgradeable.length)];
                performEventUpgrade(randomCard);
                return;
            }
            console.log('[EventScreen] No upgradeable cards in deck');
            return;
        }
        
        // If upgradeTarget is a specific card id, upgrade that one
        if (typeof upgradeTarget === 'string' && upgradeTarget !== 'choose') {
            const targetCard = upgradeable.find(c => c.id === upgradeTarget);
            if (targetCard) {
                performEventUpgrade(targetCard);
                return;
            }
        }
        
        // Otherwise, show selection UI for player to choose
        if (upgradeable.length === 0) {
            console.log('[EventScreen] No upgradeable cards in deck');
            return;
        }
        
        // Create upgrade selection overlay
        const overlay = document.createElement('div');
        overlay.id = 'event-upgrade-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 2000;
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 20px; box-sizing: border-box;
            animation: fadeIn 0.3s ease;
        `;
        
        overlay.innerHTML = `
            <h2 style="color: #00f5ff; font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem;
                        letter-spacing: 0.15em; margin-bottom: 1rem; text-shadow: 0 0 15px rgba(0,245,255,0.5);">
                SELECT A CARD TO UPGRADE
            </h2>
            <div id="event-upgrade-grid" style="
                display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
                max-width: 700px; max-height: 60vh; overflow-y: auto; padding: 10px;
            ">
                ${upgradeable.map(card => `
                    <div class="event-upgrade-card" data-instance="${card.instanceId}" style="
                        background: rgba(30, 30, 50, 0.95); border: 2px solid #606080;
                        border-radius: 8px; padding: 12px; width: 140px; cursor: pointer;
                        transition: all 0.2s; text-align: center;
                    ">
                        <div style="color: #00f5ff; font-size: 0.8rem; font-weight: bold;">${card.cost || 0}⚡</div>
                        <div style="color: #e8e8f0; font-size: 0.95rem; font-weight: bold; margin: 4px 0;">
                            ${card.name}
                        </div>
                        <div style="color: #a0a0b8; font-size: 0.75rem; line-height: 1.3;">
                            ${card.description || ''}
                        </div>
                        <div style="color: ${card.type === 'attack' ? '#ff4444' : card.type === 'skill' ? '#44aaff' : '#ffaa00'};
                                    font-size: 0.7rem; margin-top: 4px; text-transform: uppercase;">
                            ${card.type || 'card'}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button id="event-upgrade-cancel" style="
                margin-top: 1rem; padding: 10px 24px; background: rgba(255, 60, 60, 0.15);
                border: 1px solid #ff4444; color: #ff4444; border-radius: 6px;
                cursor: pointer; font-size: 0.9rem;
            ">Skip Upgrade</button>
        `;
        
        document.body.appendChild(overlay);
        
        // Card hover/click handlers
        overlay.querySelectorAll('.event-upgrade-card').forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.style.borderColor = '#00f5ff';
                el.style.boxShadow = '0 0 15px rgba(0, 245, 255, 0.3)';
                el.style.transform = 'scale(1.05)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.borderColor = '#606080';
                el.style.boxShadow = 'none';
                el.style.transform = 'scale(1)';
            });
            el.addEventListener('click', () => {
                const instanceId = el.dataset.instance;
                const card = deck.find(c => c.instanceId === instanceId);
                if (card) {
                    performEventUpgrade(card);
                }
                overlay.remove();
            });
        });
        
        // Cancel button
        document.getElementById('event-upgrade-cancel')?.addEventListener('click', () => {
            overlay.remove();
        });
    }
    
    /**
     * Perform the actual card upgrade from an event
     */
    function performEventUpgrade(card) {
        if (!card || card.upgraded) return;
        
        const oldName = card.name;
        
        // Use CardUpgradeSystem if available (gives named upgrades with flavor text)
        if (game.cardUpgradeSystem?.upgradeCard) {
            game.cardUpgradeSystem.upgradeCard(card);
        } else {
            // Fallback: simple stat boost
            card.upgraded = true;
            card.name = card.name + '+';
            
            if (card.damage && card.damage > 0) {
                card.damage = Math.ceil(card.damage * 1.25);
            }
            if (card.block && card.block > 0) {
                card.block = Math.ceil(card.block * 1.25);
            }
            if (card.draw && card.draw > 0) {
                card.draw = card.draw + 1;
            }
            if (card.cost > 0 && Math.random() < 0.3) {
                card.cost = Math.max(0, card.cost - 1);
            }
            
            // Update effects array
            if (card.effects && Array.isArray(card.effects)) {
                card.effects.forEach(eff => {
                    if (eff.type === 'damage' && typeof eff.value === 'number') eff.value = Math.ceil(eff.value * 1.25);
                    if (eff.type === 'block' && typeof eff.value === 'number') eff.value = Math.ceil(eff.value * 1.25);
                    if (eff.type === 'draw' && typeof eff.value === 'number') eff.value = eff.value + 1;
                });
            }
        }
        
        // Save updated deck
        const deck = game.state.get('deck') || [];
        game.state.set('deck', deck);
        
        console.log(`[EventScreen] Card upgraded: ${oldName} → ${card.name}`);
        game.eventBus.emit('card:upgraded', card);
    }
    
    /**
     * Complete event and return to map
     */
    function completeEvent() {
        console.log('[EventScreen] Event complete, returning to map');
        
        // v2: Record event completion in EventManager
        if (currentEvent && game.eventManager) {
            game.eventManager.recordEventCompleted(currentEvent.id, null);
        }
        
        // Clear event state
        game.state.set('event.currentEvent', null);
        atmosphereText = null;
        currentEvent = null;
        
        // Clear typewriter
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        
        // Mark node complete
        game.mapGenerator?.completeCurrentNode?.();
        game.eventBus.emit('map:updated');
        
        // Return to map
        forceScreenTransition(game, 'map-screen');
    }
    
    /**
     * Force screen transition (reliable fallback)
     */
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[EventScreen] Transitioning to: ${targetScreenId}`);
        
        const eventScreen = document.getElementById('event-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[EventScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // Hide event screen
        if (eventScreen) {
            eventScreen.classList.remove('active', 'fade-in');
            eventScreen.style.cssText = '';
        }
        
        // Try normal transition
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
            }
        } catch (e) {
            console.error('[EventScreen] Transition failed:', e);
        }
        
        // Force fallback
        setTimeout(() => {
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== targetScreenId) {
                    screen.classList.remove('active', 'fade-in');
                    screen.style.cssText = '';
                }
            });
            
            targetScreen.classList.remove('fade-out');
            targetScreen.classList.add('active');
            targetScreen.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 1000 !important;
                pointer-events: auto !important;
            `;
            
            if (game.screenManager) {
                game.screenManager.previousScreen = game.screenManager.currentScreen;
                game.screenManager.currentScreen = targetScreenId;
                game.screenManager.transitioning = false;
            }
            
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'event-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
        }, 100);
    }
    
    return { initializeEventScreen };
}
