'use client'

import {
  ArrowPathIcon,
  PencilSquareIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import type { useTranslations } from 'next-intl'
import type { useProfileForm } from '@/hooks/profile/useProfileForm'

export function ProfileForm({
  form,
  t,
}: {
  form: ReturnType<typeof useProfileForm>
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <section
      className="surface-card p-5 sm:p-6"
      aria-labelledby="personal-details-title"
    >
      <div className="flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-[#286b56]" aria-hidden="true" />
        <h2 id="personal-details-title" className="text-lg font-bold">
          {t('profile.dashboard.details_title')}
        </h2>
      </div>
      <p className="mb-2 mt-1 text-sm text-[#5a6760]">
        {t('profile.dashboard.details_description')}
      </p>
      <div className="divide-y divide-[#e5ebe6]">
        {(['name', 'email'] as const).map((field) => {
          const editing = form.editingField === field
          const saving = form.savingField === field
          const value = form.formData[field]
          return (
            <div key={field} className="py-5 last:pb-0">
              <label
                htmlFor={`profile-${field}`}
                className="mb-2 block text-xs font-semibold text-[#5a6760]"
              >
                {t(`profile.label_${field}`)}
              </label>
              {editing ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!form.saving) void form.handleSaveField(field)
                  }}
                >
                  <input
                    id={`profile-${field}`}
                    name={field}
                    type={field === 'email' ? 'email' : 'text'}
                    autoComplete={field}
                    value={value}
                    onChange={form.handleInputChange}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && !form.saving) {
                        event.preventDefault()
                        form.handleCancelEdit()
                      }
                    }}
                    placeholder={t(`profile.placeholder_${field}`)}
                    autoFocus
                    disabled={form.saving}
                    aria-invalid={!!form.error}
                    aria-describedby={
                      form.error ? 'profile-field-error' : undefined
                    }
                    className="field-input text-sm"
                  />
                  {form.error && (
                    <p
                      id="profile-field-error"
                      className="mt-2 text-sm text-red-700"
                    >
                      {form.error}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={form.saving}
                      className="btn-primary inline-flex items-center gap-2 text-sm"
                    >
                      {saving && (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      )}
                      {t(
                        saving
                          ? 'profile.button_saving'
                          : 'profile.button_save_small'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={form.handleCancelEdit}
                      disabled={form.saving}
                      className="btn-secondary text-sm"
                    >
                      {t('profile.button_cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`min-w-0 break-words text-sm ${value ? 'text-[#18211d]' : 'text-[#68776d]'}`}
                  >
                    {value || t('profile.dashboard.not_added')}
                  </p>
                  <button
                    type="button"
                    onClick={() => form.handleStartEdit(field)}
                    disabled={form.saving}
                    aria-label={t('profile.dashboard.edit_field', {
                      field: t(`profile.label_${field}`),
                    })}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#286b56] transition hover:bg-[#eaf1ef] disabled:opacity-50"
                  >
                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    {t('profile.dashboard.edit')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-5 border-t border-[#e5ebe6] pt-4 text-xs leading-relaxed text-[#68776d]">
        {t('profile.dashboard.email_hint')}
      </p>
    </section>
  )
}
