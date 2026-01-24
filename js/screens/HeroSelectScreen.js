/**
 * HeroSelectScreen - Hero selection screen handler
 * Shattered Star
 */

let selectedHeroId = null;

export function setupHeroSelect(game) {
    const btnBack = document.getElementById('btn-back-title');
    const btnStartRun = document.getElementById('btn-start-run');

    // -----------------------------
    // Back to start screen
    // -----------------------------
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.screenManager.transitionTo('start-screen');
            selectedHeroId = null;
        });
    }

    // -----------------------------
    // Start run
    // -----------------------------
    if (btnStartRun) {
        btnStartRun.addEventListener('click', () => {
            if (!selectedHeroId) {
                console.warn('[HeroSelect] No hero selected');
                return;
            }

            game.audioManager.playSFX('ui_confirm');
            game.startNewRun(selectedHeroId);
        });
    }

    // -----------------------------
    // Screen enter hook - listen for BOTH event names
    // -----------------------------
    const handleScreenEnter = (screenId) => {
        if (screenId === 'hero-select-screen') {
            // Set background
            const bgPath = game.getBackgroundPath('heroselect1');
            const heroSelectEl = document.getElementById('hero-select-screen');
            if (heroSelectEl) {
                heroSelectEl.style.backgroundImage = `url('${bgPath}')`;
                heroSelectEl.style.backgroundSize = 'cover';
                heroSelectEl.style.backgroundPosition = 'center';
            }
            
            // Background music continues from start screen
            // (background.mp3 is already playing)
            
            renderHeroCards(game);
        }
    };
    
    // Listen for both event names for compatibility
    game.eventBus.on('screen:changed', ({ to }) => handleScreenEnter(to));
    game.eventBus.on('screen:change', (screenId) => handleScreenEnter(screenId));
}

/**
 * Render hero cards
 */
function renderHeroCards(game) {
    const container = document.getElementById('hero-cards');
    const btnStartRun = document.getElementById('btn-start-run');

    if (!container) {
        console.error('[HeroSelect] Hero cards container not found');
        return;
    }

    const heroes = game.dataLoader.getAllHeroes();
    
    if (!heroes || heroes.length === 0) {
        console.error('[HeroSelect] No heroes found from dataLoader');
        container.innerHTML = '<p class="error-message">No heroes available</p>';
        return;
    }

    console.log(`[HeroSelect] Rendering ${heroes.length} heroes`);

    container.innerHTML = heroes.map(hero => `
        <div class="hero-card ${hero.locked ? 'locked' : ''}"
             data-hero-id="${hero.id}">
             
            <div class="hero-card-portrait">
                <div class="hero-silhouette ${hero.id}"></div>
            </div>

            <div class="hero-card-info">
                <h3 class="hero-card-name">${hero.name}</h3>
                <p class="hero-card-title">${hero.title}</p>
            </div>

            ${hero.locked ? `
                <div class="locked-overlay">
                    <span>🔒</span>
                </div>
            ` : ''}
        </div>
    `).join('');

    // Attach interactions ONLY to unlocked heroes
    container.querySelectorAll('.hero-card:not(.locked)').forEach(card => {
        const heroId = card.dataset.heroId;

        card.addEventListener('click', () => {
            selectHero(game, heroId);
        });

        card.addEventListener('mouseenter', () => {
            if (!selectedHeroId) {
                displayHeroDetails(game, heroId);
            }
        });
    });

    // Reset selection state
    selectedHeroId = null;
    if (btnStartRun) btnStartRun.disabled = true;
    clearHeroDetails();
}

/**
 * Select hero
 */
function selectHero(game, heroId) {
    game.audioManager.playSFX('ui_click');

    document.querySelectorAll('.hero-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(
        `.hero-card[data-hero-id="${heroId}"]`
    );

    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    selectedHeroId = heroId;
    console.log(`[HeroSelect] Selected hero: ${heroId}`);

    const btnStartRun = document.getElementById('btn-start-run');
    if (btnStartRun) btnStartRun.disabled = false;

    displayHeroDetails(game, heroId);
}

/**
 * Display hero details panel
 */
function displayHeroDetails(game, heroId) {
    const hero = game.dataLoader.getHero(heroId);
    if (!hero) {
        console.warn(`[HeroSelect] Hero not found: ${heroId}`);
        return;
    }

    // Portrait
    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = `hero-portrait ${heroId}`;
        portrait.innerHTML = `<div class="hero-portrait-inner"></div>`;
    }

    // Text
    setText('hero-name', hero.name);
    setText('hero-title', hero.title);
    setText('hero-desc', hero.description);

    // Stats
    const stats = document.getElementById('hero-stats');
    if (stats) {
        stats.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">HP</span>
                <span class="stat-value">${hero.hp}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Energy</span>
                <span class="stat-value">${hero.energy}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Starting Cards</span>
                <span class="stat-value">${hero.startingDeck?.length || 10}</span>
            </div>
        `;
    }

    // Archetypes
    const archetypes = document.getElementById('hero-archetypes');
    if (archetypes && hero.archetypes?.length) {
        archetypes.innerHTML = `
            <h4>Archetypes</h4>
            <div class="archetype-list">
                ${hero.archetypes.map(a => `
                    <div class="archetype">
                        <span class="archetype-name">${a.name}</span>
                        <span class="archetype-desc">${a.description}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

/**
 * Clear hero details panel
 */
function clearHeroDetails() {
    setText('hero-name', 'Select a Hero');
    setText('hero-title', '');
    setText(
        'hero-desc',
        'Choose your operative for this descent into the void.'
    );

    const stats = document.getElementById('hero-stats');
    if (stats) stats.innerHTML = '';

    const archetypes = document.getElementById('hero-archetypes');
    if (archetypes) archetypes.innerHTML = '';

    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = 'hero-portrait';
        portrait.innerHTML = '';
    }
}

/**
 * Utility
 */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
