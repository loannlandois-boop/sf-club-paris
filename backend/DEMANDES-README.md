# Formulaires du site — activation (Contact, Événements, Financement, Estimation, Adhésion)

Ce qui a changé : les formulaires de **Contact**, **Événements**, **Financement**,
**Achat & Revente (estimation)** et **Adhésion Club** étaient tous factices — ils affichaient
un faux message de succès sans jamais rien envoyer. Ils sont maintenant tous branchés sur une
fonction commune qui enregistre chaque demande et envoie automatiquement :
- un e-mail interne détaillé (contact@sfclub-paris.com)
- une confirmation personnalisée au client

## 1. Créer la table
SQL Editor → New query → collez [`demandes-schema.sql`](demandes-schema.sql) → **Run**.

## 2. Déployer la fonction
Edge Functions → **Create a function** nommée `demande-request` → collez le contenu de
[`demande-request.ts`](demande-request.ts) → **Deploy**.

Aucun nouveau secret : elle réutilise `RESEND_API_KEY`, `SFMATCH_INTERNAL_EMAIL`,
`SFMATCH_FROM` déjà configurés pour SF Match / SF Agenda.

## 3. Tester
Remplissez n'importe lequel de ces formulaires sur le site :
- [contact.html](../contact.html)
- [evenements.html](../evenements.html) (section "Demander le programme")
- [financement.html](../financement.html) (section "Un projet de financement ?")
- [achat-revente.html](../achat-revente.html) (section "Demandez votre estimation")
- [rejoindre.html](../rejoindre.html) (candidature Club)

→ vous devez recevoir l'e-mail interne, et l'expéditeur du formulaire reçoit sa confirmation
si un e-mail a été renseigné.

## Consulter les demandes reçues
Table Editor → table **`demandes`** : chaque ligne a un `type` (contact / evenement /
financement / estimation / adhesion), les coordonnées, le message, et une colonne `details`
(JSON) avec les champs propres à chaque formulaire. Marquez `statut = 'traitee'` une fois
répondu, pour vous y retrouver.
