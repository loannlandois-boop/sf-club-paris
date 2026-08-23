# Activer les paiements Stripe (location + caution)

Ce qui a été construit : quand vous validez une réservation dans l'agenda interne
(`admin-agenda.html`), le système génère automatiquement **2 liens Stripe** et les envoie
au client par e-mail avec la demande de documents (permis + passeport/CNI) :
- Un lien pour **payer le montant de la location**
- Un lien pour **préautoriser la caution** (le montant est "bloqué" sur la carte, jamais
  débité automatiquement — vous le capturez seulement en cas de dommages, sinon il se libère
  tout seul après quelques jours)

**Aucune photo de carte bancaire n'est jamais demandée** : Stripe gère tout, vous ne voyez
jamais le numéro de carte du client.

## 1. Créer un compte Stripe
https://dashboard.stripe.com/register — gratuit à l'ouverture (commission uniquement sur
les transactions réussies, généralement 1,5 % + 0,25 € pour une carte européenne).

## 2. Récupérer la clé secrète
Dashboard Stripe → **Developers → API keys** → copiez la **Secret key**.
- Elle commence par `sk_test_...` en mode test (aucun vrai paiement, pour essayer sans risque)
- Ou `sk_live_...` en mode production (une fois prêt à encaisser réellement) — activez le mode
  live en haut à droite du dashboard Stripe avant de la copier.

## 3. Ajouter le secret dans Supabase
Edge Functions → **Manage secrets** → `STRIPE_SECRET_KEY` = la clé copiée.

## 4. Déployer la fonction
Edge Functions → **Create a function** nommée `agenda-confirm` → collez le contenu de
[`agenda-confirm.ts`](agenda-confirm.ts) → **Deploy**.

## 5. Renseigner la caution par véhicule
Table Editor → `agenda_vehicules` → colonne **`caution`** (montant en euros) sur chaque
véhicule. Si vous n'avez pas encore cette colonne (projet créé avant cet ajout), lancez
d'abord [`migration-stripe.sql`](migration-stripe.sql) dans SQL Editor.
Le CSV démo [`agenda-vehicules-demo.csv`](agenda-vehicules-demo.csv) a déjà des cautions
d'exemple si vous voulez tester avant de saisir vos vraies valeurs.

## 6. Tester
Mode test (`sk_test_...`) : validez une réservation dans l'agenda, ouvrez le lien de paiement
reçu par e-mail → utilisez la carte de test Stripe `4242 4242 4242 4242`, une date future,
n'importe quel CVC → le paiement passe sans débiter personne.

Une fois convaincu, repassez en clé `sk_live_...` pour les vrais paiements.

## 7. Ajouter les colonnes de suivi (numéro de réservation, paiement, vol)
SQL Editor → collez [`migration-suivi.sql`](migration-suivi.sql) → **Run**.

## 8. Déployer le webhook (indispensable pour l'e-mail de remerciement)
Le lien de paiement seul ne suffit pas à savoir si le client a vraiment payé — il faut que
Stripe **prévienne** votre site quand l'argent est réellement encaissé. C'est le rôle du
webhook :

1. Edge Functions → **Create a function** nommée `stripe-webhook`
2. Collez le contenu de [`stripe-webhook.ts`](stripe-webhook.ts) → **Deploy**
3. **Important** : sur cette fonction précisément, désactivez la vérification JWT (case à
   décocher du type "Enforce JWT Verification" au moment de la création, ou dans les
   **Settings** de la fonction une fois créée). Stripe n'envoie pas de jeton Supabase — sans
   ça, tous ses appels seraient refusés avant même d'arriver à votre code. La sécurité est
   assurée autrement (vérification de signature Stripe, voir étape suivante).
4. Copiez l'URL de la fonction (visible en haut de sa page, du type
   `https://VOTRE_PROJET.supabase.co/functions/v1/stripe-webhook`)
5. Dashboard Stripe → **Developers → Webhooks → Add endpoint** → collez cette URL →
   sélectionnez l'événement **`checkout.session.completed`** → **Add endpoint**
6. Sur la page de ce webhook, cliquez **Reveal** à côté de "Signing secret" (commence par
   `whsec_...`) → copiez-le
7. Supabase → **Edge Functions → Secrets** → ajoutez `STRIPE_WEBHOOK_SECRET` = cette valeur

## 9. Déployer la fonction de suivi client
1. `agenda-lookup` ← [`agenda-lookup.ts`](agenda-lookup.ts) → **Deploy**
   (permet au client de retrouver sa réservation avec son numéro + son contact — page
   [ma-reservation.html](../ma-reservation.html))

## 10. Tester le circuit complet
1. Validez une réservation → l'e-mail de confirmation arrive avec le numéro de réservation
   (`SF-2026-000XX`) et les liens
2. Payez avec la carte de test `4242 4242 4242 4242`
3. Quelques secondes après, un **second e-mail** de remerciement doit arriver (déclenché par
   le webhook, pas par le clic sur le lien)
4. Allez sur `ma-reservation.html`, entrez le numéro + l'email/téléphone du client → la
   réservation doit s'afficher avec "Paiement : reçu ✓"

## 11. Remerciement automatique en fin de location
Un e-mail de remerciement part automatiquement le jour du retour du véhicule (réservations
payées uniquement), sans action de votre part.

1. SQL Editor → collez [migration-merci.sql](migration-merci.sql) → **Run**
2. Edge Functions → **Create a function** nommée `agenda-merci` → collez le contenu de
   [agenda-merci.ts](agenda-merci.ts) → **Deploy**
3. Ouvrez [cron-merci.sql](cron-merci.sql), remplacez `<PROJECT_REF>` et `<ANON_KEY>` (mêmes
   valeurs que pour `trigger-notify.sql`) → collez le résultat dans SQL Editor → **Run**

C'est tout : chaque jour à 10h (heure UTC), la tâche planifiée vérifie les locations qui se
terminent et envoie le remerciement.

## Notes
- **2 liens distincts** : location (capture automatique, facture générée par Stripe) et
  caution (capture manuelle, jamais débitée sauf dommages). Les combiner dans un seul lien
  a été essayé puis abandonné : Stripe refuse la génération de facture automatique dès qu'une
  session mélange capture automatique et manuelle.
- Une **facture PDF** est générée automatiquement par Stripe sur le lien de paiement
  (capture automatique = compatible) et jointe (lien de téléchargement) dans l'e-mail envoyé
  après paiement.
- Sans clé Stripe configurée, la validation fonctionne quand même (le véhicule se bloque,
  l'e-mail part), simplement sans lien de paiement — le client est informé qu'un conseiller
  le recontacte pour le règlement.
- La capture (si dommages) ou la libération de la caution préautorisée se fait
  manuellement dans le Dashboard Stripe → **Payments** → repérez le paiement partiellement
  capturé → capturez le reliquat (dommages) ou laissez expirer (libération automatique,
  généralement sous 7 jours selon la banque).
