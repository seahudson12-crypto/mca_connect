# École du Ministère — compte rendu

## Fonctionnalités créées
- Neuf pages EM : tableau de bord, étudiants, classes, mentors, prière collective, cellules, tours de garde, rapports et évaluations, années académiques.
- Classes CPEM, P1, P2, P3, P4 et P5 ; inscriptions liées aux fiches membres existantes ; recherche par pays, temple, nom et matricule.
- Statuts d’inscription, transferts de classe historisés et changement annuel créant une nouvelle inscription sans déplacer les anciens rapports.
- Permission MENTOR EM indépendante des rôles existants, avec affectations par classe et année ; aucune attribution automatique.
- Trois formulaires avec textes officiels reçus, brouillons, attestations électroniques, soumission, décisions et réouverture motivée.
- Tours de garde avec toutes les lignes d’étudiants actifs, présences P/A/J, ponctualité, participation, six critères d’évaluation et compteurs calculés.
- Statistiques filtrées par année, pays, temple, classe, mentor et statut ; erreur et liste vide distinguées.
- Impression des rapports via la fenêtre d’impression du navigateur, permettant l’enregistrement PDF.

## Stockage ajouté et réutilisé
Six tables complémentaires : `em_years`, `em_mentors`, `em_assignments`, `em_enrollments`, `em_reports`, `em_audit`.
Les classes officielles sont des codes contraints, sans table ni lignes artificielles. Les présences, évaluations et champs des formulaires sont conservés dans le contenu structuré de chaque rapport.
Réutilisation de `membres`, `temples`, `pays`, `profiles` et `user_roles` en lecture, sans recréer les fiches ni modifier leurs matricules.

## Sécurité
RLS activée sur les six tables ; aucune lecture anonyme.
Le Super Admin Principal gère les admissions, années, affectations et décisions finales.
L’Admin Temple voit ses étudiants et rapports pastoraux ; il ne valide pas les rapports.
Le mentor voit les étudiants des classes et années attribuées, tous temples confondus, et ne remplit que les tours de garde concernés.
Les autres utilisateurs n’ont pas d’accès EM implicite. Les accès habituels hors EM restent inchangés.
Les contrôles sont appliqués côté serveur et dans la base, y compris les appels directs, auteurs, verrouillages, attestations, évaluations et doublons.
Le journal est en lecture seule pour les utilisateurs ; les événements sont enregistrés par les actions et déclencheurs autorisés.

## Vérifications
17 tests automatisés réussis : les onze scénarios du cahier des charges dans une base PostgreSQL isolée, la conservation des inscriptions annuelles, les classes officielles, les calculs et verrouillages, ainsi que les deux tests existants du Centre de Pilotage.
Les migrations EM exactes sont exécutées dans cette base isolée pour vérifier réellement les politiques, fonctions et déclencheurs sans créer de données fictives dans MCA CONNECT.
Les neuf pages ont été ouvertes avec le compte principal ; le formulaire d’année accepte ses valeurs ; aucune erreur d’exécution ; aucun débordement horizontal sur téléphone.
Les pages Membres et Temples existantes s’ouvrent toujours.
Dernière lecture de la base réelle : 58 membres, trois temples, trois pays, aucune année ni inscription EM. Aucun test n’a créé de membre, d’année ou de rapport fictif en production ; le nombre de membres a évolué entre les lectures pendant le travail.

## Limites de vérification et prochaine étape
Créer la première année avec ses dates réelles, puis les premières inscriptions et affectations réelles.
Le parcours complet dans les écrans avec des données enregistrées et les comptes pasteur/mentor n’a pas été vérifié : seules les règles correspondantes ont été validées dans la base isolée.
L’impression/PDF d’un rapport réel reste à vérifier après son premier enregistrement.
Les changements du site ne sont pas publiés automatiquement.