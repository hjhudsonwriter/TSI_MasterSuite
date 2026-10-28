# Showing scenes to the players (plain English)

For The Absent Tide, each act has a "deck" of pictures, clips and character portraits. You show them on the TV from the Explorer.

## Queueing a deck
1. In the Explorer, press **Open Player View** (left column) and drag that window to the TV. It should say **Connected**.
2. In the right-hand column, open the **Force Main Campaign Event…** list. The decks are under **The Absent Tide**: Act 1 Tidepool House, Act 2 Swyth after the silence, Act 4 Middlemount, Act 5 The Archive door. Choose one and press **Queue**.
3. A pop-up opens on your screen with every card of the deck in a numbered list, each with a small picture. The two older events (The Tide Remembers, The Turning Tide) still work exactly as before.

## Jumping between cards
- **Click any card** to put it on the TV at once, in any order. Your party chooses its stops, so there is no fixed order.
- **Previous** and **Next** step through the list. The card on the TV is highlighted.
- **Hide (back to the map)** clears the TV and leaves the pop-up open. **Close** (or Esc) ends the deck and the TV returns to the map.
- Act 1, Act 4 and Act 5 put their first card up when they open. Act 2 puts nothing up until you pick a card.
- The TV fades the map to black while a card is up, then back when you hide it. A new card crosses over the old one.

## Voice lines
- A portrait shows only the character's **name** on the TV. The recorded voice line plays from **your laptop**, never from the TV window.
- **Auto-play voice lines** (ticked by default, and remembered) plays the line when you show a portrait. **Play voice line** / **Replay voice line** plays it again. Only one line plays at a time; changing card, hiding or closing stops it.
- The words of the line show to you under the card so you can say it yourself. They are not on the TV unless a card has `subtitle: true`.

## Missing files
A file that is not there yet shows as **file missing** (or **no voice file**). Nothing breaks. If a card's picture is missing, the TV stays as it was and the pop-up tells you. You can add the file later without touching any code.

## Where the files go
`tools/explorer/assets/absent-tide/` with `act1/`, `act4/`, `portraits/` and `voice/`. Images are PNG, clips MP4, voice lines MP3. Your Ilsa Tarrow files are named `isla-tarrow`; the data points at those names.

## Adding or changing a card (data only)
Open `tools/explorer/data/absent-tide-scenes.js`. Each card is one short entry (`image`, optionally `video`, `portrait`, `voice`, `line`, `dmNote`, `overlays`); the first lines of the file explain every field. Names, voice-line words and the writing laid over a picture (`overlays`: where it sits and how big, as percentages of the picture) are one-line edits.
