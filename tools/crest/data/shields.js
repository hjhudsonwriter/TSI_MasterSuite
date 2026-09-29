/* Clan Crest Creator — shield shapes.

   Seventeen real escutcheon (shield) shapes used in heraldry, from knights'
   shields of the 11th to 16th centuries to the national styles heralds still
   draw. The outlines are copied exactly from Heraldicon (Heraldry.Digital,
   https://heraldicon.org, github.com/heraldry/heraldicon), an open heraldry
   editor whose shield outlines are released into the public domain; a few of
   them are its tracings of public-domain drawings on Wikimedia Commons. The
   credits are in `credit` and in docs/ASSETS.md. They were checked against
   DrawShield's shapes (drawshield.net) and heraldry references on shield
   shapes by country and period.

   Each outline is in its own units (the crest scales it to fit), so it can be
   compared with its source. `note` is the tooltip. */
window.TSI_DATA = window.TSI_DATA || {};

window.TSI_DATA.crestShields = [
  {
    id: 'heater',
    name: 'Heater',
    note: 'The classic knight\'s shield of the 13th and 14th centuries: a flat top and sides that curve to a point.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 h 3 v 2 a 6 6 0 0 1 -3,5.196152422706632 a 6 6 0 0 1 -3,-5.196152422706632 v -2 z'
  },
  {
    id: 'norman',
    name: 'Norman',
    note: 'A tall, pointed shield of the 12th century, between the Norman kite and the heater.',
    credit: 'Heraldicon (public domain)',
    /* width 5, height 8, R = (1/4 + (8/5)²) × 5 = 14.05 */
    d: 'm 0,0 h 2.5 a 14.05 14.05 0 0 1 -2.5,8 a 14.05 14.05 0 0 1 -2.5,-8 z'
  },
  {
    id: 'kite',
    name: 'Kite',
    note: 'The long, round-topped shield of Norman knights in the 11th century, as on the Bayeux Tapestry.',
    credit: 'Heraldicon, after "Kite shield" by Perhelion, Wikimedia Commons (public domain)',
    /* width 1, height 2: a half-width 0.5 top, then two arcs of radius 5 to the point */
    d: 'm 0,0 a 0.5 0.5 0 0 1 0.49,0.5994987 a 5 5 0 0 1 -0.49,1.4005013 a 5 5 0 0 1 -0.49,-1.4005013 a 0.5 0.5 0 0 1 0.49,-0.5994987 z'
  },
  {
    id: 'iberian',
    name: 'Iberian',
    note: 'Spanish and Portuguese arms: a square top, straight sides and a round base.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 h 5 v 7 a 5 5 0 0 1 -10,0 v -7 z'
  },
  {
    id: 'oldFrench',
    name: 'Old French',
    note: 'A square top with a base that curves to a point, as in medieval French arms.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 v 15.7 c 0,6 6,12 12,13 c 6,-1 12,-7 12,-13 V 0 z'
  },
  {
    id: 'modernFrench',
    name: 'Modern French',
    note: 'Straight sides, rounded lower corners and a small point at the base: French heraldry from the 17th century on.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 h 7 v 15 a 1 1 0 0 1 -1,1 h -5 a 1 1 0 0 0 -1,1 a 1 1 0 0 0 -1,-1 h -5 a 1 1 0 0 1 -1,-1 v -15 h 7 z'
  },
  {
    id: 'english',
    name: 'English',
    note: 'The square English shield of the Tudor age and after, with flared top corners and a small point.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 h 8 a 1 1 0 0 0 -1,1 v 14 a 1 1 0 0 1 -1,1 h -5 a 1 1 0 0 0 -1,1 a 1 1 0 0 0 -1,-1 h -5 a 1 1 0 0 1 -1,-1 v -14 a 1 1 0 0 0 -1,-1 h 8 z'
  },
  {
    id: 'bohemian',
    name: 'Bohemian',
    note: 'Sides that narrow towards a round base, as in Czech heraldry.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 h 56 l -4,35 a 24.156226 24.156226 0 0 1 -48,0 z'
  },
  {
    id: 'swiss',
    name: 'Swiss',
    note: 'A heater whose top dips and rises to a point in the middle, as in Swiss arms.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 a 6 6 0 0 0 3,0 v 2 a 6 6 0 0 1 -3,5.196152422706632 a 6 6 0 0 1 -3,-5.196152422706632 v -2 a 6 6 0 0 0 3,0 z'
  },
  {
    id: 'german',
    name: 'German',
    note: 'The Tartsche: a 15th-century German jousting shield with a notch, the bouche, to rest the lance in.',
    credit: 'Heraldicon, by Korfi2Go (public domain)',
    d: 'M 0,20 c 7,-5 20,-5 20,7 0,13 -13,13 -20,8 0,0 7,9 5,15 -2,5 -5,15 -5,30 0,40 40,40 50,40 10,0 50,0 50,-40 C 100,65 97,55 95,50 91,40 90,35 90,30 90,28 90,8 100,0 70,0 55,5 40,10 30,5 25,4 15,5 0,7 0,17 0,20 z'
  },
  {
    id: 'italian',
    name: 'Italian',
    note: 'The "horse\'s head" shield (testa di cavallo) of Renaissance Italy, shaped like a horse\'s head armour.',
    credit: 'Heraldicon, by Korfi2Go (public domain)',
    d: 'M 50,0 C 35,0 30,5 25,10 c -10,10 -25,10 -25,10 0,60 11.223599,65.396698 15,70 3.776401,4.603302 14.300142,13.36702 15,35 1.131708,34.98167 15,35 20,35 5,0 18.868292,-0.0183 20,-35 0.699858,-21.63298 11.223599,-30.396698 15,-35 3.776401,-4.603302 15,-10.00006 15,-70 0,0 -15,0 -25,-10 C 70,5 65,0 50,0 Z'
  },
  {
    id: 'polish',
    name: 'Polish',
    note: 'The ornate shield of Polish heraldry, with notched sides and a pointed base.',
    credit: 'Heraldicon, after "Polish Escutcheon" by Masur, Wikimedia Commons (public domain)',
    d: 'm 43.402145,5e-7 c -8.662508,0 -14.063932,7.322064 -27.53457,9.380727 0.01086,7.9371285 -3.321499,15.7448405 -7.7644202,20.8881635 0,0 8.6550412,4.035941 8.6550412,12.967045 0,13.48538 -14.3402146,13.50873 -14.3402146,13.50873 0,0 -2.4179809,4.962539 -2.4179809,15.009696 0,22.996861 15.7236635,40.377428 27.6621895,45.737558 11.938525,5.36013 18.80961,7.63894 22.359194,12.50808 3.549585,-4.86914 10.377904,-7.14795 22.316426,-12.50808 11.938526,-5.36013 27.662185,-22.742701 27.662185,-45.737557 0,-10.047158 -2.41798,-15.009697 -2.41798,-15.009697 0,0 -14.340209,-0.02335 -14.340209,-13.50873 0,-8.931104 8.655042,-12.967045 8.655042,-12.967045 C 87.453242,25.123567 84.122242,17.317856 84.132428,9.3807275 70.661111,7.3213975 65.259687,5.0000001e-7 56.597858,5.0000001e-7 51.658715,5.0000001e-7 50.021384,2.5016165 50.021384,2.5016165 c 0,0 -1.680096,-2.50161599999999 -6.619239,-2.501616 z'
  },
  {
    id: 'renaissance',
    name: 'Renaissance',
    note: 'An ornate 16th-century shield with scalloped sides.',
    credit: 'Heraldicon, after "Coa Illustration Shield Renaissance 7" by Doc Taxon, Wikimedia Commons (public domain)',
    d: 'M 43.672061,112.35743 C 20.076921,107.21428 1.2267205,96.616647 5.1084778e-7,62.761658 9.9757105,57.299078 13.336031,27.805689 3.0804505,12.948849 l 5.98179,-9.3387997 C 28.967341,6.8985193 35.708501,-4.5443607 50,2.1304593 c 14.2915,-6.67482 21.03266,4.76806 40.93775,1.47959 l 5.9818,9.3387997 C 86.66397,27.805689 90.02428,57.299078 100,62.761658 98.77327,96.616647 79.92307,107.21428 56.32792,112.35743 51.60688,113.38653 51.68278,114.71878 50,117 c -1.68279,-2.28122 -1.60689,-3.61347 -6.327939,-4.64257 z'
  },
  {
    id: 'pavise',
    name: 'Pavise',
    note: 'The tall standing shield of 14th- and 15th-century crossbowmen.',
    credit: 'Heraldicon, by Korfi2Go (public domain)',
    d: 'M 10.529661,150 H 90 c 2,0 4.791667,0 5,-5 l 5,-120 c 0,-3 -3,-4 -5,-5 L 56,2 C 54,1 52,0 50,0 48,0 45.992856,1.04049 44,2 L 5,20 c -2,1 -5,2 -5,5 l 5,120 c 0.2083333,5 3,5 5.529661,5 z'
  },
  {
    id: 'lozenge',
    name: 'Lozenge',
    note: 'A diamond, traditionally used for the arms of women.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 L 5,6.5 L 0,13 L -5,6.5 z'
  },
  {
    id: 'oval',
    name: 'Oval',
    note: 'The oval cartouche, used by the clergy and in Italian heraldry.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 A 5 6.8 0 0 1 5,6.5 A 5 6.8 0 0 1 0,13 A 5 6.8 0 0 1 -5,6.5 A 5 6.8 0 0 1 0,0 z'
  },
  {
    id: 'round',
    name: 'Round',
    note: 'A round shield: the buckler, the Highland targe and the Norse round shield.',
    credit: 'Heraldicon (public domain)',
    d: 'm 0,0 a 5 5 0 0 1 0,10 a 5 5 0 0 1 0,-10 z'
  }
];
