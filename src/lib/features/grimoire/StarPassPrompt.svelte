<script lang="ts">
	import { starPass } from '#lib/core/rules/index.ts';
	import NewDemonDialog from './NewDemonDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The Imp killed itself with a Minion alive (Trevor, 2026-10-19): ask which Minion becomes
	 * the Imp (https://wiki.bloodontheclocktower.com/Imp), the Scarlet Woman chosen first when
	 * her ability makes it hers. The same for any Demon whose death by its own kill passes it on,
	 * as the Fang Gu's does to an Outsider, who turns evil
	 * (https://wiki.bloodontheclocktower.com/Fang_Gu). A suggestion: Cancel leaves everyone as
	 * they are, and asks again only if the players who may take it on change or the Demon dies
	 * again after coming back. Rules: `starPass`
	 * in core.
	 */
	interface Props {
		grimoire: Grimoire;
		/** False once the game has ended. */
		active: boolean;
	}

	let { grimoire, active }: Props = $props();

	const pass = $derived(active ? starPass(grimoire.game, grimoire.open.characters) : undefined);

	let open = $state(false);
	let asked = $state<string>();
	// What the dialog shows, kept while it closes after the pass is made.
	let shown = $state.raw<NonNullable<typeof pass>>();
	$effect(() => {
		// Once nothing passes on (the Demon alive again), a later death asks afresh, even after
		// a Cancel (Trevor, 2026-10-31).
		if (!pass) {
			asked = undefined;
			return;
		}
		if (open) return;
		const key = `${pass.characterId}:${pass.heirs.join(',')}`;
		if (asked === key) return;
		asked = key;
		shown = pass;
		open = true;
	});
</script>

{#if shown}
	<NewDemonDialog
		{grimoire}
		bind:open
		characterId={shown.characterId}
		heirs={shown.heirs}
		preferred={shown.preferred}
	/>
{/if}
