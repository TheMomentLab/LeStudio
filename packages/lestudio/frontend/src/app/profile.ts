/**
 * Build profile. The same frontend ships in two packages:
 *
 * - "studio"  — LeStudio: every page (default).
 * - "doctor"  — lerobot-doctor: the hardware pages only (Status, Motor Setup,
 *               Camera Setup), served by lerobot_doctor.server, which has no
 *               Hub, dataset, training or eval routes.
 *
 * `VITE_APP_PROFILE` is inlined at build time, so the workflow pages and
 * their chunks drop out of the doctor bundle.
 */
export type AppProfile = "studio" | "doctor";

export const APP_PROFILE: AppProfile = import.meta.env.VITE_APP_PROFILE === "doctor" ? "doctor" : "studio";
export const IS_DOCTOR = APP_PROFILE === "doctor";
export const APP_NAME = IS_DOCTOR ? "lerobot-doctor" : "LeStudio";
