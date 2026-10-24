<script lang="ts">
	import { offerScriptToReports } from '#lib/features/reports/report-script.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		editionScript,
		loadScriptText,
		OFFICIAL_EDITIONS,
		type ScriptLoadResult,
		type GameData
	} from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import {
		chooseScript,
		currentScript,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import ScriptCheckDialog from '#lib/features/scripts/ScriptCheckDialog.svelte';
	import type { FetchedScript } from '#lib/features/scripts/fetch-script.ts';
	import type { ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
	import { fetchSharedRef, scriptShareable } from '#lib/features/scripts/share-codes.ts';
	import { sharedRefFromHash } from '#lib/features/scripts/share.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { scriptKey } from './notebook.ts';
	import PlayerNotes from './PlayerNotes.svelte';
	import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import { roomScript } from '#lib/features/room/room-script.svelte.ts';
	import PlayerScriptActions from './PlayerScriptActions.svelte';
	import { scriptVersion } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import PlayerScriptTabs from './PlayerScriptTabs.svelte';
	import PlayerRoom from './PlayerRoom.svelte';
	import { lastRoom, roomTable } from '#lib/features/room/player.svelte.ts';
	import PlayerGrim from './PlayerGrim.svelte';
	import LeaveGuard from '#lib/features/setup/LeaveGuard.svelte';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';

	// A reading page for players, not a grimoire (Trevor, 2026-10-16): no seats or controls.

	interface Props {
		/**
		 * Opened from Join game or a room's link (Trevor, 2026-10-19: joining should land in the
		 * player view, not a page of its own): the Room tab opens on that room, or the code form.
		 */
		join?: { code?: string };
	}

	let { join }: Props = $props();
	/** On Join game, a typed code opens that room's own link. */
	const openRoom = (code: string) => void goto(resolve('/join/[code]', { code }));

	let data = $state<GameData>();
	let error = $state<string>();
	// Joining lands on the script (Trevor, 2026-10-23); the room is the row above the tabs.
	let tab = $state('script');

	onMount(async () => {
		try {
			const [game] = await Promise.all([
				loadOfficialData(),
				// The script chosen on /scripts; reports its own storage errors.
				restoreScripts()
			]);
			data = game;
			// Restored first, so the shared script ends up current rather than the last one used.
			await openSharedLink();
		} catch (e) {
			// Shown inline below, so only logged.
			reportError(e, { area: 'play', notify: false });
			error = errorMessage(e);
		}
	});

	// A shared link (/play#c=…, #e=, #bs= or #s=) loads its script through the same checks as
	// the Scripts page: the Script check opens when something was skipped or changed
	// (08-script-loading.md §5.3, §5.5).
	let checking = $state<ScriptLoadResult>();
	let checkingSource: ScriptSource = { kind: 'share' };
	let checkOpen = $state(false);
	/** Runs the Script check on fetched script text, or uses it straight away when clean. */
	async function useFetched(fetched: FetchedScript) {
		const result = loadScriptText(fetched.text, await loadOfficialData());
		if (!result.script || result.problems.some((p) => p.severity !== 'info')) {
			checking = result;
			checkingSource = fetched.source;
			checkOpen = true;
		} else await chooseScript(result.script, fetched.source);
	}

	async function openSharedLink() {
		const ref = sharedRefFromHash(location.hash);
		if (!ref) return;
		history.replaceState(history.state, '', location.pathname + location.search);
		try {
			await useFetched(await fetchSharedRef(ref));
		} catch (e) {
			reportError(e, { area: 'play', notify: false });
			toast(t('player.sharedLinkFailed'), errorMessage(e));
		}
	}

	// On a room's link, only the script that room sends (plan J1, Trevor 2026-10-22: "when
	// joining game, there should be no other information available"), never the device's own.
	const joining = $derived(join && normaliseRoomCode(join.code ?? ''));
	const script = $derived(
		!data ? undefined : join ? roomScript(joining || undefined) : currentScript.current
	);
	const logo = $derived(script && scriptLogo(script));
	let logoFailed = $state(false);
	$effect(() => {
		void logo;
		logoFailed = false;
	});
	// A report sent from here carries the script (Trevor, 2026-10-22).
	offerScriptToReports(() => script);
	/** No script yet: the Scripts page no longer lists the base three, so offer them here. */
	const choosing = $derived(!!data && !script);
	function chooseEdition(id: string) {
		const chosen = data && editionScript(id, data);
		if (chosen) void chooseScript(chosen, { kind: 'edition' });
	}

	/** What Share links to: the saved script, or the edition or script itself. */
	const shareable = $derived.by(() => {
		if (!script) return undefined;
		return scriptShareable(
			script,
			currentScript.current === script ? currentScript.saved : undefined
		);
	});
	/** The room that sent this script, when there is one: Share hands on its link and code. */
	const inRoom = $derived(
		script
			? [joining || undefined, lastRoom()].find((c) => c && roomScript(c) === script)
			: undefined
	);
	// One notebook per script: official editions by id, saved scripts by their library id.
	const key = $derived.by(() => {
		if (!script) return undefined;
		const saved = currentScript.current === script ? currentScript.saved : undefined;
		return !script.edition && saved && saved.scriptId !== 'unsaved'
			? `saved:${saved.scriptId}`
			: scriptKey(script);
	});

	const version = $derived(
		scriptVersion(currentScript.current === script ? currentScript.saved : undefined, script?.meta)
	);
</script>

<!-- A shared link opened while /play is already showing changes only the hash. -->
<svelte:window onhashchange={() => data && void openSharedLink()} />

<!-- Print and Share stay on the title's line at every width (Trevor, 2026-10-19). -->
<Page title={script?.name ?? (join ? t('room.joinTitle') : t('player.title'))} iconActions>
	<!-- The app's sidebar and hamburger, as on every app page (Trevor, 2026-10-24). -->
	<!-- The script's logo before its name, when it has one; nothing in its place otherwise
	     (Trevor, 2026-10-23). -->
	{#snippet lead()}
		{#if logo && !logoFailed}<ScriptLogo
				src={logo}
				class="title-logo"
				onfail={() => (logoFailed = true)}
			/>{/if}
	{/snippet}
	<!-- Players are already in a script: no Change script and no Code (Trevor, 2026-10-16).
	     Another script loads only from a share link or QR code. Before a game is joined or a
	     script loaded, there is nothing to print or share, so neither shows (Trevor, 2026-10-23). -->
	{#snippet actions()}
		{#if script}<PlayerScriptActions {script} {version} share={shareable} room={inRoom} />{/if}
	{/snippet}
	<!-- Author and version under the title, or a blank line so nothing moves (Trevor). -->
	{#snippet subtitle()}
		<ScriptByline
			author={script?.meta.author}
			{version}
			storyteller={roomTable.storyteller}
			inline
		/>&nbsp;
	{/snippet}

	{#if error}
		<p role="alert">{t('player.loadFailed', { error })}</p>
	{:else}
		<!-- One row for the room, over the tabs (plan J12, no Room tab): Join game's code form
		     until the phone is in a room; on /play, the room it last joined while it is in it.
		     Kept in place as the script arrives, so the room stays open. -->
		<PlayerRoom
			initialCode={join ? (join.code ?? null) : undefined}
			onCode={join ? openRoom : undefined}
		/>
	{/if}
	{#if error || (join && choosing)}
		<!-- No script yet: the room sends its own once the phone is in, and the tabs follow. -->
	{:else if choosing}
		<!-- Only when no script is loaded; no Change script once there is one (Trevor). -->
		<PageSection title={t('player.chooseScript')}>
			<ul class="choose">
				{#each OFFICIAL_EDITIONS as edition (edition.id)}
					<li>
						<Button onclick={() => chooseEdition(edition.id)}>{edition.name}</Button>
					</li>
				{/each}
				<li>
					<Button href={resolve('/scripts')} variant="quiet" icon="search"
						>{t('player.findScript')}</Button
					>
				</li>
			</ul>
		</PageSection>
	{:else if !script}
		<p class="muted">{t('player.loading')}</p>
	{:else}
		<!-- The same tabs the board's Script button shows, plus the player's own Notes. -->
		<PlayerScriptTabs {script} travellers={roomTable.travellers} bind:tab>
			{#snippet grim()}<PlayerGrim {script} />{/snippet}
			{#snippet notes()}<PlayerNotes notesKey={key} />{/snippet}
		</PlayerScriptTabs>
	{/if}
</Page>

<!-- Overlays go beside the Page, not inside it. -->
<!-- Leaving the script asks first (Trevor, 2026-10-19), but a room's link, a typed code and a
     reload stay here: everything is already saved on the device. -->
<LeaveGuard
	when={!!script}
	title={t('player.leaveTitle')}
	body={t('player.leaveBody')}
	within={(url) => url.pathname === resolve('/play') || url.pathname.startsWith(resolve('/join'))}
	unload={false}
/>
<ScriptCheckDialog
	bind:open={checkOpen}
	result={checking}
	onconfirm={() => {
		const loaded = checking?.script;
		if (loaded) void chooseScript(loaded, checkingSource);
	}}
/>

<style>
	/* Beside the name in the title, as tall as two lines of it at most. */
	:global(.title-logo) {
		flex: none;
		width: 1.8em;
		height: 1.8em;
	}
	.choose {
		display: grid;
		gap: var(--space-2);
		max-width: var(--measure);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.choose :global(a),
	.choose :global(button) {
		width: 100%;
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
