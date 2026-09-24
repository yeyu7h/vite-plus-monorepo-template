import type { z } from 'zod'

export type AdminFormSchema = z.ZodType

export type AdminFormComponent = 'input' | 'textarea' | 'select' | 'selectMenu' | 'inputNumber' | 'checkbox' | 'switch' | 'slot'

export interface AdminFormField<State extends object, Item = unknown> {
  name: Extract<keyof State, string>
  label?: string
  description?: string
  hint?: string
  required?: boolean
  component?: AdminFormComponent
  componentProps?: Record<string, unknown>
  slot?: string
  disabled?: boolean | ((state: State, item: Item | null) => boolean)
  class?: string
}

/** Fields and validation must change together when the form mode changes. */
export interface AdminFormConfig<State extends object, Item, Schema extends AdminFormSchema> {
  schema: Schema
  fields: AdminFormField<State, Item>[]
}
