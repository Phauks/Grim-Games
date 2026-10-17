<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { bannedIn, type GameMode, type StorytellerRestrictions } from '#lib/core/modes/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The Storyteller's restricted characters for one game (Trevor, 2026-10-17: every mode
	 * needs a way to restrict characters). Marked rows are kept out of the game; the mode's own
	 * bans start marked and can be lifted.
	 */
	interface Props {
		open: boolean;
		mode: GameMode;
		/** The game's characters before any ban, in order. */
		characters: readonly Character[];
		restrictions: StorytellerRestrictions;
		onChange: (next: StorytellerRestrictions) => void;
	}

	let { open = $bindable(), mode, characters, restrictions, onChange }: Props = $props();

	const modeBans = $derived(new Set(mode.parts.restricted?.banned ?? []));
	const notChoosable = $derived(new Set(mode.parts.restricted?.notChoosable ?? []));
	const banned = $derived([...bannedIn(mode, restrictions)]);
	let query = $state('');

	function toggle(id: CharacterId) {
		const without = (list: CharacterId[]) => list.filter((x) => x !== id);
		if (modeBans.has(id)) {
			const lifted = restrictions.allowed.includes(id);
			onChange({
				...restrictions,
				allowed: lifted ? without(restrictions.allowed) : [...restrictions.allowed, id]
			});
		} else {
			const on = restrictions.banned.includes(id);
			onChange({
				...restrictions,
				banned: on ? without(restrictions.banned) : [...restrictions.banned, id]
			});
		}
	}
</script>

<Dialog bind:open title={t('modes.restrictedTitle')} size="full">
	<div class="list">
		<SharedPicker
			{characters}
			mode="multi"
			selected={banned}
			bind:query
			collapsibleKey="restricted"
			marker={(c) =>
				modeBans.has(c.id)
					? t('modes.modeBan')
					: notChoosable.has(c.id)
						? t('modes.notChoosable')
						: undefined}
			onSelect={toggle}
		/>
	</div>
</Dialog>

<style>
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
