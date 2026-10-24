---
name: playtest-report
description: "Prépare une session de playtest de Medievers (protocole et grille d'observation selon le mode : hotseat, vs IA, tablette, LAN) ou transforme des notes brutes de playtest en rapport structuré avec bugs, ressentis et actions routées vers le BACKLOG. Usage : « /playtest-report prepare hotseat » ou « /playtest-report <notes collées> »."
argument-hint: "prepare <hotseat|ia|tablette|lan> | analyse <notes ou chemin>"
allowed-tools: Read, Glob, Grep, Write
---

# Playtest report

## Mode `prepare`

Produis `docs/playtests/<date>-<mode>-protocole.md` :
- **Build testé** : commit, date et appareil(s).
- **Configuration** : carte, schéma, équipes et classes, niveau de l'IA, mode de visée (drag ou jauge).
- **Objectifs de la session** : 3 au maximum, à choisir avec l'utilisateur. Exemples : compréhension sans explication (pilier 3 du GDD), lisibilité du vent, prise en main tactile.
- **Grille d'observation, minutée** :
  - premières minutes : le joueur comprend-il qui joue, comment viser, ce que fait le vent ;
  - à chaque tour : hésitations, erreurs de commande, consultations de l'arsenal ;
  - moments burlesques : rires, surprises (pilier 2, « chaos lisible ») ;
  - frustrations : morts jugées injustes, timer trop court, caméra perdue.
- **Spécifique au mode** :
  - *hotseat* : clarté de l'écran « passez la main » ;
  - *IA* : l'action de l'IA est-elle lisible ? Le niveau ressenti correspond-il au niveau réglé ?
  - *tablette* : cibles tactiles, pouce qui masque la visée, gestes système parasites ;
  - *LAN* : temps d'appairage, latence perçue, désyncs.
- **Questions de fin** : 5 au maximum, ouvertes.

## Mode `analyse`

À partir des notes, écris `docs/playtests/<date>-<mode>-rapport.md` :

```
# Playtest — <date> — <mode>
## Contexte (build, joueurs : nombre et profil, durée)
## Ce qui marche
## Frictions          | observation | fréquence (1 joueur / plusieurs / tous) | gravité |
## Confusions
## Moments forts
## Bugs               | description | étapes de repro | seed/replay si disponible |
## Écart aux piliers du GDD §1
## Top 3 actions
```

Règles :
- **Distingue l'observé du déclaré.** « Le joueur a raté 4 tirs de suite au vent fort » est une observation. « Le vent est trop fort » est une opinion de joueur. Ne transforme jamais une opinion en fait.
- Ne retiens que ce qui figure dans les notes. Ne complète pas les trous par des suppositions.
- **Routage** : chaque action se rattache à une tâche existante du BACKLOG (par son numéro), à une nouvelle tâche proposée, au skill `balance-check` (équilibrage) ou à `asset-audit` / `asset-spec` (lisibilité visuelle).
- Propose les nouvelles tâches du BACKLOG. Ne les ajoute qu'après accord.
