/**
 * HeroSelectScreen - Hero selection screen handler
 * Shattered Star
 */

let selectedHeroId = null;

export function setupHeroSelect(game) {
    const btnBack = document.getElementById('btn-back-title');
    const btnStartRun = document.getElementById('btn-start-run');

    // -----------------------------
    // Back to title
    // -----------------------------
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.screenManager.transitionTo('title-screen');
            selectedHeroId = null;
        });
    }

    // -----------------------------
    // Start run
    // -----------------------------
    if (btnStartRun) {
        btnStartRun.addEventListener('click', () => {
            if (!selectedHeroId) return;

            game.audioManager.playSFX('ui_confirm');
            game.startNewRun(selectedHeroId);
        });
    }

    // -----------------------------
    // Screen enter hook
    // -----------------------------
    game.eventBus.on('screen:changed', ({ to }) => {
        if (to === 'hero-select-screen') {
            renderHeroCards(game);
        }
    });
}

/**
 * Render hero cards
 */
function renderHeroCards(game) {
    const container = document.getElementById('hero-cards');
    const btnStartRun = document.getElementById('btn-start-run');

    if (!container) return;

    const heroes = game.dataLoader.getAllHeroes();

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

    const btnStartRun = document.getElementById('btn-start-run');
    if (btnStartRun) btnStartRun.disabled = false;

    displayHeroDetails(game, heroId);
}

/**
 * Display hero details panel
 */
function displayHeroDetails(game, heroId) {
    const hero = game.dataLoader.getHero(heroId);
    if (!hero) return;

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
