# SF AGENDA — Activation (dispo + prix automatique multi-agences)

Ce qui a été construit :
- Une page publique (**Location**) où un visiteur/vous tapez une marque + des dates → le site dit si c'est
  disponible et calcule le prix automatiquement (tarif dégressif 1-3j / 4-6j / 7-13j / 14j+). Si indisponible,
  il propose un véhicule équivalent (même segment) qui, lui, est libre — avec son prix.
- Une page interne **`admin-agenda.html`** (non listée dans le menu, réservée à l'équipe) qui affiche les
  **demandes en attente** venues du site (avec boutons Valider/Refuser), les **réservations confirmées** à
  venir, et permet d'en créer une manuellement (ex. après un appel téléphonique).
- Une demande envoyée depuis le site **ne bloque pas** le véhicule tant qu'elle n'est pas **validée** dans
  l'agenda interne — c'est la validation qui bloque réellement les dates pour les autres clients.
- Les données clients (nom, contact, réservations) ne sont **jamais** accessibles publiquement : seule
  l'équipe connectée peut les lire. Le calcul de dispo/prix passe par une fonction serveur qui ne renvoie que
  le résultat (dispo/prix), jamais les réservations des autres clients.

## 1. Créer les tables
SQL Editor → New query → collez le contenu de [`agenda-schema.sql`](agenda-schema.sql) → **Run**.

## 2. Créer votre compte équipe (connexion à l'agenda)
Authentication → **Users** → **Add user** → renseignez un email et un mot de passe (ex. le vôtre).
C'est ce compte qui vous servira à vous connecter sur `admin-agenda.html`. Vous pouvez créer un compte par
membre de l'équipe qui doit gérer l'agenda.

## 3. Déployer les 2 fonctions
1. `agenda-availability` ← [`agenda-availability.ts`](agenda-availability.ts) → **Deploy**
   (calcule dispo/prix, réutilise les secrets déjà présents `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`)
2. `agenda-request` ← [`agenda-request.ts`](agenda-request.ts) → **Deploy**
   (crée la demande "en attente" + envoie les e-mails ; réutilise les secrets `RESEND_API_KEY`,
   `SFMATCH_INTERNAL_EMAIL`, `SFMATCH_FROM` déjà configurés pour SF Match)

## 4. Importer les véhicules des agences partenaires
Table Editor → table **`agenda_vehicules`** → **Insert** → **Import data from CSV** → sélectionnez
[`agenda-vehicules-demo.csv`](agenda-vehicules-demo.csv) pour tester (8 véhicules de 4 agences fictives), puis
faites de même avec vos vrais fichiers agences (mêmes colonnes : `agence_nom, marque, modele, annee, couleur,
segment, prix_jour_1_3, prix_jour_4_6, prix_jour_7_13, prix_jour_14plus, actif`).

Valeurs possibles pour `segment` (pour un bon matching des alternatives) : `supercar, cabriolet, gt, suv_luxe,
suv, berline_luxe, sport, citadine, berline, autre`.

## 5. Tester
- **Site public** → [location.html](../location.html) → section "Vérifiez la disponibilité" → tapez une marque
  du CSV démo (ex. *Ferrari*) avec des dates → le prix s'affiche. Choisissez des dates qui se chevauchent avec
  une réservation existante (créée depuis l'agenda interne) pour voir la proposition d'alternative.
- **Agenda interne** → `admin-agenda.html` → connectez-vous avec le compte créé à l'étape 2 → créez une
  réservation test → elle apparaît dans "Réservations à venir".

## Notes
- Le prix est calculé automatiquement selon la durée : 1-3 jours, 4-6 jours, 7-13 jours, 14 jours et plus —
  chaque palier a son propre tarif/jour dans le CSV (dégressif).
- `admin-agenda.html` n'est lié depuis aucun menu du site — gardez son URL confidentielle, partagez-la
  uniquement à l'équipe.
- Pour ajouter/modifier des véhicules plus tard, ré-importez un CSV (Table Editor accepte la mise à jour) ou
  éditez directement les lignes dans le Table Editor.
