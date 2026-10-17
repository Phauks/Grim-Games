import { registerSettingsSection } from '../registry.ts';
import AboutSection from './AboutSection.svelte';
import AssistanceSection from './AssistanceSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import FontsSection from './FontsSection.svelte';
import IconsSection from './IconsSection.svelte';
import DataSection from './DataSection.svelte';
import DiagnosticsSection from './DiagnosticsSection.svelte';
import RefreshDiagnostics from '#lib/features/errors/RefreshDiagnostics.svelte';
import RulesTermsSection from './RulesTermsSection.svelte';
import TokensSection from './TokensSection.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';

// Built-in sections. Other features register theirs the same way from their own modules.
registerSettingsSection({
	id: 'appearance',
	label: { key: 'settings.appearance' },
	icon: 'appearance',
	component: AppearanceSection,
	audience: 'everyone',
	order: 10
});
registerSettingsSection({
	id: 'fonts',
	label: { key: 'settings.fonts' },
	icon: 'fonts',
	component: FontsSection,
	audience: 'everyone',
	order: 20
});
registerSettingsSection({
	id: 'tokens',
	label: { key: 'settings.tokens' },
	icon: 'reminder',
	component: TokensSection,
	audience: 'everyone',
	order: 25
});
registerSettingsSection({
	id: 'icons',
	label: { key: 'settings.icons' },
	icon: 'icons',
	component: IconsSection,
	audience: 'everyone',
	order: 30
});
registerSettingsSection({
	id: 'rules-terms',
	label: { key: 'settings.rulesTerms' },
	icon: 'info',
	component: RulesTermsSection,
	audience: 'everyone',
	order: 35
});
registerSettingsSection({
	id: 'assistance',
	label: { key: 'settings.storyteller' },
	icon: 'assistance',
	component: AssistanceSection,
	audience: 'storyteller',
	order: 40
});
registerSettingsSection({
	id: 'data',
	label: { key: 'settings.data' },
	icon: 'data',
	component: DataSection,
	audience: 'everyone',
	order: 90
});
registerSettingsSection({
	id: 'about',
	label: { key: 'shell.about' },
	icon: 'about',
	component: AboutSection,
	audience: 'everyone',
	order: 95
});
registerSettingsSection({
	id: 'diagnostics',
	label: { key: 'shell.navDiagnostics' },
	icon: 'diagnostics',
	component: DiagnosticsSection,
	headingAction: RefreshDiagnostics,
	audience: 'everyone',
	order: 96
});
