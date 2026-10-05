import { HOST, SITE } from "../constants/site";
import type { LegalTexts } from "./types";

/** French texts: the reference version (French law applies). */
export const fr: LegalTexts = {
  "legal-notice": {
    title: "Mentions légales",
    description: "Éditeur, hébergeur et crédits de Canapé.",
    sections: [
      {
        heading: "Éditeur",
        blocks: [
          `${SITE.name} est édité à titre non professionnel par ${SITE.publisher}, personne physique.`,
          "Conformément à l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), les coordonnées personnelles de l'éditeur ont été communiquées à l'hébergeur.",
          `Directeur de la publication : ${SITE.publisher}.`,
          `Contact : ${SITE.contactEmail}`,
        ],
      },
      {
        heading: "Hébergement",
        blocks: [
          [HOST.name, `${HOST.address}, États-Unis`, HOST.phone, HOST.website].filter(Boolean).join(" — "),
          "Base de données : Neon (Neon Inc.), hébergée dans l'Union européenne (Francfort, Allemagne).",
        ],
      },
      {
        heading: "Données et marques",
        blocks: [
          "Les informations sur les films et séries (titres, résumés, affiches, distribution) proviennent de The Movie Database (TMDB). Ce produit utilise TMDB et les API TMDB mais n'est ni approuvé, ni certifié, ni validé d'aucune autre manière par TMDB.",
          "Les disponibilités par plateforme sont fournies par JustWatch, via TMDB.",
          `Les noms et logos des plateformes de streaming (Netflix, Prime Video, Disney+, Canal+…) sont des marques de leurs propriétaires respectifs. ${SITE.name} n'est affilié à aucune de ces plateformes et ne donne pas accès à leurs contenus : il redirige vers elles.`,
        ],
      },
      {
        heading: "Propriété intellectuelle",
        blocks: [
          `La structure, le design et le code de ${SITE.name} sont la propriété de l'éditeur. Toute reproduction non autorisée est interdite, hors usage personnel de l'application.`,
        ],
      },
      {
        heading: "Signaler un contenu",
        blocks: [
          `Pour signaler un contenu illicite (par exemple un nom de foyer ou un prénom injurieux), écrivez à ${SITE.contactEmail} en précisant le code d'invitation du foyer concerné.`,
        ],
      },
    ],
  },

  privacy: {
    title: "Politique de confidentialité",
    description: `Quelles données ${SITE.name} traite, pourquoi, combien de temps, et comment exercer vos droits.`,
    sections: [
      {
        heading: "En bref",
        blocks: [
          [
            "Pas de compte, pas d'e-mail, pas de mot de passe : un prénom (ou un pseudo) suffit.",
            "Pas de publicité, pas de cookie de suivi ; sur le site web uniquement, une mesure d'audience anonyme et sans cookie.",
            "Vos données servent uniquement à faire fonctionner l'application et ne sont ni vendues ni partagées à des fins commerciales.",
            "Vous pouvez tout supprimer à tout moment depuis l'application (Profil ou Foyer → Supprimer mes données).",
          ],
        ],
      },
      {
        heading: "Responsable du traitement",
        blocks: [`${SITE.publisher} — ${SITE.contactEmail}`],
      },
      {
        heading: "Données traitées",
        blocks: [
          "Stockées sur nos serveurs :",
          [
            "le prénom ou pseudo et la couleur que vous choisissez, le nom du foyer et son code d'invitation ;",
            "les plateformes cochées par le foyer ;",
            "vos listes de favoris, les titres marqués « déjà vu » et vos votes en mode Match ;",
            "pour chaque appareil connecté : un jeton de session (enregistré uniquement sous forme chiffrée irréversible, « hachée ») et sa date de dernière utilisation ;",
            "lors d'une connexion par QR code : le type de navigateur et de système du nouvel appareil (par exemple « Chrome · macOS »), affiché sur l'appareil qui valide ;",
            "si vous en créez un : votre code de secours, enregistré uniquement sous forme hachée ;",
            "pour limiter les abus (essais répétés de codes, requêtes massives) : des compteurs de requêtes associés à une empreinte hachée de l'adresse IP, sans l'adresse elle-même.",
          ],
          "Transmises sans être conservées en base :",
          [
            "les phrases saisies dans la recherche par IA ou dans le Match assisté, envoyées au fournisseur d'IA pour être transformées en critères de recherche. Ne saisissez pas d'informations personnelles dans ces champs ;",
            "les recherches de titres, transmises à TMDB sans aucune information vous concernant.",
          ],
          "Conservées uniquement sur votre appareil (stockage local du navigateur ou de l'application) : le jeton de session, la langue choisie et, si vous l'avez associée, l'adresse de votre téléviseur sur le réseau Wi-Fi. Ce stockage est strictement nécessaire au fonctionnement du service et ne requiert donc pas de consentement.",
          "Caméra : utilisée uniquement, et seulement si vous l'autorisez, pour lire un QR code de connexion. L'image est analysée sur votre appareil ; elle n'est ni enregistrée ni envoyée.",
          "Données techniques : comme tout site web, l'hébergeur traite l'adresse IP et les informations de connexion (journaux techniques) pour acheminer les requêtes et assurer la sécurité du service. L'application y ajoute, pour diagnostiquer les pannes et suivre les coûts, une ligne par requête (adresse de la page appelée sans les termes recherchés, durée, résultat) et par appel à l'IA (identifiant interne du foyer, sans le texte saisi).",
          "Mesure d'audience (site web uniquement, pas l'application mobile) : Vercel Web Analytics compte les pages vues de façon agrégée — page visitée, page de provenance, pays, type de navigateur, de système et d'appareil. Elle ne dépose aucun cookie et n'enregistre pas votre adresse IP ; un visiteur n'est reconnu que par une empreinte anonyme renouvelée chaque jour, qui ne permet pas de vous suivre d'un jour à l'autre ni sur d'autres sites. Vous pouvez vous y opposer en activant « Global Privacy Control » ou « Ne pas me pister » dans votre navigateur : la mesure n'est alors plus chargée.",
        ],
      },
      {
        heading: "Finalités et bases légales",
        blocks: [
          [
            "Fournir le service (foyer, favoris, recherche, Match) : exécution des conditions d'utilisation que vous acceptez en utilisant l'application (art. 6.1.b du RGPD).",
            "Sécurité, prévention des abus et limitation du nombre de requêtes : intérêt légitime de l'éditeur (art. 6.1.f du RGPD).",
            "Mesure d'audience anonyme du site web, pour savoir quelles pages sont utilisées et améliorer le service : intérêt légitime de l'éditeur (art. 6.1.f du RGPD). Exemptée de consentement, car elle ne dépose aucun cookie et ne produit que des statistiques anonymes.",
          ],
        ],
      },
      {
        heading: "Destinataires et sous-traitants",
        blocks: [
          "Seuls l'éditeur et les prestataires techniques suivants ont accès aux données, chacun pour sa mission :",
          [
            `${HOST.name} (États-Unis) : hébergement de l'application et de l'API, et mesure d'audience du site web ;`,
            "Neon Inc. : base de données, hébergée à Francfort (Allemagne) ;",
            "Groq Inc. ou Anthropic PBC (États-Unis), selon la configuration : interprétation des phrases saisies dans les fonctions d'IA ;",
            "TMDB et YouTube : les affiches, logos et miniatures de bandes-annonces sont chargés directement depuis leurs serveurs d'images, qui reçoivent donc votre adresse IP.",
          ],
          "Les transferts vers les États-Unis sont encadrés par le Data Privacy Framework UE–États-Unis et/ou les clauses contractuelles types de la Commission européenne.",
          "Les liens « Regarder sur… » vous redirigent vers les plateformes de streaming, dont les propres politiques de confidentialité s'appliquent alors.",
        ],
      },
      {
        heading: "Durées de conservation",
        blocks: [
          [
            "Données du foyer et des membres : tant que vous utilisez l'application, ou jusqu'à ce que vous les supprimiez.",
            "Un appareil inactif depuis 12 mois est déconnecté automatiquement ; un foyer sans plus aucun appareil connecté depuis 12 mois est supprimé avec toutes ses données.",
            "Demandes de connexion par QR code : valables 5 minutes, supprimées au plus tard 24 heures après leur expiration.",
            "Compteurs anti-abus : supprimés au plus tard 48 heures après leur création.",
            "Phrases envoyées à l'IA : non conservées en base ; l'interprétation peut rester jusqu'à 24 heures en mémoire cache sur le serveur, sans lien avec votre identité.",
            "Journaux techniques de l'hébergeur : durée limitée fixée par l'hébergeur.",
            "Mesure d'audience : statistiques agrégées uniquement ; l'empreinte anonyme d'un visiteur est renouvelée chaque jour.",
          ],
        ],
      },
      {
        heading: "Vos droits",
        blocks: [
          "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition sur vos données.",
          [
            "Rectification : modifiez votre prénom et les plateformes directement dans l'application.",
            "Effacement : « Supprimer mes données » dans l'application supprime immédiatement votre profil, vos listes, vos « déjà vu » et vos votes, ainsi que les titres que vous avez ajoutés à la liste commune. Si vous étiez le dernier membre, le foyer entier est supprimé.",
            `Pour toute autre demande : ${SITE.contactEmail} (réponse sous un mois). Indiquez le code d'invitation de votre foyer et votre prénom pour que nous puissions retrouver vos données.`,
          ],
          "Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).",
        ],
      },
      {
        heading: "Sécurité",
        blocks: [
          "Toutes les communications sont chiffrées (HTTPS). Les jetons de session ne sont jamais stockés en clair. Attention : toute personne qui connaît le code d'invitation de votre foyer peut le rejoindre ; ne le partagez qu'avec les personnes concernées. De même, ne validez une connexion par QR code que pour un QR code que vous venez d'afficher vous-même.",
        ],
      },
      {
        heading: "Modifications",
        blocks: [
          "Cette politique peut évoluer avec l'application. La date de dernière mise à jour figure en haut de la page.",
        ],
      },
    ],
  },

  terms: {
    title: "Conditions d'utilisation",
    description: `Les règles d'utilisation de ${SITE.name}, application gratuite pour trouver quoi regarder sur vos plateformes.`,
    sections: [
      {
        heading: "Objet",
        blocks: [
          `${SITE.name} aide à trouver un film ou une série disponible sur les plateformes de streaming auxquelles vous êtes abonné, puis ouvre la plateforme correspondante. Utiliser l'application vaut acceptation des présentes conditions.`,
        ],
      },
      {
        heading: "Accès au service",
        blocks: [
          `${SITE.name} est gratuit et accessible sans compte. L'éditeur s'efforce d'assurer sa disponibilité mais ne la garantit pas : le service peut être interrompu, notamment pour maintenance, et ses fonctions peuvent évoluer ou être retirées.`,
          "Les fonctions d'IA sont soumises à un nombre limité de requêtes par heure et par foyer.",
        ],
      },
      {
        heading: "Foyer et code d'invitation",
        blocks: [
          "Un foyer est partagé par ses membres : chacun voit les prénoms, les plateformes, la liste commune et les votes des autres. Le code d'invitation permet à quiconque le connaît de rejoindre le foyer comme nouveau membre ; il peut être changé à tout moment depuis l'application. Un profil existant ne se retrouve sur un nouvel appareil que par un QR code validé depuis un appareil déjà connecté, ou par le code de secours personnel du membre, à garder pour soi. Ne partagez le code d'invitation qu'avec des personnes de confiance.",
        ],
      },
      {
        heading: "Votre utilisation",
        blocks: [
          "Vous vous engagez à utiliser l'application de manière loyale, à ne pas saisir de contenu illicite, injurieux ou portant atteinte aux droits d'autrui (prénoms, noms de foyer, recherches), et à ne pas perturber le service (requêtes automatisées massives, contournement des limites, tentative d'accès aux données d'autres foyers).",
          "L'éditeur peut supprimer un contenu ou un foyer qui ne respecte pas ces règles.",
        ],
      },
      {
        heading: "Informations affichées",
        blocks: [
          "Les fiches et disponibilités proviennent de sources tierces (TMDB, JustWatch) et sont données à titre indicatif : un titre peut avoir changé de plateforme ou d'offre. Vérifiez sur la plateforme avant de payer une location ou un achat.",
          "Les critères proposés par l'IA peuvent être imparfaits ; l'IA ne recommande jamais de titre elle-même, les résultats viennent toujours du catalogue.",
          `${SITE.name} ne fournit aucun contenu vidéo et n'est affilié à aucune plateforme de streaming. L'accès à leurs contenus reste soumis à vos abonnements et à leurs propres conditions.`,
        ],
      },
      {
        heading: "Responsabilité",
        blocks: [
          "Le service est fourni « en l'état ». Dans les limites permises par la loi, l'éditeur ne saurait être tenu responsable d'une indisponibilité, d'une information inexacte provenant d'une source tierce, ni des services des plateformes vers lesquelles l'application redirige.",
        ],
      },
      {
        heading: "Données personnelles",
        blocks: ["Le traitement de vos données est décrit dans la politique de confidentialité."],
      },
      {
        heading: "Modification et droit applicable",
        blocks: [
          "Ces conditions peuvent être modifiées ; la version en vigueur est celle publiée dans l'application. Elles sont régies par le droit français. En cas de litige, une solution amiable sera recherchée avant toute action ; à défaut, les tribunaux français sont compétents, sous réserve des règles protectrices du consommateur.",
          `Contact : ${SITE.contactEmail}`,
        ],
      },
    ],
  },
};
