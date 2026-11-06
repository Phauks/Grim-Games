<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import GroupGames from '#lib/features/friends/GroupGames.svelte';
	import LastGameRow from '#lib/features/game/LastGameRow.svelte';
	import JoinPanel from '#lib/features/room/JoinPanel.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { NAV_SECTIONS } from './nav.ts';

	/**
	 * Home (plan M69, Trevor 2026-11-06: option A, "want ppl to be able to type in code from
	 * home", "reuse what we have"): New game, then Join game's own code form and games to
	 * resume (JoinPanel, so a code typed here works as it does there), then a button for each
	 * place in the menu's Prepare and Create groups. The app's name is the
	 * title, so on a phone the hamburger has its row and covers nothing.
	 */
	const places = NAV_SECTIONS.filter((s) => s.id === 'prepare' || s.id === 'build').flatMap(
		(s) => s.items
	);
	// A menu label never takes values, as in NavList.
	const label = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);
	const openRoom = (code: string) => void goto(resolve('/join/[code]', { code }));
</script>

<Page title={APP_NAME}>
	<div class="home">
		<!-- Above the room code, in its column; the games to resume stay on the right (Trevor,
		     2026-11-06). The last game is the same row as the menu's top. -->
		<JoinPanel>
			{#snippet lead()}
				<LastGameRow />
				<Button icon="add" variant="accent" href={resolve('/new')}>{t('shell.navNewGame')}</Button>
			{/snippet}
		</JoinPanel>
		<GroupGames onJoin={openRoom} />
		<PageSection title={`${t('shell.navSectionPrepare')} · ${t('shell.navSectionCreate')}`}>
			<ul class="places" data-testid="home-places">
				{#each places as item (item.id)}
					<li>
						<Button icon={item.icon} href={resolve(item.path)}>{label(item.label)}</Button>
					</li>
				{/each}
			</ul>
		</PageSection>
	</div>
</Page>

<style>
	.home {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
	}
	.places {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(11 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.places :global(.button) {
		width: 100%;
	}
</style>
