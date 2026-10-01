import { HOST, SITE } from "../constants/site";
import type { LegalTexts } from "./types";

/** English translation, for convenience: the French version prevails. */
export const en: LegalTexts = {
  "legal-notice": {
    title: "Legal notice",
    description: `Publisher, host and credits of ${SITE.name}.`,
    sections: [
      {
        heading: "Publisher",
        blocks: [
          `${SITE.name} is published on a non-professional basis by ${SITE.publisher}, a private individual.`,
          "In accordance with article 6, III, 2 of the French law no. 2004-575 of 21 June 2004 (LCEN), the publisher's personal details have been provided to the host.",
          `Publication director: ${SITE.publisher}.`,
          `Contact: ${SITE.contactEmail}`,
        ],
      },
      {
        heading: "Hosting",
        blocks: [
          [HOST.name, `${HOST.address}, USA`, HOST.phone, HOST.website].filter(Boolean).join(" — "),
          "Database: Neon (Neon Inc.), hosted in the European Union (Frankfurt, Germany).",
        ],
      },
      {
        heading: "Data and trademarks",
        blocks: [
          "Movie and series information (titles, overviews, posters, cast) comes from The Movie Database (TMDB). This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.",
          "Platform availability is provided by JustWatch, through TMDB.",
          `Streaming platform names and logos (Netflix, Prime Video, Disney+, Canal+…) are trademarks of their respective owners. ${SITE.name} is not affiliated with any of them and gives no access to their content: it redirects to them.`,
        ],
      },
      {
        heading: "Intellectual property",
        blocks: [
          `The structure, design and code of ${SITE.name} belong to the publisher. Any unauthorised reproduction is prohibited, except for personal use of the app.`,
        ],
      },
      {
        heading: "Reporting content",
        blocks: [
          `To report unlawful content (for example an offensive household or member name), write to ${SITE.contactEmail} with the invite code of the household concerned.`,
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy policy",
    description: `What data ${SITE.name} processes, why, for how long, and how to exercise your rights.`,
    sections: [
      {
        heading: "In short",
        blocks: [
          [
            "No account, no email, no password: a first name (or a nickname) is enough.",
            "No ads, no tracking cookies; on the website only, anonymous cookieless audience measurement.",
            "Your data is only used to run the app and is never sold or shared for commercial purposes.",
            "You can delete everything at any time from the app (Profile or Household → Delete my data).",
          ],
        ],
      },
      {
        heading: "Data controller",
        blocks: [`${SITE.publisher} — ${SITE.contactEmail}`],
      },
      {
        heading: "Data we process",
        blocks: [
          "Stored on our servers:",
          [
            "the first name or nickname and colour you choose, the household name and its invite code;",
            "the platforms ticked by the household;",
            "your favourites lists, titles marked “already watched” and your Match votes;",
            "for each signed-in device: a session token (stored only as an irreversible hash) and when it was last used;",
            "when signing in by QR code: the new device's browser and system type (for example “Chrome · macOS”), shown on the approving device.",
          ],
          "Sent without being stored in the database:",
          [
            "sentences typed in AI search or assisted Match, sent to the AI provider to be turned into search criteria. Do not type personal information in these fields;",
            "title searches, sent to TMDB without any information about you.",
          ],
          "Kept only on your device (browser or app local storage): the session token, your language and, if you paired one, your TV's address on the Wi-Fi network. This storage is strictly necessary for the service and therefore requires no consent.",
          "Camera: used only, and only if you allow it, to read a sign-in QR code. The image is analysed on your device; it is neither saved nor sent.",
          "Technical data: like any website, the host processes IP addresses and connection information (technical logs) to route requests and keep the service secure.",
          "Audience measurement (website only, not the mobile app): Vercel Web Analytics counts page views in aggregate — page visited, referring page, country, browser, operating system and device type. It sets no cookie and does not store your IP address; a visitor is only recognised by an anonymous fingerprint reset every day, which cannot follow you from one day to the next or across other sites. You can object by turning on Global Privacy Control or Do Not Track in your browser: the measurement is then no longer loaded.",
        ],
      },
      {
        heading: "Purposes and legal bases",
        blocks: [
          [
            "Providing the service (household, favourites, search, Match): performance of the terms of use you accept by using the app (GDPR art. 6.1.b).",
            "Security, abuse prevention and rate limiting: the publisher's legitimate interest (GDPR art. 6.1.f).",
            "Anonymous audience measurement of the website, to see which pages are used and improve the service: the publisher's legitimate interest (GDPR art. 6.1.f). Exempt from consent, as it sets no cookie and only produces anonymous statistics.",
          ],
        ],
      },
      {
        heading: "Recipients and processors",
        blocks: [
          "Only the publisher and the following technical providers access the data, each for its own task:",
          [
            `${HOST.name} (USA): hosting of the app and API, and website audience measurement;`,
            "Neon Inc.: database, hosted in Frankfurt (Germany);",
            "Groq Inc. or Anthropic PBC (USA), depending on configuration: interpreting sentences typed in AI features;",
            "TMDB and YouTube: posters, logos and trailer thumbnails load directly from their image servers, which therefore receive your IP address.",
          ],
          "Transfers to the USA are covered by the EU–US Data Privacy Framework and/or the European Commission's standard contractual clauses.",
          "“Watch on…” links take you to streaming platforms, whose own privacy policies then apply.",
        ],
      },
      {
        heading: "Retention",
        blocks: [
          [
            "Household and member data: as long as you use the app, or until you delete it.",
            "A device unused for 12 months is signed out automatically; a household with no signed-in device for 12 months is deleted with all its data.",
            "QR sign-in requests: valid 5 minutes, deleted at most 24 hours after they expire.",
            "Sentences sent to the AI: not stored in the database; the interpretation may stay up to 24 hours in the server's memory cache, unlinked to your identity.",
            "Host technical logs: a limited period set by the host.",
            "Audience measurement: aggregated statistics only; a visitor's anonymous fingerprint is reset every day.",
          ],
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          "You have the right to access, rectify, erase, restrict, port and object to the processing of your data.",
          [
            "Rectification: change your name and platforms directly in the app.",
            "Erasure: “Delete my data” in the app immediately deletes your profile, lists, “already watched” titles and votes, as well as the titles you added to the shared list. If you were the last member, the whole household is deleted.",
            `Any other request: ${SITE.contactEmail} (answer within one month). Include your household's invite code and your first name so we can find your data.`,
          ],
          "If you believe your rights are not respected, you can lodge a complaint with the CNIL (www.cnil.fr) or your local data protection authority.",
        ],
      },
      {
        heading: "Security",
        blocks: [
          "All traffic is encrypted (HTTPS). Session tokens are never stored in clear. Note: anyone who knows your household's invite code can join it; only share it with the people concerned. Likewise, only approve a QR sign-in for a QR code you just displayed yourself.",
        ],
      },
      {
        heading: "Changes",
        blocks: ["This policy may change with the app. The last update date is shown at the top of the page."],
      },
    ],
  },

  terms: {
    title: "Terms of use",
    description: `The rules for using ${SITE.name}, a free app to find what to watch on your platforms.`,
    sections: [
      {
        heading: "Purpose",
        blocks: [
          `${SITE.name} helps you find a movie or series available on the streaming platforms you subscribe to, then opens that platform. Using the app means you accept these terms.`,
        ],
      },
      {
        heading: "Access",
        blocks: [
          `${SITE.name} is free and needs no account. The publisher does its best to keep it available but does not guarantee it: the service may be interrupted, for maintenance in particular, and features may change or be removed.`,
          "AI features are limited to a number of requests per hour and per household.",
        ],
      },
      {
        heading: "Household and invite code",
        blocks: [
          "A household is shared by its members: each one sees the others' names, platforms, shared list and votes. Anyone who knows the invite code can join the household, and an existing name gets that profile back on a new device. Only share this code with people you trust.",
        ],
      },
      {
        heading: "Your use",
        blocks: [
          "You agree to use the app fairly, not to enter unlawful, offensive or infringing content (names, household names, searches), and not to disrupt the service (mass automated requests, bypassing limits, trying to access other households' data).",
          "The publisher may remove content or a household that breaks these rules.",
        ],
      },
      {
        heading: "Information displayed",
        blocks: [
          "Title pages and availability come from third parties (TMDB, JustWatch) and are indicative: a title may have moved to another platform or offer. Check on the platform before paying for a rental or purchase.",
          "Criteria suggested by the AI may be imperfect; the AI never recommends titles itself, results always come from the catalogue.",
          `${SITE.name} provides no video content and is not affiliated with any streaming platform. Access to their content remains subject to your subscriptions and their own terms.`,
        ],
      },
      {
        heading: "Liability",
        blocks: [
          "The service is provided “as is”. To the extent permitted by law, the publisher is not liable for unavailability, inaccurate third-party information, or the services of the platforms the app redirects to.",
        ],
      },
      {
        heading: "Personal data",
        blocks: ["How your data is processed is described in the privacy policy."],
      },
      {
        heading: "Changes and governing law",
        blocks: [
          "These terms may change; the version in force is the one published in the app. They are governed by French law. In case of dispute, an amicable solution will be sought first; failing that, French courts have jurisdiction, subject to consumer protection rules.",
          `Contact: ${SITE.contactEmail}`,
        ],
      },
    ],
  },
};
