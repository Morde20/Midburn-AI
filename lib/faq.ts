/**
 * lib/faq.ts
 *
 * The permanent FAQs. They appear as chips on the chat home screen
 * (clicking one sends the question to the assistant and gets a real answer
 * with sources) and as a static accordion in the chat sidebar
 * (app/page.tsx). Content is taken from the Habak procedures document.
 * Edit here (both languages) — no other code changes needed.
 */

export type FaqItem = {
  question: { he: string; en: string };
  answer: { he: string; en: string };
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: {
      he: "מה שעות המשמרות בחב״ק ומתי מגיעים?",
      en: "What are the Habak shift hours and when should I arrive?",
    },
    answer: {
      he: "החב״ק מאויש 24 שעות ביממה בארבע משמרות של 6 שעות: בוקר 07:45–13:45, צהריים 13:45–19:45, ערב 19:45–01:45 ולילה 01:45–07:45. מגיעים רבע שעה לפני תחילת המשמרת לחפיפה.",
      en: "Habak is staffed 24 hours a day in four 6-hour shifts: morning 07:45–13:45, afternoon 13:45–19:45, evening 19:45–01:45 and night 01:45–07:45. Arrive 15 minutes before the shift starts for the handover.",
    },
  },
  {
    question: {
      he: "מה עושים כשמתקבלת פנייה בקו המצוקה?",
      en: "What do we do when a distress-line call comes in?",
    },
    answer: {
      he: "עונים מיד ומבררים ברוגע מי, מה, איפה, מתי ומדוע, ומתעדים ביומן האירועים. בצורך רפואי עולים בקשר מול המרפאה, בסכנה ביטחונית מעדכנים מיד את זאבי, ובפגיעה מינית מפנים למיט״ה.",
      en: "Answer immediately and calmly find out who, what, where, when and why, and log it in the incident log. For a medical need, go on the radio to the clinic; for a security danger, update Zeevi right away; for a sexual assault, refer to Mita.",
    },
  },
  {
    question: {
      he: "מה עושים כשמדווחים על ילד אבוד?",
      en: "What do we do when a lost child is reported?",
    },
    answer: {
      he: "החב״ק פותחת דיווח ומעקב, מעדכנת את הגורמים הרלוונטיים ומנסה לאתר את ההורים בטלפון לפי פרטי הצמיד. נוודים מלווים את הילד/ה לחב״ק או למרפאה, וכל שלבי האירוע נרשמים ביומן.",
      en: "Habak opens a report and follow-up, updates the relevant parties and tries to reach the parents by phone using the wristband details. Nomads escort the child to Habak or the clinic, and every step of the incident is recorded in the log.",
    },
  },
  {
    question: {
      he: "מה עושים כשמכשיר קשר אבד או תקול?",
      en: "What do we do when a radio is lost or faulty?",
    },
    answer: {
      he: "מעדכנים את מנהל/ת המחלקה, מסמנים בקובץ הקשרים שהמכשיר אבד או תקול, ורושמים ביומן האירועים: מספר המכשיר, מה קרה, מי דיווח ושהעדכונים בוצעו.",
      en: "Update the department manager, mark in the radios file that the device is lost or faulty, and record in the incident log: the device number, what happened, who reported it and that the updates were done.",
    },
  },
  {
    question: {
      he: "מי יכול לשאול מיול מהחב״ק?",
      en: "Who can borrow a Mule vehicle from Habak?",
    },
    answer: {
      he: "נהיגה מותרת רק למי שעומד בכל התנאים: רישיון נהיגה בתוקף שצילומו נמצא בחב״ק מראש, שם ברשימת המורשים ומעל גיל 24. בקבלת המפתחות מזהים מול הרשימה ומעדכנים את מיקום המיול בלוח.",
      en: "Driving is allowed only for those who meet all conditions: a valid driver's license whose photo is already on file at Habak, a name on the authorized list, and age over 24. When handing over the keys, check against the list and update the Mule's location on the board.",
    },
  },
];
