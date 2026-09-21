import { useLanguage } from './i18n'

/**
 * The list of languages, in their own script. Used in the website's language panel and in the
 * panels' top bar. It hides itself when the control centre offers only English.
 */
export function LanguagePicker({ onPicked }: { onPicked?: () => void }) {
  const { lang, setLang, languages, t } = useLanguage()
  if (languages.length < 2) return null
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500 mb-2">{t('lang.choose')}</p>
      <ul className="grid grid-cols-2 gap-2">
        {languages.map((l) => {
          const on = l.code === lang
          return (
            <li key={l.code}>
              <button
                type="button"
                lang={l.code}
                aria-current={on ? 'true' : undefined}
                onClick={() => { setLang(l.code); onPicked?.() }}
                className={`w-full text-left rounded-2xl p-3 border-2 transition ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="block text-sm font-bold text-slate-900">{l.name}</span>
                <span className="block text-[11px] text-slate-500">{l.english}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-400 mt-3">{t('lang.partial')}</p>
    </div>
  )
}
