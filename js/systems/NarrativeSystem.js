/**
 * NarrativeSystem.js - Cosmic Horror Narrative Engine
 * 
 * Creates mounting dread, void whispers, and atmospheric storytelling
 * that makes each node feel progressively more dangerous.
 * 
 * "The void remembers. And now, it watches."
 */

class NarrativeSystem {
    constructor(eventBus, gameState) {
        this.eventBus = eventBus;
        this.state = gameState;
        
        // Dread accumulates throughout a run - never fully resets
        this.dread = 0;
        this.maxDread = 100;
        
        // Whisper state
        this.whisperQueue = [];
        this.lastWhisperTime = 0;
        this.whisperCooldown = 15000; // 15 seconds between whispers
        
        // Story progression
        this.loreDiscovered = new Set();
        this.foreshadowingRevealed = [];
        
        // Void awareness - how much "it" notices you
        this.voidAwareness = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startWhisperLoop();
        console.log('[NarrativeSystem] The void stirs...');
    }
    
    setupEventListeners() {
        // Combat increases dread
        this.eventBus.on('combat:start', () => this.addDread(2));
        this.eventBus.on('combat:victory', () => this.addDread(1));
        this.eventBus.on('player:damage', (amount) => this.addDread(Math.ceil(amount / 10)));
        
        // Corruption dramatically increases void awareness
        this.eventBus.on('corruption:changed', (data) => {
            this.voidAwareness = Math.floor(data.current / 10);
            if (data.current >= 25) this.triggerWhisper('corruption_rising');
            if (data.current >= 50) this.triggerWhisper('corruption_high');
            if (data.current >= 75) this.triggerWhisper('corruption_critical');
        });
        
        // Node progression increases dread
        this.eventBus.on('node:enter', (node) => this.onNodeEnter(node));
        this.eventBus.on('node:complete', () => this.addDread(1));
        
        // Boss encounters spike dread
        this.eventBus.on('boss:encounter', () => {
            this.addDread(15);
            this.triggerWhisper('boss_approach');
        });
        
        // Act transitions
        this.eventBus.on('act:begin', (act) => this.onActBegin(act));
        
        // Death resets some but not all
        this.eventBus.on('player:death', () => this.onDeath());
    }
    
    /**
     * Add dread - the core tension mechanic
     */
    addDread(amount) {
        const oldDread = this.dread;
        this.dread = Math.min(this.maxDread, this.dread + amount);
        
        // Emit for UI updates
        this.eventBus.emit('dread:changed', {
            current: this.dread,
            previous: oldDread,
            max: this.maxDread
        });
        
        // Threshold triggers
        if (oldDread < 25 && this.dread >= 25) {
            this.triggerWhisper('dread_rising');
        }
        if (oldDread < 50 && this.dread >= 50) {
            this.triggerWhisper('dread_high');
            this.eventBus.emit('atmosphere:intensify');
        }
        if (oldDread < 75 && this.dread >= 75) {
            this.triggerWhisper('dread_critical');
            this.eventBus.emit('atmosphere:critical');
        }
    }
    
    /**
     * Get current dread level (for other systems)
     */
    getDreadLevel() {
        if (this.dread < 25) return 'calm';
        if (this.dread < 50) return 'uneasy';
        if (this.dread < 75) return 'dread';
        return 'terror';
    }
    
    /**
     * Node entry - generate atmospheric description
     */
    onNodeEnter(node) {
        const floor = this.state.get('floor') || 1;
        const corruption = this.state.get('corruption') || 0;
        
        // Deeper floors = more dread
        this.addDread(Math.floor(floor / 3));
        
        // Generate atmospheric intro based on node type and state
        const atmosphere = this.generateNodeAtmosphere(node, floor, corruption);
        
        this.eventBus.emit('narrative:atmosphere', atmosphere);
        
        // Chance for whisper on node entry
        if (Math.random() < 0.3 + (this.dread / 200)) {
            setTimeout(() => this.triggerRandomWhisper(), 2000);
        }
    }
    
    /**
     * Generate atmospheric text for a node
     */
    generateNodeAtmosphere(node, floor, corruption) {
        const dreadLevel = this.getDreadLevel();
        const nodeType = node?.type || 'unknown';
        
        const atmospheres = {
            combat: this.getCombatAtmosphere(dreadLevel, floor, corruption),
            elite: this.getEliteAtmosphere(dreadLevel, floor, corruption),
            boss: this.getBossAtmosphere(dreadLevel, floor, corruption),
            event: this.getEventAtmosphere(dreadLevel, floor, corruption),
            shop: this.getShopAtmosphere(dreadLevel, floor, corruption),
            rest: this.getRestAtmosphere(dreadLevel, floor, corruption),
            treasure: this.getTreasureAtmosphere(dreadLevel, floor, corruption),
            corrupted: this.getCorruptedAtmosphere(dreadLevel, floor, corruption)
        };
        
        return atmospheres[nodeType] || this.getDefaultAtmosphere(dreadLevel);
    }
    
    getCombatAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "Movement ahead. Something stirs in the ruins.",
                "The path narrows. You are not alone.",
                "Shadows shift. Hostiles detected.",
                "Your thermal sensors spike. Contact imminent."
            ],
            uneasy: [
                "The air grows cold. They've found you.",
                "Rust-wind carries the smell of violence. Something comes.",
                "Your reactor flares. It knows you're here.",
                "The darkness ahead... breathes."
            ],
            dread: [
                "Reality shivers. The void has sent its children.",
                "Your reflection in the metal shows something else. It's coming.",
                "The whispers crescendo into screams. Combat is certain.",
                "You feel your future narrow to a single point. Fight."
            ],
            terror: [
                "T̴h̷e̸y̵ ̸s̶e̷e̵ ̶y̷o̴u̵.̷ They have always seen you.",
                "What approaches wears the face of your fears.",
                "The void opens its mouth. You are already inside.",
                "This was always going to happen. The Pattern demands it."
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getEliteAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "Something powerful guards this path.",
                "You sense a presence far stronger than the rest.",
                "A worthy adversary awaits. Steel yourself."
            ],
            uneasy: [
                "The air itself recoils. Something terrible is near.",
                "Your instincts scream retreat. But there is no retreat.",
                "It has been waiting. For how long, you cannot say."
            ],
            dread: [
                "The creature ahead has killed before. Many times.",
                "Your reflection shows you dying. Is that a warning, or a memory?",
                "The void's champion blocks your path. It knows your name."
            ],
            terror: [
                "W̶h̷a̵t̸ ̷w̸a̸i̶t̵s̷ ̵a̴h̵e̷a̶d̷ was human once. Maybe.",
                "It speaks to the void. The void answers.",
                "This is not a fight. This is a sacrifice. Yours, or theirs."
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getBossAtmosphere(dreadLevel, floor, corruption) {
        return [
            "The air fractures. A Herald approaches.",
            "You have walked far into the dark. Now the dark walks toward you.",
            "The Seal weakens. What was bound stirs.",
            "You feel the weight of the planet's pain. Its tormentor is near.",
            "Every step you've taken led here. Was it your choice, or theirs?",
            "The void holds its breath. The Pattern watches. One of you will end."
        ][Math.floor(Math.random() * 6)];
    }
    
    getEventAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "Something unusual ahead. Not hostile... yet.",
                "A break in the violence. But for how long?",
                "The path offers a choice. Choose wisely."
            ],
            uneasy: [
                "Something waits to be found. Or to find you.",
                "The rust-wind carries whispers of opportunity. And danger.",
                "A moment of decision approaches. The void is watching."
            ],
            dread: [
                "Fate coils around this place. Tread carefully.",
                "The Pattern branches here. Some paths end in darkness.",
                "What awaits was placed here for you. The question is: by whom?"
            ],
            terror: [
                "T̷h̶i̵s̷ ̶m̸o̵m̷e̵n̶t̷ ̷w̵a̶s̴ ̸f̴o̸r̵e̸s̸e̸e̸n̶.̵",
                "The void has prepared a gift. All gifts have prices.",
                "Reality is thin here. What you choose may not be what happens."
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getShopAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "A trader has made camp. Commerce survives even here.",
                "Supplies. Rare in the wastes. Precious.",
                "The merchant's eyes hold secrets. Their wares hold power."
            ],
            uneasy: [
                "A merchant emerges from shadows. What else lurks there?",
                "Trade requires trust. Trust is a luxury in the wastes.",
                "The prices seem fair. Nothing in the wastes is fair."
            ],
            dread: [
                "The trader knows too much. Knows your name. Your fears.",
                "These wares have history. Some of it screams.",
                "Who supplies the merchants this deep in the void's shadow?"
            ],
            terror: [
                "The merchant's smile doesn't reach their eyes. Nothing does.",
                "Some of these items remember their previous owners. They died badly.",
                "Currency is meaningless here. What do they really want?"
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getRestAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "A moment of peace. Savor it.",
                "The fire crackles. Safety, for now.",
                "Rest your wounds. The path ahead is long."
            ],
            uneasy: [
                "The fire keeps the dark at bay. For how long?",
                "Sleep comes hard. Dreams harder.",
                "Peace is temporary. The void never rests."
            ],
            dread: [
                "Even here, you feel watched. The fire's light doesn't reach far enough.",
                "Your dreams will not be kind tonight.",
                "Rest while you can. Something is counting the hours."
            ],
            terror: [
                "The flames show you things. Things that haven't happened yet.",
                "Close your eyes. In the dark, something smiles.",
                "Rest? T̷h̴e̸ ̸v̵o̸i̷d̶ ̶k̵n̵o̵w̸s̷ ̴n̶o̸ ̵s̸l̸e̴e̶p̶.̷"
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getTreasureAtmosphere(dreadLevel, floor, corruption) {
        const intros = {
            calm: [
                "Salvage. Valuable, if you can claim it.",
                "Treasure from before the fall. Still intact.",
                "Power awaits those bold enough to take it."
            ],
            uneasy: [
                "This cache was hidden for a reason.",
                "Treasure unguarded is treasure that guards itself.",
                "What price did the previous owner pay?"
            ],
            dread: [
                "The artifacts pulse with void energy. Dangerous. Tempting.",
                "This was bait once. Is it still?",
                "Power corrupts. Corrupt power consumes."
            ],
            terror: [
                "The treasure calls to you. By name.",
                "T̵a̷k̴e̸ ̸i̸t̵.̴ ̵W̶e̶ ̸w̴a̴n̸t̸ ̴y̶o̸u̵ ̴t̶o̸ ̸t̶a̵k̷e̸ ̴i̵t̸.̶",
                "The artifacts remember. They remember everyone."
            ]
        };
        
        const pool = intros[dreadLevel] || intros.calm;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    getCorruptedAtmosphere(dreadLevel, floor, corruption) {
        return [
            "Reality bleeds here. The Seal weakens.",
            "The void has touched this place. It never lets go.",
            "Colors that shouldn't exist. Sounds that shouldn't be heard.",
            "Your shadow moves independently. Watching.",
            "The corruption here is old. Patient. Hungry.",
            "Step carefully. The ground remembers what the void has taken.",
            "T̶h̵e̶ ̷P̷a̷t̴t̵e̴r̴n̷ ̷f̴r̸a̶c̵t̵u̶r̷e̵s̵.̷ ̵Y̵o̴u̷ ̸a̴r̶e̴ ̸t̴h̵e̶ ̴c̴r̶a̵c̵k̷.̶",
            "What walks here is not entirely real. Neither are you, anymore."
        ][Math.floor(Math.random() * 8)];
    }
    
    getDefaultAtmosphere(dreadLevel) {
        return "The path continues. The void watches.";
    }
    
    /**
     * Void whisper system - subtle horror messages
     */
    triggerWhisper(type) {
        const now = Date.now();
        if (now - this.lastWhisperTime < this.whisperCooldown) {
            this.whisperQueue.push(type);
            return;
        }
        
        this.lastWhisperTime = now;
        const whisper = this.generateWhisper(type);
        
        this.eventBus.emit('void:whisper', whisper);
    }
    
    triggerRandomWhisper() {
        const corruption = this.state.get('corruption') || 0;
        const floor = this.state.get('floor') || 1;
        const hero = this.state.get('hero.id') || 'korvax';
        
        const types = ['ambient', 'foreshadow', 'taunt'];
        if (corruption > 25) types.push('corruption', 'corruption');
        if (floor > 5) types.push('deep', 'foreshadow');
        if (this.voidAwareness > 5) types.push('aware', 'aware', 'personal');
        
        const type = types[Math.floor(Math.random() * types.length)];
        this.triggerWhisper(type);
    }
    
    generateWhisper(type) {
        const hero = this.state.get('hero.id') || 'korvax';
        const corruption = this.state.get('corruption') || 0;
        const floor = this.state.get('floor') || 1;
        
        const whispers = {
            ambient: [
                "...can you hear us?...",
                "...the stars are wrong...",
                "...we remember...",
                "...not alone...",
                "...falling forever...",
                "...the pattern breaks...",
                "...it was always going to be you...",
                "...we see your future...",
                "...such beautiful pain...",
                "...the seal cracks..."
            ],
            corruption_rising: [
                "...the void takes root in you...",
                "...yes... let it in...",
                "...you're becoming... more...",
                "...corruption is just another word for freedom...",
                "...the darkness feels warm, doesn't it?..."
            ],
            corruption_high: [
                "...you're almost one of us...",
                "...the boundary blurs...",
                "...can you still tell which thoughts are yours?...",
                "...beautiful... so beautiful...",
                "...the transformation is nearly complete..."
            ],
            corruption_critical: [
                "...WELCOME HOME...",
                "...you were always void...",
                "...the mask slips...",
                "...w̵e̸ ̴a̶r̷e̸ ̶y̸o̵u̶ ̸n̵o̷w̴...",
                "...there is no going back..."
            ],
            dread_rising: [
                "...they know you're coming...",
                "...something follows...",
                "...the shadows grow longer...",
                "...each step echoes in the void..."
            ],
            dread_high: [
                "...the Heralds stir...",
                "...you've come so far to die...",
                "...fear is just wisdom in disguise...",
                "...run. please run. (don't run)..."
            ],
            dread_critical: [
                "...THE WORLD-EATER WAKES...",
                "...the Pattern demands sacrifice...",
                "...Xal'Korath knows your name...",
                "...this reality was never meant to last..."
            ],
            foreshadow: [
                "...the Scrap-King awaits his throne...",
                "...the Fallen Paladin still believes...",
                "...the Whisper King has worn your face...",
                "...the Heralds were protectors once...",
                "...the Seals cannot hold forever...",
                "...the Architects failed. so will you..."
            ],
            boss_approach: [
                "...it knows you're coming...",
                "...the Herald senses your warmth...",
                "...this was always the end...",
                "...one of you will not leave this place..."
            ],
            taunt: [
                "...your friends died here too...",
                "...we've seen how this ends...",
                "...struggle makes it sweeter...",
                "...the Dawnseeker fell. so will you...",
                "...your hope is delicious..."
            ],
            aware: [
                "...we see you...",
                "...you cannot hide...",
                "...we know your thoughts...",
                "...running only makes us hungrier...",
                "...YOU..."
            ],
            personal: this.getPersonalWhispers(hero),
            deep: [
                "...the Architects left warnings...",
                "...Vharos dreams of oblivion...",
                "...the fifth seal was never completed...",
                "...the planet screams in frequencies you cannot hear...",
                "...every run is a recursion..."
            ]
        };
        
        const pool = whispers[type] || whispers.ambient;
        const text = pool[Math.floor(Math.random() * pool.length)];
        
        return {
            text,
            type,
            intensity: this.getWhisperIntensity(),
            corruption
        };
    }
    
    getPersonalWhispers(hero) {
        const personalWhispers = {
            korvax: [
                "...your reactor will fail...",
                "...the engineer still lives...",
                "...you were built to destroy. fulfill your purpose...",
                "...the heat inside you is our gift...",
                "...broken titan. shattered star..."
            ],
            lyria: [
                "...we exist in all your timelines...",
                "...the Marsh remembers your other selves...",
                "...temporal mage. time is our domain...",
                "...you've died here before. you will again...",
                "...which timeline is real? (none of them)..."
            ],
            auren: [
                "...your faith is a candle in an infinite dark...",
                "...the light abandoned this place long ago...",
                "...even paladins fall...",
                "...we were gods once. we will be again...",
                "...your mentor awaits..."
            ],
            shade: [
                "...you're already dead. you just don't know it...",
                "...the Whisper King knows your true name...",
                "...how many masks do you wear?...",
                "...identity is illusion. we can free you...",
                "...you are our echo..."
            ]
        };
        
        return personalWhispers[hero] || personalWhispers.korvax;
    }
    
    getWhisperIntensity() {
        if (this.dread < 25) return 'subtle';
        if (this.dread < 50) return 'noticeable';
        if (this.dread < 75) return 'strong';
        return 'overwhelming';
    }
    
    /**
     * Background whisper loop
     */
    startWhisperLoop() {
        setInterval(() => {
            // Process queued whispers
            if (this.whisperQueue.length > 0) {
                const type = this.whisperQueue.shift();
                this.triggerWhisper(type);
            }
            
            // Random ambient whispers based on dread
            const whisperChance = 0.02 + (this.dread / 500); // 2% base, up to 22% at max dread
            if (Math.random() < whisperChance) {
                this.triggerRandomWhisper();
            }
        }, 5000); // Check every 5 seconds
    }
    
    /**
     * Get narrative text for combat intro based on enemy type
     */
    getCombatNarrative(enemies) {
        const dreadLevel = this.getDreadLevel();
        const enemyCount = enemies?.length || 1;
        const corruption = this.state.get('corruption') || 0;
        
        // First enemy determines narrative
        const mainEnemy = enemies?.[0];
        const enemyId = mainEnemy?.id || 'unknown';
        
        // Check for special enemy narratives
        const specialNarratives = {
            'rust_raider': "Rustborn raiders emerge from the scrap. Survival of the fittest—and they believe they are.",
            'scrap_drone': "Corrupted machinery whirs to life. Even the machines here have forgotten their purpose.",
            'void_touched': "It might have been human once. The void has... improved it.",
            'cultist': "A Maw Choir devotee. They sing of your ending.",
            'echo_self': "It wears your face. Your moves. Your fears."
        };
        
        if (specialNarratives[enemyId]) {
            return specialNarratives[enemyId];
        }
        
        // Generic but atmospheric combat intros
        const genericIntros = [
            `${enemyCount > 1 ? 'They' : 'It'} found you. ${dreadLevel === 'terror' ? 'They always do.' : 'Fight.'}`,
            `The path demands blood. ${dreadLevel === 'terror' ? 'It prefers yours.' : 'Prove your worth.'}`,
            `Violence echoes through the wastes. Add to the chorus.`
        ];
        
        return genericIntros[Math.floor(Math.random() * genericIntros.length)];
    }
    
    /**
     * Generate outcome flavor text for events
     */
    getOutcomeNarrative(outcome, choice) {
        const dreadLevel = this.getDreadLevel();
        const corruption = this.state.get('corruption') || 0;
        
        // Add dread-based color to outcomes
        if (corruption > 50 && Math.random() < 0.3) {
            return `${outcome.description} The void whispers its approval.`;
        }
        
        if (this.dread > 75 && Math.random() < 0.3) {
            return `${outcome.description} Something in the dark takes notice.`;
        }
        
        return outcome.description;
    }
    
    /**
     * Act transitions - major narrative moments
     */
    onActBegin(act) {
        // Reset some dread but not all - the horror compounds
        this.dread = Math.floor(this.dread * 0.5) + (act * 10);
        
        const actNarratives = {
            1: "The Ironspine Wastes stretch before you. Rust and ruin as far as thermal sensors can detect. Something brought down the Dawnseeker here. Something that still watches.",
            2: "Deeper into the wound. The corruption thickens like fog. The Heralds sense your progress. They are not pleased.",
            3: "The Cradle Abyss. Where reality ends and the void begins. Xal'Korath dreams just below the surface. Your footsteps are its alarm clock."
        };
        
        this.eventBus.emit('narrative:act_intro', {
            act,
            text: actNarratives[act] || "The path continues. The end approaches."
        });
    }
    
    /**
     * Death narrative
     */
    onDeath() {
        // Dread partially persists across runs (meta-horror)
        const persistentDread = Math.floor(this.dread * 0.2);
        
        const deathNarratives = [
            "The void welcomes you home. But not for long. There's always another run.",
            "You fall. The Pattern resets. The recursion continues.",
            "Death is temporary. The void's hunger is eternal.",
            "The Architects called it 'iteration.' The void calls it 'lunch.'",
            "Rest now. Wake soon. The Pattern demands it.",
            "Your echo screams into the void. The void echoes back."
        ];
        
        this.eventBus.emit('narrative:death', {
            text: deathNarratives[Math.floor(Math.random() * deathNarratives.length)],
            persistentDread
        });
        
        // Reset for next run
        this.dread = persistentDread;
        this.voidAwareness = Math.floor(this.voidAwareness * 0.3);
    }
    
    /**
     * Discover lore - unlock story fragments
     */
    discoverLore(loreId) {
        if (!this.loreDiscovered.has(loreId)) {
            this.loreDiscovered.add(loreId);
            this.eventBus.emit('lore:discovered', {
                id: loreId,
                total: this.loreDiscovered.size
            });
            
            // Lore discovery triggers special whispers
            setTimeout(() => {
                this.triggerWhisper('foreshadow');
            }, 3000);
        }
    }
    
    /**
     * Get current narrative state (for saving)
     */
    getState() {
        return {
            dread: this.dread,
            voidAwareness: this.voidAwareness,
            loreDiscovered: Array.from(this.loreDiscovered),
            foreshadowingRevealed: this.foreshadowingRevealed
        };
    }
    
    /**
     * Restore narrative state (from save)
     */
    setState(savedState) {
        if (savedState) {
            this.dread = savedState.dread || 0;
            this.voidAwareness = savedState.voidAwareness || 0;
            this.loreDiscovered = new Set(savedState.loreDiscovered || []);
            this.foreshadowingRevealed = savedState.foreshadowingRevealed || [];
        }
    }
}

export { NarrativeSystem };
