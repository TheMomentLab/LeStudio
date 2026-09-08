/**
 * Build profile. The same frontend ships in two packages:
 *
 * - "studio"  — LeStudio: every page (default).
 * - "checkup" — lerobot-checkup: the hardware pages only (Status, Motor Setup,
 *               Camera Setup), served by lerobot_checkup.server, which has no
 *               Hub, dataset, training or eval routes.
 *
 * `VITE_APP_PROFILE` is inlined at build time, so the workflow pages and
 * their chunks drop out of the checkup bundle.
 */
export type AppProfile = "studio" | "checkup";

export const APP_PROFILE: AppProfile = import.meta.env.VITE_APP_PROFILE === "checkup" ? "checkup" : "studio";
export const IS_CHECKUP = APP_PROFILE === "checkup";
export const APP_NAME = IS_CHECKUP ? "lerobot-checkup" : "LeStudio";
