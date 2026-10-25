/**
 * lib/i18n/dictionary.ts
 *
 * All UI strings for the app, in Hebrew (default) and English. Deliberately
 * a plain nested object + dot-path lookup instead of a full i18n library —
 * this app has one audience (Habak staff) and two languages, so the
 * extra dependency isn't worth it.
 *
 * Hebrew copy is gender-neutral on purpose (nouns, plural or impersonal
 * forms instead of masculine/feminine second person). The assistant itself
 * speaks in the feminine ("חב״ק AI חושבת...").
 *
 * Both locales MUST keep identical keys.
 */

export type Locale = "he" | "en";

export const DEFAULT_LOCALE: Locale = "he";

const dictionaries = {
  he: {
    app: {
      name: "חב״ק AI",
    },
    chat: {
      greeting: "במה אפשר לעזור היום?",
      placeholder: "אפשר להקליד שאלה...",
      send: "שליחה",
      thinking: "חב״ק AI חושבת...",
      newChat: "צ׳אט חדש",
      faq: "שאלות נפוצות",
      faqEmpty: "אין עדיין שאלות נפוצות",
      sources: "מקורות לתשובה",
      sourcesCount: "מקורות",
      sourcesNote: "קטעים מהמסמכים שעליהם נשענת התשובה",
      noSources: "אין מקורות להצגה",
      showMore: "הצג הכל",
      showLess: "הצג פחות",
      openMenu: "פתיחת תפריט",
      closeMenu: "סגירת תפריט",
    },
    admin: {
      documents: {
        title: "ניהול מסמכים",
        existing: "מסמכים קיימים",
        newDoc: "העלאת מסמך חדש",
        docTitle: "כותרת המסמך",
        chooseFile: "בחירת קובץ",
        upload: "העלאת מסמך",
        uploading: "מעלים ומעבדים...",
        uploaded: "המסמך הועלה ועובד בהצלחה",
        error: "שגיאה בהעלאת המסמך",
        status: "סטטוס",
        actions: "פעולות",
        delete: "מחיקה",
        deleteConfirm: "למחוק את המסמך? הפעולה אינה הפיכה.",
        statusProcessing: "בעיבוד",
        statusReady: "מוכן",
        statusFailed: "נכשל",
        chunks: "יחידות טקסט",
        noDocuments: "לא הועלו מסמכים עדיין",
      },
    },
    common: {
      langToggle: "English",
    },
  },
  en: {
    app: {
      name: "Habak AI",
    },
    chat: {
      greeting: "What can I help with today?",
      placeholder: "Type a question...",
      send: "Send",
      thinking: "Habak AI is thinking...",
      newChat: "New chat",
      faq: "FAQ",
      faqEmpty: "No FAQs yet",
      sources: "Answer sources",
      sourcesCount: "Sources",
      sourcesNote: "Passages from the documents this answer is based on",
      noSources: "No sources to show",
      showMore: "Show all",
      showLess: "Show less",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },
    admin: {
      documents: {
        title: "Document management",
        existing: "Existing documents",
        newDoc: "Upload a new document",
        docTitle: "Document title",
        chooseFile: "Choose file",
        upload: "Upload document",
        uploading: "Uploading and processing...",
        uploaded: "Document uploaded and processed successfully",
        error: "Error uploading document",
        status: "Status",
        actions: "Actions",
        delete: "Delete",
        deleteConfirm: "Delete this document? This cannot be undone.",
        statusProcessing: "Processing",
        statusReady: "Ready",
        statusFailed: "Failed",
        chunks: "chunks",
        noDocuments: "No documents uploaded yet",
      },
    },
    common: {
      langToggle: "עברית",
    },
  },
} as const;

// Union of both locales' exact literal types, not just `typeof dictionaries.he`.
// The old `typeof dictionaries.he` alias only matched the Hebrew variant's
// literal string types, so returning the English variant from getDictionary()
// failed type-checking under `next build` (not caught by `next dev`, which
// doesn't block on this). Both locales share identical keys/shape — only the
// string literals differ — so this union still gives correct property typing.
export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
