# Notes de déploiement — Medieverse

Spécificités projet lues par la skill `/deploy` (plugin `claude-utils`). La méthode, l'ordre des
étapes et les garde-fous vivent dans la skill.

## Enjeu

Jeu en ligne entre joueurs à distance : deux pairs d'une partie en ligne doivent tourner sur le
**même commit** (TECH_SPEC §8.3, `VITE_BUILD`). Une mise en ligne coupe donc les parties en cours
entre une ancienne et une nouvelle version. Les règles RTDB sont partagées avec les autres jeux du
projet `videogames-06` (données de Medieverse sous `/medieverse/`) : une règle trop large ou trop
stricte touche aussi les autres jeux.

## Cible et régime

- **URL de production** : https://medieverse-06.web.app
- **Projet / compte** : Firebase `videogames-06`, cible d'hébergement `medieverse` → site
  `medieverse-06` (`.firebaserc`)
- **Régime d'autorisation** : `confirmation-par-commande`
- **Déploiement par CI ?** : non
- **Shell** : bash (Git Bash) ou PowerShell, indifférent

## Version

- **Fichier** : aucun. La version est le **commit** : `vite.config.ts` injecte
  `git rev-parse --short HEAD` (suffixe `+` si l'arbre est sale) et sa date, affichés en bas de la
  page de titre.
- **Bumpé par** : personne — un commit poussé et un arbre propre tiennent lieu de bump.
- **Contrôle « la version est dans le bundle »** :
  `h=$(git rev-parse --short HEAD); echo "$h"; grep -l "\"$h\"" dist/assets/*.js` — doit afficher
  le hash puis au moins un fichier. Un hash suivi de `+` dans le bundle signale un arbre sale : ne
  pas déployer.

## Vérifications avant déploiement

| Commande | Ce qu'elle couvre | Obligatoire avant livraison |
|---|---|---|
| `pnpm run check` | lint, typecheck, Vitest, rejeu des replays, sondes de déterminisme dans les navigateurs | oui |
| `pnpm run build` | build statique `dist/` | oui |

## Ne jamais committer

`dist/` · `node_modules/` · `.firebase/` · `.claude/settings.local.json` · `.playwright-mcp/`

## Secrets du poste

Aucun fichier : la CLI `firebase` est connectée au compte de l'utilisateur (`firebase login`). La
config web Firebase dans `src/` est publique par nature.

## Cibles

| Cible | Commande | Quand |
|---|---|---|
| hébergement | `firebase deploy --only hosting:medieverse` | toute modification du jeu — le cas courant |
| règles RTDB | `firebase deploy --only database` | si `database.rules.json` a changé |

**Piège** : les règles RTDB sont celles de tout le projet `videogames-06` ; ne les déployer que
depuis un fichier qui garde les chemins des autres jeux.

## Sonde en ligne

Lire le hash servi : `curl -s https://medieverse-06.web.app/ | grep -o 'assets/index-[^"]*\.js'`,
puis chercher `git rev-parse --short HEAD` dans ce fichier publié. Le hash doit y être, sans `+`.
Visuellement : la ligne de version en bas à gauche de la page de titre.

## Rollback

`firebase hosting:clone medieverse-06:live@<version précédente> medieverse-06:live`, ou
`git checkout <commit>` + build + redéploiement de l'hébergement. Lister les versions dans la
console Firebase (Hosting → historique des versions).
