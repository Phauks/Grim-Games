// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="unplugin-icons/types/svelte" />
declare global {
	/** Injected by Vite at build time from build-info.ts. */
	const __BUILD_INFO__: import('#lib/build-info.ts').BuildInfo;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The board's extra history entry, so Back asks before leaving a game. */
			inGame?: boolean;
			/** The grimoire was opened with a typed Grim view password, not the link. */
			password?: boolean;
		}
		// interface Platform {}
	}
}

export {};
