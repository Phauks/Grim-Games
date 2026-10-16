/** Grim-Games' own lint rules, as an ESLint plugin (`grim/...`). */
import { confirmDialog } from './confirm-dialog.js';
import { namesAsBadges } from './names-as-badges.js';

export default {
	rules: { 'names-as-badges': namesAsBadges, 'confirm-dialog': confirmDialog }
};
