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
      name: "מידברן AI",
    },
    chat: {
      greeting: "במה אפשר לעזור היום?",
      placeholder: "אפשר להקליד שאלה...",
      send: "שליחה",
      thinking: "מידברן AI חושבת...",
      newChat: "צ׳אט חדש",
      faq: "שאלות נפוצות",
      sources: "מקורות לתשובה",
      sourcesCount: "מקורות",
      sourcesNote: "קטעים מהמסמכים שעליהם נשענת התשובה",
      noSources: "אין מקורות להצגה",
      showMore: "הצג הכל",
      showLess: "הצג פחות",
    },
    home: {
      title: "🤖 בוט AI MIDBURN 2026 - נהלי המחלקות",
      p1: "הולכים לאיבוד בין הנהלים? יש לנו בוט בשביל זה! 🧡",
      p2: "מותר? אסור? למי פונים? ומה בעצם הנוהל?",
      p3: "במקום לחפור באוגדן הנהלים של מידברן 2026, פשוט תשאלו את הבוט החדש שלנו!",
      p4: "הבוט מבוסס על נהלי מידברן המעודכנים לשנת 2026, ונועד לעשות לכולנו את החיים קצת יותר קלים – שואלים בשפה חופשית ומקבלים תשובות על מה ואיך נכון לפעול.",
      p5: "יאללה, תשאלו חופשי – הוא פה בשבילכם! 🔥",
      disclaimer:
        "ורק למען הסר ספק – הבוט הוא כלי עזר להתמצאות בנהלים, ובכל מקרה של אי־בהירות או סתירה, הנוסח הרשמי של אוגדן הנהלים המעודכן הוא הקובע.",
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
        sourceFile: "קובץ",
        sourceLink: "קישור Google Drive",
        linkUrl: "קישור למסמך ב-Google Drive",
        linkHint:
          "יש לשתף את המסמך כ״כל מי שיש לו את הקישור – צפייה״. המערכת קוראת את המסמך מחדש כששואלים שאלה (לכל היותר פעם בדקה), ולכן שינויים במסמך משתקפים בתשובות.",
        addLink: "הוספת קישור",
        addingLink: "מוסיפים וקוראים את המסמך...",
        linkAdded: "הקישור נוסף והמסמך נקרא בהצלחה",
        linkBadge: "קישור",
        openLink: "פתיחה",
        refresh: "רענון עכשיו",
        refreshing: "מרענן...",
        refreshed: "המסמך רענן",
        lastSynced: "נבדק לאחרונה",
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
      name: "Midburn AI",
    },
    chat: {
      greeting: "What can I help with today?",
      placeholder: "Type a question...",
      send: "Send",
      thinking: "Midburn AI is thinking...",
      newChat: "New chat",
      faq: "FAQ",
      sources: "Answer sources",
      sourcesCount: "Sources",
      sourcesNote: "Passages from the documents this answer is based on",
      noSources: "No sources to show",
      showMore: "Show all",
      showLess: "Show less",
    },
    home: {
      title: "🤖 MIDBURN 2026 AI Bot - Department Procedures",
      p1: "Lost in the procedures? We have a bot for that! 🧡",
      p2: "Allowed? Forbidden? Who do you turn to? And what is the actual procedure?",
      p3: "Instead of digging through the Midburn 2026 procedures binder, just ask our new bot!",
      p4: "The bot is based on the updated Midburn procedures for 2026 and is meant to make life a little easier for all of us – ask in plain language and get answers on what to do and how to do it.",
      p5: "Come on, ask freely – it is here for you! 🔥",
      disclaimer:
        "And just to be clear – the bot is a tool for finding your way around the procedures. In any case of ambiguity or contradiction, the official wording of the updated procedures binder is what counts.",
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
        sourceFile: "File",
        sourceLink: "Google Drive link",
        linkUrl: "Link to a Google Drive document",
        linkHint:
          "Share the document as \"Anyone with the link – Viewer\". The system re-reads it whenever a question is asked (at most once a minute), so changes to the document show up in answers.",
        addLink: "Add link",
        addingLink: "Adding and reading the document...",
        linkAdded: "Link added and document read successfully",
        linkBadge: "Link",
        openLink: "Open",
        refresh: "Refresh now",
        refreshing: "Refreshing...",
        refreshed: "Document refreshed",
        lastSynced: "Last checked",
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
