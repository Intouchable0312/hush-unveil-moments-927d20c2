# Plan de refonte Hush

Grosse série de changements. Je regroupe par thème pour livrer proprement.

## 1. Auth (page login/signup)

- **Masquer `BottomNav`** quand l'utilisateur n'est pas connecté OU quand la route est `/auth`. Rediriger toute route protégée vers `/auth` si pas de session (au lieu d'afficher la nav vide).
- **Refonte visuelle** de `/auth` : hero plein écran, dégradé subtil, verre dépoli, logo animé, tabs Connexion/Inscription en pilule glassmorphism, champs avec labels flottants, transitions.
- **Sélecteur d'indicatif téléphonique** avec drapeau emoji (🇫🇷 +33, 🇧🇪 +32, etc.) via un petit menu déroulant recherchable. Formatage automatique du numéro avec `libphonenumber-js` (espacement selon le pays).
- **Bouton final = `PaymentSlider` réutilisé** (renommé `ActionSlider`) pour "Glisser pour se connecter" / "Glisser pour créer mon compte".

## 2. Slider partout pour actions importantes

Généraliser `ActionSlider` (extrait de `PaymentSlider`) pour :
- Auth (login/signup)
- Publier un post
- Bannir / débannir (admin)
- Supprimer compte, se déconnecter
- Confirmations d'abonnement

Les petites actions (toggle, edit inline) restent des boutons.

## 3. Navigation bottom bar

Remplacer l'onglet **Suggestions** par **Messages** (icône `MessageCircle`).
Les suggestions deviennent un **panneau repliable en haut de la page Accueil** (bouton ✨ qui déploie une carte avec les hashtags/créateurs suggérés).

Nouveaux 5 onglets : Accueil · Messages · **Poster (+)** · Abonnements · Compte

## 4. Onglet Compte — sous-onglets

Découper `/account` en sous-sections avec navigation interne (tabs horizontales) :
- **Profil** (photo, bannière, bio, hashtags)
- **Créateur** (devenir créateur, plans d'abonnement, tarifs)
- **Préférences** (thème)
- **Sécurité** (email, mot de passe, déconnexion, suppression compte) → actions destructives derrière slider

## 5. Cropping photo profil + bannière

Intégrer `react-easy-crop` :
- Modal plein écran avec zoom (slider), pan, ratio 1:1 pour avatar, 3:1 pour bannière
- Génération du crop côté client (canvas) puis upload dans le bucket `media`
- Ajouter le champ `cover_url` déjà présent dans `profiles` (bannière).

## 6. Onglet Poster — réorganisation

Actuellement trois boutons plats. Refonte :
- Cards visuelles avec icônes pour choisir le type (Public / Abonnés / Payant)
- Zone de dépôt média avec preview
- Prix via slider numérique (si payant)
- Sélection visibilité via segmented control
- Bouton final = slider

## 7. Admin — recherche + gift subscription

- Champ de recherche live (nom / username / téléphone) filtrant la liste
- **Modale "Offrir un abonnement"** : au lieu de `prompt()`, une modale avec autocomplete créateur (search par username/nom), sélection de durée, aperçu, confirmation par slider
- Actions ban/unban/admin en temps réel via Supabase Realtime sur `bans` et `user_roles` (broadcast à tous les admins connectés)

## 8. Autorisation photos par conversation

- Nouvelle table `conversation_settings(conversation_id, user_id, allow_photos_from_other bool, updated_at)`
- Retirer le toggle global `allow_fan_photos` du compte
- Dans la vue conversation `/messages/$otherId`, ajouter un toggle en header (par utilisateur, par conversation)
- Côté envoi photo : vérifier le réglage de l'autre partie avant d'autoriser l'upload
- Realtime sur `conversation_settings` pour reflet immédiat

## 9. Temps réel partout

Ajouter des canaux Realtime pour :
- `bans` (déjà en place — vérifier)
- `user_roles` (admin toggle en direct)
- `subscriptions` (nouvel abo offert → apparaît immédiatement)
- `conversation_settings` (toggle photos)
- `profiles` (changement thème / avatar)

Publications à ajouter dans une migration : `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.

---

## Détails techniques

- Deps à ajouter : `react-easy-crop`, `libphonenumber-js`
- Nouveau composant : `ActionSlider` (généralisation de `PaymentSlider`)
- Nouveau composant : `ImageCropperModal`
- Nouveau composant : `PhoneInput` (avec sélecteur pays)
- Nouveau composant : `UserSearchPicker` (autocomplete profils)
- Nouveau composant : `SuggestionsPanel` (repliable, sur Accueil)
- Migration SQL : table `conversation_settings` + policies + realtime; drop `profiles.allow_fan_photos` (ou le laisser en no-op)
- `BottomNav` : masquer sur `/auth` et si pas de session
- Router: garde pour rediriger routes protégées → `/auth` si pas connecté

## Livraison

Vu la taille, je fais tout dans cette itération, en gardant les migrations SQL groupées en 1-2 appels. Les changements SQL nécessitent ton approbation avant que je continue le code qui en dépend.

Confirme le plan et je démarre.
