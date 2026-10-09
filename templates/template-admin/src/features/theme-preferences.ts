export const THEME_PREFERENCES_STORAGE_KEY = 'admin-theme-preferences'

export const primaryColors = [
  { label: '绿色', value: 'green', preview: '#22c55e' },
  { label: '蓝色', value: 'blue', preview: '#3b82f6' },
  { label: '紫色', value: 'violet', preview: '#8b5cf6' },
  { label: '橙色', value: 'orange', preview: '#f97316' },
] as const

export const radiusOptions = [
  { label: '紧凑', value: 'compact', radius: '0.125rem' },
  { label: '标准', value: 'default', radius: '0.25rem' },
  { label: '圆润', value: 'rounded', radius: '0.5rem' },
] as const

export type PrimaryColor = (typeof primaryColors)[number]['value']
export type RadiusOption = (typeof radiusOptions)[number]['value']
export type ThemePreferences = { primary: PrimaryColor; radius: RadiusOption }

export const defaultThemePreferences: ThemePreferences = { primary: 'green', radius: 'default' }

function isPrimaryColor(value: unknown): value is PrimaryColor {
  return primaryColors.some((item) => item.value === value)
}

function isRadiusOption(value: unknown): value is RadiusOption {
  return radiusOptions.some((item) => item.value === value)
}

export function parseThemePreferences(raw: string | null): ThemePreferences {
  if (!raw) return { ...defaultThemePreferences }

  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return { ...defaultThemePreferences }
    const saved = value as Record<string, unknown>
    return {
      primary: isPrimaryColor(saved.primary) ? saved.primary : defaultThemePreferences.primary,
      radius: isRadiusOption(saved.radius) ? saved.radius : defaultThemePreferences.radius,
    }
  } catch {
    return { ...defaultThemePreferences }
  }
}

export function loadThemePreferences(): ThemePreferences {
  try {
    return parseThemePreferences(localStorage.getItem(THEME_PREFERENCES_STORAGE_KEY))
  } catch {
    return { ...defaultThemePreferences }
  }
}

export function applyThemePreferences(preferences: ThemePreferences) {
  const root = document.documentElement
  if (preferences.primary === defaultThemePreferences.primary) root.removeAttribute('data-admin-primary')
  else root.dataset.adminPrimary = preferences.primary

  if (preferences.radius === defaultThemePreferences.radius) root.style.removeProperty('--ui-radius')
  else root.style.setProperty('--ui-radius', radiusOptions.find((option) => option.value === preferences.radius)!.radius)
}

export function saveThemePreferences(preferences: ThemePreferences) {
  applyThemePreferences(preferences)
  try {
    localStorage.setItem(THEME_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Keep the applied preference for this session when storage is unavailable.
  }
}
