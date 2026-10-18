/**
 * Cards or table on the Character reference page, remembered on this device only. Browser
 * storage can be missing or throw (private windows, blocked site data); then the default
 * is used and nothing breaks.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

export type ReferenceView = 'cards' | 'table';

const KEY = 'grim-games:reference-view';

function read(): ReferenceView {
	return readStoredText(KEY) === 'table' ? 'table' : 'cards';
}

class ReferenceViewMode {
	#value = $state<ReferenceView>(read());

	get current(): ReferenceView {
		return this.#value;
	}

	set current(value: ReferenceView) {
		this.#value = value;
		// If not remembered, the choice still applies until the page is closed.
		writeStoredText(KEY, value);
	}
}

export const referenceView = new ReferenceViewMode();
