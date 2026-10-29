/* Scarlett Isles Explorer: the terrain the DM can paint on a map's hexes (29 October 2026).
   cost is a multiplier on the 6 miles a hex normally takes to cross: 0.5 is half (3 miles), 2 is double (12), 3 is triple (18).
   cost: null means the party cannot cross it at all. "Open land" is what an unpainted hex is: the usual 6 miles.
   Harry's list: Road, Forest, Hills, Mountain Trails (as forest and hills), Mountain Climb (as marsh), Marsh, and two kinds
   nobody can cross. To change a cost or a colour, change it here; nothing else needs touching. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.hexTerrain = {
  kinds: [
    { id: 'road', label: 'Road', cost: 0.5, colour: '#e0c16a' },
    { id: 'forest', label: 'Forest', cost: 2, colour: '#2f8a45' },
    { id: 'hills', label: 'Hills', cost: 2, colour: '#b0843a' },
    { id: 'marsh', label: 'Marsh', cost: 3, colour: '#3f9a92' },
    { id: 'mountain_trails', label: 'Mountain trails', cost: 2, colour: '#8f95a8' },
    { id: 'mountain_climb', label: 'Mountain climb', cost: 3, colour: '#d6dbe8' },
    { id: 'mountains', label: 'Mountains (impassable)', cost: null, colour: '#7a3b3b' },
    { id: 'water', label: 'Water (impassable)', cost: null, colour: '#2f6fc4' }
  ]
};
