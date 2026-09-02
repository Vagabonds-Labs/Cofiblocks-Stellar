'use client'

import {
  UserIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

export function ProfileForm({ form, t }: any) {
  const isEditing = (f: 'name' | 'email') => form.editingField === f
  const isSaving = (f: 'name' | 'email') => form.savingField === f

  const renderField = (
    field: 'name' | 'email',
    placeholder: string,
    textClass: string
  ) => {
    const value = form.formData[field]
    const hasValue = value && value.trim().length > 0

    return (
      <div className="group relative flex flex-col items-center">
        {isEditing(field) ? (
          <div className="flex items-center gap-2">
            <input
              type={field === 'email' ? 'email' : 'text'}
              name={field}
              value={value}
              onChange={form.handleInputChange}
              onKeyDown={(e) => form.handleKeyDown(e, field)}
              placeholder={placeholder}
              autoFocus
              className="text-center text-sm md:text-base border-b border-gray-300
                         focus:border-orange-500 focus:outline-none bg-transparent px-1"
            />

            <button
              onClick={() => form.handleSaveField(field)}
              disabled={isSaving(field)}
              className="text-orange-500 hover:text-orange-600 transition"
            >
              {isSaving(field) ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={form.handleCancelEdit}
              disabled={isSaving(field)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => form.handleStartEdit(field)}
            className="relative flex items-center justify-center group"
          >
            <span
              className={`${textClass} ${
                hasValue ? 'text-gray-900' : 'text-gray-400 italic'
              }`}
            >
              {hasValue
                ? value
                : field === 'name'
                ? t('profile.click_to_set_name')
                : t('profile.click_to_set_email')}
            </span>

            <PencilIcon
              className="
                absolute -right-6
                w-4 h-4
                text-gray-400
                opacity-0
                group-hover:opacity-100
                group-hover:text-orange-500
                transition
              "
            />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      {/* Avatar */}
      <div className="flex flex-col items-center">
        <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center">
          <UserIcon className="w-16 h-16 text-gray-400" />
        </div>

        {/* Name */}
        <div className="mt-4">
          {renderField(
            'name',
            t('profile.placeholder_name'),
            'text-lg font-semibold'
          )}
        </div>

        {/* Email */} 
        <div className="mt-2">
          {renderField(
            'email',
            t('profile.placeholder_email'),
            'text-sm text-gray-600'
          )}
        </div>
      </div>
    </div>
  )
}
