/**
 * EventScreen - Handles narrative event encounters
 * FIXED: Now properly initializes when screen becomes visible
 */

export function setupEventScreen(game) {
    const screen = document.getElementById('event-screen');
    
    console.log('[EventScreen] Setting up event screen');
    
    // FIXED: Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'event-screen') {
            console.log('[EventScreen] Screen shown, initializing...');
            initializeEventScreen();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'event-screen') {
            console.log('[EventScreen] Screen changed to event, initializing...');
            initializeEventScreen();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('event:enter', () => {
        console.log('[EventScreen] event:enter event received');
        initializeEventScreen();
    });
    
    function initializeEventScreen() {
        console.log('[EventScreen] Initializing event...');
        
        // Get current event from state (set by MapScreen when clicking event node)
        let currentEvent = game.state.get('event.currentEvent');
        
        if (!currentEvent) {
            console.log('[EventScreen] No event in state, generating random event');
            currentEvent = generateRandomEvent();
            game.state.set('event.currentEvent', currentEvent);
        }
        
        if (currentEvent) {
            renderEvent(currentEvent);
        } else {
            console.error('[EventScreen] No event to display');
            // Fallback - return to map
            completeEvent();
        }
    }
    
    function generateRandomEvent() {
        const act = game.state.get('act') || 1;
        
        try {
            return game.dataLoader?.getRandomEvent?.(act);
        } catch (e) {
            console.warn('[EventScreen] Failed to get event, using fallback:', e);
            return getFallbackEvent();
        }
    }
    
    function getFallbackEvent() {
        const fallbackEvents = [
            {
                id: 'mysterious_stranger',
                name: 'Mysterious Stranger',
                description: 'A cloaked figure emerges from the shadows. They offer you a deal...',
                image: null,
                choices: [
                    {
                        text: 'Accept their offer',
                        outcome: {
                            type: 'reward',
                            description: 'You gain a mysterious artifact.',
                            credits: 50
                        }
                    },
                    {
                        text: 'Decline and leave',
                        outcome: {
                            type: 'safe',
                            description: 'You walk away unharmed.'
                        }
                    },
                    {
                        text: 'Attack them',
                        outcome: {
                            type: 'combat',
                            description: 'The stranger reveals their true form!',
                            damage: 10
                        }
                    }
                ]
            },
            {
                id: 'ancient_terminal',
                name: 'Ancient Terminal',
                description: 'You discover a terminal from before the collapse. Its screen flickers to life...',
                choices: [
                    {
                        text: 'Download data',
                        outcome: {
                            type: 'reward',
                            description: 'You gain valuable knowledge.',
                            credits: 30
                        }
                    },
                    {
                        text: 'Search for medical supplies',
                        outcome: {
                            type: 'heal',
                            description: 'You find a med kit.',
                            heal: 15
                        }
                    },
                    {
                        text: 'Leave it alone',
                        outcome: {
                            type: 'safe',
                            description: 'You continue on your way.'
                        }
                    }
                ]
            },
            {
                id: 'abandoned_cache',
                name: 'Abandoned Cache',
                description: 'You stumble upon an abandoned supply cache. It appears to be trapped...',
                choices: [
                    {
                        text: 'Attempt to disarm the trap',
                        outcome: {
                            type: 'random',
                            success: { credits: 75, description: 'You successfully disarm the trap and claim the supplies!' },
                            failure: { damage: 15, description: 'The trap explodes! You take damage.' }
                        }
                    },
                    {
                        text: 'Walk away',
                        outcome: {
                            type: 'safe',
                            description: 'Discretion is the better part of valor.'
                        }
                    }
                ]
            }
        ];
        
        return fallbackEvents[Math.floor(Math.random() * fallbackEvents.length)];
    }
    
    function renderEvent(event) {
        console.log(`[EventScreen] Rendering event: ${event.name || event.id}`);
        
        const titleEl = document.getElementById('event-title');
        const descEl = document.getElementById('event-text') || document.getElementById('event-description');
        const imageEl = document.getElementById('event-image');
        const choicesEl = document.getElementById('event-choices');
        
        if (titleEl) {
            titleEl.textContent = event.name || 'Unknown Event';
        }
        
        if (descEl) {
            descEl.textContent = event.description || '';
        }
        
        if (imageEl && event.image) {
            imageEl.style.backgroundImage = `url('${event.image}')`;
            imageEl.style.display = 'block';
        } else if (imageEl) {
            imageEl.style.display = 'none';
        }
        
        if (choicesEl) {
            choicesEl.innerHTML = '';
            
            (event.choices || []).forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'event-choice';
                button.textContent = choice.text;
                button.addEventListener('click', () => {
                    console.log(`[EventScreen] Choice selected: ${choice.text}`);
                    game.audioManager?.playSFX?.('ui_click');
                    handleChoice(choice);
                });
                choicesEl.appendChild(button);
            });
            
            console.log(`[EventScreen] Rendered ${event.choices?.length || 0} choices`);
        }
    }
    
    function handleChoice(choice) {
        const outcome = choice.outcome;
        
        if (!outcome) {
            console.log('[EventScreen] No outcome defined, completing event');
            completeEvent();
            return;
        }
        
        console.log(`[EventScreen] Processing outcome type: ${outcome.type}`);
        
        switch (outcome.type) {
            case 'reward':
                handleReward(outcome);
                break;
            case 'heal':
                handleHeal(outcome);
                break;
            case 'damage':
                handleDamage(outcome);
                break;
            case 'combat':
                handleCombat(outcome);
                return; // Don't complete event yet
            case 'random':
                handleRandom(outcome);
                break;
            case 'safe':
            default:
                showOutcome(outcome.description || 'You continue on your journey.');
                break;
        }
        
        // Show outcome then complete
        setTimeout(() => completeEvent(), 1500);
    }
    
    function handleReward(outcome) {
        if (outcome.credits) {
            const current = game.state.get('credits') || 0;
            game.state.set('credits', current + outcome.credits);
            game.eventBus.emit('credits:gained', outcome.credits);
        }
        
        if (outcome.card) {
            const deck = game.state.get('deck') || [];
            deck.push({ ...outcome.card, instanceId: `event_${Date.now()}` });
            game.state.set('deck', deck);
            game.eventBus.emit('card:obtained', outcome.card);
        }
        
        if (outcome.artifact) {
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(outcome.artifact);
            game.state.set('artifacts', artifacts);
            game.eventBus.emit('artifact:gained', outcome.artifact);
        }
        
        showOutcome(outcome.description || 'You received a reward!');
    }
    
    function handleHeal(outcome) {
        const hp = game.state.get('hp') || 50;
        const maxHp = game.state.get('maxHp') || 80;
        const healAmount = outcome.heal || Math.floor(maxHp * 0.2);
        const newHp = Math.min(maxHp, hp + healAmount);
        
        game.state.set('hp', newHp);
        game.eventBus.emit('heal', healAmount);
        game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
        
        showOutcome(outcome.description || `Healed ${healAmount} HP!`);
    }
    
    function handleDamage(outcome) {
        const hp = game.state.get('hp') || 50;
        const maxHp = game.state.get('maxHp') || 80;
        const damage = outcome.damage || 10;
        const newHp = Math.max(0, hp - damage);
        
        game.state.set('hp', newHp);
        game.eventBus.emit('damage', damage);
        game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
        
        showOutcome(outcome.description || `Took ${damage} damage!`);
        
        if (newHp <= 0) {
            setTimeout(() => {
                game.eventBus.emit('player:death');
            }, 1000);
        }
    }
    
    function handleCombat(outcome) {
        // Apply any pre-combat damage
        if (outcome.damage) {
            handleDamage({ damage: outcome.damage, description: outcome.description });
        }
        
        // Start combat
        setTimeout(() => {
            // Generate enemy based on outcome or use default
            const act = game.state.get('act') || 1;
            let enemies;
            
            try {
                enemies = game.dataLoader?.getRandomEncounter?.(act, 'normal') || [getDefaultEnemy()];
            } catch (e) {
                enemies = [getDefaultEnemy()];
            }
            
            game.state.set('combat.enemies', enemies);
            forceScreenTransition(game, 'combat-screen');
        }, 1500);
    }
    
    function getDefaultEnemy() {
        return {
            id: 'event_enemy',
            name: 'Hostile Entity',
            hp: 30,
            maxHp: 30,
            intent: { type: 'attack', damage: 8 }
        };
    }
    
    function handleRandom(outcome) {
        const roll = Math.random();
        const success = roll > 0.4; // 60% success rate
        
        if (success && outcome.success) {
            if (outcome.success.credits) {
                const current = game.state.get('credits') || 0;
                game.state.set('credits', current + outcome.success.credits);
            }
            showOutcome(outcome.success.description || 'Success!');
        } else if (outcome.failure) {
            if (outcome.failure.damage) {
                handleDamage({ damage: outcome.failure.damage });
            }
            showOutcome(outcome.failure.description || 'Failed!');
        }
    }
    
    function showOutcome(text) {
        const descEl = document.getElementById('event-text') || document.getElementById('event-description');
        const choicesEl = document.getElementById('event-choices');
        
        if (descEl) {
            descEl.innerHTML = `<strong>${text}</strong>`;
        }
        
        if (choicesEl) {
            choicesEl.innerHTML = `
                <button class="event-choice continue-btn">Continue</button>
            `;
            choicesEl.querySelector('.continue-btn').addEventListener('click', () => {
                completeEvent();
            });
        }
    }
    
    function completeEvent() {
        console.log('[EventScreen] Event complete, returning to map');
        
        // Clear current event
        game.state.set('event.currentEvent', null);
        
        // Mark node as complete
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
        
        // Return to map using force transition
        forceScreenTransition(game, 'map-screen');
    }
    
    /**
     * Force screen transition (same pattern as other screens)
     */
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[EventScreen] forceScreenTransition to: ${targetScreenId}`);
        
        const eventScreen = document.getElementById('event-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[EventScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // Hide the event screen
        if (eventScreen) {
            eventScreen.classList.remove('active', 'fade-in');
            eventScreen.style.cssText = '';
        }
        
        // Try normal ScreenManager transition
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
            }
        } catch (e) {
            console.error('[EventScreen] screenManager.transitionTo failed:', e);
        }
        
        // Force the transition
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
    
    return { initializeEventScreen, renderEvent };
}
