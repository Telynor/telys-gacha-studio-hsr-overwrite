# Changelog

## 1.0.9

- Match the five-star lead-in to the PS5 reference with a subdued Path emblem,
  blue light columns, and the larger center star aligned to its visible center.
- Bring Light Cone artwork in large and settle it near half the screen height.
  Slide the reward nameplate into place during the reveal.
- Widen and offset the 3–4–3 summary rows, with upright Light Cone artwork,
  Path and element icons, gold stars, and purple or gold highlights.
- Use the same wider frame in the summary portrait editor and the result cards.

## 1.0.8

- Wait for decoded future frames in the actual cinematic video element after
  its file has downloaded. Keep Skip available while preparing the decoder.
- Temporarily reduce this browser's hidden tabletop rendering and pause running
  banner CSS/Web Animations while the opening prepares/plays. Restore the prior
  limits/animations on completion, Skip, startup failure, or closing the reveal.
- Add a client setting for background rendering reduction, enabled by default.
  Preserve the tabletop's configured minimum and any later changes to its limit.
- Cap reveal Canvas pixel density at 2× to avoid excessive high-DPI allocation.
- Add local cinematic reports for buffered playback, decoder readiness,
  resolution, waits/stalls, and dropped frames when supported. Include the
  installed version and active preload settings in the integration startup log.
- Time out unsuccessful decoder preparation instead of holding the pull open;
  keep original rewards and five-star-preserving ten-pull Skip behavior intact.

## 1.0.7

- Add a **Skip** button for ten-pulls, available during the configured opening
  video and reward reveals. Singles retain their existing behavior.
- Skip the opening and remaining three-/four-star reveals while keeping every
  remaining five-star's full Path/star lead-in, splash art, and labels. Each
  five-star stays on screen until clicked; after the last one, open the summary.
- Keep multiple five-stars in their actual pull order, continue a five-star
  already playing without restarting it, and avoid replaying earlier rewards.
- Go directly to the summary when no five-stars remain. Always show all ten
  original rewards in the summary without changing Items, quantities, or delivery.
- Stop skipped animation frames and ignore late video callbacks. Support native
  keyboard activation of Skip and preserve reduced-motion preferences.

## 1.0.6

- Download the selected opening and rarity aura videos completely before
  playback, then use browser-local Blob URLs. Warm the banner's videos when it
  opens and reuse the downloads across pulls.
- Show preload progress with a Skip video option. Timed-out or failed downloads
  fall back to the reward reveal without changing delivered Items.
- Add a bounded client video cache with configurable memory budget, shared
  downloads, active-playback protection, and cleanup when leaving the page.
- Seek consecutive same-rarity aura clips instead of reloading their media.
- Add a draggable character art preview to each reward's Config window, with
  wheel/slider zoom, numeric offsets, arrow-key nudges, and reset controls.
- Save separate framing for the 10-pull summary portrait and full-screen splash
  art. The preview and real pull use the same placement calculations.
- Fit full character splash art inside the screen by default and align summary
  portraits to the top, avoiding the old torso crop on tall Actor portraits.
- Keep adjustments local to the selected banner reward; preserve the linked
  Actor and awarded character-card Item.

## 1.0.5

- Remove the extra rectangular outlines drawn around Light Cone art. The linked
  Item artwork, its existing borders, and the Path/element icons are preserved.
- Add a timeline-driven rarity flash: purple for four-star rewards, gold for
  five-star rewards, and blue for three-star rewards, behind the splash art.
- Restart aura clips for every reward, including consecutive rewards of the
  same rarity, and keep the procedural ring active while a clip is loading.
- Align late-starting aura videos with the reveal clock and ignore cancelled
  playback callbacks from earlier rewards.
- Preserve the rarity flash when a throttled frame crosses the reveal boundary.

## 1.0.4

- Verify that inventory writes return every expected saved Item. Empty or partial
  results from creation hooks now produce a recorded delivery failure.
- Include confirmed Item IDs in pull history so a GM can review partial delivery
  before repairing it without granting another copy of already saved rewards.

## 1.0.3

- Move the reveal above Gacha Studio's banner and loading screen. Previously the
  hidden reveal could wait for clicks while "Establishing link" stayed visible.
- Save the host's original selected rewards before starting the presentation,
  while preserving its payment, RNG, pity, quantities, and stacking logic.
- Await the host's actual Item creates and updates, including its unawaited
  create call, and report write failures or inaccessible reward links.
- Keep the anti-spam lock until presentation completes; playback or chat errors
  after saved delivery do not grant duplicates or discard the saved rewards.
- Retain the latest 20 selected pulls on the recipient Actor for GM review of
  future failed deliveries. Earlier lost selections cannot be reconstructed.
- Add delivery-order, failure, concurrency, preview, and history regression tests.

## 1.0.2

- Fix Config clicks on the native form used by Gacha Studio's banner editor.
  The click listener now attaches to the whole form instead of its first field.
- Use the same native-element handling inside the reward editor so its fields,
  artwork buttons, and Actor drop area bind to the correct window element.
- Add regression coverage for indexed native forms, the render-to-Config-to-Save
  flow, repeated rendering, and jQuery-wrapped application elements.

## 1.0.1

- Replace the cramped inline character editor with a **Config** button inside
  each reward panel and a separate, resizable configuration window.
- Arrange the reward panel's name, quantity, and controls in rows that fit the
  existing pool grid, without an editor extending beside the card.
- Keep Actor links, labels, icons, artwork uploads, and reward preview together
  in the selected entry's window. Hide the superseded inline reveal controls.
- Add Save changes and Cancel. Save only the selected entry's presentation;
  preserve the programmed reward Item, quantity, and other banner entries.
- Wait for pending Actor drops before saving, ignore callbacks after closing,
  and reject saves when the entry was removed/replaced or the banner changed.
- Distribute the installable ZIP directly from this repository. Use the updated
  raw manifest URL in the README for 1.0.1 and future updates.

## 1.0.0

- Extend the existing Gacha Studio reward programmer with per-entry Actor links,
  metadata snapshots, editable labels/icons, and splash artwork overrides.
- Replace the host animation handler while retaining its original reward results
  and inventory delivery.
- Add the saved character Path/five-star intro, full character splash, rarity
  aura, click-to-advance flow, and ten-pull-only 3–4–3 summary.
- Preserve configured opening videos and add reduced-motion support.
