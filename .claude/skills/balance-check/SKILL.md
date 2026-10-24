---
name: balance-check
description: "Analyse l'équilibrage de l'arsenal et des classes : écarts entre src/content et le GDD, armes dominantes, combos dégénérés, et statistiques des soaks IA contre IA (part des kills par arme, durée des parties). Usage : « /balance-check weapons », « /balance-check classes », « /balance-check soak <rapport> »."
argument-hint: "weapons | classes | soak [chemin rapport] | all"
allowed-tools: Read, Glob, Grep, Write, Bash(npm run maps:soak*), Bash(npm run sim:headless*)
---

# Balance check

## Règle

Chaque valeur est jugée **par rapport à une cible écrite** dans le GDD (tableaux §3.2 et §4) ou à un critère du BACKLOG (M8.5 : aucune arme ne dépasse 30 % des kills IA). Une valeur sans cible écrite est listée « pas de cible — non jugée », jamais déclarée correcte. Sans données de soak, la section soak vaut NOT ASSESSED.

## Phase 1 — Charger

| Entrée | Chemin | Statut |
|---|---|---|
| Armes (valeurs du code) | `src/content/weapons.ts` | FOUND/ABSENT |
| Classes | `src/content/classes.ts` | FOUND/ABSENT |
| Schémas de règles | `src/content/schemes.ts` (ou l'équivalent) | FOUND/ABSENT |
| Cibles design | `docs/GDD.md` §3.2, §4, §6 | FOUND/ABSENT |
| Soak | `docs/reports/soak/*.json` (le plus récent, ou celui donné en argument) | FOUND/ABSENT |

## Phase 2 — Conformité code / GDD

Tableau de toutes les valeurs (dégâts, rayon, vent, munitions, mèche, passifs) : valeur dans le GDD, valeur dans le code, écart. Chaque écart est un constat. Il n'est ni bon ni mauvais en soi : soit le GDD, soit le code doit être mis à jour.

## Phase 3 — Analyse statique

- **Dégâts par munition et par tour** pour chaque arme, en conditions idéales (impact direct) et typiques (d = R/2).
- **Dominance** : une arme qui égale ou dépasse une autre sur tous les axes (dégâts, rayon, munitions, insensibilité au vent, facilité de visée) rend cette autre inutile. C'est un constat CRITICAL.
- **Passifs** : impact sur le temps nécessaire pour tuer. Par exemple, Chevalier −25 % contre les armes à explosion ; Roi +10 % de dégâts dans un rayon de 200 px ; Clerc +10 PV par tour, ce qui pose un risque d'équipe impossible à tuer si plusieurs Clercs se soignent entre eux.
- **Combos** : Roi + Frondeur + pot ; Clerc ×2 en boucle de soin ; chausse-trapes + Sapeur.
- **Déluge** : une partie peut-elle durer plus de 40 tours (GDD §10) avec ces valeurs ?

## Phase 4 — Soak (si les données existent)

Indicateurs :
- part des kills par arme (seuil de 30 %) ;
- taux de victoire par classe et par composition ;
- durée moyenne des parties en tours ;
- part des morts par noyade, par chute et par flammes ;
- taux de victoire de l'IA Connétable contre l'IA Écuyer (au moins 85 %, BACKLOG 5.5).

Signale tout indicateur calculé sur moins de 50 parties comme peu fiable.

## Phase 5 — Rapport

```
## Balance — <domaine> — <date> — verdict: CRITICAL | CONCERNS | NOT ASSESSED | HEALTHY
### Écarts code/GDD
### Constats (CRITICAL / CONCERN) | constat | preuve (calcul ou chiffre de soak) | proposition |
### Non jugé (pas de cible)
### Propositions d'ajustement | paramètre | actuel | proposé | justification | effet attendu |
```

Le verdict retient la première condition remplie, dans cet ordre :
1. **CRITICAL** : une dominance, un combo dégénéré ou une arme au-dessus de 30 % des kills.
2. **CONCERNS** : des écarts ou des outliers réglables.
3. **NOT ASSESSED** : une section n'a pas de données.
4. **HEALTHY** : sinon.

## Après le rapport

Ne modifie aucune valeur sans accord. Si une valeur change, mets à jour **le code et le GDD dans le même commit**, puis relance `determinism-check`, car les hashes des replays de référence changeront. Demande alors confirmation avant de les régénérer.
