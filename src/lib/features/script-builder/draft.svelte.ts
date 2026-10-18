import type { CharacterId } from '#lib/core/data/types.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import type { HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import type { VariationOf } from '#lib/features/scripts/saved-scripts.ts';
import { emptyDraft, parseDraft, type DraftCredit, type ScriptDraft } from './draft.ts';

const STORAGE_KEY = 'grim-games:script-builder';

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
	return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

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

	setScriptVersion(scriptVersion: string): void {
		this.#set({ ...this.#draft, scriptVersion });
	}

	setTeensyville(teensyville: boolean): void {
		const next: ScriptDraft = { ...this.#draft };
		if (teensyville) next.teensyville = true;
		else delete next.teensyville;
		this.#set(next);
	}

	/**
	 * Adds the character, or takes it off when it is already on. A homebrew character comes
	 * with its definition (and credit, when known), kept while it is on the script.
	 */
	toggle(id: CharacterId, homebrew?: { entry: HomebrewEntry; credit?: DraftCredit }): void {
		const { ids, homebrew: entries, credits } = this.#draft;
		if (ids.includes(id)) {
			this.#set({
				...this.#draft,
				ids: ids.filter((x) => x !== id),
				homebrew: without(entries, id),
				credits: without(credits, id)
			});
			return;
		}
		this.#set({
			...this.#draft,
			ids: [...ids, id],
			homebrew: homebrew ? { ...entries, [id]: homebrew.entry } : entries,
			credits: homebrew?.credit ? { ...credits, [id]: homebrew.credit } : credits
		});
	}

	/** After saving: later saves replace that saved script, which is a variation of `variationOf`. */
	setEditing(scriptId: string | undefined, variationOf?: VariationOf): void {
		const next: ScriptDraft = { ...this.#draft, editing: scriptId, variationOf };
		if (!scriptId) delete next.editing;
		if (!variationOf) delete next.variationOf;
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
