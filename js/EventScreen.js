/**
 * EventScreen - Handles narrative event encounters
 */

export function setupEventScreen(game) {
    const screen = document.getElementById('event-screen');
    const choicesContainer = document.getElementById('event-choices');
    
    let currentEvent = null;
    
    // Listen for event triggers
    game.eventBus.on('event:start', (eventData) => {
        currentEvent = eventData;
        displayEvent(eventData);
    });
    
    function displayEvent(event) {
        // Set title
        const titleEl = document.getElementById('event-title');
        if (titleEl) titleEl.textContent = event.name;
        
        // Set narrative text
        const textEl = document.getElementById('event-text');
        if (textEl) textEl.textContent = event.description;
        
        // Set image (or placeholder)
        const imageEl = document.getElementById('event-image');
        if (imageEl) {
            imageEl.style.backgroundImage = event.image 
                ? `url(${event.image})` 
                : 'linear-gradient(45deg, #1a1a2e, #16213e)';
        }
        
        // Display choices
        if (choicesContainer) {
            choicesContainer.innerHTML = event.choices.map((choice, index) => `
                <button class="event-choice" data-index="${index}">
                    <span class="choice-text">${choice.text}</span>
                    ${choice.preview ? `<span class="choice-preview">${choice.preview}</span>` : ''}
                </button>
            `).join('');
            
            // Add click handlers
            choicesContainer.querySelectorAll('.event-choice').forEach(btn => {
                btn.addEventListener('click', () => selectChoice(parseInt(btn.dataset.index)));
            });
        }
    }
    
    function selectChoice(index) {
        if (!currentEvent || !currentEvent.choices[index]) return;
        
        const choice = currentEvent.choices[index];
        
        // Apply effects
        if (choice.effects) {
            game.rewards.generateEventRewards(choice.effects);
        }
        
        // Show result narrative if any
        if (choice.result) {
            showResult(choice.result);
        } else {
            completeEvent();
        }
        
        game.eventBus.emit('event:choice', { event: currentEvent, choice, index });
    }
    
    function showResult(resultText) {
        const textEl = document.getElementById('event-text');
        if (textEl) {
            textEl.innerHTML = `<p class="event-result">${resultText}</p>`;
        }
        
        // Replace choices with continue button
        if (choicesContainer) {
            choicesContainer.innerHTML = `
                <button class="event-choice continue-btn" id="event-continue">
                    <span class="choice-text">Continue</span>
                </button>
            `;
            document.getElementById('event-continue').addEventListener('click', completeEvent);
        }
    }
    
    function completeEvent() {
        game.eventBus.emit('event:complete', currentEvent);
        game.mapGenerator.completeCurrentNode();
        game.screenManager.transitionTo('map-screen');
        currentEvent = null;
    }
    
    return { displayEvent, selectChoice };
}
