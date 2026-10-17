<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import {
		bannedIn,
		GAME_MODES,
		gameModeById,
		modeCharacters,
		NO_RESTRICTIONS,
		STANDARD,
		type StorytellerRestrictions
	} from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import RestrictedDialog from './RestrictedDialog.svelte';

	/**
	 * New game's mode choice (Trevor, 2026-10-17): the mode, Inspect, and the Storyteller's
	 * restricted characters. One row whatever is chosen, so nothing reflows.
	 */
	interface Props {
		modeId: string;
		restrictions: StorytellerRestrictions;
		/** The chosen script's characters, for the restricted list. */
		loadScriptCharacters: () => Promise<readonly Character[]>;
	}

	let {
		modeId = $bindable(STANDARD.id),
		restrictions = $bindable(NO_RESTRICTIONS),
		loadScriptCharacters
	}: Props = $props();

	const mode = $derived(gameModeById(modeId) ?? STANDARD);
	const options = GAME_MODES.map((m) => ({ value: m.id, label: m.name }));
	const restrictedCount = $derived(bannedIn(mode, restrictions).size);
	let inspecting = $state(false);
	let restricting = $state(false);
	let pool = $state.raw<readonly Character[]>([]);

	async function openRestricted() {
		try {
			const [data, script] = await Promise.all([loadOfficialData(), loadScriptCharacters()]);
			// Every character the mode could use, its own bans included so they can be lifted.
			pool = modeCharacters(mode, script, data.characters, {
				banned: [],
				allowed: mode.parts.restricted?.banned ?? []
			});
			restricting = true;
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	}
</script>

<div class="mode">
	<div class="select">
		<Select
			label={t('modes.label')}
			value={modeId}
			{options}
			onChange={(v) => {
				modeId = v;
				restrictions = NO_RESTRICTIONS;
			}}
		/>
	</div>
	<IconButton
		icon="info"
		label={t('modes.inspect', { name: mode.name })}
		onclick={() => (inspecting = true)}
	/>
</div>
<Button icon="filter" onclick={openRestricted}>
	{t('modes.restricted')} · {t('modes.restrictedCount', { count: restrictedCount })}
</Button>

<ModeInspectDialog bind:open={inspecting} {mode} />
<RestrictedDialog
	bind:open={restricting}
	{mode}
	characters={pool}
	{restrictions}
	onChange={(next) => (restrictions = next)}
/>

<style>
	.mode {
		display: flex;
		align-items: end;
		gap: var(--space-2);
	}
	.select {
		flex: 1;
		min-width: 0;
	}
</style>
