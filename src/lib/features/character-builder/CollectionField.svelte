<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NameDialog from '#lib/features/library/NameDialog.svelte';
	import { characterCollections } from '#lib/features/library/library-collections.svelte.ts';
	import { savedRef } from '#lib/features/library/library-collections.ts';
	import Select from '#lib/ui/primitives/Select.svelte';

	/**
	 * The Library's character collections this character is in (Trevor, 2026-10-18: "in
	 * character builder, allow assigning to character collection"). It is the Library's own
	 * store, so the Library shows the same collections. A character can be in several, so each
	 * is ticked on its own; "New collection" names one and puts the character in it. Until the
	 * character is saved there is nothing for a collection to hold, so it is shown but disabled.
	 */
	interface Props {
		/** The saved character's id, once saved. */
		savedId: string | undefined;
	}

	let { savedId }: Props = $props();

	let naming = $state(false);

	const ref = $derived(savedId && savedRef(savedId));
	const inCollections = $derived(
		ref ? characterCollections.list.filter((c) => c.characters.includes(ref)).map((c) => c.id) : []
	);
	const options = $derived(characterCollections.list.map((c) => ({ value: c.id, label: c.name })));
	/** The list's last option: name a new collection rather than pick one. */
	const newCollection = $derived({
		value: 'new',
		label: t('library.newCollection'),
		run: () => (naming = true)
	});

	function change(values: string[]) {
		if (!ref) return;
		// The one option ticked or unticked: the Library store toggles one at a time.
		for (const c of characterCollections.list) {
			if (values.includes(c.id) !== inCollections.includes(c.id)) {
				characterCollections.toggle(c.id, ref);
			}
		}
	}

	function add(name: string) {
		const id = characterCollections.add(name);
		if (id && ref) characterCollections.toggle(id, ref);
	}
</script>

<Select
	label={t('character-builder.collections')}
	multiple
	values={inCollections}
	{options}
	action={newCollection}
	placeholder={t('common.none')}
	disabled={!ref}
	onValuesChange={change}
/>

<NameDialog bind:open={naming} title={t('library.newCollection')} onsave={add} />
