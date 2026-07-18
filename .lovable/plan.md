
## 1. Animation continue du logo (un seul et même SVG)

Aujourd'hui `HushLoader` dessine le logo, puis on démonte le composant et un autre `HushLogo` apparaît ailleurs. Je remplace ça par un **logo unique persistant** (`GlobalLogo`) monté au niveau du shell, positionné en `fixed`, qui :

1. Se dessine (stroke → fill) au centre de l'écran (comme aujourd'hui).
2. **Sans démontage**, s'anime (transform: translate + scale via FLIP) vers sa position finale :
   - Si non connecté → position/taille du logo de la page `/auth` (centré haut).
   - Si connecté → coin haut-gauche petit format (nouveau header discret ajouté à la home / partagé).
3. Toute la nav est masquée (opacité 0) le temps de l'anim, puis fade-in.

Le `<HushLogo>` inline sur `/auth` et sur la home est retiré : on lit la bounding-box d'un placeholder invisible (`data-logo-anchor="auth" | "app"`) pour calculer la transform cible. Aucun second logo n'apparaît.

## 2. Refonte messagerie

Bugs actuels : côté créateur les conversations n'apparaissent pas (RLS + jointure via nom de FK fragile), pas d'accès aux messages reçus, PPV côté paiement absent.

Refonte :
- **Nouvelle requête liste** : deux `select` séparés (fan / creator) puis merge, ou RPC `list_my_conversations` en security definer qui renvoie {conv, other_profile, last_message, unread_count}. Fini les jointures par nom de FK.
- **RLS conversations** : vérifie que `SELECT` est ouvert aux deux parties (`fan_id = auth.uid() OR creator_id = auth.uid()`). Idem `messages`.
- **Realtime** : abonnement global côté liste (`INSERT` messages où conv_id ∈ mes convs) → la conv remonte + badge instantané.
- **PPV photos** :
  - Par défaut `allow_photos_from_other = false` pour les deux côtés à la création de la conv (migration + trigger sur `INSERT conversations`).
  - Seul le créateur voit le toggle "autoriser les photos du fan" ; le fan ne peut envoyer une photo que si le créateur a activé.
  - Le créateur peut toujours envoyer, avec prix PPV.
  - Paiement PPV directement dans le chat via **Stripe Checkout** (déjà `stripe-checkout` avec `kind: "message_media"`). Après retour `?paid=1&message_id=…`, le webhook insère dans `message_media_purchases` et realtime déverrouille la photo sans rechargement.

## 3. Zoom bloqué

- Meta viewport: `maximum-scale=1, user-scalable=no` (déjà partiellement en place — je vérifie et complète avec `touch-action: manipulation` sur `body` + CSS `-webkit-text-size-adjust: 100%`).

## 4. Programme Ambassadeur

- Migration : nouveau `role` enum value `ambassador` **ou** colonne `profiles.is_ambassador boolean` (plus simple, plus rapide côté UI). Je prends la colonne, avec RLS : lecture publique, écriture réservée aux admins via policy `has_role(auth.uid(), 'admin')`.
- Badge visuel distinctif (étoile + gradient or) affiché partout où l'on montre un profil : header profil créateur, feed, liste messages, résultats de recherche, admin.
- Toggle dans le panneau admin sur chaque utilisateur.

## 5. Refonte panneau admin (multi-onglets)

Nouvel `admin.tsx` avec onglets :

1. **Vue d'ensemble** — KPI globaux (users, créateurs, ambassadeurs, posts, revenus totaux 30j, MRR abonnements, messages/j).
2. **Utilisateurs** — recherche existante + toggle ambassadeur, ban, admin, offrir abo, **voir les stats du user** (modal : nb posts, nb abonnés, revenus, dernière activité).
3. **Créateurs** — top créateurs par revenus/abonnés, tableau triable.
4. **Contenu** — liste des derniers posts avec possibilité de supprimer, voir signalements (table `post_reports` à créer).
5. **Finances** — table des achats (abonnements, PPV posts, PPV messages) filtrables.
6. **Signalements** — nouvelle table `reports` (user peut signaler post/profil/message) + modération.

Toutes les données via RPC security definer `admin_*` protégées par `has_role(auth.uid(),'admin')`. Realtime sur les tables concernées pour refresh live.

### Technique
- Migrations : `is_ambassador`, `reports`, RPCs `admin_overview_stats`, `admin_user_stats`, `admin_top_creators`, `admin_recent_purchases`, `list_my_conversations`, trigger `conversations_default_photo_settings`.
- Composants : `GlobalLogo`, `AdminTabs`, `AmbassadorBadge`, `StatCard`, `AdminUserStatsModal`.
- Realtime channels sur `posts`, `subscriptions`, `messages`, `post_purchases`, `message_media_purchases`, `bans`, `profiles`, `reports`.

Je confirme le plan et j'enchaîne : migrations d'abord (une seule), puis code frontend + composants dans la foulée.
