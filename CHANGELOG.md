# Changelog

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
