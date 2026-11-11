import {installBannerSettings} from "./banner-settings.js";
import {installSharedPity} from "./banner-pity.js";
import {ID, HOST_ID, setting} from "./constants.js";
import {readCharacter, resolveVisual} from "./character.js";
import {installProgrammer} from "./programmer.js";
import {installAnimationOverride} from "./integration.js";
import {getPullHistory, installDeliveryBeforeReveal} from "./delivery.js";
import {videoCache} from "./video-cache.js";
import {installVideoPreloader, warmBannerVideos} from "./video-preload.js";
import {getVideoPlaybackReports} from "./video-playback.js";

Hooks.once("init", () => {
  game.settings.register(ID, "bannerClasses", {scope: "world", config: false, type: Object, default: {}});
  game.settings.register(ID, "defaultBanner", {scope: "world", config: false, type: String, default: ""});
  game.settings.register(ID, "enabled", {name: "Enable HSR pull overwrite", hint: "Use HSR character reveals and the ten-pull result layout for Gacha Studio pulls.", scope: "world", config: true, type: Boolean, default: true, requiresReload: true});
  game.settings.register(ID, "openingVideos", {name: "Keep configured opening videos", hint: "Play the existing banner's Video opening before the new reward reveals.", scope: "world", config: true, type: Boolean, default: true});
  game.settings.register(ID, "speed", {name: "Reveal playback speed", scope: "world", config: true, type: Number, range: {min: .5, max: 3, step: .25}, default: 1.5});
  game.settings.register(ID, "preloadVideos", {name: "Preload videos in this browser", hint: "Download pull videos before playback and reuse the local copies between pulls.", scope: "client", config: true, type: Boolean, default: true});
  game.settings.register(ID, "videoCacheMB", {name: "Video preload memory limit (MB)", hint: "Cached video files are released as this limit is reached. Increase it for unusually large opening videos.", scope: "client", config: true, type: Number, range: {min: 64, max: 1024, step: 64}, default: 256, onChange: value => videoCache.setLimit(value * 1024 * 1024)});
  game.settings.register(ID, "reduceBackgroundRendering", {name: "Reduce scene rendering during cinematics", hint: "Temporarily limit this browser's hidden tabletop rendering and pause banner animations while the opening video plays. Restore them when it ends or is skipped.", scope: "client", config: true, type: Boolean, default: true});
});

Hooks.once("ready", async () => {
  if (!game.modules.get(HOST_ID)?.active) {
    ui.notifications.error("Tely's Gacha Studio HSR overwrite requires the existing Gacha Studio (gacha-banner) module."); return;
  }
  try {
    const [{GachaAnimation}, {GachaConfigApp}, {GachaRoller}] = await Promise.all([
      import(new URL(`../../${HOST_ID}/scripts/animation.js`, import.meta.url).href),
      import(new URL(`../../${HOST_ID}/scripts/config.js`, import.meta.url).href),
      import(new URL(`../../${HOST_ID}/scripts/roller.js`, import.meta.url).href),
    ]);
    if (typeof GachaAnimation?.play !== "function" || typeof GachaConfigApp?.prototype?._generateItemHTML !== "function" || typeof GachaRoller?.performRoll !== "function" || typeof GachaRoller?._deliverItems !== "function") {
      throw new Error("The installed Gacha Studio version does not expose the required animation and reward programmer APIs.");
    }
    installAnimationOverride(GachaAnimation);
    installDeliveryBeforeReveal(GachaRoller, GachaAnimation);
    videoCache.setLimit(setting(ID, "videoCacheMB", 256) * 1024 * 1024);
    installVideoPreloader();
    const preview = async (results, bannerId) => {
      const banner = (setting(HOST_ID, "bannerList", [])).find(value => value.id === bannerId) || {};
      return GachaAnimation.play(results, {...banner, animation: {...banner.animation, type: "starRail"}});
    };
    installProgrammer(GachaConfigApp, {preview});
    installBannerSettings(GachaConfigApp);
    installSharedPity(CONFIG.Actor.documentClass);
    game.modules.get(ID).api = Object.freeze({readCharacter, resolveVisual, preview, getPullHistory, warmBannerVideos, videoCacheStats: () => videoCache.stats(), clearVideoCache: () => videoCache.clear(), getVideoPlaybackReports});
    console.info(`${ID} | v${game.modules.get(ID).version} installed on Gacha Studio. Host rewards are saved before reveal playback.`, {preloadVideos: setting(ID, "preloadVideos", true), reduceBackgroundRendering: setting(ID, "reduceBackgroundRendering", true)});
  } catch (error) {
    console.error(`${ID} | Could not install the Gacha Studio integration.`, error);
    ui.notifications.error("The HSR overwrite could not connect to this version of Gacha Studio. See the console for details.");
  }
});
