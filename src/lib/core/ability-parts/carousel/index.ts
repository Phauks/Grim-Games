/** SPIKE: Carousel as ability parts, one file per character. */
import acrobat from './acrobat.json' with { type: 'json' };
import alchemist from './alchemist.json' with { type: 'json' };
import alsaahir from './alsaahir.json' with { type: 'json' };
import amnesiac from './amnesiac.json' with { type: 'json' };
import atheist from './atheist.json' with { type: 'json' };
import balloonist from './balloonist.json' with { type: 'json' };
import banshee from './banshee.json' with { type: 'json' };
import bountyhunter from './bountyhunter.json' with { type: 'json' };
import cannibal from './cannibal.json' with { type: 'json' };
import choirboy from './choirboy.json' with { type: 'json' };
import cultleader from './cultleader.json' with { type: 'json' };
import engineer from './engineer.json' with { type: 'json' };
import farmer from './farmer.json' with { type: 'json' };
import fisherman from './fisherman.json' with { type: 'json' };
import general from './general.json' with { type: 'json' };
import highpriestess from './highpriestess.json' with { type: 'json' };
import huntsman from './huntsman.json' with { type: 'json' };
import king from './king.json' with { type: 'json' };
import knight from './knight.json' with { type: 'json' };
import lycanthrope from './lycanthrope.json' with { type: 'json' };
import magician from './magician.json' with { type: 'json' };
import nightwatchman from './nightwatchman.json' with { type: 'json' };
import noble from './noble.json' with { type: 'json' };
import pixie from './pixie.json' with { type: 'json' };
import poppygrower from './poppygrower.json' with { type: 'json' };
import preacher from './preacher.json' with { type: 'json' };
import princess from './princess.json' with { type: 'json' };
import shugenja from './shugenja.json' with { type: 'json' };
import steward from './steward.json' with { type: 'json' };
import villageidiot from './villageidiot.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['acrobat', acrobat],
	['alchemist', alchemist],
	['alsaahir', alsaahir],
	['amnesiac', amnesiac],
	['atheist', atheist],
	['balloonist', balloonist],
	['banshee', banshee],
	['bountyhunter', bountyhunter],
	['cannibal', cannibal],
	['choirboy', choirboy],
	['cultleader', cultleader],
	['engineer', engineer],
	['farmer', farmer],
	['fisherman', fisherman],
	['general', general],
	['highpriestess', highpriestess],
	['huntsman', huntsman],
	['king', king],
	['knight', knight],
	['lycanthrope', lycanthrope],
	['magician', magician],
	['nightwatchman', nightwatchman],
	['noble', noble],
	['pixie', pixie],
	['poppygrower', poppygrower],
	['preacher', preacher],
	['princess', princess],
	['shugenja', shugenja],
	['steward', steward],
	['villageidiot', villageidiot]
]);
