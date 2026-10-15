/**
 * Cards or table on the Character reference page, remembered on this device only. Browser
 * storage can be missing or throw (private windows, blocked site data); then the default
 * is used and nothing breaks.
 */
export type ReferenceView = 'cards' | 'table';

const KEY = 'grim-games:reference-view';

function read(): ReferenceView {
	try {
		const value = globalThis.localStorage?.getItem(KEY);
		return value === 'table' ? 'table' : 'cards';
	} catch {
		return 'cards';
	}
}

class ReferenceViewMode {
	#value = $state<ReferenceView>(read());

	get current(): ReferenceView {
		return this.#value;
	}

	set current(value: ReferenceView) {
		this.#value = value;
		try {
			globalThis.localStorage?.setItem(KEY, value);
		} catch {
			// Not remembered; the choice still applies until the page is closed.
		}
	}
}

export const referenceView = new ReferenceViewMode();
