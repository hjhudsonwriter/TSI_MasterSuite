/* Arenas of The Scarlett Isles: the arenas and their rounds.
   A word-for-word copy of the old tool's data/arenas.json, stored as a script
   so it loads from a double-clicked file. Picture paths are relative to
   tools/arenas/. Edit the rounds here.

   Below it are the picture and sound lists the old tool kept inside its code
   (app.js: R1_OVERLAYS, R4_OVERLAYS, MMR2_*_OVERLAYS and SFX), moved here
   unchanged because they're content. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.arenas = {
  "arenas": [
    {
      "id": "swyth_salt_ring_trials",
      "name": "Swyth: The Salt-Ring Trials",
      "description": "Three escalating rounds. POV arena scenes, individual turns, skill + attack mini-game, cinematic overlays, HP attrition, prizes.",
      "rounds": [
        {
          "id": "r1",
          "title": "Round 1 — Arena Duelists",
          "scene": {
            "base": "assets/maps/swyth_base_rounds_1_2.png",
            "overlay_boss": "assets/overlays/arena_duelists_standard.png",
            "overlays": {
              "pc_hit": "assets/overlays/arena_duelists_hit.png",
              "pc_fail_variants": [
                "assets/overlays/arena_duelists_fail.png"
              ]
            }
          },
          "reward_gp": 500,
          "skill_challenge": {
            "target_successes": 6,
            "max_failures": 3,
            "damage_on_failure": "2d6",
            "dcs": {
              "easy": 13,
              "standard": 15,
              "hard": 17
            },
            "turn_limit": 6,
            "overtime": {
              "failure_each_turn": 0,
              "party_damage_each_turn": "1d6"
            },
            "notes": [
              "Individual turns. One player acts per turn.",
              "On your turn: make a Skill check for a success/failure, then make an Attack roll to deal damage if you hit.",
              "Win: reach 6 successes. Lose: reach 3 failures."
            ],
            "actions": [
              {
                "id": "athletics",
                "label": "Drive them back (Athletics)"
              },
              {
                "id": "acrobatics",
                "label": "Footwork & feints (Acrobatics)"
              },
              {
                "id": "intimidation",
                "label": "Break morale (Intimidation)"
              },
              {
                "id": "perception",
                "label": "Read the tells (Perception)"
              },
              {
                "id": "deception",
                "label": "Bait an opening (Deception)"
              },
              {
                "id": "performance",
                "label": "Win the crowd (Performance)"
              }
            ]
          },
          "attack": {
            "hit_dc": 14,
            "default_damage": "2d8"
          },
          "enemies": [
            {
              "id": "duelist",
              "name": "Arena Duelist",
              "count": 2,
              "hp": 45
            }
          ]
        },
        {
          "id": "r4",
          "title": "Round 2 — The Beast-Pen",
          "scene": {
            "base": "assets/maps/swyth_beast_pen_round_4.png",
            "overlay_boss": "assets/overlays/beast_pen_standard.png",
            "overlays": {
              "pc_hit": "assets/overlays/beast_pen_hit_standard.png",
              "pc_fail_variants": [
                "assets/overlays/beast_pen_boar_fail_standard.png",
                "assets/overlays/beast_pen_hyena_fail_standard.png"
              ]
            }
          },
          "reward_gp": 5000,
          "skill_challenge": {
            "target_successes": 9,
            "max_failures": 3,
            "damage_on_failure": "5d6",
            "dcs": {
              "easy": 16,
              "standard": 17,
              "hard": 19
            },
            "turn_limit": 8,
            "overtime": {
              "failure_each_turn": 0,
              "party_damage_each_turn": "1d10"
            },
            "notes": [
              "Beasts surge from pens. You can control them or endure them.",
              "Hard Animal Handling on a success counts as TWO successes once per player this round (tracked automatically).",
              "Win: 9 successes. Lose: 3 failures."
            ],
            "actions": [
              {
                "id": "animal_handling",
                "label": "Calm / redirect a beast (Animal Handling)",
                "special": "beast_bonus_once"
              },
              {
                "id": "nature",
                "label": "Exploit instincts (Nature)"
              },
              {
                "id": "athletics",
                "label": "Wrestle / pin / hold a gate (Athletics)"
              },
              {
                "id": "acrobatics",
                "label": "Dodge through chaos (Acrobatics)"
              },
              {
                "id": "intimidation",
                "label": "Roar them back (Intimidation)"
              }
            ]
          },
          "attack": {
            "hit_dc": 15,
            "default_damage": "2d10"
          },
          "enemies": [
            {
              "id": "razor_boar",
              "name": "Razor-Boar",
              "count": 1,
              "hp": 95
            },
            {
              "id": "hooked_hyena",
              "name": "Hooked Hyena",
              "count": 2,
              "hp": 55
            }
          ]
        },
        {
          "id": "r5",
          "title": "Round 3 — Wyvern Rite (Finale)",
          "scene": {
            "base": "assets/maps/swyth_wyvern_rite_round_5.png",
            "overlay_boss": "assets/wyvern_standard.png",
            "overlays": {
              "pc_hit": "assets/wyvern_hit.png",
              "pc_fail_variants": [
                "assets/wyvern_slash.png",
                "assets/wyvern_tail_strike.png"
              ]
            }
          },
          "reward_gp": 50000,
          "skill_challenge": {
            "target_successes": 12,
            "max_failures": 2,
            "damage_on_failure": "8d6",
            "dcs": {
              "easy": 17,
              "standard": 18,
              "hard": 20
            },
            "turn_limit": 8,
            "overtime": {
              "failure_each_turn": 1,
              "party_damage_each_turn": "2d8"
            },
            "notes": [
              "Almost impossible by design. Two failures ends the run.",
              "Each turn is a single player’s moment: skill check + attack.",
              "Overtime is brutal: the crowd and the rite turn against you."
            ],
            "actions": [
              {
                "id": "athletics",
                "label": "Hold the line (Athletics)"
              },
              {
                "id": "acrobatics",
                "label": "Evade the dive (Acrobatics)"
              },
              {
                "id": "perception",
                "label": "Read the wings (Perception)"
              },
              {
                "id": "survival",
                "label": "Predict strike path (Survival)"
              },
              {
                "id": "arcana",
                "label": "Disrupt the rite glyph (Arcana)"
              }
            ]
          },
          "attack": {
            "hit_dc": 16,
            "default_damage": "3d10"
          },
          "enemies": [
            {
              "id": "wyvern",
              "name": "Wyvern",
              "count": 1,
              "hp": 200
            }
          ]
        }
      ]
    },
    {
      "id": "middlemount_lions_crown",
      "name": "Middlemount: The Lion’s Crown",
      "description": "A prestigious mountain arena beneath Clan Bacca banners. Three rounds: opening duels, the Lion Totems trial, then the Lion’s Mark champion.",
      "rounds": [
        {
          "id": "mm_r1",
          "title": "Round 1 — Arena Duelists (Opening Bout)",
          "scene": {
            "base": "assets/maps/middlemount_lions_crown.png",
            "overlay_boss": "assets/overlays/arena_duelists_standard.png",
            "overlays": {
              "pc_hit": "assets/overlays/arena_duelists_hit.png",
              "pc_fail_variants": [
                "assets/overlays/arena_duelists_fail.png"
              ]
            }
          },
          "reward_gp": 1000,
          "skill_challenge": {
            "target_successes": 6,
            "max_failures": 3,
            "damage_on_failure": "2d6",
            "dcs": {
              "easy": 13,
              "standard": 15,
              "hard": 17
            },
            "turn_limit": 6,
            "overtime": {
              "failure_each_turn": 0,
              "party_damage_each_turn": "1d6"
            },
            "notes": [
              "Individual turns. One player acts per turn.",
              "On your turn: make a Skill check for a success/failure, then make an Attack roll to deal damage if you hit.",
              "Win: reach 6 successes. Lose: reach 3 failures."
            ],
            "actions": [
              {
                "id": "athletics",
                "label": "Drive them back (Athletics)"
              },
              {
                "id": "acrobatics",
                "label": "Footwork & feints (Acrobatics)"
              },
              {
                "id": "intimidation",
                "label": "Break morale (Intimidation)"
              },
              {
                "id": "perception",
                "label": "Read the tells (Perception)"
              },
              {
                "id": "deception",
                "label": "Bait an opening (Deception)"
              },
              {
                "id": "performance",
                "label": "Win the crowd (Performance)"
              }
            ]
          },
          "attack": {
            "hit_dc": 14,
            "default_damage": "2d8"
          },
          "enemies": [
            {
              "id": "duelist",
              "name": "Arena Duelist",
              "count": 2,
              "hp": 45
            }
          ]
        },
        {
          "id": "mm_r2",
          "title": "Round 2 — The Lion Totems",
          "scene": {
            "base": "assets/maps/middlemount_lions_crown.png",
            "overlay_boss": "assets/overlays/lion_swordsman_standard.png",
            "secondary_overlay_boss": "assets/overlays/lions_totems_standard.png",
            "overlays": {
              "pc_hit": "assets/overlays/lion_swordsman_hit.png",
              "pc_fail_variants": [
                "assets/overlays/lion_swordsman_fail.png"
              ]
            },
            "secondary_overlays": {
              "pc_hit": "assets/overlays/lions_totems_hit.png",
              "pc_fail_variants": [
                "assets/overlays/lions_totems_fail.png"
              ]
            }
          },
          "reward_gp": 8000,
          "skill_challenge": {
            "target_successes": 8,
            "max_failures": 5,
            "damage_on_failure": "5d6",
            "dcs": {
              "easy": 15,
              "standard": 17,
              "hard": 19
            },
            "turn_limit": 7,
            "overtime": {
              "failure_each_turn": 1,
              "party_damage_each_turn": "1d10"
            },
            "notes": [
              "Objective: shatter the three Lion Totems.",
              "Until the totems are broken, the arena’s magic empowers the guardians.",
              "Win: destroy all three totems (the round ends when the last totem falls)."
            ],
            "actions": [
              {
                "id": "arcana",
                "label": "Disrupt the runes (Arcana)"
              },
              {
                "id": "religion",
                "label": "Unmake the warding rite (Religion)"
              },
              {
                "id": "athletics",
                "label": "Wrench stonework loose (Athletics)"
              },
              {
                "id": "perception",
                "label": "Spot the weak seam (Perception)"
              },
              {
                "id": "intimidation",
                "label": "Rattle the guardians (Intimidation)"
              }
            ]
          },
          "attack": {
            "hit_dc": 15,
            "default_damage": "2d10"
          },
          "enemies": [
            {
              "id": "lion_totem",
              "name": "Lion Totem",
              "count": 3,
              "hp": 45
            },
            {
              "id": "lion_swordsman",
              "name": "Lion Swordsman (Lion-Helm Duelist)",
              "count": 2,
              "hp": 90
            }
          ]
        },
        {
          "id": "mm_r3",
          "title": "Round 3 — The Lion’s Mark",
          "scene": {
            "base": "assets/maps/middlemount_lions_crown.png",
            "overlay_boss": "assets/overlays/lions_mark_standard.png",
            "overlays": {
              "pc_hit": "assets/overlays/lions_mark_hit.png",
              "pc_fail_variants": [
                "assets/overlays/lions_mark_fail.png"
              ]
            }
          },
          "reward_gp": 25000,
          "skill_challenge": {
            "target_successes": 10,
            "max_failures": 5,
            "damage_on_failure": "6d6",
            "dcs": {
              "easy": 16,
              "standard": 18,
              "hard": 20
            },
            "turn_limit": 7,
            "overtime": {
              "failure_each_turn": 1,
              "party_damage_each_turn": "2d8"
            },
            "notes": [
              "A brutal champion rides a dire lion.",
              "Each turn, a player is chosen as the Lion’s Mark.",
              "On a failed Skill check, the champion strikes the marked player (not the active player).",
              "Win: drive the champion back (10 successes) or defeat them by damage. Lose: if failures reach 5, or if 2 players reach 0 HP."
            ],
            "actions": [
              {
                "id": "athletics",
                "label": "Hold ground and brace (Athletics)"
              },
              {
                "id": "acrobatics",
                "label": "Slip the lion’s pounce (Acrobatics)"
              },
              {
                "id": "intimidation",
                "label": "Draw the rider’s ire (Intimidation)"
              },
              {
                "id": "perception",
                "label": "Read the charge line (Perception)"
              },
              {
                "id": "arcana",
                "label": "Disrupt the mark glyph (Arcana)"
              }
            ]
          },
          "attack": {
            "hit_dc": 16,
            "default_damage": "3d10"
          },
          "enemies": [
            {
              "id": "lion_knight",
              "name": "Bacca Lion Knight (Dire Lion Rider)",
              "count": 1,
              "hp": 220
            }
          ]
        }
      ]
    }
  ]
};

window.TSI_DATA.arenaMedia = {
  /* Arena Duelists (Swyth r1 and Middlemount mm_r1): once a duelist drops. */
  r1: {
    defeated_1: 'assets/overlays/arena_duelists_defeated_1.png',
    defeated_2: 'assets/overlays/arena_duelists_defeated_2.png',
    hit_1: 'assets/overlays/arena_duelists_hit_1.png',
    hit_2: 'assets/overlays/arena_duelists_hit_2.png',
    fail_1: 'assets/overlays/arena_duelists_fail_1.png',
    fail_2: 'assets/overlays/arena_duelists_fail_2.png'
  },
  /* The Beast-Pen (Swyth r4): which beasts are dead, and which one attacks. */
  r4: {
    standard: 'assets/overlays/beast_pen_standard.png',
    standard_boar_dead: 'assets/overlays/beast_pen_standard_boar_dead.png',
    standard_hyena_1_dead: 'assets/overlays/beast_pen_standard_hyena_1_dead.png',
    standard_hyena_2_dead: 'assets/overlays/beast_pen_standard_hyena_2_dead.png',
    standard_hyena_both_dead: 'assets/overlays/beast_pen_standard_hyena_both_dead.png',
    standard_boar_hyena_dead: 'assets/overlays/beast_pen_standard_boar_hyena_dead.png',
    hit_standard: 'assets/overlays/beast_pen_hit_standard.png',
    hit_boar_dead: 'assets/overlays/beast_pen_hit_boar_dead.png',
    hit_hyena_dead: 'assets/overlays/beast_pen_hit_hyena_dead.png',
    hit_hyena_both_dead: 'assets/overlays/beast_pen_hit_hyena_both_dead.png',
    hit_boar_hyena_dead: 'assets/overlays/beast_pen_hit_boar_hyena_dead.png',
    boar_fail_standard: 'assets/overlays/beast_pen_boar_fail_standard.png',
    boar_fail_hyena_1_dead: 'assets/overlays/beast_pen_boar_fail_hyena_1_dead.png',
    boar_fail_hyena_2_dead: 'assets/overlays/beast_pen_boar_fail_hyena_2_dead.png',
    boar_fail_hyena_both_dead: 'assets/overlays/beast_pen_boar_fail_hyena_both_dead.png',
    hyena_fail_standard: 'assets/overlays/beast_pen_hyena_fail_standard.png',
    hyena_fail_hyena_dead: 'assets/overlays/beast_pen_hyena_fail_hyena_dead.png',
    hyena_fail_hyena_boar_dead: 'assets/overlays/beast_pen_hyena_fail_hyena_boar_dead.png'
  },
  /* The Lion Totems (Middlemount mm_r2): the swordsmen in front, the totems behind. */
  mmR2Swordsmen: {
    standard: 'assets/overlays/lion_swordsman_standard.png',
    hit: 'assets/overlays/lion_swordsman_hit.png',
    fail: 'assets/overlays/lion_swordsman_fail.png',
    dead_1: 'assets/overlays/lion_swordsman_1_dead.png',
    dead_2: 'assets/overlays/lion_swordsman_2_dead.png',
    dead_both: 'assets/overlays/lion_swordsman_both_dead.png'
  },
  mmR2Totems: {
    standard: 'assets/overlays/lions_totems_standard.png',
    hit: 'assets/overlays/lions_totems_hit.png',
    fail: 'assets/overlays/lions_totems_fail.png',
    down_1: 'assets/overlays/lions_totems_standard_1_dead.png',
    down_2: 'assets/overlays/lions_totems_standard_2_dead.png',
    down_3: 'assets/overlays/lions_totems_standard_3_dead.png'
  },
  lionsMarkIcon: 'assets/overlays/lions_mark_icon.png',

  /* Sounds, with the volumes the old tool played them at. */
  sfx: {
    crowd_loop: 'assets/sfx/crowd_standard.mp3',
    crowd_hit: 'assets/sfx/crowd_hit.mp3',
    crowd_fail: 'assets/sfx/crowd_fail.mp3',
    r1_hit: 'assets/sfx/arena_duelist_hit.mp3',
    r1_fail: 'assets/sfx/arena_duelist_fail.mp3',
    r4_hit: 'assets/sfx/beast_pen_hit.mp3',
    r4_fail: 'assets/sfx/beast_pen_fail.mp3',
    r5_hit: 'assets/sfx/wyvern_hit.mp3',
    r5_fail: 'assets/sfx/wyvern_fail.mp3',
    lions_mark_horn: 'assets/sfx/horn_blast.mp3',
    mm_r2_hit: 'assets/sfx/lions_totems_hit.mp3',
    mm_r2_fail: 'assets/sfx/lions_totems_fail.mp3',
    /* The Lion's Mark round plays all three at once. */
    mm_r3_hit_stack: ['assets/sfx/lions_mark_hit_1.mp3', 'assets/sfx/lions_mark_hit_2.mp3', 'assets/sfx/lions_mark_hit_3.mp3'],
    mm_r3_fail_stack: ['assets/sfx/lions_mark_fail_1.mp3', 'assets/sfx/lions_mark_fail_2.mp3', 'assets/sfx/lions_mark_fail_3.mp3']
  },
  volumes: { crowd_loop: 0.35, round: 0.9, crowd: 0.75, horn: 0.95 },
  overlayMs: 5200,
  announceMs: 5000,
  pulseMs: 5000
};
