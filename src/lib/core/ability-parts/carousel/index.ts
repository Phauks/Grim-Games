/** SPIKE: Carousel as ability parts, one file per character. TEMPORARY: one batch's characters. */
import acrobat from './acrobat.json' with { type: 'json' };
import balloonist from './balloonist.json' with { type: 'json' };
import bountyhunter from './bountyhunter.json' with { type: 'json' };
import cultleader from './cultleader.json' with { type: 'json' };
import general from './general.json' with { type: 'json' };
import highpriestess from './highpriestess.json' with { type: 'json' };
import king from './king.json' with { type: 'json' };
import knight from './knight.json' with { type: 'json' };
import lycanthrope from './lycanthrope.json' with { type: 'json' };
import noble from './noble.json' with { type: 'json' };
import pixie from './pixie.json' with { type: 'json' };
import preacher from './preacher.json' with { type: 'json' };
import shugenja from './shugenja.json' with { type: 'json' };
import steward from './steward.json' with { type: 'json' };
import villageidiot from './villageidiot.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['acrobat', acrobat],
	['balloonist', balloonist],
	['bountyhunter', bountyhunter],
	['cultleader', cultleader],
	['general', general],
	['highpriestess', highpriestess],
	['king', king],
	['knight', knight],
	['lycanthrope', lycanthrope],
	['noble', noble],
	['pixie', pixie],
	['preacher', preacher],
	['shugenja', shugenja],
	['steward', steward],
	['villageidiot', villageidiot]
]);
