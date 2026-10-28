import type { CharacterId, SeatedType } from '#lib/core/data/types.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';
import type { HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import type { VariationOf } from '#lib/features/scripts/saved-scripts.ts';
import { emptyDraft, parseDraft, type DraftCredit, type ScriptDraft } from './draft.ts';

const STORAGE_KEY = 'grim-games:script-builder';

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
	return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

/** The script on the builder, saved on this device on every change. */
class ScriptBuilderDraft {
	// Blocked storage or damaged JSON starts empty; the builder still works this visit.
	#draft = $state<ScriptDraft>(readParsed(STORAGE_KEY, parseDraft));

	get current(): ScriptDraft {
		return this.#draft;
	}

	#set(next: ScriptDraft): void {
		this.#draft = next;
		// No storage: the draft lasts this visit only.
		writeStored(STORAGE_KEY, next);
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
		// A new size brings its own usual counts.
		delete next.expected;
		this.#set(next);
	}

	/** Sets how many of a type the script should have; `undefined` goes back to the usual count. */
	setExpected(type: SeatedType, count: number | undefined): void {
		const expected = { ...this.#draft.expected };
		if (count === undefined) delete expected[type];
		else expected[type] = count;
		const next: ScriptDraft = { ...this.#draft, expected };
		if (!Object.keys(expected).length) delete next.expected;
		this.#set(next);
	}

	/** Every type back to the size's usual count. */
	resetExpected(): void {
		const next: ScriptDraft = { ...this.#draft };
		delete next.expected;
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

	/**
	 * A homebrew character on the script was edited (its id may have changed with its name):
	 * the new definition takes its place, in the same spot on the script.
	 */
	replaceHomebrew(oldId: CharacterId, id: CharacterId, entry: HomebrewEntry): void {
		const { ids, homebrew, credits } = this.#draft;
		if (!ids.includes(oldId)) return;
		const kept = ids.filter((x) => x !== id || x === oldId);
		this.#set({
			...this.#draft,
			ids: kept.map((x) => (x === oldId ? id : x)),
			homebrew: { ...without(homebrew, oldId), [id]: entry },
			credits: oldId === id ? credits : without(credits, oldId)
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
