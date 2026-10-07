# Audit du compteur Commons

## Constats sur l’ancien compteur

1. Le filtre lisait seulement les paramètres `source` et `institution` du wikicode. Une section « Source » hors modèle ou une URL produite par un modèle pouvait être manquée.
2. L’extraction par expression régulière dépendait de la disposition des paramètres et gérait mal les modèles imbriqués. Elle n’offrait pas une lecture générale de la provenance.
3. Les fichiers écartés n’étaient pas affichés, ce qui empêchait de distinguer absence de provenance et lecture incomplète.
4. La limite portait sur les candidats avant filtrage, mais le message pouvait donner l’impression qu’elle portait sur les seuls résultats retenus.
5. Le site de l’association avait fait l’objet d’une exception historique. Aucune liste noire de domaine n’est reprise.

## Nouvelle méthode

`exturlusage` repère les pages de fichiers contenant un lien indexé. Chaque page est ensuite lue via `action=parse` : les modèles sont développés par MediaWiki. Le HTML est analysé dans un document séparé, jamais injecté dans la page de l’outil.

Les liens sont classés dans quatre groupes :

- **Source** : cellule identifiée comme source, ou section nommée Source, Sources ou Provenance.
- **Institution** : cellule identifiée comme institution, collection ou repository. Ce groupe n’est pas ajouté au nombre de sources.
- **Ailleurs** : description ou autre emplacement. Une mention ne prouve pas la provenance.
- **À vérifier** : lien indexé non retrouvé dans le HTML lu, ou échec de lecture.

Chaque résultat propose l’URL repérée, son contexte, un extrait et la version de la page. Une section nommée Source est un indice documentaire, pas une certification de provenance.

## Exemple vérifié

Le 7 octobre 2026, recherche de l’URL `https://gallica.bnf.fr/anthologie/notices/01206.htm`, limitée à trois fichiers : les fichiers `Construction tour eiffel.JPG`, `Construction tour eiffel2.JPG` et `Construction tour eiffel3.JPG` ont tous été classés en source. Le premier utilise une section Source hors modèle. Le relevé était explicitement signalé comme limité.

## Limites conservées

- Ce n’est pas un inventaire exhaustif d’une institution. Un fichier sans lien indexé vers le domaine n’est pas découvert.
- Une provenance saisie seulement en données structurées, un identifiant sans URL ou un lien vers une archive peut manquer.
- Les intitulés de section en langues non reconnues et les structures atypiques restent dans les autres cas. Aucun résultat n’est automatiquement déclaré sans lien avec l’institution.
- Les liens générés par un modèle peuvent être génériques : leur présence dans Source n’est pas une preuve suffisante de provenance.
- Les usages sont des couples wiki et page, tous espaces de noms confondus. Ce ne sont ni des vues, ni des téléchargements, ni un nombre d’insertions dans la même page.

## Ce qui a été contrôlé

- La recherche par domaine et par URL exacte, sans confondre un domaine ressemblant.
- Les pages successives de l’API, y compris une page intermédiaire vide avec continuation.
- Le dédoublonnage, les erreurs, la limite de collecte et l’arrêt demandé.
- Les exports CSV : protection contre l’interprétation des cellules comme formules.
- Les maquettes V1 et V2 sur ordinateur et écran étroit, les dialogues au clavier et les contrastes avec axe.

Ces contrôles ne démontrent pas l’absence de toute erreur. Les index et les pages évoluent pendant un relevé. Les alias, anciennes URL, liens raccourcis et notices sans lien explicite ne sont pas rapprochés automatiquement.

## Documentation officielle

- [API des liens externes](https://www.mediawiki.org/wiki/API:Exturlusage)
- [API de rendu des pages](https://www.mediawiki.org/wiki/API:Parsing_wikitext)
- [Réutilisation globale des fichiers](https://www.mediawiki.org/wiki/Extension:GlobalUsage)
