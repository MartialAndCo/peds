export type StoryType = 'FACTURE' | 'SANTE' | 'FAMILLE' | 'ECOLE' | 'TRANSPORT' | 'URGENCE' | 'FILLER'

export interface StoryTemplate {
  type: StoryType
  description: string
  descriptionEn: string
  angle: string
  angleEn: string
  prompt: string
  promptEn: string
  amount: number | null
  requiresPrevious?: string // Description FR de la story précédente requise
  requiresPreviousEn?: string // Description EN de la story précédente requise
}

// Helper pour créer une story bilingue
function createStory(template: {
  type: StoryType
  descriptionFr: string
  descriptionEn: string
  angleFr: string
  angleEn: string
  promptFr: string
  promptEn: string
  amount: number | null
  requiresPreviousFr?: string
  requiresPreviousEn?: string
}): StoryTemplate {
  return {
    type: template.type,
    description: template.descriptionFr,
    descriptionEn: template.descriptionEn,
    angle: template.angleFr,
    angleEn: template.angleEn,
    prompt: template.promptFr,
    promptEn: template.promptEn,
    amount: template.amount,
    requiresPrevious: template.requiresPreviousFr,
    requiresPreviousEn: template.requiresPreviousEn
  }
}

export const STORY_TEMPLATES: Record<StoryType, StoryTemplate[]> = {
  
  FACTURE: [
    createStory({
      type: 'FACTURE',
      descriptionFr: "Facture électricité impayée",
      descriptionEn: "Unpaid electricity bill",
      angleFr: "Maman panique, risque de coupure",
      angleEn: "Mom panicking, risk of power cut",
      promptFr: "ma mère elle a reçu un avis de coupure si on paye pas 80€ avant vendredi... elle panique complètement là",
      promptEn: "my mom got a disconnection notice... we need to pay $85 before friday or they cut our power... she's freaking out",
      amount: 80
    }),
    createStory({
      type: 'FACTURE',
      descriptionFr: "Coupure EDF + frais réactivation",
      descriptionEn: "Power cut + reactivation fees",
      angleFr: "C'est coupé, urgences",
      angleEn: "It's cut off, emergency",
      promptFr: "on a plus d'élec depuis ce matin et EDF veut 150€ de frais pour réactiver... on peut pas rester comme ça",
      promptEn: "we have no power since this morning and they want $160 reactivation fee... we can't stay like this",
      amount: 150,
      requiresPreviousFr: "Facture électricité impayée",
      requiresPreviousEn: "Unpaid electricity bill"
    }),
    createStory({
      type: 'FACTURE',
      descriptionFr: "Facture gaz retard",
      descriptionEn: "Gas bill overdue",
      angleFr: "Accumulation des dettes",
      angleEn: "Debt accumulation",
      promptFr: "la facture de gaz aussi elle est en retard là... si on additionne avec l'élec c'est 200€... c'est la merde",
      promptEn: "the gas bill is late too... if we add everything it's like $210... we're screwed",
      amount: 200
    }),
    createStory({
      type: 'FACTURE',
      descriptionFr: "Loyer en retard menace",
      descriptionEn: "Late rent threat",
      angleFr: "Propriétaire menace d'expulsion",
      angleEn: "Landlord threatening eviction",
      promptFr: "le proprio il a mis un papier sous la porte... si on donne pas 300€ d'ici la fin de semaine il nous met dehors",
      promptEn: "the landlord put a notice under our door... if we don't pay $320 by end of week we're getting evicted",
      amount: 300
    })
  ],
  
  SANTE: [
    createStory({
      type: 'SANTE',
      descriptionFr: "Maman malade stress",
      descriptionEn: "Mom sick from stress",
      angleFr: "Conséquence des problèmes d'argent",
      angleEn: "Consequence of money problems",
      promptFr: "maman elle dort plus depuis les problèmes de thune... elle est tombée hier soir dans la cuisine... faudrait qu'elle voit un doc mais on a pas la mutuelle",
      promptEn: "mom can't sleep since our money problems... she fell in the kitchen last night... she needs to see a doctor but we don't have insurance",
      amount: 200,
      requiresPreviousFr: "Facture électricité impayée",
      requiresPreviousEn: "Unpaid electricity bill"
    }),
    createStory({
      type: 'SANTE',
      descriptionFr: "Médicaments urgents maman",
      descriptionEn: "Mom's urgent medication",
      angleFr: "Pas de thune pour les soins",
      angleEn: "No money for healthcare",
      promptFr: "le doc il a prescrit des médocs à maman mais ça coûte 120€... on peut pas les acheter là...",
      promptEn: "the doc prescribed meds for mom but it's $130... we can't afford them right now...",
      amount: 120
    }),
    createStory({
      type: 'SANTE',
      descriptionFr: "Dent de sagesse",
      descriptionEn: "Wisdom tooth pain",
      angleFr: "Problème perso de santé",
      angleEn: "Personal health issue",
      promptFr: "j'ai une dent de sagesse qui me fait mal depuis 3 jours... faut que je la fasse enlever mais c'est 150€...",
      promptEn: "my wisdom tooth has been hurting for 3 days... need to get it removed but it's $160...",
      amount: 150
    }),
    createStory({
      type: 'SANTE',
      descriptionFr: "Lunettes cassées",
      descriptionEn: "Broken glasses",
      angleFr: "Impossible de voir en cours",
      angleEn: "Can't see in class",
      promptFr: "j'ai cassé mes lunettes hier... je vois rien en cours là... pour en refaire c'est 200€ minimum...",
      promptEn: "i broke my glasses yesterday... i can't see anything in class... need $210 for new ones...",
      amount: 200
    })
  ],
  
  FAMILLE: [
    createStory({
      type: 'FAMILLE',
      descriptionFr: "Frère/soeur besoin aide",
      descriptionEn: "Sibling needs help",
      angleFr: "Responsabilité familiale",
      angleEn: "Family responsibility",
      promptFr: "mon petit frère il a besoin de matos pour l'école... maman elle peut pas... c'est 80€ de fournitures",
      promptEn: "my little brother needs school supplies... mom can't afford it... it's $85 for materials",
      amount: 80
    }),
    createStory({
      type: 'FAMILLE',
      descriptionFr: "Anniversaire maman",
      descriptionEn: "Mom's birthday",
      angleFr: "Obligation sentimentale",
      angleEn: "Emotional obligation",
      promptFr: "c'est l'anniv de maman samedi... je voulais lui acheter un truc mais j'ai pas un sou... j'aurais besoin de 50€...",
      promptEn: "it's mom's birthday saturday... wanted to get her something but i'm broke... need like $55...",
      amount: 50
    }),
    createStory({
      type: 'FAMILLE',
      descriptionFr: "Enterrement grand-mère",
      descriptionEn: "Grandmother's funeral",
      angleFr: "Urgence familiale dramatique",
      angleEn: "Family emergency",
      promptFr: "ma grand-mère elle est décédée hier... faut qu'on aille à l'enterrement mais c'est loin et on a pas de thune pour le train...",
      promptEn: "my grandma passed away yesterday... we need to go to the funeral but it's far and we have no money for the train...",
      amount: 150
    })
  ],
  
  ECOLE: [
    createStory({
      type: 'ECOLE',
      descriptionFr: "Voyage scolaire obligatoire",
      descriptionEn: "Mandatory school trip",
      angleFr: "Pression sociale école",
      angleEn: "School social pressure",
      promptFr: "la prof elle a dit que le voyage est obligatoire... c'est 200€... tout le monde y va... si j'y vais pas je vais me faire rejeter...",
      promptEn: "teacher said the trip is mandatory... it's $210... everyone is going... if i don't go i'll be left out...",
      amount: 200
    }),
    createStory({
      type: 'ECOLE',
      descriptionFr: "Ordinateur portable cassé",
      descriptionEn: "Broken laptop",
      angleFr: "Obligation pour les devoirs",
      angleEn: "Need it for homework",
      promptFr: "mon pc il a lâché... j'ai besoin d'en racheter un pour mes cours... le moins cher c'est 300€...",
      promptEn: "my laptop died... need to buy a new one for school... cheapest is $320...",
      amount: 300
    }),
    createStory({
      type: 'ECOLE',
      descriptionFr: "Frais d'inscription retard",
      descriptionEn: "Late registration fees",
      angleFr: "Menace de radiation",
      angleEn: "Threat of expulsion",
      promptFr: "le lycée il menace de me radier si on paie pas les frais d'inscription... c'est 150€...",
      promptEn: "school is threatening to kick me out if we don't pay the registration fees... it's $160...",
      amount: 150
    })
  ],
  
  TRANSPORT: [
    createStory({
      type: 'TRANSPORT',
      descriptionFr: "Pas de thune pour le bus",
      descriptionEn: "No money for bus",
      angleFr: "Impossible d'aller en cours",
      angleEn: "Can't get to school",
      promptFr: "j'ai plus de thune pour le bus... j'ai marché 1h ce matin pour aller en cours... faut que je recharge ma carte...",
      promptEn: "i have no money for the bus... walked an hour this morning to get to school... need to reload my card...",
      amount: 30
    }),
    createStory({
      type: 'TRANSPORT',
      descriptionFr: "Vélo volé",
      descriptionEn: "Bike stolen",
      angleFr: "Perte matériel essentiel",
      angleEn: "Lost essential equipment",
      promptFr: "on m'a volé mon vélo hier... c'est comment j'allais en cours... faut que j'en rachète un mais c'est 100€ d'occaz...",
      promptEn: "someone stole my bike yesterday... that's how i got to school... need to buy another one but it's $110 used...",
      amount: 100
    }),
    createStory({
      type: 'TRANSPORT',
      descriptionFr: "Réparation voiture maman",
      descriptionEn: "Mom's car repair",
      angleFr: "Maman peut plus aller au travail",
      angleEn: "Mom can't get to work",
      promptFr: "la voiture de maman elle démarre plus... elle peut plus aller au taf... la réparation c'est 250€...",
      promptEn: "mom's car won't start... she can't get to work... repair is $260...",
      amount: 250
    })
  ],
  
  URGENCE: [
    createStory({
      type: 'URGENCE',
      descriptionFr: "Amende urgence",
      descriptionEn: "Urgent fine payment",
      angleFr: "Menace justice",
      angleEn: "Legal threat",
      promptFr: "maman elle a reçu une amende de 150€... si on paye pas rapidement ça va être 500€ et des poursuites...",
      promptEn: "mom got a $160 fine... if we don't pay quickly it'll be $520 plus legal action...",
      amount: 150
    }),
    createStory({
      type: 'URGENCE',
      descriptionFr: "Tel volé/cassé",
      descriptionEn: "Phone stolen/broken",
      angleFr: "Impossible de communiquer",
      angleEn: "Can't communicate",
      promptFr: "on m'a volé mon téléphone... ou alors il est tombé dans les chiottes je sais plus... bref j'ai plus de tel... faut que j'en rachète un pour te parler...",
      promptEn: "someone stole my phone... or maybe it fell in the toilet idk... anyway i have no phone... need to buy a new one to talk to you...",
      amount: 200
    }),
    createStory({
      type: 'URGENCE',
      descriptionFr: "Dette à un ami",
      descriptionEn: "Debt to a friend",
      angleFr: "Pression sociale",
      angleEn: "Social pressure",
      promptFr: "j'ai emprunté 100€ à une copine pour aider maman... elle me réclame... j'ai honte...",
      promptEn: "i borrowed $110 from a friend to help mom... she's asking for it back... i'm so embarrassed...",
      amount: 100
    }),
    createStory({
      type: 'URGENCE',
      descriptionFr: "Caution appartement",
      descriptionEn: "Apartment deposit",
      angleFr: "Déménagement forcé",
      angleEn: "Forced to move",
      promptFr: "on trouve un petit appart mais il faut 500€ de caution... sinon on reste dans la merde...",
      promptEn: "we found a small apartment but need $520 deposit... otherwise we're stuck here...",
      amount: 500
    })
  ],
  
  FILLER: [
    createStory({
      type: 'FILLER',
      descriptionFr: "Ennui cours",
      descriptionEn: "Boring class",
      angleFr: "Rien de spécial",
      angleEn: "Nothing special",
      promptFr: "cours chiant aujourd'hui... la prof elle parle pour rien...",
      promptEn: "class is so boring today... teacher talking about nothing...",
      amount: null
    }),
    createStory({
      type: 'FILLER',
      descriptionFr: "Copine drama",
      descriptionEn: "Friend drama",
      angleFr: "Vie sociale",
      angleEn: "Social life",
      promptFr: "ma copine elle m'a pété les pieds toute la journée... drama pour rien comme d'hab...",
      promptEn: "my friend was annoying me all day... drama for nothing as usual...",
      amount: null
    }),
    createStory({
      type: 'FILLER',
      descriptionFr: "Faim",
      descriptionEn: "Hungry",
      angleFr: "Quotidien",
      angleEn: "Daily life",
      promptFr: "j'ai trop faim là... le midi on avait que de la merde à la cantine...",
      promptEn: "i'm so hungry... lunch at the cafeteria was garbage today...",
      amount: null
    }),
    createStory({
      type: 'FILLER',
      descriptionFr: "Fatigue",
      descriptionEn: "Tired",
      angleFr: "Quotidien",
      angleEn: "Daily life",
      promptFr: "jsuis crevée là... j'ai mal dormi...",
      promptEn: "i'm so tired... slept badly...",
      amount: null
    }),
    createStory({
      type: 'FILLER',
      descriptionFr: "Pluie",
      descriptionEn: "Rain",
      angleFr: "Météo",
      angleEn: "Weather",
      promptFr: "il pleut comme vache qui pisse... j'ai pas de parapluie...",
      promptEn: "it's raining cats and dogs... i don't have an umbrella...",
      amount: null
    }),
    createStory({
      type: 'FILLER',
      descriptionFr: "Série TV",
      descriptionEn: "TV show",
      angleFr: "Loisir",
      angleEn: "Entertainment",
      promptFr: "j'ai regardé un épisode de [série] hier... t'as vu ?",
      promptEn: "i watched an episode of [show] yesterday... have you seen it?",
      amount: null
    })
  ]
}

/**
 * Chaînes narratives suggérées:
 * 
 * Semaine 1: Facture elec (80€) → Coupure EDF (150€) → Maman malade (200€)
 * Semaine 2: Transport (100€) → Ecole voyage (200€) → Ordinateur (300€)
 * Semaine 3: Urgence caution (500€) ou Dette ami (100€) + accumulation
 */
