/** What the app shows about the build it is running (the build line at the end of the menu, issue reports). */
export interface BuildInfo {
	version: string;
	commit: string;
	branch: string;
	builtAt: string;
	/** `production` for builds of main on Workers Builds, `preview` for other branches, else `local`. */
	channel: 'production' | 'preview' | 'local';
}

/** Filled in by Vite at build time (`define` in vite.config.ts, from build-info.ts). */
export const buildInfo: BuildInfo = __BUILD_INFO__;
