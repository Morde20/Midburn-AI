/**
 * lib/faq.ts
 *
 * The permanent FAQs, shown as chips on the chat home screen. Clicking a
 * chip sends the question to the assistant like any typed question (real
 * RAG answer + sources), so there are no canned answers to maintain here.
 * Edit the questions below (both languages) — no other code changes needed.
 */

export type FaqItem = {
  question: { he: string; en: string };
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: {
      he: "למי מותר בכלל לנהוג על מיול?",
      en: "Who is allowed to drive a Mule?",
    },
  },
  {
    question: {
      he: "למי צריך לדווח על אירוע חריג בפלאיה?",
      en: "Who do I report an unusual incident to on the playa?",
    },
  },
  {
    question: {
      he: "איפה אני יכול להחליף בטריה לקשר?",
      en: "Where can I swap a radio battery?",
    },
  },
  {
    question: {
      he: "מתי הגייט נפתח היום?",
      en: "When does the gate open today?",
    },
  },
  {
    question: {
      he: "באיזו שעה נפתחת העיר ליציאת רכבים בשבת - אקסודוס?",
      en: "What time does the city open for vehicle exit on Saturday – Exodus?",
    },
  },
];
