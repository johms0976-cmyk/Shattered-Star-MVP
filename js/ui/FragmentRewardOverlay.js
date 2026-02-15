/**
 * FragmentRewardOverlay.js - Pick-one-of-three Void Fragment Reward UI
 * 
 * Reusable overlay that presents 3 fragment choices to the player.
 * Called after elite/boss victories, from events, rest sites, etc.
 * 
 * Usage:
 *   import { showFragmentReward } from './ui/FragmentRewardOverlay.js';
 *   showFragmentReward(game, { pool: 'common,uncommon', count: 3, onComplete: () => {} });
 * 
 * @version 1.0.0
 */

/**
 * Show a fragment reward overlay (pick one of N)
 * @param {Object} game - Game instance (needs .voidSystems.fragments, .eventBus, .audioManager)
 * @param {Object} options
 * @param {string} options.pool - Rarity filter: 'all', 'common,uncommon', 'uncommon,rare', etc.
 * @param {number} options.count - Number of choices to show (default 3)
 * @param {string} options.source - Where the reward came from (for logging)
 * @param {Function} options.onComplete - Called after player picks (or skips)
 * @param {boolean} options.allowSkip - Whether the player can skip (default true)
 */
export function showFragmentReward(game, options = {}) {
    const {
        pool = 'all',
        count = 3,
        source = 'unknown',
        onComplete = null,
        allowSkip = true
    } = options;

    const fragmentSystem = game.voidSystems?.fragments;
    if (!fragmentSystem) {
        console.warn('[FragmentReward] VoidFragmentSystem not available');
        onComplete?.();
        return;
    }

    // Get random fragment choices
    const choices = fragmentSystem.getRandomFragment(pool, count);
    if (!choices || choices.length === 0) {
        console.log('[FragmentReward] No fragments available to offer');
        onComplete?.();
        return;
    }

    console.log(`[FragmentReward] Offering ${choices.length} fragments from ${source}`);

    // Remove any existing overlay
    const existing = document.getElementById('fragment-reward-overlay');
    if (existing) existing.remove();

    // Build overlay
    const overlay = document.createElement('div');
    overlay.id = 'fragment-reward-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.92); z-index: 2500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 1.5rem; animation: fragmentOverlayIn 0.4s ease-out;
    `;

    // Rarity color map
    const rarityColors = {
        common: '#8a8a9a',
        uncommon: '#00f5ff',
        rare: '#ffd700',
        legendary: '#bf00ff'
    };

    // Type icon map
    const typeIcons = {
        reactive: '⚡', chain: '🔗', damage: '💥', economy: '💰',
        defensive: '🛡️', utility: '🔮', passive: '👁️'
    };

    const fragmentCards = choices.map((frag, i) => {
        const color = rarityColors[frag.rarity] || '#8a8a9a';
        const icon = typeIcons[frag.type] || '👁️';
        const corruptionCost = frag.corruptionPerCombat || 0;

        return `
            <div class="fragment-choice" data-fragment-index="${i}" style="
                background: linear-gradient(180deg, rgba(20, 10, 30, 0.95) 0%, rgba(10, 5, 20, 0.98) 100%);
                border: 2px solid ${color}; border-radius: 12px;
                padding: 1.25rem; width: 220px; max-width: 30vw;
                cursor: pointer; transition: all 0.3s ease;
                display: flex; flex-direction: column; align-items: center; text-align: center;
                position: relative; overflow: hidden;
            ">
                <!-- Rarity glow -->
                <div style="
                    position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
                    width: 80px; height: 80px; border-radius: 50%;
                    background: radial-gradient(circle, ${color}33, transparent);
                    pointer-events: none;
                "></div>

                <!-- Type icon -->
                <div style="font-size: 2rem; margin-bottom: 0.5rem; position: relative;">${icon}</div>

                <!-- Name -->
                <div style="
                    color: ${color}; font-size: 1.1rem; font-weight: bold;
                    font-family: 'Bebas Neue', 'Oswald', sans-serif;
                    letter-spacing: 0.05em; margin-bottom: 0.5rem;
                ">${frag.name}</div>

                <!-- Rarity badge -->
                <div style="
                    color: ${color}; font-size: 0.65rem; text-transform: uppercase;
                    letter-spacing: 0.1em; margin-bottom: 0.75rem;
                    border: 1px solid ${color}44; border-radius: 4px; padding: 2px 8px;
                ">${frag.rarity}</div>

                <!-- Description -->
                <div style="
                    color: #c0c0d0; font-size: 0.8rem; line-height: 1.4;
                    margin-bottom: 0.75rem; min-height: 3em;
                ">${frag.description}</div>

                <!-- Corruption cost -->
                <div style="
                    color: #bf00ff; font-size: 0.75rem;
                    border-top: 1px solid #333; padding-top: 0.5rem; width: 100%;
                ">+${corruptionCost} Corruption/combat</div>

                <!-- Lore text -->
                ${frag.lore ? `<div style="
                    color: #666; font-size: 0.7rem; font-style: italic;
                    margin-top: 0.5rem;
                ">"${frag.lore}"</div>` : ''}
            </div>
        `;
    }).join('');

    overlay.innerHTML = `
        <style>
            @keyframes fragmentOverlayIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fragmentPulse {
                0%, 100% { box-shadow: 0 0 15px rgba(191, 0, 255, 0.2); }
                50% { box-shadow: 0 0 30px rgba(191, 0, 255, 0.5); }
            }
            .fragment-choice:hover {
                transform: translateY(-8px) scale(1.03) !important;
                box-shadow: 0 0 30px rgba(191, 0, 255, 0.4) !important;
            }
            .fragment-choice.selected {
                animation: fragmentPulse 0.6s ease-in-out !important;
                transform: scale(1.05) !important;
            }
            .fragment-choice.not-selected {
                opacity: 0.3 !important;
                pointer-events: none !important;
                transform: scale(0.95) !important;
            }
        </style>

        <!-- Header -->
        <div style="
            color: #bf00ff; font-size: 0.8rem; text-transform: uppercase;
            letter-spacing: 0.2em; margin-bottom: 0.5rem;
        ">VOID FRAGMENT DISCOVERED</div>

        <div style="
            color: #e8e8f0; font-size: 1.5rem; font-weight: bold;
            font-family: 'Bebas Neue', 'Oswald', sans-serif;
            letter-spacing: 0.1em; margin-bottom: 0.25rem;
        ">CHOOSE A FRAGMENT</div>

        <div style="
            color: #888; font-size: 0.8rem; margin-bottom: 1.5rem;
        ">Fragments passively modify your combat — but each feeds the corruption.</div>

        <!-- Fragment choices -->
        <div style="
            display: flex; gap: 1.25rem; justify-content: center;
            flex-wrap: wrap; margin-bottom: 1.5rem;
        ">
            ${fragmentCards}
        </div>

        <!-- Slot info -->
        <div id="fragment-slot-info" style="
            color: #666; font-size: 0.75rem; margin-bottom: 1rem;
        "></div>

        <!-- Skip button -->
        ${allowSkip ? `
            <button id="fragment-skip-btn" style="
                background: none; border: 1px solid #444; color: #888;
                padding: 0.5rem 1.5rem; cursor: pointer; border-radius: 6px;
                font-size: 0.85rem; transition: all 0.2s;
            ">Skip</button>
        ` : ''}
    `;

    document.body.appendChild(overlay);

    // Update slot info
    const slotInfo = document.getElementById('fragment-slot-info');
    if (slotInfo) {
        const unlocked = fragmentSystem.getUnlockedSlots();
        const equipped = fragmentSystem.equippedFragments.length;
        const collected = fragmentSystem.collectedFragments.length;
        slotInfo.textContent = `Slots: ${equipped}/${unlocked} equipped · ${collected} in inventory`;
    }

    // Click handlers for fragment choices
    overlay.querySelectorAll('.fragment-choice').forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.dataset.fragmentIndex);
            const chosen = choices[index];
            if (!chosen) return;

            game.audioManager?.playSFX?.('artifact_gain');

            // Visual feedback
            overlay.querySelectorAll('.fragment-choice').forEach(c => {
                c.classList.add('not-selected');
                c.style.transition = 'all 0.4s ease';
            });
            el.classList.remove('not-selected');
            el.classList.add('selected');

            // Collect the fragment
            fragmentSystem.collectFragment(chosen.id);

            // Auto-equip if there's a free slot
            const unlocked = fragmentSystem.getUnlockedSlots();
            if (fragmentSystem.equippedFragments.length < unlocked) {
                fragmentSystem.equipFragment(chosen.id);
                console.log(`[FragmentReward] Auto-equipped: ${chosen.name}`);
            } else {
                console.log(`[FragmentReward] Collected (slots full): ${chosen.name}`);
            }

            // Emit events
            game.eventBus.emit('fragment:acquired', { fragment: chosen, source });
            game.eventBus.emit('void:whisper', {
                text: `The ${chosen.name} binds to your essence...`,
                intensity: 'medium'
            });

            // Dismiss after brief pause
            setTimeout(() => {
                overlay.style.transition = 'opacity 0.4s ease';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                    onComplete?.();
                }, 400);
            }, 800);
        });
    });

    // Skip button
    const skipBtn = document.getElementById('fragment-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            console.log(`[FragmentReward] Player skipped fragment reward`);
            overlay.style.transition = 'opacity 0.3s ease';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                onComplete?.();
            }, 300);
        });
        skipBtn.addEventListener('mouseenter', () => {
            skipBtn.style.borderColor = '#888';
            skipBtn.style.color = '#ccc';
        });
        skipBtn.addEventListener('mouseleave', () => {
            skipBtn.style.borderColor = '#444';
            skipBtn.style.color = '#888';
        });
    }
}

/**
 * Check whether a fragment reward should be offered based on context
 * @param {Object} game
 * @param {string} nodeType - 'elite', 'boss', 'combat', etc.
 * @returns {boolean}
 */
export function shouldOfferFragment(game, nodeType) {
    if (!game.voidSystems?.fragments) return false;

    const fragmentSystem = game.voidSystems.fragments;

    // Check if there are any fragments left to offer
    const available = Object.values(fragmentSystem.fragmentDatabase).filter(f => {
        if (fragmentSystem.collectedFragments.includes(f.id)) return false;
        if (fragmentSystem.equippedFragments.find(eq => eq.id === f.id)) return false;
        return true;
    });

    if (available.length === 0) return false;

    // Always offer after boss
    if (nodeType === 'boss') return true;

    // Elite: 60% chance
    if (nodeType === 'elite') return Math.random() < 0.6;

    // Regular combat: 10% chance (rare treat)
    if (nodeType === 'combat') return Math.random() < 0.10;

    return false;
}
