# Changelog

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
