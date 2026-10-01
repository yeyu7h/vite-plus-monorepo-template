import type { SystemParamApi } from '@/api/core/system'

export type ParamStatus = SystemParamApi.Item['status']
export type ParamValueType = SystemParamApi.Item['valueType']

type BadgeColor = 'info' | 'neutral' | 'primary' | 'success' | 'warning'

type ParamEnumMetadata = {
  label: string
  color: BadgeColor
  description: string
}

function enumValues<const Metadata extends Record<string, ParamEnumMetadata>>(metadata: Metadata) {
  return Object.keys(metadata) as [keyof Metadata & string, ...(keyof Metadata & string)[]]
}

function enumOptions<const Metadata extends Record<string, ParamEnumMetadata>>(metadata: Metadata) {
  return enumValues(metadata).map((value) => ({ value, ...metadata[value] }))
}

export const paramValueTypeMetadata = {
  STRING: {
    label: '字符串',
    color: 'neutral',
    description: '普通文本，保持输入内容不变。',
  },
  NUMBER: {
    label: '数字',
    color: 'info',
    description: '必须是有限数字。',
  },
  BOOLEAN: {
    label: '布尔值',
    color: 'warning',
    description: '仅允许 true 或 false。',
  },
  JSON: {
    label: 'JSON',
    color: 'primary',
    description: '必须是合法 JSON，可用于对象、数组或标量值。',
  },
} satisfies Record<ParamValueType, ParamEnumMetadata>

export const paramStatusMetadata = {
  ENABLED: {
    label: '启用',
    color: 'success',
    description: '公共参数接口可以读取该值。',
  },
  DISABLED: {
    label: '禁用',
    color: 'neutral',
    description: '公共参数接口不会返回该值。',
  },
} satisfies Record<ParamStatus, ParamEnumMetadata>

export const paramValueTypeValues = enumValues(paramValueTypeMetadata)
export const paramStatusValues = enumValues(paramStatusMetadata)
export const paramValueTypeOptions = enumOptions(paramValueTypeMetadata)
export const paramStatusOptions = enumOptions(paramStatusMetadata)

export function getParamValueTypeMetadata(valueType: ParamValueType) {
  return paramValueTypeMetadata[valueType]
}

export function getParamStatusMetadata(status: ParamStatus) {
  return paramStatusMetadata[status]
}

export function getParamValueError(valueType: ParamValueType, value: string): string | undefined {
  if (!value.trim()) return '请输入参数值'

  if (valueType === 'NUMBER' && !Number.isFinite(Number(value))) return '请输入有限数字'
  if (valueType === 'BOOLEAN' && value !== 'true' && value !== 'false') return '布尔值只能是 true 或 false'
  if (valueType === 'JSON') {
    try {
      JSON.parse(value)
    } catch {
      return '请输入合法 JSON'
    }
  }
}

export function formatParamValue(valueType: ParamValueType, value: string): string {
  if (valueType !== 'JSON') return value

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function getDefaultParamValue(valueType: ParamValueType): string {
  if (valueType === 'BOOLEAN') return 'false'
  if (valueType === 'JSON') return '{}'
  return ''
}
