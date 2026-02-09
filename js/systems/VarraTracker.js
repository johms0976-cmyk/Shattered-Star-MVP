/**
 * VarraTracker - Scrap-Chief Varra Recurring NPC System
 * Shattered Star
 * 
 * Tracks interactions with Scrap-Chief Varra throughout Act 1.
 * She appears at multiple points with different roles:
 * 
 * Encounter 1 (early, nodes 2-5): Introduction - a tense first meeting
 * Encounter 2 (mid, nodes 7-10): The deal - she offers something with strings
 * Encounter 3 (pre-boss): She reveals her connection to the Scrap-King
 * Post-boss: Appears in epilogue based on relationship
 * 
 * Her dialogue and offerings change based on:
 * - How you treated her previously
 * - Your corruption level
 * - Your Rustborn reputation
 */

class VarraTracker {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Initialize Varra state if not present
        if (!this.state.get('npc.varra')) {
            this.state.set('npc.varra', {
                metCount: 0,
                relationship: 'neutral', // hostile, wary, neutral, friendly, allied
                debtOwed: false,
                betrayed: false,
                gaveScrap: false,
                sharedIntel: false,
                lastChoice: null,
                remembers: []
            });
        }
    }
    
    /**
     * Get Varra state
     */
    getState() {
        return this.state.get('npc.varra') || {
            metCount: 0,
            relationship: 'neutral',
            debtOwed: false,
            betrayed: false,
            remembers: []
        };
    }
    
    /**
     * Update Varra state
     */
    updateState(updates) {
        const current = this.getState();
        this.state.set('npc.varra', { ...current, ...updates });
    }
    
    /**
     * Record a player choice regarding Varra
     */
    recordChoice(choiceId, description) {
        const state = this.getState();
        state.remembers.push({ choice: choiceId, description, node: this.state.get('map.visitedNodes')?.length || 0 });
        state.lastChoice = choiceId;
        state.metCount += 1;
        this.state.set('npc.varra', state);
    }
    
    /**
     * Get the appropriate Varra event based on progress
     */
    getNextVarraEvent() {
        const varraState = this.getState();
        const nodesVisited = this.state.get('map.visitedNodes')?.length || 0;
        
        // First encounter: Introduction (nodes 2-5)
        if (varraState.metCount === 0 && nodesVisited >= 2 && nodesVisited <= 6) {
            return this.firstEncounter();
        }
        
        // Second encounter: The Deal (nodes 7-10, only if met before)
        if (varraState.metCount === 1 && nodesVisited >= 7 && nodesVisited <= 11) {
            return this.secondEncounter();
        }
        
        return null;
    }
    
    /**
     * Check if a Varra event should trigger at this node
     */
    shouldTrigger() {
        const varraState = this.getState();
        const nodesVisited = this.state.get('map.visitedNodes')?.length || 0;
        
        // First encounter chance
        if (varraState.metCount === 0 && nodesVisited >= 2 && nodesVisited <= 6) {
            return Math.random() < 0.35; // 35% per event node
        }
        
        // Second encounter chance
        if (varraState.metCount === 1 && nodesVisited >= 7 && nodesVisited <= 11) {
            return Math.random() < 0.4; // 40% per event node
        }
        
        return false;
    }
    
    // =========================================
    // ENCOUNTER 1: FIRST MEETING
    // =========================================
    
    firstEncounter() {
        const corruption = this.state.get('corruption') || 0;
        const rustbornRep = this.state.get('factions.rustborn') || 0;
        
        return {
            id: 'varra_encounter_1',
            name: 'The Scrap-Chief',
            type: 'npc',
            npc: 'varra',
            image: 'varra_portrait',
            text: [
                "A sharp whistle cuts through the rust-wind. Three Rustborn warriors materialize from behind scrap heaps, weapons drawn but not yet hostile.",
                "Their leader steps forward — a woman with chrome-capped teeth, a mechanical left arm, and eyes that miss nothing. Scrap insignia on her shoulder marks her rank.",
                "\"Scrap-Chief Varra,\" she says, like you should know the name. \"You're the offworlder who fell from the sky.\"",
                "She circles you slowly, mechanical arm clicking softly. \"My scouts have been tracking you since the crash site. You fight well for someone who doesn't belong here.\"",
                rustbornRep > 0 
                    ? "\"Word travels fast in the wastes. Some of my people say you've been... helpful.\"" 
                    : "\"My people don't trust outsiders. Neither do I. But I'm practical.\"",
                "\"I have a proposition.\""
            ],
            choices: [
                {
                    text: "\"I'm listening, Chief.\" Show respect.",
                    choiceId: 'respectful',
                    effects: {
                        reputation: { rustborn: 1 },
                        relationship: 'friendly'
                    },
                    result: "Varra's chrome teeth flash in what might be a smile.\n\n\"Smart. The wastes are controlled by the Scrap-King — a warlord who unified three tribes by force. He sits in his iron fortress at the far end of these wastes, growing more paranoid every day.\"\n\nShe leans close. \"I was next in line to lead before he took power. I still have loyalists. And I think you might be useful.\"\n\nShe presses a small device into your hand — a Rustborn frequency transponder.\n\n\"Keep this. When you're near my people, they'll know you're not to be shot on sight. Probably.\"\n\n*Gained: Varra's Transponder (Rustborn enemies may surrender in combat)*\n*Rustborn reputation +1*"
                },
                {
                    text: "\"What's in it for me?\" Be direct.",
                    choiceId: 'pragmatic',
                    effects: {
                        credits: 25,
                        relationship: 'neutral'
                    },
                    result: "Varra nods, unsurprised. \"I like that. No pretense.\"\n\n\"The Scrap-King has been stockpiling Ancient tech. Weapons your people would understand better than mine. Help me destabilize his rule, and I'll make sure some of that tech finds its way to you.\"\n\nShe tosses you a pouch of credits — advance payment.\n\n\"Consider it a retainer. We'll talk again.\"\n\n*Gained: 25 Credits*"
                },
                {
                    text: "\"I don't work for warlords.\" Refuse.",
                    choiceId: 'refuse',
                    effects: {
                        reputation: { rustborn: -1 },
                        relationship: 'wary'
                    },
                    result: "Varra's expression hardens. Her mechanical arm clenches.\n\n\"Chief, not warlord. There's a difference. The Scrap-King is the warlord.\"\n\nShe steps back. \"Fine. Walk the wastes alone. But remember — everyone needs allies out here. Especially outsiders.\"\n\nHer warriors melt back into the scrap. Varra pauses at the edge of visibility.\n\n\"You'll come around. They all do.\"\n\n*Rustborn reputation -1*"
                },
                {
                    text: corruption >= 20 
                        ? "[Corruption 20+] Let the void read her intentions." 
                        : "[Requires Corruption 20+]",
                    choiceId: 'void_read',
                    requiresCorruption: 20,
                    disabled: corruption < 20,
                    effects: {
                        corruption: 3,
                        relationship: 'wary',
                        loreUnlock: 'varra_secrets'
                    },
                    result: "Your eyes darken. The void reaches out, brushing against Varra's mind.\n\nYou see: grief. A brother lost to something that whispered from the deep. Ambition, yes — but born from desperation, not greed. And fear. Deep, bone-level fear of what the Scrap-King is becoming.\n\nVarra staggers back, hand going to her weapon. \"What did you just—\"\n\nHer warriors raise their blades. But she holds up a hand.\n\n\"You're touched by it too,\" she whispers. \"The same thing that took my brother.\"\n\nShe leaves quickly. But you saw truth in her fear.\n\n*Corruption +3*\n*Learned: Varra's brother became the Scrap-King*"
                }
            ]
        };
    }
    
    // =========================================
    // ENCOUNTER 2: THE DEAL
    // =========================================
    
    secondEncounter() {
        const varraState = this.getState();
        const corruption = this.state.get('corruption') || 0;
        const lastChoice = varraState.lastChoice;
        
        // Opening line changes based on first encounter
        const openingVariants = {
            respectful: "\"Offworlder.\" This time, Varra approaches alone. Her mechanical arm carries a heavy satchel. \"You kept my transponder. Good. That means you're not stupid.\"",
            pragmatic: "\"Back for more credits?\" Varra appears from behind a rusted hull, amused. \"I like consistent people.\"",
            refuse: "\"Don't shoot,\" Varra calls from twenty meters away, hands visible. \"I know we didn't part well. But circumstances have changed.\"",
            void_read: "Varra approaches cautiously, one hand on her blade. \"I've been thinking about what you did. What you... saw. I need to know — can you see the same thing in the Scrap-King?\""
        };
        
        const opening = openingVariants[lastChoice] || openingVariants.pragmatic;
        
        return {
            id: 'varra_encounter_2',
            name: 'Varra\'s Bargain',
            type: 'npc',
            npc: 'varra',
            image: 'varra_portrait',
            text: [
                opening,
                "She sets the satchel down and opens it. Inside: a collection of scrap-tech components, a crude map, and something wrapped in void-resistant cloth.",
                "\"The Scrap-King is preparing something. My scouts say he's building a device from Ancient tech — something that channels the energy from beneath the planet. Whatever he found down there is making him stronger. And crazier.\"",
                "\"I need you to take him down. And I can help. But it's going to cost us both.\""
            ],
            choices: [
                {
                    text: "\"What are you offering?\"",
                    choiceId: 'accept_deal',
                    effects: {
                        artifact: {
                            id: 'varras_scrap_map',
                            name: "Varra's Scrap Map",
                            rarity: 'uncommon',
                            description: 'Reveals one hidden path per map. Shop prices reduced by 10%.'
                        },
                        reputation: { rustborn: 1 },
                        relationship: 'friendly',
                        debtOwed: true
                    },
                    result: "Varra unwraps the void-resistant cloth, revealing a detailed map etched in scrap-metal — every path through the wastes, including hidden supply caches and shortcuts.\n\n\"This is everything my scouts have gathered. Secret paths. Weapon stashes. The King's patrol routes.\"\n\nShe holds it out. \"Take it. Use it. Kill the King.\"\n\nHer voice drops. \"And when it's over — when the throne is empty — you support my claim. That's the deal.\"\n\n*Gained: Varra's Scrap Map*\n*Rustborn reputation +1*\n*You owe Varra a debt.*"
                },
                {
                    text: "\"I'll help. But I want something from his vault.\"",
                    choiceId: 'negotiate',
                    effects: {
                        credits: 40,
                        reputation: { rustborn: 0 },
                        relationship: 'neutral',
                        debtOwed: false
                    },
                    result: "Varra considers. \"Bold. The vault has Ancient tech that could power a small army.\"\n\nShe nods slowly. \"Fine. Kill the King, and you get first pick from his vault before my people move in. One item. Non-negotiable.\"\n\nShe tosses you the credits from the satchel. \"Advance payment. Don't spend it all in one place.\"\n\nHer chrome teeth glint. \"Business is business.\"\n\n*Gained: 40 Credits*\n*Post-boss vault access promised*"
                },
                {
                    text: "\"I was already going to fight him. You just want to ride my victory.\"",
                    choiceId: 'call_out',
                    effects: {
                        reputation: { rustborn: -1 },
                        relationship: 'wary',
                        playerBuff: { type: 'strength', value: 1 }
                    },
                    result: "Varra's mechanical arm whirs. For a moment, you think she might swing.\n\nThen she laughs. \"You've got steel in you, offworlder. Wrong, but steel.\"\n\n\"Fine. Kill the King your way. But when the dust settles and you need the Rustborn — and you WILL need the Rustborn — remember that I offered partnership, and you chose pride.\"\n\nShe leaves the satchel. \"Keep the supplies. Consider them motivation.\"\n\n*Gained: +1 Strength (battle focus)*\n*Rustborn reputation -1*"
                }
            ]
        };
    }
    
    // =========================================
    // POST-BOSS APPEARANCE
    // =========================================
    
    /**
     * Get Varra's post-boss dialogue (appears after post-boss event)
     */
    getPostBossDialogue() {
        const varraState = this.getState();
        
        if (varraState.metCount === 0) {
            // Never met Varra — she appears briefly
            return {
                speaker: 'Unknown Voice',
                text: "As you leave the fortress, a figure watches from the scrap-line. Chrome teeth catch the light. She nods once, then vanishes.\n\nYou get the feeling you'll see her again."
            };
        }
        
        const variants = {
            friendly: {
                speaker: 'Scrap-Chief Varra',
                text: "Varra finds you outside the fortress. Her warriors are already moving in, securing the throne.\n\n\"You did it.\" She looks at the Scrap-King's body — her brother's body — and something breaks behind her eyes. Just for a moment.\n\n\"I'll hold the wastes. You go east — toward the Marsh. My scouts say the signal is coming from there.\"\n\nShe grips your arm. \"Whatever my brother became, whatever changed him — it's bigger than one warlord. Find the source. End it.\"\n\n\"And offworlder? You have a friend in the Rustborn now. Don't forget that.\""
            },
            neutral: {
                speaker: 'Scrap-Chief Varra',
                text: "Varra appears at the fortress gate, flanked by warriors. She surveys the scene with cold efficiency.\n\n\"The throne is empty. Time I filled it.\"\n\nShe glances at you. \"The signal from the east — the Marsh. That's where you need to go next. My scouts can get you to the border.\"\n\nIt's not warmth. But it's respect.\n\n\"We're not friends, offworlder. But I pay my debts.\""
            },
            wary: {
                speaker: 'Scrap-Chief Varra',
                text: "Varra watches from a distance as her warriors claim the fortress. She doesn't approach.\n\nOne of her scouts hands you a scrap-metal chip with coordinates etched on it. \"From the Chief. The Marsh. East.\"\n\nThe scout pauses. \"She says: 'Don't come back to the wastes unless you're invited.'\"\n\nNot hostile. But the door is barely open."
            }
        };
        
        // Map relationship to variant
        const relationship = varraState.relationship || 'neutral';
        if (relationship === 'allied' || relationship === 'friendly') {
            return variants.friendly;
        } else if (relationship === 'wary' || relationship === 'hostile') {
            return variants.wary;
        }
        return variants.neutral;
    }
}

export default VarraTracker;
