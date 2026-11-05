/* Scarlett Isles Explorer: the soundscape (guide 5, 5 November 2026): the background sound that follows the table.
   Beds and moods play from the Explorer Player View (the TV window), so they survive a change of tool; sound effects and voice lines stay on
   the laptop. The Explorer decides what plays (tools/explorer/soundscape-rules.js); this file only says what there is.
     beds       id -> { file (a path inside the suite), volume (this file's level, 0 to 1: worked out from its loudness so they all sound about
                the same; the Sound control's master slider is multiplied on top), label }
     moods      the ids the Mood menu offers (any bed id also works in a {sound: id} cue)
     mapBeds    the Explorer map -> its road sound
     weatherBeds weather kind -> the bed that plays over the road sound
     fadeSecs   crossfade between sounds; duckTo how loud everything is while a voice line plays (0.3 = 30%)
   A file that is not there is skipped quietly and the Sound control says "file missing". Folder: tools/explorer/assets/soundscape/ (the campfire,
   rain and storm beds reuse the Explorer's sound effect files in tools/explorer/assets/sfx/). Levels were measured on 5 November 2026 (EBU R128)
   and brought to about -26 LUFS; the quietest files (the plains and the night) are already at full volume. The campfire and the night play together at the
   same level (both -27.5 LUFS, the night's own level), so the campfire is set a little lower than the rest. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.soundscape = {
  fadeSecs: 4,
  duckTo: 0.3,
  moodBedLevel: 0.5,          /* the road sound sits at this level under a mood */
  beds: {
    coast: { file: 'tools/explorer/assets/soundscape/coast.wav', volume: 0.44, label: 'Coast (surf, gulls, wind)' },
    forest: { file: 'tools/explorer/assets/soundscape/forest.mp3', volume: 0.35, label: 'Forest (wind in pines)' },
    marsh: { file: 'tools/explorer/assets/soundscape/marsh.mp3', volume: 0.8, label: 'Marsh (reeds, frogs, still water)' },
    plains: { file: 'tools/explorer/assets/soundscape/plains.mp3', volume: 1.0, label: 'Plains (open wind over grass)' },
    mountain: { file: 'tools/explorer/assets/soundscape/mountain.mp3', volume: 1.0, label: 'Mountain (high thin wind)' },
    town: { file: 'tools/explorer/assets/soundscape/town.mp3', volume: 1.0, label: 'Town (a market murmur)' },
    tavern: { file: 'tools/explorer/assets/soundscape/tavern.mp3', volume: 0.52, label: 'Tavern (an inn interior)' },
    night: { file: 'tools/explorer/assets/soundscape/night.mp3', volume: 1.0, label: 'Night (crickets, an owl)' },
    blizzard: { file: 'tools/explorer/assets/soundscape/blizzard.mp3', volume: 0.26, label: 'White Blizzard (howling wind and snow)' },
    heat: { file: 'tools/explorer/assets/soundscape/heat.mp3', volume: 0.32, label: 'Sun & Heatwave (a dry drone)' },
    combat: { file: 'tools/explorer/assets/soundscape/combat.mp3', volume: 0.22, label: 'Combat (tense battle music)' },
    mystery: { file: 'tools/explorer/assets/soundscape/mystery.ogg', volume: 0.37, label: 'Mystery (a low, uneasy drone)' },
    campfire: { file: 'tools/explorer/assets/sfx/campfire.mp3', volume: 0.17, label: 'Campfire' },
    rain: { file: 'tools/explorer/assets/sfx/rain.mp3', volume: 0.54, label: 'Cold Downpour (rain)' },
    storm: { file: 'tools/explorer/assets/sfx/storm.mp3', volume: 0.17, label: 'Black Storm (thunder and rain)' }
  },
  moods: ['combat', 'mystery', 'tavern'],
  fightMood: 'combat',
  mapBeds: {
    the_north_isle: 'coast',
    the_east_isle: 'coast',
    northern_province_east: 'forest',
    northern_province_west: 'forest',
    eastern_province_north: 'marsh',
    eastern_province_south: 'marsh',
    midland_province: 'mountain',
    southern_province_east: 'plains',
    southern_province_west: 'plains',
    western_province_south: 'plains'
  },
  townBed: 'town',
  nightBed: 'night',
  campBed: 'campfire',
  campSecs: 30,               /* a Make Camp keeps the campfire (and the night) going at least this long, so the 4 second fades are heard; a campfire event keeps them on until it is finished */
  campWith: 'night',          /* plays together with the campfire, at the same level, for exactly as long (Harry, 5 November 2026) */
  weatherBeds: { blizzard: 'blizzard', storm: 'storm', rain: 'rain', sun_heat: 'heat' }
};
