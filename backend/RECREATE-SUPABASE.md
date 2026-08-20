# Recréer le projet Supabase (guide complet, dans l'ordre)

Le projet précédent a été supprimé (pause > suppression sur le plan gratuit après inactivité).
Voici tout ce qu'il faut refaire, dans l'ordre. Chaque fichier mentionné existe déjà dans ce
dossier `backend/` — vous n'avez qu'à copier-coller.

## 1. Créer le nouveau projet
1. https://supabase.com/dashboard/projects → **New project** → plan **Free**.
2. Notez le mot de passe de la base (pour vous, pas pour moi).
3. Une fois créé, allez dans **Project Settings → API** et gardez cette page ouverte : vous aurez
   besoin de **Project URL** et de la clé **anon public** à l'étape 8.

## 2. Créer toutes les tables en une fois
SQL Editor → New query → collez tout le contenu de [`SETUP-COMPLET.sql`](SETUP-COMPLET.sql) → **Run**.
(Il contient les tables SF Match, l'inventaire marché, et SF Agenda — tout en un seul script.)

## 3. Compte e-mail (Resend)
Si vous avez toujours votre compte sur resend.com (le domaine `sfclub-paris.com` y est probablement
encore vérifié, c'est indépendant de Supabase) : **API Keys** → créez une nouvelle clé, copiez-la.
Sinon, recréez un compte et re-vérifiez le domaine (DNS Squarespace) comme la première fois.

## 4. Déployer les fonctions (Edge Functions → Create a function)
1. Nommée `notify-buyers` → collez [`notify-buyers.ts`](notify-buyers.ts) → **Deploy**
2. Nommée `agenda-availability` → collez [`agenda-availability.ts`](agenda-availability.ts) → **Deploy**

## 5. Ajouter les secrets (Edge Functions → Manage secrets)
- `RESEND_API_KEY` = votre clé Resend
- `SFMATCH_INTERNAL_EMAIL` = `contact@sfclub-paris.com`
- `SFMATCH_FROM` = `SF Club Paris <contact@sfclub-paris.com>`

(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement, rien à faire.)

## 6. Brancher le déclencheur automatique (e-mails)
1. Ouvrez [`trigger-notify.sql`](trigger-notify.sql).
2. Remplacez `<PROJECT_REF>` par votre référence de projet (visible dans l'URL du dashboard, ex.
   `abcdxyz` dans `abcdxyz.supabase.co`) et `<ANON_KEY>` par la clé **anon public** notée à l'étape 1.
3. Collez le résultat dans SQL Editor → **Run**.

## 7. Créer votre compte équipe (pour l'agenda interne)
**Authentication → Users → Add user** → email + mot de passe. C'est ce compte qui vous connecte sur
`admin-agenda.html`.

## 8. Me communiquer 2 valeurs
Dans **Project Settings → API** : **Project URL** + clé **anon public** → envoyez-les moi ici. Je les
recolle dans le site (`sf-match.html`, `location.html`, `admin-agenda.html`) et je redéploie.

## 9. Importer les données de test
Une fois que je vous confirme le site à jour, **Table Editor** :
- `inventory` → Import CSV → [`inventaire-demo.csv`](../inventaire-demo.csv)
- `agenda_vehicules` → Import CSV → [`agenda-vehicules-demo.csv`](agenda-vehicules-demo.csv)

---
Une fois les étapes 1 à 8 faites et les 2 valeurs envoyées, tout redevient fonctionnel comme avant.
