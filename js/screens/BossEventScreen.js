/**
 * BossEventScreen - Handles pre-boss and post-boss narrative event display
 * Shattered Star
 * 
 * Renders narrative events with typewriter text reveal, atmospheric styling,
 * and choice consequences. Also handles mid-fight dialogue overlay during combat.
 * ADDED: Void Fragment effect support in boss event choices.
 */

import { showFragmentReward } from '../ui/FragmentRewardOverlay.js';

export function setupBossEventScreen(game) {
    
    // Listen for boss narrative events
    game.eventBus.on('boss:pre_event', (eventData) => showBossEvent(eventData, 'pre'));
    game.eventBus.on('boss:post_event', (eventData) => showBossEvent(eventData, 'post'));
    game.eventBus.on('combat:dialogue', (dialogue) => showCombatDialogue(dialogue));
    
    /**
     * Show a boss narrative event (pre or post)
     */
    function showBossEvent(eventData, phase) {
        if (!eventData) return;
        
        const screen = document.getElementById('event-screen');
        if (!screen) return;
        
        const container = screen.querySelector('.event-container') || screen;
        
        // Build the event HTML with boss-specific styling
        const phaseClass = phase === 'pre' ? 'pre-boss-event' : 'post-boss-event';
        
        container.innerHTML = `
            <div class="boss-event ${phaseClass}">
                <div class="boss-event-header">
                    <div class="boss-event-label">${phase === 'pre' ? '⚠ APPROACHING BOSS' : '✦ REVELATION'}</div>
                    <h2 class="boss-event-title">${eventData.name}</h2>
                </div>
                <div class="boss-event-text" id="boss-event-text"></div>
                <div class="boss-event-choices" id="boss-event-choices" style="display: none;"></div>
                <div class="boss-event-result" id="boss-event-result" style="display: none;"></div>
                ${eventData.epilogue ? `<div class="boss-event-epilogue" id="boss-event-epilogue" style="display: none;"></div>` : ''}
                <button class="boss-proceed-btn" id="boss-proceed-btn" style="display: none;">
                    ${phase === 'pre' ? 'FACE THE BOSS' : 'CONTINUE'}
                </button>
            </div>
        `;
        
        // Transition to event screen
        game.screenManager.transitionTo('event-screen');
        
        // Typewriter reveal the text paragraphs
        const textContainer = document.getElementById('boss-event-text');
        typewriterReveal(eventData.text, textContainer, () => {
            // Show choices after text is revealed
            showBossChoices(eventData, phase);
        });
    }
    
    /**
     * Typewriter text reveal for narrative paragraphs
     */
    function typewriterReveal(paragraphs, container, onComplete) {
        if (!paragraphs || paragraphs.length === 0) {
            onComplete?.();
            return;
        }
        
        let currentParagraph = 0;
        
        function revealNext() {
            if (currentParagraph >= paragraphs.length) {
                onComplete?.();
                return;
            }
            
            const p = document.createElement('p');
            p.className = 'boss-narrative-paragraph';
            p.style.opacity = '0';
            container.appendChild(p);
            
            const text = paragraphs[currentParagraph];
            let charIndex = 0;
            
            // Fade in
            setTimeout(() => {
                p.style.transition = 'opacity 0.3s ease';
                p.style.opacity = '1';
            }, 50);
            
            const typeInterval = setInterval(() => {
                if (charIndex < text.length) {
                    p.textContent = text.substring(0, charIndex + 1);
                    charIndex++;
                } else {
                    clearInterval(typeInterval);
                    currentParagraph++;
                    setTimeout(revealNext, 400);
                }
            }, 25); // Fast typewriter speed
            
            // Allow skip by clicking
            container.addEventListener('click', function skipHandler() {
                clearInterval(typeInterval);
                p.textContent = text;
                p.style.opacity = '1';
                currentParagraph++;
                container.removeEventListener('click', skipHandler);
                setTimeout(revealNext, 100);
            }, { once: false });
        }
        
        revealNext();
    }
    
    /**
     * Show choices for boss event
     */
    function showBossChoices(eventData, phase) {
        const choicesContainer = document.getElementById('boss-event-choices');
        if (!choicesContainer || !eventData.choices) return;
        
        const corruption = game.state.get('corruption') || 0;
        const credits = game.state.get('credits') || 0;
        
        let choicesHtml = '';
        eventData.choices.forEach((choice, index) => {
            const disabled = (choice.requiresCorruption && corruption < choice.requiresCorruption) ||
                            (choice.effects?.creditCost && credits < choice.effects.creditCost);
            
            choicesHtml += `
                <div class="boss-choice ${disabled ? 'disabled' : ''} ${choice.requiresCorruption ? 'corruption-choice' : ''}" 
                     data-choice-index="${index}"
                     ${disabled ? 'title="Requirements not met"' : ''}>
                    <div class="boss-choice-text">${choice.text}</div>
                    ${choice.effects?.creditCost ? `<div class="boss-choice-cost">-${choice.effects.creditCost} Credits</div>` : ''}
                </div>
            `;
        });
        
        choicesContainer.innerHTML = choicesHtml;
        choicesContainer.style.display = 'block';
        choicesContainer.style.opacity = '0';
        
        // Fade in choices
        setTimeout(() => {
            choicesContainer.style.transition = 'opacity 0.5s ease';
            choicesContainer.style.opacity = '1';
        }, 100);
        
        // Choice click handlers
        choicesContainer.querySelectorAll('.boss-choice:not(.disabled)').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.choiceIndex);
                handleBossChoice(eventData, index, phase);
            });
        });
    }
    
    /**
     * Handle a boss event choice
     */
    function handleBossChoice(eventData, choiceIndex, phase) {
        const choice = eventData.choices[choiceIndex];
        if (!choice) return;
        
        // Apply effects
        applyChoiceEffects(choice.effects);
        
        // Track choice for Varra if relevant
        if (choice.choiceId && game.varraTracker) {
            game.varraTracker.recordChoice(choice.choiceId, choice.text);
            
            if (choice.effects?.relationship) {
                game.varraTracker.updateState({ relationship: choice.effects.relationship });
            }
            if (choice.effects?.debtOwed !== undefined) {
                game.varraTracker.updateState({ debtOwed: choice.effects.debtOwed });
            }
        }
        
        // Store boss modifier for boss narrative system
        if (choice.effects?.bossModifier) {
            game.state.set('bossModifier', choice.effects.bossModifier);
        }
        
        // Hide choices, show result
        const choicesContainer = document.getElementById('boss-event-choices');
        if (choicesContainer) choicesContainer.style.display = 'none';
        
        const resultContainer = document.getElementById('boss-event-result');
        if (resultContainer && choice.result) {
            resultContainer.innerHTML = `<div class="boss-result-text">${choice.result.replace(/\n/g, '<br>')}</div>`;
            resultContainer.style.display = 'block';
            resultContainer.style.opacity = '0';
            setTimeout(() => {
                resultContainer.style.transition = 'opacity 0.5s ease';
                resultContainer.style.opacity = '1';
            }, 100);
        }
        
        // Show epilogue if post-boss
        if (eventData.epilogue && phase === 'post') {
            setTimeout(() => {
                const epilogueContainer = document.getElementById('boss-event-epilogue');
                if (epilogueContainer) {
                    epilogueContainer.innerHTML = `<p class="epilogue-text">${eventData.epilogue}</p>`;
                    epilogueContainer.style.display = 'block';
                    epilogueContainer.style.opacity = '0';
                    setTimeout(() => {
                        epilogueContainer.style.transition = 'opacity 0.8s ease';
                        epilogueContainer.style.opacity = '1';
                    }, 200);
                }
            }, 2000);
        }
        
        // Show proceed button
        setTimeout(() => {
            const proceedBtn = document.getElementById('boss-proceed-btn');
            if (proceedBtn) {
                proceedBtn.style.display = 'block';
                proceedBtn.style.opacity = '0';
                setTimeout(() => {
                    proceedBtn.style.transition = 'opacity 0.5s ease';
                    proceedBtn.style.opacity = '1';
                }, 100);
                
                proceedBtn.addEventListener('click', () => {
                    if (phase === 'pre') {
                        // Proceed to boss combat
                        game.eventBus.emit('boss:start_combat');
                    } else {
                        // Proceed to next act or victory
                        game.eventBus.emit('act:complete', { act: game.state.get('act') || 1 });
                    }
                });
            }
        }, phase === 'post' ? 3000 : 1500);
    }
    
    /**
     * Apply choice effects to game state
     */
    function applyChoiceEffects(effects) {
        if (!effects) return;
        
        // Credits
        if (effects.credits) {
            const current = game.state.get('credits') || 0;
            game.state.set('credits', current + effects.credits);
        }
        if (effects.creditCost) {
            const current = game.state.get('credits') || 0;
            game.state.set('credits', Math.max(0, current - effects.creditCost));
        }
        
        // Corruption
        if (effects.corruption) {
            const current = game.state.get('corruption') || 0;
            game.state.set('corruption', Math.min(100, Math.max(0, current + effects.corruption)));
            if (effects.corruption > 0) {
                game.eventBus.emit('corruption:gained', effects.corruption);
            } else {
                game.eventBus.emit('corruption:lost', Math.abs(effects.corruption));
            }
        }
        
        // Reputation
        if (effects.reputation) {
            for (const [faction, change] of Object.entries(effects.reputation)) {
                const current = game.state.get(`factions.${faction}`) || 0;
                game.state.set(`factions.${faction}`, Math.max(-5, Math.min(5, current + change)));
            }
        }
        
        // Artifact
        if (effects.artifact) {
            let enrichedArtifact = typeof effects.artifact === 'string' 
                ? { id: effects.artifact } : { ...effects.artifact };
            
            // Enrich artifact with full data
            try {
                if (!enrichedArtifact.name || !enrichedArtifact.effects) {
                    if (game.rewards?.enrichArtifact) {
                        enrichedArtifact = game.rewards.enrichArtifact(enrichedArtifact);
                    } else if (game.rewards?.artifactEffects?.[enrichedArtifact.id]) {
                        const known = game.rewards.artifactEffects[enrichedArtifact.id];
                        enrichedArtifact = { ...enrichedArtifact, name: known.name, description: known.description, rarity: known.rarity, effects: known.effects || {} };
                    }
                }
                if (!enrichedArtifact.name && game.dataLoader?.getArtifact) {
                    const fromData = game.dataLoader.getArtifact(enrichedArtifact.id);
                    if (fromData) enrichedArtifact = { ...fromData, effects: enrichedArtifact.effects || fromData.effects || {} };
                }
            } catch (e) {
                console.warn('[BossEventScreen] Artifact enrichment failed:', e);
            }
            
            if (!enrichedArtifact.name) {
                enrichedArtifact.name = (enrichedArtifact.id || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                enrichedArtifact.description = enrichedArtifact.description || 'A powerful relic.';
                enrichedArtifact.effects = enrichedArtifact.effects || {};
            }
            
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(enrichedArtifact);
            game.state.set('artifacts', artifacts);
            
            if (game.rewards?.applyImmediateArtifactEffects) {
                game.rewards.applyImmediateArtifactEffects(enrichedArtifact);
            }
            
            game.eventBus.emit('artifact:gained', enrichedArtifact);
        }
        
        // Player buff (for boss fight)
        if (effects.playerBuff) {
            const buffs = game.state.get('preBossBuffs') || [];
            buffs.push(effects.playerBuff);
            game.state.set('preBossBuffs', buffs);
        }
        
        // Lore unlock
        if (effects.loreUnlock) {
            const lore = game.state.get('loreUnlocks') || [];
            if (!lore.includes(effects.loreUnlock)) {
                lore.push(effects.loreUnlock);
                game.state.set('loreUnlocks', lore);
            }
        }
        
        // Void Fragment reward
        if (effects.fragment) {
            if (typeof effects.fragment === 'string' && effects.fragment !== 'random') {
                // Specific fragment
                const fragmentSystem = game.voidSystems?.fragments;
                if (fragmentSystem) {
                    fragmentSystem.collectFragment(effects.fragment);
                    const unlocked = fragmentSystem.getUnlockedSlots();
                    if (fragmentSystem.equippedFragments.length < unlocked) {
                        fragmentSystem.equipFragment(effects.fragment);
                    }
                    game.eventBus.emit('fragment:acquired', {
                        fragment: fragmentSystem.fragmentDatabase[effects.fragment],
                        source: 'boss_event'
                    });
                }
            } else {
                // Random pick-one-of-three
                setTimeout(() => {
                    showFragmentReward(game, {
                        pool: effects.fragmentPool || 'uncommon,rare',
                        count: 3,
                        source: 'boss_event',
                        allowSkip: true,
                        onComplete: () => {}
                    });
                }, 300);
            }
        }
    }
    
    /**
     * Show mid-combat dialogue overlay
     */
    function showCombatDialogue(dialogue) {
        if (!dialogue) return;
        
        // Create or find dialogue overlay
        let overlay = document.getElementById('combat-dialogue-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'combat-dialogue-overlay';
            overlay.className = 'combat-dialogue-overlay';
            document.getElementById('combat-screen')?.appendChild(overlay);
        }
        
        const lines = dialogue.lines || [dialogue.text || ''];
        const speaker = dialogue.speaker || 'Unknown';
        const action = dialogue.action || '';
        const mood = dialogue.mood || 'neutral';
        
        overlay.innerHTML = `
            <div class="dialogue-box mood-${mood}">
                <div class="dialogue-speaker">${speaker}</div>
                <div class="dialogue-lines" id="dialogue-lines"></div>
                ${action ? `<div class="dialogue-action">${action}</div>` : ''}
                ${dialogue.void_whisper ? `<div class="dialogue-void-whisper">${dialogue.void_whisper}</div>` : ''}
                <button class="dialogue-dismiss">Continue</button>
            </div>
        `;
        
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            overlay.style.transition = 'opacity 0.4s ease';
            overlay.style.opacity = '1';
        }, 50);
        
        // Typewrite the dialogue lines
        const linesContainer = document.getElementById('dialogue-lines');
        if (linesContainer) {
            let lineIndex = 0;
            function showNextLine() {
                if (lineIndex >= lines.length) return;
                const p = document.createElement('p');
                p.className = 'dialogue-line';
                p.textContent = `"${lines[lineIndex]}"`;
                p.style.opacity = '0';
                linesContainer.appendChild(p);
                setTimeout(() => {
                    p.style.transition = 'opacity 0.3s ease';
                    p.style.opacity = '1';
                }, 50);
                lineIndex++;
                if (lineIndex < lines.length) {
                    setTimeout(showNextLine, 800);
                }
            }
            showNextLine();
        }
        
        // Dismiss button
        overlay.querySelector('.dialogue-dismiss').addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                // Resume combat
                game.eventBus.emit('combat:resume');
            }, 400);
        });
    }
    
    return { showBossEvent, showCombatDialogue };
}
