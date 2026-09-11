import { describe, expect, it } from 'vitest';
import { parseOdsExtracts } from './definition.service.js';

// Fragments réels (raccourcis) de pages 1mot.net, pour figer le format attendu sans dépendre
// du réseau dans les tests.
const RIFLE_PAGE = `
<h1>...</h1><h4>2 courts extraits de l’<a class=ex href="//fr.wikipedia.org/wiki/L%27Officiel_du_jeu_Scrabble">ODS</a> <a class=hi id=h1 href="javascript:hp(1)"></a><span class=hp id=a1>(ODS est l’acronyme du dictionnaire officiel du scrabble.)</span></h4><ul><li><a href=//1Mot.net/rifle>RIFLE</a> n.m. Carabine à canon rayé.</li><li><a href=//1Mot.net/rifler>RIFLER</a> v. [cj. aimer]. Raboter, limer.</li></ul><ul><li class=no>Pluriel : <a href=rifles>RIFLES</a></li></ul>
`;

const XYLOPHONE_PAGE = `
<h4>2 courts extraits de l’<a class=ex href="...">ODS</a></h4><ul><li><a href=//1Mot.net/xylophone>XYLOPHONE</a> n.m. Mus. Instrument à percussion.</li></ul><ul><li class=no>Pluriel : <a href=xylophones>XYLOPHONES</a></li></ul>
`;

const NOT_FOUND_PAGE = `
<h1>Désolé, impossible de trouver la page demandée.</h1><p>S.V.P., utilisez la <a href=//ortograf.ws/cherchedebutalpha.htm>page web de recherche</a>.</p>
`;

describe('parseOdsExtracts', () => {
  it('extrait plusieurs entrées ODS (mot ambigu avec une forme conjuguée)', () => {
    expect(parseOdsExtracts(RIFLE_PAGE)).toEqual([
      'RIFLE n.m. Carabine à canon rayé.',
      'RIFLER v. [cj. aimer]. Raboter, limer.',
    ]);
  });

  it('extrait une seule entrée ODS', () => {
    expect(parseOdsExtracts(XYLOPHONE_PAGE)).toEqual(['XYLOPHONE n.m. Mus. Instrument à percussion.']);
  });

  it("ne prend pas la seconde liste (formes fléchies : Pluriel, Féminin…)", () => {
    const extracts = parseOdsExtracts(RIFLE_PAGE);
    expect(extracts.join(' ')).not.toContain('Pluriel');
  });

  it('renvoie un tableau vide si la page ne contient pas de section ODS (mot absent)', () => {
    expect(parseOdsExtracts(NOT_FOUND_PAGE)).toEqual([]);
  });

  it('renvoie un tableau vide sur une page vide ou inattendue', () => {
    expect(parseOdsExtracts('')).toEqual([]);
    expect(parseOdsExtracts('<html><body>rien à voir</body></html>')).toEqual([]);
  });
});
