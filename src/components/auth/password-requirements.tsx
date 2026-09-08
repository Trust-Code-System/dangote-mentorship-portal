import { getTranslations } from 'next-intl/server';

/**
 * The password rules, stated before the user types rather than after they fail.
 *
 * The list mirrors what the server actually enforces — `z.string().min(8)` in
 * both `resetPassword` and `acceptInvite`. It deliberately does not invent
 * complexity rules the backend does not apply; promising requirements that are
 * not checked is worse than saying nothing.
 */
export async function PasswordRequirements() {
  const t = await getTranslations('auth');

  return (
    <div className="rounded-xl border border-auth-border bg-auth-field/60 p-4">
      <p className="text-sm font-semibold text-auth-ink">{t('passwordRequirementsLabel')}</p>
      <ul className="mt-2 space-y-1.5">
        {[t('passwordRuleLength'), t('passwordRuleUnique')].map((rule) => (
          <li key={rule} className="flex gap-2.5 text-sm text-auth-ink-2">
            <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-[#0A6E13]" />
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
