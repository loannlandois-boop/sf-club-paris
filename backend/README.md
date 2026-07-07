# SF MATCH — Activation du back-end (base partagée + notifications auto)

Objectif : quand un vendeur dépose un véhicule, l'annonce est stockée dans une base
partagée et **envoyée automatiquement par e-mail aux acheteurs** dont la recherche
correspond (et inversement).

Tu n'as que **2 valeurs à me communiquer** à la fin (URL + clé anon). Le reste se
configure en 5 minutes dans Supabase.

## 1. Créer le projet
1. Va sur https://supabase.com → **New project** (plan gratuit).
2. Note le mot de passe de la base (pour toi).

## 2. Créer les tables
- Menu **SQL Editor** → **New query** → colle le contenu de `schema.sql` → **Run**.

## 3. Compte e-mail d'envoi (Resend, gratuit)
1. Crée un compte sur https://resend.com.
2. **API Keys** → crée une clé → copie-la (commence par `re_...`).
3. (Optionnel) Vérifie ton domaine pour envoyer depuis `contact@sfclubparis.com`.
   Sinon, l'envoi se fait depuis `onboarding@resend.dev` (fonctionne pour les tests).

## 4. Déployer la fonction `notify-buyers`
Dans Supabase → **Edge Functions** → **Create a function** nommée `notify-buyers`,
colle le contenu de `notify-buyers.ts`, puis **Deploy**.

Ajoute les **secrets** (Edge Functions → Manage secrets) :
- `RESEND_API_KEY` = ta clé Resend
- `SFMATCH_INTERNAL_EMAIL` = etude@arnaud-enr.com (ou l'adresse voulue)
- `SFMATCH_FROM` = `SF Club Paris <onboarding@resend.dev>` (ou ton domaine vérifié)

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà fournis automatiquement.

## 5. Brancher les Webhooks (déclenchent la fonction à chaque dépôt)
Database → **Webhooks** → **Create** :
- Table `listings`, événement **Insert** → type **Supabase Edge Functions** → `notify-buyers`.
- Idem pour la table `searches`.

## 6. Me communiquer 2 valeurs
Dans Supabase → **Project Settings → API** :
- **Project URL** (ex. `https://xxxx.supabase.co`)
- **anon public key** (longue clé `eyJ...`)

→ Envoie-les moi : je les colle dans le site (`SFMATCH_SUPABASE`) et je déploie.
La clé **anon** est publique par design (aucun risque). Ne partage **jamais** la
clé `service_role`.

C'est tout : dès que c'est branché, chaque dépôt notifie automatiquement les
acheteurs correspondants, sur tous les appareils.
