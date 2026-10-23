/** Grim-Games' own lint rules, as an ESLint plugin (`grim/...`). */
import { clearableField } from './clearable-field.js';
import { closeButton } from './close-button.js';
import { confirmDialog } from './confirm-dialog.js';
import { deleteButton } from './delete-button.js';
import { dropdownChoice } from './dropdown-choice.js';
import { iconMeaning } from './icon-meaning.js';
import { modalActions } from './modal-actions.js';
import { namesAsBadges } from './names-as-badges.js';
import { sharePanel } from './share-panel.js';
import { textField } from './text-field.js';

export default {
	rules: {
		'names-as-badges': namesAsBadges,
		'confirm-dialog': confirmDialog,
		'clearable-field': clearableField,
		'delete-button': deleteButton,
		'close-button': closeButton,
		'modal-actions': modalActions,
		'dropdown-choice': dropdownChoice,
		'text-field': textField,
		'icon-meaning': iconMeaning,
		'share-panel': sharePanel
	}
};
