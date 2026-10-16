import { registerSettingsSection } from '../registry.ts';
import AssistanceSection from './AssistanceSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import FontsSection from './FontsSection.svelte';
import IconsSection from './IconsSection.svelte';
import ResetSection from './ResetSection.svelte';
import RulesTermsSection from './RulesTermsSection.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';

// Built-in sections. Other features register theirs the same way from their own modules.
registerSettingsSection({
	id: 'appearance',
	label: 'Appearance',
	icon: 'appearance',
	component: AppearanceSection,
	audience: 'everyone',
	order: 10
});
registerSettingsSection({
	id: 'fonts',
	label: 'Fonts',
	icon: 'fonts',
	component: FontsSection,
	audience: 'everyone',
	order: 20
});
registerSettingsSection({
	id: 'icons',
	label: 'Icons',
	icon: 'icons',
	component: IconsSection,
	audience: 'everyone',
	order: 30
});
registerSettingsSection({
	id: 'rules-terms',
	label: 'Rules terms',
	icon: 'info',
	component: RulesTermsSection,
	audience: 'everyone',
	order: 35
});
registerSettingsSection({
	id: 'assistance',
	label: 'Storyteller settings',
	icon: 'assistance',
	component: AssistanceSection,
	audience: 'storyteller',
	order: 40
});
registerSettingsSection({
	id: 'reset',
	label: 'Reset settings',
	icon: 'undo',
	component: ResetSection,
	audience: 'everyone',
	order: 90
});
