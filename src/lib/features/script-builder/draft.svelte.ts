import type { CharacterId } from '#lib/core/data/types.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { emptyDraft, parseDraft, type ScriptDraft } from './draft.ts';

const STORAGE_KEY = 'grim-games:script-builder';

function read(): ScriptDraft {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		return parseDraft(raw ? JSON.parse(raw) : null);
	} catch (error) {
		// Blocked storage or damaged JSON: start empty; the builder still works this visit.
		reportError(error, { area: 'script-builder', notify: false });
		return emptyDraft();
	}
}

/** The script on the builder, saved on this device on every change. */
class ScriptBuilderDraft {
	#draft = $state<ScriptDraft>(read());

	get current(): ScriptDraft {
		return this.#draft;
	}

	#set(next: ScriptDraft): void {
		this.#draft = next;
		try {
			globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch (error) {
			reportError(error, { area: 'script-builder', notify: false });
		}
	}

	setName(name: string): void {
		this.#set({ ...this.#draft, name });
	}

	setAuthor(author: string): void {
		this.#set({ ...this.#draft, author });
	}

	/** Adds the character, or takes it off when it is already on. */
	toggle(id: CharacterId): void {
		const ids = this.#draft.ids;
		this.#set({
			...this.#draft,
			ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
		});
	}

	/** After saving: later saves replace that saved script. */
	setEditing(scriptId: string | undefined): void {
		const next: ScriptDraft = { ...this.#draft, editing: scriptId };
		if (!scriptId) delete next.editing;
		this.#set(next);
	}

	replace(draft: ScriptDraft): void {
		this.#set(draft);
	}

	clear(): void {
		this.#set(emptyDraft());
	}
}

export const scriptBuilderDraft = new ScriptBuilderDraft();
