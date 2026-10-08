# Commons Collection

Find Wikimedia Commons files linked to a digital library, inspect the location of the links and explore file reuse. The interface is available in English and French, with a language selector. Source titles and excerpts remain in their original language.

For Toolforge installation and updates, see the [deployment guide](docs/TOOLFORGE.md).

Repérer les fichiers Commons liés à une bibliothèque numérique, comprendre où le lien est présent et consulter leurs usages dans les wikis.

L’interface est disponible en français et en anglais. La langue du navigateur est utilisée au premier accès, puis le choix est mémorisé. Le changement de langue recharge la page et conserve le relevé sauvegardé. Pendant une collecte, mettre en pause avant de changer de langue.

## Essayer sur son ordinateur

Installer une version récente de Node.js (22 ou 24), télécharger ce dépôt et ouvrir un terminal dans son dossier :

```sh
npm ci
npm run dev
```

Ouvrir l’adresse locale indiquée dans le terminal. Aucun compte ni clé API nécessaire. Les requêtes partent du navigateur vers les API publiques Wikimédia.

Ajouter `?demo=1` pour afficher un exemple **fictif**, sans requête aux API.

## Comprendre le résultat

Lire [la méthode, l’audit et les limites](docs/AUDIT.md). Les emplacements des liens sont montrés pour permettre une vérification. Le relevé n’est pas exhaustif.

## Vérifier le code

```sh
npm test
npm run build
```

Le site compilé se trouve dans `dist/`. Le dossier `src/` contient le code du navigateur, `tests/` les cas de régression. `linkedom` est utilisé uniquement pour les tests HTML, sous sa licence ISC. Aucune bibliothèque n’est chargée dans le navigateur.

## Licences

Code sous [MIT](LICENSE). Textes, guides et créations visuelles originaux sous [CC BY-SA 4.0](LICENSE-DOCS.md). Attribution : **p5ykomat**. Les données externes conservent leurs licences et attributions.

## Reprendre une collecte

Les appels sont séquentiels, avec une pause d’au moins une seconde après chaque réponse et des pages de 100 liens au maximum pour le repérage. Si le service limite les requêtes, l’outil attend et réessaie, jusqu’à six tentatives par appel. Les résultats arrivent progressivement.

**Mettre en pause** conserve l’avancement. **Reprendre le relevé** poursuit la collecte sans recommencer les pages déjà reçues. Le dernier relevé est sauvegardé dans ce navigateur et peut être restauré pendant 24 heures, même après un rechargement. Une nouvelle recherche repart de zéro pour actualiser les données. Si le stockage du navigateur est plein ou interdit, la reprise reste disponible tant que la page demeure ouverte.

Une panne durable de l’API peut laisser un relevé partiel : les données reçues restent consultables et exportables, avec cette limite indiquée. Aucun résultat manquant n’est remplacé par un chiffre inventé.

## Grandes collections

Le choix **Tous les fichiers**, sélectionné par défaut, parcourt toutes les pages de résultats fournies par l’API, sans plafond de 500 fichiers. Les limites de 50, 100, 500, 1 000 et 3 000 restent disponibles. Le total apparaît dès la fin du repérage ; la lecture détaillée des notices continue ensuite et peut durer plusieurs dizaines de minutes pour une grande collection. Ce total porte sur les fichiers contenant un lien indexé, pas sur une provenance certifiée. L’écran affiche 100 fichiers à la fois avec un bouton pour en afficher davantage ; l’export contient tous les fichiers collectés.

## Démo

Une démonstration est disponible pour [tester le projet en ligne](https://compteur-commons.vercel.app/), sans installation.

Une mise à disposition sur Toolforge est prévue. Le lien sera ajouté ici lorsqu’elle sera disponible.
