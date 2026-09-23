---
title: Spike — Suivi des colis au kiosque (API transporteurs vs mail)
status: partial
created: 2026-07-29
feeds: PRD §backlog flux d'affichage (« colis Amazon »)
source: portails développeurs consultés le 2026-07-29 + 1 mail Amazon.fr réel (27/07/2026) + 1 numéro S10 étranger réel (2026-08-03)
---

# Spike — afficher les colis en cours de livraison

**Question :** comment le kiosque affiche-t-il les colis en cours, avec date et
heure de livraison, pour arbitrer « bureau ou maison » ?

**Verdict global : FAISABLE au jour près, PAS à l'heure près.** Aucune source
propre ne donne de créneau horaire. Le maximum atteignable est **jour + étape**
(commandé / expédié / en cours de livraison / livré). Le widget doit être
spécifié sur cette granularité, sinon il promet ce qu'aucune source ne fournit.

> ⚠️ **Hypothèse réfutée par la preuve.** J'avançais que « le mail du jour J est
> plus riche que l'API ». Le mail Amazon réel (ci-dessous) dit
> « Livraison prévue **aujourd'hui** » — jour, pas heure. Corrigé.

## Preuve — mails Amazon du 27/07/2026

Deux mails du même colis, 1 h 23 d'écart. **L'expéditeur change selon l'étape.**

| Étape | Expéditeur | Reçu (UTC) | Échéance annoncée |
|---|---|---|---|
| En cours de livraison | `shipment-tracking@amazon.fr` | 09:02:30 | « Livraison prévue aujourd'hui » |
| Livré | `order-update@amazon.fr` | 10:25:38 | « Livré aujourd'hui » + « déposé dans la boîte aux lettres » |

Sujets encodés Base64 RFC 2047, décodés proprement : `Livré : « … »`,
`En cours de livraison : « … »`. Le préfixe du sujet porte l'étape.

**L'heure est dans l'enveloppe, pas dans le corps.** Aucun corps ne donne d'heure ;
l'en-tête `Date` du mail « Livré » (12h25 locale) approxime l'heure réelle de livraison.

**Clés :** le `N° de commande` est stable entre les deux mails — c'est la clé de dédup.
Le `shipmentId` **ne l'est pas** : `Twk1C4My9` dans le lien de suivi,
`113736816521302` dans les liens d'avis, dans le même mail. Ne pas s'en servir comme clé.

Détail du mail « En cours de livraison » (`shipment-tracking@amazon.fr`, 11h02 locale) :

| Champ | Valeur observée | Exploitable ? |
|---|---|---|
| Sujet | `En cours de livraison : « NEW'C Kit de 3, Verre... »` (Base64 RFC 2047) | ✅ porte l'étape |
| Étape | stepper `Commandé → Expédié → **En cours de livraison** → Livré` | ✅ |
| Échéance | « Livraison prévue **aujourd'hui** » | ⚠️ jour seulement |
| Heure / créneau | **absent** | ❌ |
| N° commande | `407-8241558-7777115` (`\d{3}-\d{7}-\d{7}`) | ✅ clé de dédup |
| Transporteur | **absent** | ❌ |
| N° de suivi transporteur | **absent** | ❌ |
| Lien | `amazon.fr/progress-tracker/package?orderId=…&shipmentId=…` | ✅ deep-link |

**Conséquence majeure :** pas de numéro de suivi transporteur ⇒ Amazon Logistics
⇒ **aucune API transporteur ne peut suivre ce colis**. Pour Amazon, le mail
n'est pas une option parmi d'autres, c'est la seule voie.

La partie `text/plain` du mail est propre et parsable (l'échéance et le n° de
commande y figurent en clair) — un template sensor IMAP suffit, pas besoin de
parser le HTML.

## Inventaire des API — ce que je pensais vs réalité

| Source | Pressenti | Réalité vérifiée |
|---|---|---|
| Amazon | « il doit bien y avoir une API » | **Aucune API publique client.** SP-API = vendeurs, Shipping API = expéditeurs. |
| La Poste | contrat pro requis | **Okapi « Suivi v2 », gratuit, inscription libre.** Header `X-Okapi-Key`. Couvre courrier suivi + **Colissimo + Chronopost** en un appel. |
| DHL | payant | **Unified Tracking gratuit**, 250 appels/jour, 1 appel / 5 s. Largement suffisant pour un foyer. |
| Colissimo / Chronopost (WS directs) | accessibles | **Contrat entreprise requis.** Inutiles — passer par Suivi v2. |
| UPS | — | Clé via Developer Kit. Conditions tarifaires 2026 **non vérifiées**. |
| 17TRACK (intégration HA native) | API officielle | **API non officielle.** `pyseventeentrack` : login email+mdp (≤16 car.), README : *« this API may stop working at any moment »*. |
| 17TRACK (API dev) | — | ~119 $ / 12 mois. Pas de palier gratuit réel. |
| Parcel App | — | **API officielle, 5 $/an**, intégration HACS `jmdevita/parcel-ha`, poll 5 min. |
| Ship24 / AfterShip / TrackingMore | — | Chiffres issus de pages **éditées par Ship24 sur ses concurrents** — biais commercial, à revérifier à la source. |

## Cas réel n°2 — un S10 étranger (2026-08-03)

**Ce cas casse la taxonomie du spike.** Le document raisonnait sur deux situations :
« Amazon ⇒ pas de numéro transporteur ⇒ le mail est la seule voie » et « le reste
⇒ un numéro français ⇒ La Poste Suivi v2 ». Un colis réel en exhibe une troisième.

Numéro fourni par Florian : **`CQ966406916DE`**, annoncé comme « chez Colissimo ».

| Contrôle | Résultat |
| --- | --- |
| Format | **UPU S10** — 2 lettres de service + 8 chiffres + clé + 2 lettres de pays |
| Clé de contrôle | **valide** : `96640691` pondéré 8-6-4-2-3-5-9-7 → somme 258 ; `258 mod 11 = 5` ; `11 − 5 = 6` = la clé annoncée |
| Pays d'origine | **`DE` — Allemagne** |

**Conséquence :** ce n'est pas un envoi Colissimo à la source. C'est un colis parti
d'Allemagne dont La Poste n'assure que le dernier kilomètre. Le numéro est **émis
par l'opérateur étranger**, pas par La Poste — et rien ne garantit que Suivi v2
réponde dessus avant l'entrée du colis dans le réseau français, voire du tout.

**Troisième cas à ajouter à la recommandation :** un numéro **existe** (contrairement
à Amazon Logistics) mais **son émetteur est étranger** (contrairement à un Colissimo
domestique). La recommandation n°2 du spike — « le reste → Suivi v2 » — n'a jamais
été confrontée à ce cas.

### Tentatives de suivi depuis l'agent, le 2026-08-03

| Source | Résultat |
| --- | --- |
| `laposte.fr/outils/suivre-vos-envois?code=…` | **HTTP 403** — refus actif du fetch automatisé |
| `dhl.de/int-verfolgen/search?piececode=…` | **timeout à 60 s** |

Le 403 ajoute une information au constat du 29/07 (« page rendue en JS ») : le
portail **bloque activement**, il ne se contente pas de rendre côté client.
Écarté volontairement : les agrégateurs commerciaux (Ship24, 17TRACK), qui
auraient reçu le numéro de suivi du foyer pour un résultat obtenable à la main.

**Statut du colis : inconnu.** Aucune source n'a répondu ; rien n'est déduit.

## Contrainte d'architecture — le porteur de secret

Le kiosque est un SPA statique sans backend ; `.env.local` n'est pas bundlé (AD-8).
**Aucune clé d'API transporteur ne peut vivre dans le front.** Toutes ces API sont
conçues serveur-à-serveur (CORS non testé, mais l'hypothèse par défaut est qu'elles
ne répondent pas à un `fetch` navigateur cross-origin).

La question « quelle API ? » est donc en réalité **« quel porteur de secret ? »**,
et l'architecture n'en admet qu'un : **Home Assistant**, déjà unique système
d'enregistrement. HA porte les credentials, expose des entités ; le kiosque les lit
via le seam `src/hakit/` (AD-2), comme la conso élec.

## Recommandation

1. **Amazon → IMAP dans HA.** Seule voie. Soit `ha-amazon-order-status`, soit
   IMAP natif + template sensors sur la partie `text/plain`.
   Réserves consignées : mot de passe IMAP stocké **en clair** côté HA ; les colis
   expédiés par un tiers n'envoient parfois **jamais** le mail « Livré » (purge manuelle).
   ⚠️ **Ne pas filtrer sur un seul expéditeur.** `shipment-tracking@amazon.fr` et
   `order-update@amazon.fr` se partagent le cycle de vie. Un filtre sur le premier
   attrape les départs et manque **toutes** les livraisons — sans erreur visible,
   le widget laissant les colis « en cours » indéfiniment. Filtrer sur le domaine
   `amazon.fr` et discriminer sur le préfixe du sujet.
2. **Reste (Colissimo, Chronopost, courrier suivi) → La Poste Suivi v2**, gratuit,
   trois transporteurs pour une clé. Si un jour DHL entre dans le jeu, son palier
   gratuit suffit.
3. **Écarter 17TRACK natif** malgré sa gratuité : API non officielle, casse annoncée
   par ses propres auteurs. **Parcel à 5 $/an** est l'alternative contractuelle si on
   veut un agrégateur plutôt que du sur-mesure.
4. **Spécifier le widget sur jour + étape.** Le signal décisif pour l'arbitrage
   bureau/maison est la **transition Expédié → En cours de livraison**, pas une date
   estimée. Ne pas afficher d'heure : aucune source n'en fournit.

## Incertitudes ouvertes

- Mails « en cours de livraison » et « Livré » observés. **« Expédié » toujours
  inconnu** — c'est le seul susceptible de porter une date future exploitable
  (« prévue mercredi 29 »). À collecter avant de figer les regex.
- Les sujets décodent proprement en RFC 2047 Base64 (vérifié à la main). Que
  l'intégration IMAP de HA les décode elle-même reste **non testé**.
- Un seul colis observé, livré en boîte aux lettres. Les libellés d'un colis
  remis en main propre ou déposé en point relais : **inconnus**.
- CORS des API transporteurs : **non testé** (sans objet si HA porte les appels).
- Conditions tarifaires UPS 2026 : **non vérifiées**.
- Quotas réels de La Poste Suivi v2 : la gratuité est attestée par une lib tierce,
  **pas lue sur le portail officiel** (page rendue en JS, et qui **renvoie 403** au
  fetch automatisé — constaté le 2026-08-03).
- **Suivi v2 sur un numéro S10 étranger : non testé.** C'est la question ouverte la
  plus concrète du spike, et `CQ966406916DE` en est le cas d'essai tout trouvé —
  il suffit d'une clé Okapi pour trancher. Trois issues possibles, aucune écartée :
  Suivi v2 répond dès l'émission, ne répond qu'à l'entrée dans le réseau français,
  ou ne répond jamais sur un numéro qu'elle n'a pas émis.
- **Part réelle des colis étrangers dans le foyer : inconnue.** Un seul cas observé.
  Si elle est significative, la recommandation n°2 (« le reste → Suivi v2 ») ne
  couvre pas ce qu'elle prétend couvrir.

## Sources

developer.laposte.fr · github.com/debuss/lapostesuivi ·
support-developer.dhl.com (art. 47001249492) · developer.dhl.com/api-reference/shipment-tracking ·
colissimo.entreprise.laposte.fr · developer.ups.com · developer-docs.amazon/sp-api ·
home-assistant.io/integrations/seventeentrack · github.com/shaiu/pyseventeentrack ·
help.17track.net · parcelapp.net/help/api.html · github.com/jmdevita/parcel-ha ·
github.com/koconnorgit/ha-amazon-order-status · github.com/JavanXD/ha-package_deliveries ·
home-assistant.io/integrations/imap · ship24.com/pricing
