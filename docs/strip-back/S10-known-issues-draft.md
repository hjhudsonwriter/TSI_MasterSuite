# S10: known-issues draft (for the lead to merge into docs/KNOWN_ISSUES.md)

- **Changed on purpose.** Before: Clan Influence and Day Log opened from the bottom bar. After: both gone; Political Capital and Honour/Respect are read in the Hall's Clan Relations and changed only by Change a score in the DM doc.
- **Fixed.** Before: "Management" was clipped to "MANAGEMEN" on the bottom-bar button at 1920 x 1080. After: the panel buttons are wider.
- **Left alone.** `state.log` is still written and still saved (it grows without limit) until step S18; nothing shows it. The old-Day-Log text file reads the live save's log, so S18 must move that to the set-aside copy.
- **Left alone.** Rule functions still return `{ log: [...] }` pairs; the screen writes them to `state.log` only.
- **Left alone.** Beast Handler link code (`bastion-link.js`) comments still mention "the Day Log"; S18 sweeps them.
