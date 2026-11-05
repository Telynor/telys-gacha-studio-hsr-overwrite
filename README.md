# tely's gacha studio HSR overwrite

An addendum to **Gacha Studio**, module ID `gacha-banner`, for Foundry VTT 14.
It replaces the host's pull presentation and extends its reward programmer.
The original Gacha Studio module must remain installed and enabled.

## Install

Paste this URL into Foundry's **Install Module → Manifest URL**:

```text
https://github.com/Telynor/telys-gacha-studio-hsr-overwrite/releases/latest/download/manifest.json
```

Enable this module alongside Gacha Studio. Tely's Star Rail Ultimates is
recommended for automatic character metadata and saved Path/element icons.
It is optional: the reward programmer also permits manually supplied metadata.

## Program each character reward

1. Open the existing Gacha Studio banner manager and edit a banner.
2. Add the **character-card Item that should be awarded** to its reward pool.
3. Expand **HSR character reveal** beneath that reward.
4. Click **Choose corresponding character** and drag an Actor from the Actors
   sidebar or an Actor compendium into the drop area.
5. The actor supplies its name, Path, element, icons, and splash artwork.
   Use **Upload / choose** to select or upload replacement art for this reward.
6. Use **Preview this reward**, then **save the banner**.

Each banner reward stores an independent Actor link and presentation snapshot.
The Actor's UUID does not replace the reward Item's UUID. Drawing Welt displays
Welt's saved Nihility icon and splash, then the host grants the configured Welt
character-card Item. A Himeko entry uses its saved Erudition icon instead.
An Actor is never imported or spawned by this extension.

The snapshot also makes the reveal available to players who cannot read the
GM's source Actor. **Refresh from actor** imports changed source metadata;
manual artwork overrides are preserved. **Use actor artwork** clears the
per-reward splash override. The source Actor is never modified.

## Pull presentation

- The existing pull buttons invoke the new presentation automatically.
- A five-star reward begins on black, with a little blue, its own Path icon,
  and five rising stars. The middle star is twice the other stars' width and
  height. The Path and central star arrive together, then shrink and fade.
- The splash appears over the supplied starfield and expanding rarity aura:
  gold for 5★, purple for 4★, blue for 3★.
- Characters use full, unframed splash art with their name, element icon,
  star count, and Path label. Light Cones use their linked reward Item's art.
- Every reward holds until one click, Enter, Space, or Escape advances it.
- Singles close after their reward. Only a ten-pull shows the angled,
  staggered **3–4–3** summary. Click that screen to close it.
- Real pulls always retain the host's selected rewards, rarities, and order.
  The demonstration's shuffle is not included in production.
- Concurrent pull presentations queue instead of replacing each other.
- Reduced-motion preferences show held rewards without the reveal animation.

The old card-flipping/mulligan/discard presentation is replaced by this flow.
Gacha Studio's payment, actual reward selection, pity, 50/50, item stacking,
inventory delivery, and result chat remain handled by the host engine.

## Existing ticket/train/Pom-Pom opening

In the banner's existing **Animation** tab, choose **Video** and keep the normal
and five-star opening clips configured there. They play before this extension's
reward reveals. An opening can be skipped without changing the selected rewards.
Disable **Keep configured opening videos** in this extension's settings to omit
them. Reveal playback defaults to 1.5× and can be changed in Module Settings.

## Actor metadata integration

Tely's Star Rail Ultimates supplies:

- Actor flag `flags.telys-star-rail-ultimates.ultimate`: `pathId`, `elementId`,
  and `splashImage`; its public `getConfig(actor)` API is used when available.
- World settings `paths` and `elements`: each definition's name and saved icon.
- Light Cone Item flag `lightCone`: its Path and artwork when configured.

Other Actor schemas fall back to `system.details.path`, `system.details.element`,
`system.splashArt`, and the Actor portrait. The reward editor permits manual
corrections. Missing icons are omitted rather than replaced with another Path.

## Compatibility and testing

The host integration was checked against the supplied
`gacha-banner` version `1.6.0-telynor.2`, based on Gacha Studio 1.6.0.
It imports the existing `GachaAnimation` and `GachaConfigApp` classes at runtime
and does not copy or overwrite the host module's files. A world reload restores
the original behavior when this extension is disabled.

Run `npm test`, `npm run check`, and `npm run build` with Node.js and Python 3.
Tests exercise metadata import, per-banner overrides, immutable reward delivery,
single/ten-pull transitions, summary layout, and the host animation integration.
This release targets Foundry 14; a live Foundry world was not available during
automated validation. Changes to the host's internal class names or file layout
may require an integration update.

## Credits

Gacha Studio is by G. Aura Studios. This repository contains the extension only;
obtain and keep the original module separately. Star glow, starfield, and aura
reference media were supplied for this project from Honkai: Star Rail material
(HoYoverse). Character splash artwork and reward Items remain in your world;
sample Welt artwork is not bundled.

The extension's code is MIT licensed. Third-party/reference media retains its
original ownership.
