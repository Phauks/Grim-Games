import { reportError } from '#lib/features/errors/report.svelte.ts';
import type { IconSetId } from './catalogue.ts';
import regular from './generated/ph-regular.ts';
import type { IconMap } from './types.ts';

// The default weight ships in the main bundle so icons draw on first paint; the others
// are separate chunks fetched the first time a device picks them (or opens Settings).
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

	get(id: IconSetId): IconMap | undefined {
		return this.#loaded[id];
	}

	load(id: IconSetId): void {
		if (this.#loaded[id] || this.#pending.has(id)) return;
		this.#pending.add(id);
		loaders[id]()
			.then((module) => (this.#loaded = { ...this.#loaded, [id]: module.default }))
			// The regular set keeps showing, so this is only logged.
			.catch((error) => reportError(error, { area: 'settings', notify: false }))
			.finally(() => this.#pending.delete(id));
	}
}

export const iconSets = new IconSets();
