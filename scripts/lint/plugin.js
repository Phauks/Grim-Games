/** Grim-Games' own lint rules, as an ESLint plugin (`grim/...`). */
import { clearableField } from './clearable-field.js';
import { confirmDialog } from './confirm-dialog.js';
import { namesAsBadges } from './names-as-badges.js';

export default {
	rules: {
		'names-as-badges': namesAsBadges,
		'confirm-dialog': confirmDialog,
		'clearable-field': clearableField
	}
};
