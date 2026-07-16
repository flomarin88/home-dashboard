# Configuration Home Assistant requise par le dashboard

Le dashboard est un **client mince** : Home Assistant est l'unique source de vérité
(AD-1) et **toute logique horaire / d'automatisation vit dans HA** (AD-4). Certaines
features ont donc besoin d'**entités HA** (helpers, capteurs template) créées côté HA.
Ce document liste ce setup, feature par feature.

> Après édition de `configuration.yaml` : **Outils de développement → YAML → Recharger**
> le domaine concerné (Template entities, Input datetime…), ou redémarrer HA. Les
> helpers créés via l'UI (Paramètres → Appareils et services → Helpers) ne nécessitent
> pas de rechargement.

---

## Poubelles — sortie jaune / noire (Story 6.1)

La tuile poubelle **reflète** un capteur template et **écrit un timestamp** au marquage
« sortie ». Le *schéma horaire, l'état « fait/oubli » et l'historique* vivent **dans HA**.

### Créneaux

- **Jaune** (tri) : mardi **18h** → mercredi **7h**
- **Noire** (ordures) : jeudi **18h** → vendredi **7h**

### 1. Deux helpers `input_datetime` (timestamp de sortie + journal)

Le plus simple via l'UI : **Paramètres → Appareils et services → Helpers → Créer un
helper → Date et/ou heure** → cocher **date ET heure**. Créer :

- **Poubelle jaune sortie** → `input_datetime.poubelle_jaune_sortie`
- **Poubelle noire sortie** → `input_datetime.poubelle_noire_sortie`

Équivalent YAML :

```yaml
input_datetime:
  poubelle_jaune_sortie: { name: Poubelle jaune sortie, has_date: true, has_time: true }
  poubelle_noire_sortie: { name: Poubelle noire sortie, has_date: true, has_time: true }
```

L'app y écrit `now` au tap « Sortie » (`input_datetime.set_datetime`). **L'historique HA
de ces entités = le journal** récupérable (le dashboard n'a aucune persistance propre).

### 2. Capteur template `sensor.poubelle_a_sortir`

Il calcule l'état à partir des créneaux + des deux timestamps ci-dessus.

```yaml
template:
  - sensor:
      - name: "Poubelle à sortir"
        unique_id: poubelle_a_sortir
        state: >
          {% set n = now() %}
          {% set monday = (n - timedelta(days=n.weekday())).replace(hour=0, minute=0, second=0, microsecond=0) %}
          {% set tue18 = monday + timedelta(days=1, hours=18) %}   {# mardi 18h #}
          {% set wed07 = monday + timedelta(days=2, hours=7) %}    {# mercredi 7h #}
          {% set thu18 = monday + timedelta(days=3, hours=18) %}   {# jeudi 18h #}
          {% set fri07 = monday + timedelta(days=4, hours=7) %}    {# vendredi 7h #}
          {% set j = as_timestamp(states('input_datetime.poubelle_jaune_sortie'), 0) %}
          {% set k = as_timestamp(states('input_datetime.poubelle_noire_sortie'), 0) %}
          {% set j_done = j >= as_timestamp(tue18) %}
          {% set k_done = k >= as_timestamp(thu18) %}
          {% set r = namespace(v='aucune') %}
          {% if tue18 <= n and n < wed07 and not j_done %}{% set r.v = 'jaune' %}
          {% elif thu18 <= n and n < fri07 and not k_done %}{% set r.v = 'noire' %}
          {% elif n >= wed07 and n.weekday() == 2 and not j_done %}{% set r.v = 'oubli_jaune' %}
          {% elif n >= fri07 and n.weekday() == 4 and not k_done %}{% set r.v = 'oubli_noire' %}
          {% endif %}
          {{ r.v }}
```

Ré-évalué **chaque minute** (HA le fait automatiquement pour les templates utilisant
`now()`), donc les bascules à 18h/7h prennent effet en < 1 min.

### Contrat d'interface (⚠️ le code du dashboard en dépend)

`sensor.poubelle_a_sortir` — `state` ∈ :

| state          | signification                                   | tuile        |
| -------------- | ----------------------------------------------- | ------------ |
| `jaune`        | jaune à sortir maintenant (créneau, pas faite)  | icône jaune  |
| `noire`        | noire à sortir maintenant                       | icône noire  |
| `oubli_jaune`  | jaune non sortie, créneau passé                 | icône rouge  |
| `oubli_noire`  | noire non sortie, créneau passé                 | icône rouge  |
| `aucune`       | rien à sortir                                   | atténuée     |

Si tu changes ces valeurs d'état côté HA, il faut mettre à jour le mapping de l'app
(`src/entities/mapping.ts`) en conséquence.

### 3. Appliquer & tester

- **Recharger** : Outils de dév → YAML → **Recharger les entités Template** (+ **Recharger
  Input datetime** si helpers en YAML).
- **Tester la logique sans attendre mardi** : Outils de dév → **Template**, coller le bloc
  `state:` et remplacer `{% set n = now() %}` par une date forcée (ex. un mardi 19h) pour
  voir la valeur renvoyée.
- **Tester l'écriture** : Outils de dév → Actions → `input_datetime.set_datetime` sur
  `poubelle_jaune_sortie` avec l'heure courante → le capteur doit passer `jaune → aucune`
  (c'est ce que fera le bouton « Sortie »).

### Réglages possibles

- **Durée de l'« oubli »** : par défaut, rouge seulement le reste de la matinée de
  collecte (`n.weekday() == 2`/`4`). Élargir en changeant cette condition.
- **Sortie tardive en état « oubli »** : la tuile l'autorise (écrit quand même le
  timestamp) — comportement ajustable côté app.
