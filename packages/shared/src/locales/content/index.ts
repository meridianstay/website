import type { ContentTranslations, TranslationBook } from '../../contentText'
import hi from './hi'
import mr from './mr'
import gu from './gu'

// A head start: the homepage, header and footer as they ship, already translated into the three
// languages most of our hosts and guests read. They are merged underneath whatever the control
// centre has saved, so any wording an admin changes or retranslates always wins. Other languages
// start empty and are filled in Website content → Translations.

export const starterContent: TranslationBook = { hi, mr, gu }

/** The starter pack for one language, with the control centre's own translations on top. */
export const withStarterContent = (lang: string, saved: ContentTranslations | undefined): ContentTranslations =>
  ({ ...(starterContent[lang] ?? {}), ...(saved ?? {}) })
