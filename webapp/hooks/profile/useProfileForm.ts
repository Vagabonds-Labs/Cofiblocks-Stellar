'use client'

import { useState, useEffect } from 'react'
import { authService } from '@/services/auth'
import { ApiError } from '@/lib/api/types'

export function useProfileForm(user: any, t: any, refreshUser: () => Promise<void>) {
  const [formData, setFormData] = useState({ name: '', email: '' })
  const [editingField, setEditingField] = useState<'name' | 'email' | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingField, setSavingField] = useState<'name' | 'email' | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
      })
    }
  }, [user])

  const handleInputChange = (e: any) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(false)
  }

  const validateField = (field: 'name' | 'email', value: string): boolean => {
    if (field === 'name') {
      if (value.trim().length > 0 && value.trim().length < 5) {
        setError(t('profile.error_name_min'))
        return false
      }
      if (value.trim().length > 25) {
        setError(t('profile.error_name_max'))
        return false
      }
    }

    if (field === 'email') {
      if (value.trim()) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!regex.test(value.trim())) {
          setError(t('profile.error_email_invalid'))
          return false
        }
      }
    }

    return true
  }

  const handleSaveField = async (field: 'name' | 'email') => {
    if (saving) return
    setError(null)
    setSuccess(false)

    let value: string | null = formData[field].trim()
    const currentValue = user?.[field] || ''

    // If no change, just exit edit mode
    if (value === currentValue) {
      setEditingField(null)
      return
    }

    // Validate the field
    if (!validateField(field, value)) {
      return
    }

    setSavingField(field)
    setSaving(true)

    try {
      if (value.length === 0) {
        if (currentValue.length > 0) {
          setFormData({
            name: user?.name || '',
            email: user?.email || '',
          })
          setError(t('profile.error_field_required'))
        }
        else {
          setSuccess(true)
        }
        setEditingField(null)
        return
      }
      const updateData: any = { [field]: value }
      const updated = await authService.updateUser(updateData)
      await refreshUser()

      setFormData({
        name: updated.name || '',
        email: updated.email || '',
      })

      setEditingField(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

    } catch (err) {
      console.error(err)
      const apiError = err as ApiError
      setError(t(`api_errors.${apiError.code}`))
    } finally {
      setSaving(false)
      setSavingField(null)
    }
  }

  const handleStartEdit = (field: 'name' | 'email') => {
    if (saving) return
    setFormData({ name: user?.name || '', email: user?.email || '' })
    setEditingField(field)
    setError(null)
    setSuccess(false)
  }

  const handleCancelEdit = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
      })
    }
    setEditingField(null)
    setError(null)
    setSuccess(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'name' | 'email') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveField(field)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  // Legacy methods for backward compatibility
  const validateForm = () => {
    if (!formData.name.trim() && !formData.email.trim()) {
      setError(t('profile.error_at_least_one'))
      return false
    }

    if (formData.name.trim()) {
      if (formData.name.trim().length < 5) {
        setError(t('profile.error_name_min'))
        return false
      }
      if (formData.name.trim().length > 25) {
        setError(t('profile.error_name_max'))
        return false
      }
    }

    if (formData.email.trim()) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!regex.test(formData.email.trim())) {
        setError(t('profile.error_email_invalid'))
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!validateForm()) return

    setSaving(true)

    try {
      const updateData: any = {}

      if (formData.name.trim() !== (user?.name || '')) updateData.name = formData.name.trim()
      if (formData.email.trim() !== (user?.email || '')) updateData.email = formData.email.trim()

      if (Object.keys(updateData).length === 0) {
        setError('No changes to save')
        setSaving(false)
        return
      }

      const updated = await authService.updateUser(updateData)
      await refreshUser()

      setFormData({
        name: updated.name || '',
        email: updated.email || '',
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

    } catch (err) {
      console.error(err)
      setError(t('profile.error_message'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
      })
    }
    setError(null)
    setSuccess(false)
  }

  return {
    formData,
    editingField,
    saving,
    savingField,
    success,
    error,
    handleInputChange,
    handleStartEdit,
    handleSaveField,
    handleCancelEdit,
    handleKeyDown,
    handleSubmit,
    handleCancel,
    setError,
  }
}
