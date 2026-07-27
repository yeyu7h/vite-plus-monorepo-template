import type { Hook } from '@hono/zod-openapi'

import { UNPROCESSABLE_ENTITY } from '../http-status-codes.js'

// oxlint-disable-next-line typescript/no-explicit-any -- Hono's Hook requires its complete generic bridge at this boundary.
const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        success: result.success,
        error: {
          name: result.error.name,
          issues: result.error.issues,
        },
      },
      UNPROCESSABLE_ENTITY,
    )
  }
}

export default defaultHook
