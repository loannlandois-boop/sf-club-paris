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

## Notes
- Sans clé Stripe configurée, la validation fonctionne quand même (le véhicule se bloque,
  l'e-mail part), simplement sans lien de paiement — le client est informé qu'un conseiller
  le recontacte pour le règlement.
- Les 2 liens générés sont aussi visibles dans l'agenda interne, sous chaque réservation
  confirmée, si vous devez les renvoyer.
- La capture (ou l'annulation) de la caution se fait manuellement dans le Dashboard Stripe →
  **Payments** → repérez le paiement en statut "Uncaptured" → **Capture** (si dommages) ou
  laissez expirer (se libère automatiquement, généralement sous 7 jours selon la banque).
