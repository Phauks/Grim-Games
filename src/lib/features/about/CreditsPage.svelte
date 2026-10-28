<script lang="ts">
	import SoundCredits from '#lib/features/sound/SoundCredits.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import OfficialNotice from './OfficialNotice.svelte';
</script>

<!-- Beneath About in the menu's App group, out of About (Trevor, 2026-10-28): the notice that
     the app is not official, with TPI's data and icons, then the recordings' sources (plan U3). -->
<Page title={t('shell.credits')}>
	<OfficialNotice />
	<PageSection title={t('shell.soundCredits')}>
		<SoundCredits />
	</PageSection>
</Page>
