---
title: Spike — Suivi des colis au kiosque (API transporteurs vs mail)
status: partial
created: 2026-07-29
feeds: PRD §backlog flux d'affichage (« colis Amazon »)
source: portails développeurs consultés le 2026-07-29 + 1 mail Amazon.fr réel (27/07/2026)
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

## Preuve — mail Amazon du 27/07/2026

`shipment-tracking@amazon.fr`, reçu `Mon, 27 Jul 2026 09:02:30 +0000` (11h02 locale).

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

- **Un seul mail observé**, à l'étape « en cours de livraison ». Contenu des mails
  « Expédié » (porte-t-il une date future du type « prévue mercredi 29 » ?) et
  « Livré » : **inconnu**. À collecter avant de figer les regex.
- Décodage du sujet Base64 RFC 2047 par l'intégration IMAP de HA : **non testé**.
- CORS des API transporteurs : **non testé** (sans objet si HA porte les appels).
- Conditions tarifaires UPS 2026 : **non vérifiées**.
- Quotas réels de La Poste Suivi v2 : la gratuité est attestée par une lib tierce,
  **pas lue sur le portail officiel** (page rendue en JS, non récupérable).

## Sources

developer.laposte.fr · github.com/debuss/lapostesuivi ·
support-developer.dhl.com (art. 47001249492) · developer.dhl.com/api-reference/shipment-tracking ·
colissimo.entreprise.laposte.fr · developer.ups.com · developer-docs.amazon/sp-api ·
home-assistant.io/integrations/seventeentrack · github.com/shaiu/pyseventeentrack ·
help.17track.net · parcelapp.net/help/api.html · github.com/jmdevita/parcel-ha ·
github.com/koconnorgit/ha-amazon-order-status · github.com/JavanXD/ha-package_deliveries ·
home-assistant.io/integrations/imap · ship24.com/pricing
