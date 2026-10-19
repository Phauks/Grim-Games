import { reportError } from '#lib/features/errors/report.svelte.ts';
import type { IconSetId } from './catalogue.ts';
import regular from './generated/ph-regular.ts';
import type { IconMap } from './types.ts';

// Each slot's default icon in the default weight ships in the main bundle so icons draw on
// first paint. The rest of that weight (alternatives, bag tile symbols) and the other weights
// are separate chunks fetched the first time one is drawn (or Settings opens).
const loaders: Record<IconSetId, () => Promise<{ default: IconMap }>> = {
	'ph-regular': async () => ({ default: regular }),
	'ph-thin': () => import('./generated/ph-thin.ts'),
	'ph-light': () => import('./generated/ph-light.ts'),
	'ph-bold': () => import('./generated/ph-bold.ts'),
	'ph-fill': () => import('./generated/ph-fill.ts'),
	'ph-duotone': () => import('./generated/ph-duotone.ts')
};

class IconSets {
	#loaded = $state.raw<Partial<Record<IconSetId, IconMap>>>({ 'ph-regular': regular });
	#pending = new Set<IconSetId>();

	#regularComplete = false;

	get(id: IconSetId): IconMap | undefined {
		return this.#loaded[id];
	}

	/** Loads a weight, and for the default weight the rest of it when `icon` isn't there yet. */
	load(id: IconSetId, icon?: string): void {
		if (id === 'ph-regular' && icon && !this.#loaded[id]?.[icon]) this.#loadRegularMore();
		if (this.#loaded[id] || this.#pending.has(id)) return;
		this.#pending.add(id);
		loaders[id]()
			.then((module) => (this.#loaded = { ...this.#loaded, [id]: module.default }))
			// The regular set keeps showing, so this is only logged.
			.catch((error) => reportError(error, { area: 'settings', notify: false }))
			.finally(() => this.#pending.delete(id));
	}

	#loadRegularMore(): void {
		if (this.#regularComplete) return;
		this.#regularComplete = true;
		import('./generated/ph-regular-more.ts')
			.then(({ default: more }) => {
				this.#loaded = { ...this.#loaded, 'ph-regular': { ...regular, ...more } };
			})
			.catch((error) => {
				this.#regularComplete = false;
				reportError(error, { area: 'settings', notify: false });
			});
	}
}

export const iconSets = new IconSets();
