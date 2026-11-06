# tely's gacha studio HSR overwrite

An addendum to **Gacha Studio**, module ID `gacha-banner`, for Foundry VTT 14.
It replaces the host's pull presentation and extends its reward programmer.
The host saves the selected rewards to inventory before the reveal begins.
The original Gacha Studio module must remain installed and enabled.

## Install

Paste this URL into Foundry's **Install Module → Manifest URL**:

```text
https://raw.githubusercontent.com/Telynor/telys-gacha-studio-hsr-overwrite/main/manifest.json
```

For version 1.0.1 and later, use the manifest URL above. The older GitHub release
manifest still points to 1.0.0; reinstalling with the URL above switches Foundry
to this update channel.

Enable this module alongside Gacha Studio. Tely's Star Rail Ultimates is
recommended for automatic character metadata and saved Path/element icons.
It is optional: the reward programmer also permits manually supplied metadata.

## Program each character reward

1. Open the existing Gacha Studio banner manager and edit a banner.
2. Add the **character-card Item that should be awarded** to its reward pool.
3. Click **Config** inside that reward's panel. Its settings open in a separate,
   resizable window showing the exact reward Item being configured.
4. Click **Choose corresponding character** and drag an Actor from the Actors
   sidebar or an Actor compendium into the drop area.
5. The actor supplies its name, Path, element, icons, and splash artwork.
   Use **Upload / choose** to select or upload replacement art for this reward.
6. Under **Character art framing**, choose **10-pull portrait** or **Reveal splash
   art**. Drag the art inside the preview to position it, scroll to zoom, or use
   the zoom slider and horizontal/vertical offset fields. Arrow keys nudge the
   art by 1% (Shift + arrow: 5%). Each view saves its own framing.
7. Use **Preview this reward**, click **Save changes**, then **save the banner**.
   **Cancel** or closing the window discards its pending changes.

The Config button stays inside the reward panel. Actor links and artwork fields
are edited in the separate window, with enough space for their labels and image
browsers. The Actors sidebar remains accessible while this window is open, so
you can drag a character into it. Each entry has its own editor, including when
the same Item appears more than once or in multiple banners.

Each banner reward stores an independent Actor link and presentation snapshot.
The Actor's UUID does not replace the reward Item's UUID. Drawing Welt displays
Welt's saved Nihility icon and splash, then the host grants the configured Welt
character-card Item. A Himeko entry uses its saved Erudition icon instead.
An Actor is never imported or spawned by this extension.

The snapshot also makes the reveal available to players who cannot read the
GM's source Actor. **Refresh from actor** imports changed source metadata;
manual artwork overrides are preserved. **Use actor artwork** clears the
per-reward splash override. The source Actor is never modified.

The summary preview uses the saved Actor portrait; the reveal preview uses its
splash artwork or this reward's override. Summary portraits start aligned to the
top so a tall portrait shows the character's head. Reveal artwork fits fully
inside the screen by default. **Reset portrait framing** restores the default
summary crop; **Fit whole artwork** restores the reveal's fit. Reveal framing
scales with the viewer's screen, and the preview matches the current browser's
screen shape.

## Pull presentation

- The existing pull buttons invoke the new presentation automatically.
- A five-star reward begins on black, with a little blue, its own Path icon,
  and five rising stars. The middle star is twice the other stars' width and
  height. The Path and central star arrive together, then shrink and fade.
- The splash appears over the supplied starfield and expanding rarity aura:
  gold for 5★, purple for 4★, blue for 3★.
- A matching rarity flash runs on the reveal clock, including while the aura
  video loads. Consecutive rewards restart their aura from the beginning.
- Characters use full, unframed splash art with their name, element icon,
  star count, and Path label. Light Cones use their linked reward Item's art.
  Their supplied artwork and icon borders are preserved without extra outlines.
- Every reward holds until one click, Enter, Space, or Escape advances it.
- Singles close after their reward. Only a ten-pull shows the angled,
  staggered **3–4–3** summary. Click that screen to close it.
- Real pulls always retain the host's selected rewards, rarities, and order.
  The demonstration's shuffle is not included in production.
- Concurrent pull presentations queue instead of replacing each other.
- Inventory creation and stacking updates finish before opening videos or reward
  reveals start. Closing the tab during a reveal does not cancel saved rewards.
- The host's anti-spam lock stays active until the presentation closes. The
  reveal appears above the banner's loading screen so it can receive clicks.
- Reduced-motion preferences show held rewards without the reveal animation.

The old card-flipping/mulligan/discard presentation is replaced by this flow.
Gacha Studio's payment, actual reward selection, pity, 50/50, item stacking,
inventory delivery, and result chat remain handled by the host engine. This
extension moves presentation after that delivery and waits for the host's actual
inventory writes, including item creation that the host starts without awaiting.

## Interrupted or failed pulls

Version 1.0.3 records the latest 20 selected pulls on the recipient Actor, with
the original reward Item UUIDs, quantities, banner, and delivery status. A GM can
inspect them using the extension API:

```js
game.modules.get("telys-gacha-studio-hsr-overwrite").api.getPullHistory(actor)
```

An inaccessible reward link or a rejected inventory save is reported as a
delivery failure. Review the recorded rewards against the Actor's inventory
before manually repairing a failed or partial delivery. The record does not
automatically grant another copy or charge for a replacement pull.

Pulls interrupted on earlier versions did not have this record. Their selected
rewards cannot be reconstructed from the extension's startup console log;
missing currency or rewards need a GM repair.

## Existing ticket/train/Pom-Pom opening

In the banner's existing **Animation** tab, choose **Video** and keep the normal
and five-star opening clips configured there. They play before this extension's
reward reveals. An opening can be skipped without changing the selected rewards.
Disable **Keep configured opening videos** in this extension's settings to omit
them. Reveal playback defaults to 1.5× and can be changed in Module Settings.

## Local video preloading

Opening a banner starts downloading its configured normal/five-star openings
and the three rarity aura clips in the background. Before playback, the selected
opening and needed aura files finish downloading and are played through local
Blob URLs. Repeat pulls reuse those files, and consecutive rewards of the same
rarity seek the existing aura video instead of loading it again.

If a pull starts before the files are ready, **Preparing warp video** shows the
download progress. **Skip video** (or Escape) continues with the character reveals
and Canvas rarity effects. A failed download also falls back to the reveal;
preloading does not alter the host's saved rewards or make another charge.

**Preload videos in this browser** is enabled by default. The client setting
**Video preload memory limit (MB)** defaults to 256 MB. Unused encoded video files
are evicted as the cache fills; files needed for active playback stay pinned, so
an active pull can temporarily exceed that retained-cache budget. A single file
larger than the limit is skipped. Reloading or leaving the world releases the
cache. These copies are local to each player's browser and are not written to
their disk by this module.

Foundry-hosted asset paths work directly. External video hosts must permit CORS
downloads; otherwise use a file uploaded to Foundry or disable preloading in that
browser to use the previous URL playback. Buffering avoids network stalls during
playback; video decoding still depends on the player's device. Reduced-motion
preferences omit video downloads and playback.

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
Tests exercise metadata import, per-banner overrides, reward editor save/cancel,
Actor drop and upload timing, immutable reward delivery, single/ten-pull
transitions, summary layout, independent portrait/splash framing, full video
buffering, cache reuse/eviction, skipped downloads, and the host animation
integration.
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
