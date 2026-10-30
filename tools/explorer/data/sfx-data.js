/* Scarlett Isles Explorer: the sound effects (30 October 2026, Harry's list).
   They play from the DM's window (the laptop), never from the Player View. Each one:
     file    the sound's file, inside folder
     volume  how loud it is, 0 to 1 (the Sound panel's volume slider is multiplied on top)
     loop    true to repeat for as long as it is wanted, false to play once
     label   its name in the Sound panel
   campFadeMs is how long the campfire plays after Make Camp while the screen fades out and back in
   (the same 4 seconds the TV's fade takes); a campfire event keeps it going until the event is finished.
   A file that is not in the folder is skipped quietly. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.explorerSfx = {
  folder: 'tools/explorer/assets/sfx/',
  campFadeMs: 4000,
  sounds: {
    footsteps: { file: 'footsteps.mp3', volume: 0.6, loop: true, label: 'Footsteps (while heroes move)' },
    campfire: { file: 'campfire.mp3', volume: 0.6, loop: true, label: 'Campfire (Make Camp)' },
    rain: { file: 'rain.mp3', volume: 0.5, loop: true, label: 'Rain (rain weather)' },
    storm: { file: 'storm.mp3', volume: 0.6, loop: true, label: 'Thunder and rain (storm weather)' },
    raven: { file: 'raven.mp3', volume: 0.7, loop: false, label: 'Raven (the Ironbow sends word)' }
  }
};
