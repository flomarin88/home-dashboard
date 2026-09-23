---
title: Spike — Temps de trajet domicile→travail au kiosque (Waze vs Google vs HERE)
status: partial
created: 2026-07-29
feeds: PRD §backlog flux d'affichage (« info trafic »)
source: doc Home Assistant + code source home-assistant/core (branche dev) + pywaze, consultés le 2026-07-29
---

# Spike — afficher le temps de trajet domicile → travail

**Cadrage retenu avec l'humain avant recherche :** décision servie = « je pars
maintenant, ça prend combien ? » (horizon = instant présent, pas de départ
futur) · **un seul trajet**, domicile → travail, un seul sens · tuile
**affichée en permanence** sur l'accueil.

**Question :** quelle source alimente cette tuile, et à quel prix ?

**Verdict global : FAISABLE et GRATUIT — mais le seul candidat compatible avec
un affichage permanent s'appuie sur une API Waze non officielle.** Même classe
de risque que le 17TRACK écarté dans le [spike colis](spike-suivi-colis-2026-07-29.md).
Différence décisive : là-bas l'alternative contractuelle existait à 5 $/an ; ici
le choix « affichage permanent » la disqualifie **arithmétiquement**, pas par goût.

## Le chiffrage qui tranche

| Source | Clé / CB | Polling par défaut | Volume / mois | Palier gratuit |
|---|---|---|---|---|
| **Google Travel Time** (intégration HA) | clé + **carte bancaire obligatoire** | 10 min → ~144/j | ~4 320 | **5 000** (Compute Routes **Pro**) |
| **HERE Travel Time** (intégration HA) | clé, Base Plan | configurable | — | **5 000** ⚠️ non revérifié à la source |
| **Waze Travel Time** (intégration HA) | **aucune** | **5 min** (`SCAN_INTERVAL`) → 288/j | 8 640 | sans objet |

La doc HA de Google écrit elle-même qu'**« using more than 1 sensor will exceed
the free credit limit »** au rythme par défaut, et recommande de brider
« Elements per day » à **≤ 161**. Une tuile permanente sur Google, c'est une
carte bancaire branchée sur un compteur qui tourne 24/7.

Waze est gratuit **parce qu'il n'est pas contractuel** — c'est la même phrase
que « 17TRACK est gratuit parce que son API n'est pas officielle ». Le prix
n'est pas en euros, il est en fragilité.

## Ce que je n'avais pas anticipé — l'écart vs la normale est gratuit

Une tuile qui affiche « 34 min » ne dit rien. Ce qui informe, c'est « 34 min,
+12 vs la normale ». Je pensais devoir reconstituer la normale à partir de
l'historique HA. **Faux : Waze renvoie les deux temps.**

`pywaze/route_calculator.py` parse **`crossTime`** (avec trafic) ou
**`crossTimeWithoutRealTime`** (sans trafic) selon le paramètre `real_time`.
HA expose `realtime` dans son options flow, défaut `True` (`const.py`,
`DEFAULT_OPTIONS`).

**Le point décisif, vérifié dans `config_flow.py` :** aucun `unique_id` n'est
posé, ni `_abort_if_unique_id_configured`, ni `_async_abort_entries_match`.
**Deux entrées de configuration sur le même couple origine/destination sont donc
autorisées** — une `realtime: true`, une `realtime: false`. Le delta se calcule
dans un template sensor **côté HA** (AD-4) ; le kiosque ne fait que lire via
`src/hakit/` (AD-2). Zéro clé, zéro coût, zéro logique horaire dans le front.

> Ce n'est pas une déduction depuis la doc — la doc HA ne mentionne ni
> `crossTimeWithoutRealTime` ni l'absence d'`unique_id`. Lu dans le code.

## La contradiction tranchée — permanent ≠ polling permanent

Le cadrage demande une **tuile permanente**. Il n'implique **pas** un **polling
permanent**, et c'est là que se joue la survie de l'intégration.

`pywaze` frappe `routing-livemap-<region>.waze.com/RoutingManager/routingRequest`
avec :

```python
HEADERS = {"User-Agent": "pywaze", "referer": "https://www.waze.com/"}
```

C'est l'endpoint interne de la **livemap** Waze, pas une API publiée, interrogé
par un client qui s'annonce comme tel. Marteler ça 24/7 est exactement ce qui
attire un blocage.

HA sait désactiver le polling automatique d'une intégration (options système de
l'entrée) et le piloter par `homeassistant.update_entity` — la doc Waze de HA le
documente explicitement comme le moyen d'obtenir un intervalle personnalisé.

**Décision (2026-07-29) : polling automatique désactivé, rafraîchissement à la
demande uniquement.** Aucun appel de fond. L'appui sur la tuile appelle
`homeassistant.update_entity` (intention UI → HA par service call, conforme à
l'architecture). Quelques appels par jour au lieu de 8 640 par mois : le risque
de blocage passe de structurel à négligeable.

**Contrepartie assumée : l'obsolescence devient l'état par défaut**, plus le cas
limite. Le pattern de la Story 1.6 ne suffit pas ici — il grise une valeur
périmée, or une durée périmée est indiscernable d'une durée fraîche. La tuile
**ne doit afficher aucune durée** tant qu'elle n'a pas été rafraîchie dans la
session : état initial = appel à l'action.

## La fragilité n'est pas théorique

| Issue | Date | Symptôme observé |
|---|---|---|
| [core#153153](https://github.com/home-assistant/core/issues/153153) | 28/09/2025, HA 2025.9.4 — **fermée** | **503 nginx** dès l'étape de validation (`helpers.py:25`) |
| [core#115576](https://github.com/home-assistant/core/issues/115576) | — | **HTML renvoyé au lieu de JSON**, les capteurs cessent de se mettre à jour |

La doc HA ne porte **aucun avertissement** sur le caractère non officiel de la
source, et le README de `pywaze` non plus (MIT). L'absence de disclaimer n'est
pas une garantie de stabilité — c'est juste une absence de disclaimer.

Côté gestion d'erreur : `_check_response` lève `WRCError` sur réponse non-succès,
JSON invalide ou vide ; `WRCTimeoutError` sur timeout. Le capteur passe alors à
`None` → `unknown`. Le kiosque doit traiter ce cas comme une **indisponibilité
normale**, pas comme un bug.

## Ce que l'entité fournit (source : `sensor.py`, `coordinator.py`, `const.py`)

| Élément | Valeur |
|---|---|
| State | `duration`, en **minutes** (`UnitOfTime.MINUTES`, float) |
| Attributs | `duration`, `distance`, `route`, `origin`, `destination` |
| Régions | `us`, `na`, `eu`, `il`, `au` → **`eu`** pour la France |
| Véhicules | `car`, `taxi`, `motorcycle` |
| Origine / destination | adresse, coordonnées GPS, **ou entité** : `zone`, `person`, `device_tracker` |
| Options notables | `avoid_toll_roads`, `avoid_subscription_roads`, `avoid_ferries`, `incl_filter`/`excl_filter` (match exact du nom de rue, casse et espaces compris), `time_delta`, `base_coordinates` |
| IoT class | Cloud Polling |

Deux conséquences de design :

1. **Le couple d'adresses vit dans HA, pas dans le repo** — acquis : la zone
   « Travail » est créée côté HA (décision du 2026-07-29). Origine = zone `home`,
   destination = cette zone. Système d'enregistrement unique (AD-1).
   **Référencer par `entity_id`** (`zone.travail`), pas par nom convivial : la
   doc HA signale que le nom de zone est *case sensitive*, un renommage ou une
   majuscule cassent la configuration sans erreur explicite.
2. **`time_delta` (sélecteur de durée, valeurs négatives autorisées) interroge un
   départ décalé.** La question « à quelle heure dois-je partir ? » — écartée du
   cadrage — n'est donc pas fermée par ce choix technique, seulement repoussée.
   Le même fournisseur pourra la servir.

## Recommandation

1. **Waze Travel Time, intégration native HA.** Seul candidat compatible avec un
   affichage permanent sans carte bancaire. Région `eu`.
2. **Deux entrées de configuration** sur le même couple origine/destination :
   `realtime: true` et `realtime: false`. Un template sensor HA expose le delta.
   La tuile lit `état` + `delta`, rien de plus.
3. **Polling automatique désactivé, rafraîchissement déclenché par l'utilisateur.**
   L'appui appelle `homeassistant.update_entity` sur **les deux** entités.
   Aucune logique horaire nécessaire — il n'y a pas de fenêtre à définir.
4. **Spécifier la tuile sur trois états, pas un affichage.** *Jamais rafraîchie* →
   appel à l'action, aucun chiffre. *En attente* → le service est fire-and-forget,
   la valeur arrive par le websocket, il faut un délai de garde. *Fraîche* →
   durée + écart + horodatage. `unknown` reste un état de premier ordre : cette
   source tombe, c'est documenté, la tuile doit le dire au lieu de mentir.
5. **Ne pas construire de repli automatique vers Google/HERE.** Un repli qui
   s'arme sans qu'on le voie sur une API facturée à l'appel est un risque
   financier silencieux. Si Waze casse durablement, c'est une décision à
   reprendre, pas un `try/except`.

## Incertitudes ouvertes

- **Le palier HERE (5 000/mois) est lu sur la doc HA, pas sur la grille tarifaire
  HERE** (page rendue en JS, non récupérable). Même réserve que pour les quotas
  La Poste dans le spike colis.
- **L'écart `realtime` / sans-trafic est établi au niveau du code, pas mesuré**
  sur le trajet réel. Que `crossTimeWithoutRealTime` produise une normale
  exploitable (et non une valeur théorique déconnectée) reste à constater une
  fois les deux entités créées.
- **Fréquence réelle des blocages Waze : inconnue.** Deux incidents documentés,
  aucune base pour en déduire un taux.
- **Le serveur de routage `eu` sur un trajet français : non testé.**
- **TomTom : un composant custom existe** (dépôt mis à jour le 21/07/2026),
  **non instruit**. `open_route_service` (eifinger) existe aussi, non instruit.
- **La granularité de l'état n'a pas été vérifiée** (arrondi minute ou décimal) —
  détermine si la tuile doit arrondir elle-même.
- **Placement dans la grille non tranché** : `src/pages/home-grid.ts` documente un
  plafond de 6 tuiles par rangée et un viewport de 748px au-delà duquel
  `KioskShell` rogne. Barre supérieure ou rangée dédiée : décision de story.
- **`homeassistant.update_entity` sur une intégration dont le polling est
  désactivé : non vérifié dans le code.** La doc HA le présente comme le moyen
  d'obtenir un intervalle personnalisé, donc c'est l'usage prévu — mais tout le
  montage « à la demande » repose dessus. À lire avant de figer la story.
- **Latence d'un double `update_entity` non mesurée.** Deux entrées, deux appels
  réseau vers Waze : détermine si un délai de garde de quelques secondes suffit.
- **Aucun pattern existant pour « demande → attente → arrivée ».** L'infra
  optimiste (Story 2.1) converge vers un état cible connu d'avance ; ici le
  résultat est inconnu par définition. Soit une variante à instruire, soit un
  nouveau pattern — arbitrage à faire au moment de la story, pas ici.

## Sources

home-assistant.io/integrations/waze_travel_time · .../google_travel_time ·
.../here_travel_time ·
github.com/home-assistant/core → `homeassistant/components/waze_travel_time/`
(`sensor.py`, `coordinator.py`, `const.py`, `config_flow.py`, branche `dev`) ·
github.com/eifinger/pywaze → `src/pywaze/route_calculator.py` ·
github.com/home-assistant/core/issues/153153 · .../issues/115576 ·
github.com/eifinger/open_route_service
