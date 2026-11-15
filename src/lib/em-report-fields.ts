export interface Field {
  key: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "long" | "select" | "checks";
  options?: string[];
}
export interface Section {
  title: string;
  fields: Field[];
}
const f = (
  key: string,
  label: string,
  type: Field["type"] = "select",
  options?: string[],
): Field => ({ key, label, type, options });
const regular = [
  "Oui, très régulièrement",
  "Oui, régulièrement",
  "Occasionnellement",
  "Rarement",
  "Non",
];
const capacity = ["Excellente", "Bonne", "Satisfaisante", "À développer"];
const responsibility = ["Oui, pleinement", "Oui, dans l’ensemble", "Partiellement", "Non"];
const followFrequency = [
  "Chaque semaine",
  "Deux fois par mois",
  "Une fois par mois",
  "Selon les besoins",
];
const appraisal = ["Très satisfaisant", "Satisfaisant", "À renforcer", "Insuffisant"];
const final = [
  "Favorable",
  "Favorable avec recommandations",
  "À revoir après une période supplémentaire de suivi",
  "Défavorable",
];
const commonEnd: Section[] = [
  {
    title: "Appréciation générale",
    fields: [
      f("appreciation", "Appréciation", "select", appraisal),
      f("commentaire", "Commentaire général", "long"),
    ],
  },
  {
    title: "Avis final",
    fields: [
      f("avis", "Avis", "select", final),
      f("observations_finales", "Observations finales", "long"),
      f("lieu", "Lieu", "text"),
      f("date_attestation", "Date", "date"),
      f("cachet", "Mention du cachet de l’Église", "text"),
    ],
  },
];
export const PRAYER_FIELDS: Section[] = [
  {
    title: "IV. Participation à la vie de prière collective",
    fields: [
      f("regularite", "Participation régulière", "select", regular),
      f("activites", "Activités de prière", "checks", [
        "Réunions de prière de l’église",
        "Veillées de prière",
        "Chaînes de prière",
        "Intercession collective",
        "Temps de prière en petits groupes",
        "Programmes spéciaux de prière",
        "Autre",
      ]),
      f("activites_autre", "Autre activité", "text"),
      f("frequence", "Fréquence", "select", [
        "Plusieurs fois par semaine",
        "Une fois par semaine",
        "Deux fois par mois",
        "Une fois par mois",
        "Selon les programmes de l’église",
      ]),
    ],
  },
  {
    title: "V. Implication et responsabilités dans la prière",
    fields: [
      f("responsabilites", "Responsabilités", "checks", [
        "Participe activement aux temps de prière",
        "Conduit des séances de prière",
        "Prépare des sujets de prière",
        "Anime des temps d’intercession",
        "Encourage les autres à participer",
        "Prie pour les malades et les personnes en difficulté",
        "Participe à l’organisation des programmes",
        "Assiste le responsable de prière",
        "Autre",
      ]),
      f("responsabilites_autre", "Autre responsabilité", "text"),
      f("capacite", "Capacité à conduire un groupe", "select", capacity),
      f("responsabilite", "Régularité et responsabilité", "select", responsibility),
    ],
  },
  {
    title: "VI. Suivi et mentorat pastoral",
    fields: [
      f("suivi", "Suivi pastoral", "select", [
        "Oui, régulièrement",
        "Oui, occasionnellement",
        "Non",
      ]),
      f("suivi_frequence", "Fréquence du suivi", "select", followFrequency),
      f("suivi_nature", "Nature du suivi", "checks", [
        "Échanges avec l’étudiant",
        "Participation aux rencontres de prière",
        "Conseils et orientations spirituelles",
        "Encouragements",
        "Corrections et recadrages si nécessaire",
        "Évaluation de sa progression",
        "Autre",
      ]),
      f("suivi_autre", "Autre suivi", "text"),
      f("dernier_suivi", "Date du dernier suivi", "date"),
    ],
  },
  {
    title: "VII. Progression et fruits observés",
    fields: [
      f("fruits", "Progrès observés", "checks", [
        "Plus grande régularité dans la prière",
        "Meilleure implication dans les activités spirituelles",
        "Progression dans la conduite des temps de prière",
        "Capacité accrue à intercéder",
        "Meilleure connaissance des sujets de prière",
        "Plus grande assurance dans la prière collective",
        "Capacité à encourager et mobiliser les autres",
        "Évolution de son engagement spirituel",
        "Autre",
      ]),
      f("progres", "Précisions sur les progrès", "long"),
    ],
  },
  {
    title: "VIII. Difficultés rencontrées",
    fields: [
      f("difficultes", "Difficultés", "checks", [
        "Aucune difficulté",
        "Manque de régularité",
        "Indisponibilité",
        "Manque d’implication",
        "Difficulté à conduire la prière",
        "Difficulté à mobiliser les autres",
        "Autre",
      ]),
      f("recommandations", "Précisions et recommandations du Pasteur / Mentor", "long"),
    ],
  },
  ...commonEnd,
];
export const CELL_FIELDS: Section[] = [
  {
    title: "IV. Implantation de la cellule",
    fields: [
      f("implantation", "L’étudiant a-t-il implanté une cellule ?", "select", [
        "Oui",
        "Non",
        "En cours d’implantation",
      ]),
      f("date_debut", "Date de début", "date"),
      f("quartier", "Lieu / Quartier", "text"),
      f("adresse", "Adresse ou point de localisation", "text"),
      f("zone", "Zone", "select", [
        "Dans le quartier de résidence",
        "Dans un autre quartier",
        "Dans une localité différente",
        "Autre",
      ]),
      f("validation_pasteur", "Validation du Pasteur", "select", ["Oui", "Non", "En attente"]),
    ],
  },
  {
    title: "V. Organisation et fonctionnement",
    fields: [
      f("jour", "Jour habituel", "select", [
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
        "Dimanche",
      ]),
      f("heure_debut", "Heure de début", "time"),
      f("heure_fin", "Heure de fin", "time"),
      f("frequence", "Fréquence", "select", [
        "Chaque semaine",
        "Deux fois par semaine",
        "Plusieurs fois par mois",
        "Autre",
      ]),
      f("lieu_habituel", "Lieu habituel", "select", [
        "Domicile",
        "Espace communautaire",
        "Local de l’église",
        "Autre",
      ]),
      f("participants", "Participants réguliers", "number"),
      f("personnes_touchees", "Personnes invitées ou touchées", "number"),
      f("organisation", "Organisation définie", "select", ["Oui", "Non", "En cours"]),
      f("description", "Description du fonctionnement", "long"),
    ],
  },
  {
    title: "VI. Activités menées",
    fields: [
      f("activites", "Activités", "checks", [
        "Prière d’intercession",
        "Prière pour les familles",
        "Prière pour l’Église",
        "Prière pour les malades",
        "Prière pour les autorités et la nation",
        "Évangélisation et prière pour le salut des âmes",
        "Prière pour les besoins des participants",
        "Étude de la Parole accompagnée de prière",
        "Témoignages et partages",
        "Autre",
      ]),
      f("activites_autre", "Autres activités", "text"),
    ],
  },
  {
    title: "VII. Rôle et responsabilités de l’étudiant",
    fields: [
      f("responsabilites", "Responsabilités", "checks", [
        "Coordonne les rencontres",
        "Conduit les temps de prière",
        "Prépare les sujets",
        "Enseigne ponctuellement la Parole",
        "Mobilise les participants",
        "Assure leur suivi",
        "Encourage leur participation",
        "Organise des actions d’évangélisation",
        "Identifie et accompagne de nouveaux participants",
        "Travaille sous la supervision du Pasteur / Mentor",
        "Autre",
      ]),
      f("responsabilites_autre", "Autres responsabilités", "text"),
      f("capacite", "Capacité d’organisation", "select", capacity),
      f("regularite", "Régularité", "select", responsibility),
    ],
  },
  {
    title: "VIII. Suivi et mentorat pastoral",
    fields: [
      f("suivi", "Suivi pastoral", "select", [
        "Suivi régulier",
        "Suivi occasionnel",
        "Aucun suivi",
      ]),
      f("suivi_frequence", "Fréquence du suivi", "select", followFrequency),
      f("suivi_nature", "Nature du suivi", "checks", [
        "Échanges avec l’étudiant",
        "Participation à une rencontre",
        "Évaluation du fonctionnement",
        "Orientation spirituelle",
        "Correction / recadrage",
        "Encouragement et accompagnement",
        "Autre",
      ]),
      f("suivi_autre", "Autre suivi", "text"),
      f("dernier_suivi", "Date du dernier suivi", "date"),
    ],
  },
  {
    title: "IX. Fruits et évolution",
    fields: [
      f("fruits", "Fruits observés", "checks", [
        "Augmentation du nombre de participants",
        "Régularité accrue",
        "Croissance spirituelle",
        "Meilleure connaissance de la Parole",
        "Personnes conduites à Christ",
        "Intégration de nouveaux membres dans l’église",
        "Développement de nouveaux responsables",
        "Implication accrue dans l’évangélisation",
        "Dynamique de prière qui s’étend dans la zone",
        "Autre",
      ]),
      f("progres", "Description des fruits observés", "long"),
    ],
  },
  {
    title: "X. Difficultés rencontrées",
    fields: [
      f("difficultes", "Difficultés", "checks", [
        "Mobilisation des participants",
        "Régularité des rencontres",
        "Disponibilité",
        "Organisation",
        "Encadrement pastoral",
        "Localisation",
        "Difficultés liées aux participants",
        "Autre",
      ]),
      f("recommandations", "Précisions et recommandations", "long"),
    ],
  },
  ...commonEnd,
];
export const GUARD_FIELDS: Section[] = [
  {
    title: "II. Informations sur la tour de garde",
    fields: [
      f("date", "Date", "date"),
      f("heure_prevue", "Heure prévue", "time"),
      f("heure_effective", "Heure effective", "time"),
      f("theme", "Thème ou sujet de prière", "text"),
      f("mode", "Mode de participation", "select", ["Présentiel", "En ligne", "Autre"]),
      f("mode_autre", "Autre mode", "text"),
    ],
  },
  {
    title: "IV. Évaluation de l’étudiant responsable de la prière",
    fields: [
      f("sujet_confie", "Thème ou sujet confié", "text"),
      ...[
        "Préparation et maîtrise du sujet",
        "Respect du thème et des orientations",
        "Clarté et cohérence dans la conduite",
        "Capacité à conduire et mobiliser les participants",
        "Gestion du temps",
        "Attitude, discipline et responsabilité",
      ].map((label, i) =>
        f(`evaluation_${i}`, label, "select", ["Très satisfaisant", "Satisfaisant", "À améliorer"]),
      ),
      f("observations", "Observations et remarques", "long"),
      f("points_forts", "Points forts", "long"),
      f("points_ameliorer", "Points à améliorer", "long"),
      f("accompagnement", "Recommandations et accompagnement souhaité", "long"),
    ],
  },
  {
    title: "V. Évaluation générale de la classe",
    fields: [
      f("niveau", "Niveau global", "select", ["Très bon", "Bon", "Moyen", "Faible"]),
      f("horaires", "Respect des horaires", "select", ["Oui", "Partiellement", "Non"]),
      f("engagement", "Engagement dans les sujets", "select", ["Bon", "Moyen", "Faible"]),
      f("sequences", "Des étudiants ont-ils conduit des séquences de prière ?", "select", [
        "Oui",
        "Non",
      ]),
    ],
  },
  {
    title: "VI. Difficultés rencontrées",
    fields: [
      "Absences",
      "Retards",
      "Faible participation",
      "Difficultés de connexion",
      "Indisponibilité",
      "Difficultés d’organisation",
      "Autres observations",
    ].map((label, i) => f(`difficulte_${i}`, label, "long")),
  },
  {
    title: "VII. Recommandations du mentor",
    fields: [
      f("dispositions", "Dispositions proposées pour améliorer la participation", "long"),
      f("suivi_particulier", "Étudiants nécessitant un suivi particulier et raisons", "long"),
      f("recommandations", "Autres recommandations à l’administration de l’EM", "long"),
    ],
  },
];
export const OBJECTS: Record<string, string> = {
  priere:
    "Le présent rapport est établi dans le cadre du mentorat pratique de l'étudiant(e) de l'École du Ministère. Il vise à apprécier son engagement dans la vie de prière collective, sa régularité, sa participation aux rencontres de prière, son sens des responsabilités ainsi que sa progression dans la pratique de la prière communautaire.",
  cellule:
    "Le présent rapport est établi dans le cadre du mentorat pratique de l'étudiant(e) de l'École du Ministère, notamment en ce qui concerne sa capacité à implanter et à développer une cellule de prière dans son environnement. Il vise à permettre à l'administration de l'EM d'apprécier son engagement, son sens de l'initiative, ses capacités d'organisation, de mobilisation et d'encadrement, ainsi que les fruits issus de cette implantation.",
  garde:
    "Le présent rapport est établi dans le cadre du mentorat pratique des étudiants de l'École du Ministère et du suivi de leur participation aux tours de garde hebdomadaires organisés par classe. Il vise à apprécier la régularité, la ponctualité et le niveau d'implication de chaque étudiant dans les temps de prière, ainsi que sa capacité à participer activement à la vie spirituelle collective. Il permet également d'évaluer l'étudiant désigné pour conduire la tour de garde, notamment sa préparation, sa maîtrise du sujet de prière, sa capacité à conduire et à mobiliser les participants, ainsi que son sens de la discipline et des responsabilités. Ce rapport constitue un outil de suivi, d'évaluation et d'accompagnement pastoral destiné à favoriser la progression spirituelle et pratique des étudiants dans le cadre de leur formation à l'École du Ministère.",
};
export function attestation(
  type: string,
  nom: string,
  temple: string,
  student: string,
  classe: string,
) {
  const dots = "................................";
  if (type === "garde")
    return `Je soussigné(e), ${nom || dots}, Mentor de la classe ${classe || dots}, certifie que les informations contenues dans ce rapport sont conformes à mes observations et au suivi effectué durant cette tour de garde hebdomadaire. Je confirme avoir renseigné les informations relatives à la présence, à la ponctualité et à la participation des étudiants de ma classe, ainsi que l'évaluation de l'étudiant désigné pour conduire la prière. Je porte également à la connaissance de l'administration de l'École du Ministère les éventuelles difficultés et observations relatives à la participation des étudiants ainsi qu'à la conduite de la prière par l'étudiant désigné. Je certifie que les appréciations formulées dans ce rapport sont objectives, constructives et fondées sur les faits observés. Elles visent à favoriser la progression des étudiants dans leur engagement et leur service. Le présent rapport est transmis à l'administration de l'École du Ministère pour servir dans le cadre du suivi, du mentorat et de l'évaluation du parcours pratique des étudiants.`;
  return `Je soussigné(e), Pasteur ${nom || dots}, Pasteur Principal de l'Église ${temple || dots}, certifie avoir connaissance ${type === "priere" ? `de l'engagement de l'étudiant(e) ${student || dots} dans les activités de prière collective de notre communauté.` : `de la démarche d'implantation de la cellule de prière par l'étudiant(e) ${student || dots}.`} Je confirme que les informations renseignées dans le présent rapport correspondent, à ma connaissance, à la réalité ${type === "priere" ? "de sa participation et de son implication." : "du travail effectué par l'étudiant(e) dans la zone concernée."} Je reconnais également que ${type === "priere" ? "cet accompagnement s'effectue sous la couverture et l'encadrement spirituels de l'église locale." : "cette démarche s'effectue sous la couverture et l'encadrement spirituels de l'église locale, et je m'engage, avec l'équipe pastorale, à accompagner l'étudiant(e) dans le développement et le suivi de cette cellule."} Le présent rapport est délivré à l'École du Ministère pour servir dans le cadre du suivi, du mentorat et de la validation du parcours pratique de l'étudiant(e).`;
}
