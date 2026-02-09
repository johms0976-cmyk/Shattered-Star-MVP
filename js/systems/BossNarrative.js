/**
 * BossNarrative - Act 1 Boss Narrative Wrapper
 * Shattered Star
 * 
 * Manages the narrative arc around boss encounters:
 * - Pre-boss event (context, choice, preparation)
 * - Mid-fight dialogue triggers (phase transitions)
 * - Post-boss revelation (seeds Act 2)
 * 
 * For Act 1: The Scrap-King encounter in Ironspine Wastes
 */

class BossNarrative {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Track narrative state
        this.preBossChoice = null;
        this.phaseDialogueShown = {};
        this.postBossRevealed = false;
        
        // Listen for combat phase changes
        this.eventBus.on('boss:phase_change', (data) => this.onPhaseChange(data));
        this.eventBus.on('boss:defeated', () => this.onBossDefeated());
    }
    
    /**
     * Get pre-boss event data for given act/boss
     */
    getPreBossEvent(act, bossId) {
        const events = this.preBossEvents[`${act}_${bossId}`];
        if (!events) return null;
        
        // Check for Varra-specific variant
        const varraState = this.state.get('npc.varra') || {};
        if (varraState.metCount >= 1 && events.varraVariant) {
            return events.varraVariant;
        }
        
        return events.standard;
    }
    
    /**
     * Get mid-fight dialogue for phase transition
     */
    getPhaseDialogue(bossId, phase) {
        const key = `${bossId}_phase_${phase}`;
        if (this.phaseDialogueShown[key]) return null;
        
        this.phaseDialogueShown[key] = true;
        
        const dialogues = this.bossDialogues[bossId];
        if (!dialogues) return null;
        
        return dialogues[`phase${phase}`] || null;
    }
    
    /**
     * Get post-boss revelation event
     */
    getPostBossEvent(act, bossId) {
        const events = this.postBossEvents[`${act}_${bossId}`];
        if (!events) return null;
        
        const corruption = this.state.get('corruption') || 0;
        
        // High corruption variant
        if (corruption >= 40 && events.highCorruption) {
            return events.highCorruption;
        }
        
        return events.standard;
    }
    
    /**
     * Handle phase change during boss fight
     */
    onPhaseChange(data) {
        const dialogue = this.getPhaseDialogue(data.bossId, data.phase);
        if (dialogue) {
            this.eventBus.emit('combat:dialogue', dialogue);
        }
    }
    
    /**
     * Handle boss defeat
     */
    onBossDefeated() {
        this.postBossRevealed = true;
    }
    
    /**
     * Reset for new run
     */
    reset() {
        this.preBossChoice = null;
        this.phaseDialogueShown = {};
        this.postBossRevealed = false;
    }
    
    // =========================================
    // PRE-BOSS EVENTS
    // =========================================
    
    preBossEvents = {
        '1_scrap_king': {
            standard: {
                id: 'pre_boss_scrap_king',
                name: 'The Scrap-King\'s Gate',
                type: 'pre_boss',
                image: 'boss_gate',
                text: [
                    "The path narrows between walls of twisted metal. Ahead, a crude fortress rises from the rust — a throne built from the wreckage of a hundred war machines.",
                    "Rustborn sentries line the walls, their eyes tracking you with a mix of fear and anticipation. You can hear drums inside. Deep. Rhythmic. Like a heartbeat.",
                    "A grizzled Rustborn warrior blocks the gate, scrap-blade drawn.",
                    "\"The King knows you're here. He's been waiting. Says you smell like the old world.\""
                ],
                choices: [
                    {
                        text: "Demand an audience. You'll face him on your terms.",
                        effects: {
                            bossModifier: 'standard',
                            reputation: { rustborn: -1 }
                        },
                        result: "The warrior spits and steps aside. \"Your funeral, offworlder. The King doesn't grant audiences. He grants executions.\"\n\nThe drums grow louder as you enter."
                    },
                    {
                        text: "Ask about the King. Knowledge is power.",
                        effects: {
                            bossModifier: 'informed',
                            playerBuff: { type: 'insight', value: 1 }
                        },
                        result: "The warrior hesitates, then leans close. \"He wasn't always like this. Found something in the deep ruins — a shard of something that whispered to him. Changed him. Made him stronger. Made him... wrong.\"\n\nShe looks away. \"His second phase — when he puts on the suit — aim for the joints. The scrap-tech overheats.\"\n\nYou nod and pass through the gate."
                    },
                    {
                        text: "Offer tribute. Perhaps violence isn't necessary.",
                        effects: {
                            creditCost: 30,
                            bossModifier: 'tribute',
                            reputation: { rustborn: 1 }
                        },
                        result: "You lay 30 credits at the warrior's feet. She raises an eyebrow.\n\n\"Generous. But the King doesn't want your coin. He wants proof — proof that the offworlders aren't the threat he thinks they are.\"\n\nShe pauses. \"Fight him. Show strength. That's the only tribute he respects. But... he might hold back in the first phase. Might.\"\n\nThe drums welcome you inside."
                    },
                    {
                        text: "[Corruption 30+] Let the void speak through you.",
                        requiresCorruption: 30,
                        effects: {
                            bossModifier: 'corrupted',
                            corruption: 5,
                            reputation: { rustborn: -2, whisperers: 1 }
                        },
                        result: "Your eyes darken. Words that aren't yours crawl from your throat — ancient, grating, impossible.\n\nThe warrior stumbles back, scrap-blade trembling. \"What... what ARE you?\"\n\nThe sentries scatter. The drums falter. Inside the fortress, you hear the Scrap-King laugh — but there's fear in it.\n\nThe void in you smiles."
                    }
                ]
            },
            varraVariant: {
                id: 'pre_boss_scrap_king_varra',
                name: 'The Scrap-King\'s Gate',
                type: 'pre_boss',
                image: 'boss_gate',
                text: [
                    "The path narrows between walls of twisted metal. Ahead, a crude fortress rises from the rust.",
                    "Before you reach the gate, a familiar voice calls from the shadows.",
                    "\"Offworlder.\" Scrap-Chief Varra steps into view, arms crossed, expression unreadable. \"So you're really going through with this.\"",
                    "She looks toward the fortress. \"The Scrap-King was my brother once. Before the shard changed him. Before the whispers started.\""
                ],
                choices: [
                    {
                        text: "\"Your brother? Is there a way to save him?\"",
                        effects: {
                            bossModifier: 'mercy',
                            reputation: { rustborn: 2 }
                        },
                        result: "Varra's expression cracks — just for a moment. \"The shard... it's lodged in his back, between the shoulder blades. If you could break it free without killing him...\"\n\nShe shakes her head. \"But he won't let you close. Not willingly.\"\n\nShe presses something into your hand — a small EMP charge. \"Use this when he enters the suit. It'll stun him. Give you a window.\"\n\n*Gained: EMP Charge (stuns boss for 1 turn during Phase 2)*"
                    },
                    {
                        text: "\"He needs to be put down. For everyone's sake.\"",
                        effects: {
                            bossModifier: 'ruthless',
                            reputation: { rustborn: -1 },
                            playerBuff: { type: 'strength', value: 2 }
                        },
                        result: "Varra's jaw tightens. \"You're probably right. I just... couldn't do it myself.\"\n\nShe pulls a jagged blade from her belt. \"Rustborn steel. It's keyed to his armor frequencies. Cuts through his scrap-plating like paper.\"\n\n*Gained: Rustborn Edge (+2 Strength for the boss fight)*"
                    },
                    {
                        text: "\"What is the shard? What whispered to him?\"",
                        effects: {
                            bossModifier: 'informed',
                            loreUnlock: 'seal_fragment_1'
                        },
                        result: "Varra sits on a rusted hull and speaks quietly. \"He found it in the deep ruins — a fragment of something ancient. A seal, the old ones called it. One of four that hold... something... in place.\"\n\nHer eyes go distant. \"The shard spoke to him. Promised power. Promised he'd unite all the tribes. And he did. But the price...\"\n\nShe looks at you. \"Whatever's sealed down there, offworlder — it's waking up. And my brother is just the first symptom.\"\n\nThe weight of her words settles like dust."
                    }
                ]
            }
        }
    };
    
    // =========================================
    // MID-FIGHT DIALOGUE
    // =========================================
    
    bossDialogues = {
        scrap_king: {
            intro: {
                speaker: 'Scrap-King',
                speakerTitle: 'Warlord of the Wastes',
                lines: [
                    "You dare enter the Iron Throne?",
                    "The wastes have been whispering about you, offworlder.",
                    "Let's see if you bleed rust or something... softer."
                ],
                mood: 'threatening'
            },
            phase2: {
                speaker: 'Scrap-King',
                lines: [
                    "Hah! You actually hurt me. Been a while since anyone managed that.",
                    "Time to show you what Rustborn engineering really looks like."
                ],
                action: "The Scrap-King wrenches a massive scrap-mech suit from the wall and climbs inside. Servos whine. Metal screams.",
                mood: 'escalating',
                // Korvax-specific variant
                korvax: {
                    lines: [
                        "Another machine pretending to be a man. We're not so different, you and I.",
                        "Let's see whose metal breaks first."
                    ]
                }
            },
            phase3: {
                speaker: 'Scrap-King',
                lines: [
                    "NO! I won't— I CAN'T lose this!",
                    "The shard... it's BURNING... give me MORE!"
                ],
                action: "Something dark pulses from the Scrap-King's back — a crystalline shard embedded in his spine, leaking void-light. His eyes go black.",
                mood: 'desperate',
                // This reveals the cosmic horror element
                void_whisper: "Yes. Let me in. Let me THROUGH."
            },
            defeat: {
                speaker: 'Scrap-King',
                lines: [
                    "The shard... pull it... pull it out...",
                    "It showed me things... the seal... the four seals...",
                    "Something is coming, offworlder. Something that makes me look like a child's toy.",
                    "The wastes... will remember..."
                ],
                mood: 'broken',
                // The key revelation
                revelation: "As the Scrap-King falls, the shard in his back cracks and projects a fleeting image into the air — four points of light arranged in a diamond pattern, each one flickering, fading. A sound like a heartbeat echoes from somewhere beneath the ground.\n\nThen silence.\n\nThe shard goes dark. But you can still feel it pulsing."
            }
        }
    };
    
    // =========================================
    // POST-BOSS EVENTS
    // =========================================
    
    postBossEvents = {
        '1_scrap_king': {
            standard: {
                id: 'post_boss_scrap_king',
                name: 'The Shard\'s Echo',
                type: 'post_boss',
                text: [
                    "The fortress is quiet now. Rustborn warriors stand in the doorways, watching. Waiting.",
                    "In your hand, the shard pulses faintly — cold, heavy, wrong. It shows you fragments:",
                    "A vast darkness beneath the planet's surface. Four seals, arranged like a compass rose. Three still holding. One — the one that fed this shard — cracked and bleeding void-light.",
                    "You understand now. The Scrap-King wasn't the threat. He was a symptom.",
                    "Something is sealed beneath Vharos. And it is waking up."
                ],
                choices: [
                    {
                        text: "Keep the shard. You need to understand what's happening.",
                        effects: {
                            artifact: {
                                id: 'seal_shard_fragment',
                                name: 'Seal Shard Fragment',
                                rarity: 'rare',
                                description: 'A fragment of the Ironspine Seal. Grants +1 Energy every 4th combat. Gain 2 Corruption every 4th combat.'
                            },
                            corruption: 3,
                            loreUnlock: 'seal_knowledge_1'
                        },
                        result: "The shard hums against your skin. Knowledge seeps in — fragments of an ancient civilization's final act. They sealed something away. Something cosmic. Something hungry.\n\nThe shard whispers: \"Find the others.\"\n\n*Gained: Seal Shard Fragment*\n*Corruption +3*"
                    },
                    {
                        text: "Destroy the shard. Nothing good comes from void artifacts.",
                        effects: {
                            corruption: -5,
                            reputation: { firstLight: 1 },
                            loreUnlock: 'seal_knowledge_1'
                        },
                        result: "You hurl the shard to the ground and bring your heel down hard. It shatters with a sound like a scream cut short.\n\nFor a moment, the void-light bleeds across the floor like spilled ink. Then it fades.\n\nBut the images it showed you remain burned in your mind. Four seals. Something beneath.\n\nYou didn't need the shard to know the truth. You just needed to survive long enough to see it.\n\n*Corruption -5*"
                    },
                    {
                        text: "Give the shard to the Rustborn. It's their land, their problem.",
                        effects: {
                            reputation: { rustborn: 2 },
                            loreUnlock: 'seal_knowledge_1'
                        },
                        result: "You press the shard into the hands of the nearest Rustborn warrior. They stare at it, then at you.\n\n\"This is what changed the King?\"\n\nYou nod. \"Guard it. Study it. But don't let it whisper to you.\"\n\nThe warrior wraps it in scrap-cloth and carries it like a live grenade. You've made an ally today — and ensured the Rustborn will be part of whatever comes next.\n\n*Rustborn reputation +2*"
                    }
                ],
                epilogue: "As you leave the fortress, a new signal pulses on the horizon — faint, rhythmic, coming from the Eclipse Marsh to the east.\n\nThe same frequency as the shard.\n\nThe same frequency as the signal that brought the Dawnseeker to Vharos.\n\nAct I Complete."
            },
            highCorruption: {
                id: 'post_boss_scrap_king_corrupted',
                name: 'The Shard Calls',
                type: 'post_boss',
                text: [
                    "The Scrap-King crumbles. But the shard doesn't fall with him — it floats, drifting toward you like it knows you.",
                    "Like it was always meant for you.",
                    "The void inside you recognizes it. Welcomes it. Your corruption pulses in rhythm with its light.",
                    "The Rustborn watch from the shadows. They're afraid. Not of what you did to their king.",
                    "Of what you're becoming."
                ],
                choices: [
                    {
                        text: "Absorb the shard. Accept what you're becoming.",
                        effects: {
                            corruption: 15,
                            artifact: {
                                id: 'seal_shard_consumed',
                                name: 'Consumed Seal Fragment',
                                rarity: 'cosmic',
                                description: 'The first seal fragment, absorbed into your being. +2 Energy. Start each combat with 3 Corruption.'
                            },
                            reputation: { whisperers: 2, rustborn: -2, firstLight: -2 }
                        },
                        result: "The shard dissolves into your hand like ink into water. The world goes dark for a heartbeat — then EXPLODES with clarity.\n\nYou see the seals. All four. You see what they hold. You see its face.\n\nIt sees you too.\n\n\"Finally,\" it says. \"A worthy vessel.\"\n\n*Gained: Consumed Seal Fragment*\n*Corruption +15*"
                    },
                    {
                        text: "Fight the pull. You're still in control.",
                        effects: {
                            corruption: -3,
                            reputation: { firstLight: 1 }
                        },
                        result: "You clench your fist. The shard wavers, then drops to the ground.\n\nThe void in you screams. But you hold.\n\nFor now.\n\n\"Interesting,\" something whispers from very far away. \"You resist. That makes you more valuable, not less.\"\n\n*Corruption -3*"
                    }
                ],
                epilogue: "The signal pulses again from the east. But this time, you can feel it in your bones.\n\nWhatever the seals are holding — it knows your name now.\n\nAct I Complete."
            }
        }
    };
}

export default BossNarrative;
