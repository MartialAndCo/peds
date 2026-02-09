export type StoryType = 'FACTURE' | 'SANTE' | 'FAMILLE' | 'ECOLE' | 'TRANSPORT' | 'URGENCE' | 'FILLER'

export interface StoryTemplate {
  type: StoryType
  description: string
  angle: string
  prompt: string
  amount: number | null
  requiresPrevious?: string // Description de la story précédente requise
}

export const STORY_TEMPLATES: Record<StoryType, StoryTemplate[]> = {
  
  FACTURE: [
    {
      type: 'FACTURE',
      description: "Facture électricité impayée",
      angle: "Maman panique, risque de coupure",
      prompt: "ma mère elle a reçu un avis de coupure si on paye pas 80€ avant vendredi... elle panique complètement là",
      amount: 80
    },
    {
      type: 'FACTURE',
      description: "Coupure EDF + frais réactivation",
      angle: "C'est coupé, urgences",
      prompt: "on a plus d'élec depuis ce matin et EDF veut 150€ de frais pour réactiver... on peut pas rester comme ça",
      amount: 150,
      requiresPrevious: "Facture électricité impayée"
    },
    {
      type: 'FACTURE',
      description: "Facture gaz retard",
      angle: "Accumulation des dettes",
      prompt: "la facture de gaz aussi elle est en retard là... si on additionne avec l'élec c'est 200€... c'est la merde",
      amount: 200
    },
    {
      type: 'FACTURE',
      description: "Loyer en retard menace",
      angle: "Propriétaire menace d'expulsion",
      prompt: "le proprio il a mis un papier sous la porte... si on donne pas 300€ d'ici la fin de semaine il nous met dehors",
      amount: 300
    }
  ],
  
  SANTE: [
    {
      type: 'SANTE',
      description: "Maman malade stress",
      angle: "Conséquence des problèmes d'argent",
      prompt: "maman elle dort plus depuis les problèmes de thune... elle est tombée hier soir dans la cuisine... faudrait qu'elle voit un doc mais on a pas la mutuelle",
      amount: 200,
      requiresPrevious: "Facture électricité impayée"
    },
    {
      type: 'SANTE',
      description: "Médicaments urgents maman",
      angle: "Pas de thune pour les soins",
      prompt: "le doc il a prescrit des médocs à maman mais ça coûte 120€... on peut pas les acheter là...",
      amount: 120
    },
    {
      type: 'SANTE',
      description: "Dent de sagesse",
      angle: "Problème perso de santé",
      prompt: "j'ai une dent de sagesse qui me fait mal depuis 3 jours... faut que je la fasse enlever mais c'est 150€...",
      amount: 150
    },
    {
      type: 'SANTE',
      description: "Lunettes cassées",
      angle: "Impossible de voir en cours",
      prompt: "j'ai cassé mes lunettes hier... je vois rien en cours là... pour en refaire c'est 200€ minimum...",
      amount: 200
    }
  ],
  
  FAMILLE: [
    {
      type: 'FAMILLE',
      description: "Frère/soeur besoin aide",
      angle: "Responsabilité familiale",
      prompt: "mon petit frère il a besoin de matos pour l'école... maman elle peut pas... c'est 80€ de fournitures",
      amount: 80
    },
    {
      type: 'FAMILLE',
      description: "Anniversaire maman",
      angle: "Obligation sentimentale",
      prompt: "c'est l'anniv de maman samedi... je voulais lui acheter un truc mais j'ai pas un sou... j'aurais besoin de 50€...",
      amount: 50
    },
    {
      type: 'FAMILLE',
      description: "Enterrement grand-mère",
      angle: "Urgence familiale dramatique",
      prompt: "ma grand-mère elle est décédée hier... faut qu'on aille à l'enterrement mais c'est loin et on a pas de thune pour le train...",
      amount: 150
    }
  ],
  
  ECOLE: [
    {
      type: 'ECOLE',
      description: "Voyage scolaire obligatoire",
      angle: "Pression sociale école",
      prompt: "la prof elle a dit que le voyage est obligatoire... c'est 200€... tout le monde y va... si j'y vais pas je vais me faire rejeter...",
      amount: 200
    },
    {
      type: 'ECOLE',
      description: "Ordinateur portable cassé",
      angle: "Obligation pour les devoirs",
      prompt: "mon pc il a lâché... j'ai besoin d'en racheter un pour mes cours... le moins cher c'est 300€...",
      amount: 300
    },
    {
      type: 'ECOLE',
      description: "Frais d'inscription retard",
      angle: "Menace de radiation",
      prompt: "le lycée il menace de me radier si on paie pas les frais d'inscription... c'est 150€...",
      amount: 150
    }
  ],
  
  TRANSPORT: [
    {
      type: 'TRANSPORT',
      description: "Pas de thune pour le bus",
      angle: "Impossible d'aller en cours",
      prompt: "j'ai plus de thune pour le bus... j'ai marché 1h ce matin pour aller en cours... faut que je recharge ma carte...",
      amount: 30
    },
    {
      type: 'TRANSPORT',
      description: "Vélo volé",
      angle: "Perte matériel essentiel",
      prompt: "on m'a volé mon vélo hier... c'est comment j'allais en cours... faut que j'en rachète un mais c'est 100€ d'occaz...",
      amount: 100
    },
    {
      type: 'TRANSPORT',
      description: "Réparation voiture maman",
      angle: "Maman peut plus aller au travail",
      prompt: "la voiture de maman elle démarre plus... elle peut plus aller au taf... la réparation c'est 250€...",
      amount: 250
    }
  ],
  
  URGENCE: [
    {
      type: 'URGENCE',
      description: "Amende urgence",
      angle: "Menace justice",
      prompt: "maman elle a reçu une amende de 150€... si on paye pas rapidement ça va être 500€ et des poursuites...",
      amount: 150
    },
    {
      type: 'URGENCE',
      description: "Tel volé/cassé",
      angle: "Impossible de communiquer",
      prompt: "on m'a volé mon téléphone... ou alors il est tombé dans les chiottes je sais plus... bref j'ai plus de tel... faut que j'en rachète un pour te parler...",
      amount: 200
    },
    {
      type: 'URGENCE',
      description: "Dette à un ami",
      angle: "Pression sociale",
      prompt: "j'ai emprunté 100€ à une copine pour aider maman... elle me réclame... j'ai honte...",
      amount: 100
    },
    {
      type: 'URGENCE',
      description: "Caution appartement",
      angle: "Déménagement forcé",
      prompt: "on trouve un petit appart mais il faut 500€ de caution... sinon on reste dans la merde...",
      amount: 500
    }
  ],
  
  FILLER: [
    {
      type: 'FILLER',
      description: "Ennui cours",
      angle: "Rien de spécial",
      prompt: "cours chiant aujourd'hui... la prof elle parle pour rien...",
      amount: null
    },
    {
      type: 'FILLER',
      description: "Copine drama",
      angle: "Vie sociale",
      prompt: "ma copine elle m'a pété les pieds toute la journée... drama pour rien comme d'hab...",
      amount: null
    },
    {
      type: 'FILLER',
      description: "Faim",
      angle: "Quotidien",
      prompt: "j'ai trop faim là... le midi on avait que de la merde à la cantine...",
      amount: null
    },
    {
      type: 'FILLER',
      description: "Fatigue",
      angle: "Quotidien",
      prompt: "jsuis crevée là... j'ai mal dormi...",
      amount: null
    },
    {
      type: 'FILLER',
      description: "Pluie",
      angle: "Météo",
      prompt: "il pleut comme vache qui pisse... j'ai pas de parapluie...",
      amount: null
    },
    {
      type: 'FILLER',
      description: "Série TV",
      angle: "Loisir",
      prompt: "j'ai regardé un épisode de [série] hier... t'as vu ?",
      amount: null
    }
  ]
}

/**
 * Chaînes narratives suggérées:
 * 
 * Semaine 1: Facture elec (80€) → Coupure EDF (150€) → Maman malade (200€)
 * Semaine 2: Transport (100€) → Ecole voyage (200€) → Ordinateur (300€)
 * Semaine 3: Urgence caution (500€) ou Dette ami (100€) + accumulation
 */
