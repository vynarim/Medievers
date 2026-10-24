---
paths:
  - ".claude/skills/**"
---

# Règles — écriture de skills

Principe repris de Claude Code Game Studios (MIT) : **un contrôle qui ne peut pas dire qu'il n'a pas tourné n'est pas un contrôle.**

- Tout skill qui rend un verdict a une valeur `NOT ASSESSED`, avec sa raison. Elle se classe **au-dessus** de PASS, parce que rien n'a été établi, et **en dessous** de FAIL, parce qu'un problème connu est plus actionnable qu'une inconnue.
- Une entrée absente ne prend jamais la valeur permissive par défaut.
- Les chiffres viennent d'un outil exécuté, jamais d'une estimation. Ce que l'outil ne mesure pas est NOT ASSESSED.
- Un skill de contrôle ne corrige pas pour obtenir un PASS. Il rapporte, puis nomme la tâche ou le skill qui corrige.
- `allowed-tools` contient le minimum nécessaire. Les commandes Bash sont listées par préfixe.
