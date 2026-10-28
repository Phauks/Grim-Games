<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		loadScript,
		type Character,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import { fieldsFromEntry, previewCharacter } from '#lib/core/rules/index.ts';
	import type { SavedCharacter } from '#lib/features/character-builder/saved-characters.ts';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { chooseScript, currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import type { ScriptRow } from './ScriptPane.svelte';
	import { savedIdOf, savedRef, type CharacterCollection } from './library-collections.ts';
	import { characterCollections } from './library-collections.svelte.ts';
	import {
		convertPlan,
		keptCharacter,
		otherKinds,
		type ConvertLoss,
		type ConvertSource
	} from './library-convert.ts';
	import { characterKey, collectionKey, type ItemKind } from './library-items.ts';
	import { libraryKey } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';
	import { removeScript } from './remove-script.ts';
	import { addAsCollection, entryOf } from './add-as-kind.ts';

	/**
	 * Changes what kind of item something is (Trevor, 2026-10-18): a script, a character or a
	 * character collection. The new item takes the old one's place, folder and tags; what
	 * won't carry over is said before Confirm, never refused.
	 */
	type Item =
		| { kind: 'script'; row: ScriptRow }
		| { kind: 'character'; saved: SavedCharacter }
		| { kind: 'collection'; collection: CharacterCollection };

	interface Props {
		open?: boolean;
		item: Item;
		data: GameData | undefined;
		/** The new item's Library key, to open it. */
		onchanged?: (key: string) => void;
	}

	let { open = $bindable(false), item, data, onchanged }: Props = $props();

	const options = $derived(
		otherKinds(item.kind).map((k) => ({ value: k, label: t(`library.kindName.${k}`) }))
	);
	let to = $state<ItemKind>('script');
	$effect(() => {
		if (open) to = otherKinds(item.kind)[0];
	});

	/** The script's loaded form, for a script item. */
	const script = $derived.by((): LoadedScript | undefined => {
		if (item.kind !== 'script' || !data) return undefined;
		const { listing, shareable } = item.row;
		return listing.saved
			? reloadSavedScript(listing.saved, data)
			: loadScript(shareable.json, data).script;
	});

	const savedCharacter = (savedId: string): Character | undefined => {
		const saved = savedCharacters.get(savedId);
		return saved ? previewCharacter(fieldsFromEntry(saved.entry)) : undefined;
	};

	/** A collection's characters, each with how the collection refers to it. */
	const members = $derived.by((): { ref: string; character: Character }[] => {
		if (item.kind !== 'collection') return [];
		return item.collection.characters.flatMap((ref) => {
			const savedId = savedIdOf(ref);
			const character = savedId ? savedCharacter(savedId) : data?.byId.get(ref as never);
			return character ? [{ ref, character }] : [];
		});
	});

	const source = $derived.by((): ConvertSource => {
		if (item.kind === 'script') {
			const homebrew = new Set(script?.homebrew ?? []);
			const characters = script?.characters ?? [];
			return {
				kind: 'script',
				name: item.row.listing.row.name,
				characters,
				homebrew: characters.filter((c) => homebrew.has(c.id)),
				details: Object.entries(script?.meta ?? {}).some(
					([key, v]) => key !== 'name' && v !== undefined && v !== ''
				)
			};
		}
		if (item.kind === 'character') {
			const fields = fieldsFromEntry(item.saved.entry);
			const character = previewCharacter(fields);
			return {
				kind: 'character',
				name: fields.name,
				characters: [character],
				homebrew: [character]
			};
		}
		const characters = members.map((m) => m.character);
		return {
			kind: 'collection',
			name: item.collection.name,
			characters,
			homebrew: members.filter((m) => savedIdOf(m.ref)).map((m) => m.character)
		};
	});
	const plan = $derived(convertPlan(source, to));
	const lossy = $derived(
		plan.possible && plan.losses.some((l) => l.kind === 'details' || l.kind === 'others')
	);

	function lossText(loss: ConvertLoss): string {
		switch (loss.kind) {
			case 'details':
				return t('library.changeKind.lossDetails');
			case 'others':
				return t('library.changeKind.lossOthers', { count: loss.count });
			case 'kept-character':
				return t('library.changeKind.keptCharacter');
		}
	}

	/** The item's characters as they go on a script: official ones by id. */
	function scriptEntries(): unknown[] {
		if (item.kind === 'character') return [item.saved.entry];
		if (item.kind === 'collection') {
			return members.map((m) => {
				const savedId = savedIdOf(m.ref);
				return savedId ? (savedCharacters.get(savedId)?.entry ?? m.ref) : m.ref;
			});
		}
		return [];
	}

	async function makeScript(): Promise<string | undefined> {
		if (!data) return undefined;
		const loaded = loadScript(
			[{ id: '_meta', name: source.name }, ...scriptEntries()],
			data
		).script;
		if (!loaded) return undefined;
		await chooseScript(loaded, { kind: 'built' });
		const saved = currentScript.saved;
		return saved && saved.scriptId !== 'unsaved' ? libraryKey({ json: saved.json }) : undefined;
	}

	function makeCollection(): string | undefined {
		if (script) return addAsCollection(script, source.name);
		const id = characterCollections.add(source.name);
		if (!id) return undefined;
		if (item.kind === 'character') characterCollections.toggle(id, savedRef(item.saved.savedId));
		return collectionKey(id);
	}

	function makeCharacter(): string | undefined {
		if (item.kind === 'collection') {
			const first = members[0];
			const savedId = first && savedIdOf(first.ref);
			// Already a Character builder character: that one is kept as it is.
			if (savedId) return characterKey(savedId);
		}
		const character = keptCharacter(source);
		if (!character) return undefined;
		return characterKey(savedCharacters.save(fieldsFromEntry(entryOf(character))));
	}

	async function removeOld(old: Item, target: ItemKind) {
		if (old.kind === 'script') await removeScript(old.row.listing);
		else if (old.kind === 'collection') characterCollections.delete(old.collection.id);
		else if (target !== 'collection') savedCharacters.remove(old.saved.savedId);
	}

	const oldKey = $derived(
		item.kind === 'script'
			? item.row.key
			: item.kind === 'character'
				? characterKey(item.saved.savedId)
				: collectionKey(item.collection.id)
	);

	async function change() {
		if (!plan.possible) return;
		// Kept from the start: removing the old item closes the pane this dialog sits in.
		const old = item;
		const target = to;
		const from = oldKey;
		open = false;
		try {
			const key =
				target === 'script'
					? await makeScript()
					: target === 'collection'
						? makeCollection()
						: makeCharacter();
			if (!key) return;
			if (key !== from) {
				libraryLabels.moveLabels(from, key);
				await removeOld(old, target);
			}
			onchanged?.(key);
		} catch (e) {
			reportError(e, { area: 'library' });
		}
	}
</script>

<Dialog bind:open title={t('library.changeKind.title')}>
	<div class="body" data-testid="change-kind">
		<Select label={t('library.changeKind.to')} value={to} {options} onChange={(v) => (to = v)} />
		{#if !plan.possible}
			<p class="warn" role="status">{t(`library.changeKind.${plan.reason}`)}</p>
		{:else if plan.losses.length}
			<ul class="losses" aria-label={t('library.changeKind.notKept')}>
				{#each plan.losses as loss (loss.kind)}
					<li>{lossText(loss)}</li>
				{/each}
			</ul>
		{:else}
			<p role="status">{t('library.changeKind.allKept')}</p>
		{/if}
	</div>
	{#snippet actions()}
		<ModalActions
			danger={lossy}
			disabled={!plan.possible}
			onCancel={() => (open = false)}
			onConfirm={() => void change()}
		/>
	{/snippet}
</Dialog>

<style>
	.body {
		display: grid;
		gap: var(--space-3);
	}
	p,
	ul {
		margin: 0;
	}
	.losses {
		padding-inline-start: var(--space-4);
	}
	.warn {
		color: var(--evil-text);
	}
</style>
