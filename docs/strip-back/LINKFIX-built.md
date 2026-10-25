# LINKFIX built: fixes after the independent review of S17

Branch `linkfix`, from `main` (db85b56). The online link stays built and switched off; CLAUDE.md is untouched; nothing goes online by default or in tests; no key is committed. Backed up on the branch `wip-linkfix`. The first working copy was lost in a container restart and every item was redone.

## The ten items

1. **The phone had no on-switch (major).** `relay-config.js` now ships `enabled: false` with the empty address. `L.enabled()` and `L.configuredUrl()` (link-rules.js) require `enabled === true` as well as a good address; `puller.active()` checks it in plain sight; `R.http` re-checks on every request, so even a caller that skips `R.create()` sends nothing. The publisher says "address filled in but enabled still false" (status `notenabled`). The Bastion's Switch on is the laptop's extra switch, and Switch off stops only the laptop. The QR link carries no online flag (tested). Guide, panel text, setup guide and phone notes tell this one story. Tests: address plus enabled false (also missing, `'true'`, 1 and so on) gives no request of any kind from the phone, the sender or the transport (fetch, XHR, EventSource, WebSocket, beacon spy), and in the click-through the same phone looks only with `enabled: true`.
2. **`__proto__` handlers.** The sender's notes are Maps. Test with `mira`, `__proto__`, `constructor`, `toString`: sent, not resent, cleaned up on Take back code. The rest of the link code was scanned: the Bastion list uses a Map and a Set, snapshot creature ids already go through `P.safeKey`, nothing else is keyed by a handler name.
3. **iPhone steps on the first screen.** The screen after linking has Copy my link and the shut Home Screen help.
4. **Link during a reveal.** `view.playing()` and `intro.closing()`: the same link is ignored; a different or damaged one waits until the reveal and its closing curtain end, then asks first. Click-through test.
5. **Phone address 199 or 200 letters.** One limit (`L.PHONE_URL_MAX`); loading a save uses `cleanPhoneUrl`. Tests for 190 to 202.
6. to 9. **Docs** (`ONLINE-LINK-SETUP.md`, `PHONE-PAGE.md`, `guide.html`): GitHub Pages steps and the merge dependency; completely off means publishing the change; honest rules text, what Test the link proves, what to do if the quota fills; the step 6 text, 20 s polling, the step references; exact CLAUDE.md find-and-replace edits (four, not applied).
10. **Tests.** Look-alike hosts, user names, backslashes, ports; removing either final `$` makes a test fail (checked by hand). The click-through blocks WebSockets, proves the block with a five-kind probe, and asserts the online pages' own spy saw only the made-up host.

## Left alone
The Pages steps and the Google console steps are still unchecked against the real screens. A phone's `seen` list in phone.js is a plain object keyed by creature id; ids are filtered by `P.safeKey` before they reach a phone, so it was left.

## Gates
See the final report.
