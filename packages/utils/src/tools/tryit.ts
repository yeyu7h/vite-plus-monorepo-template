/**
 * Convert a function to an error-first function
 * Supports both sync and async functions
 *
 * @param fn Function to wrap / 要包装的函数
 * @returns Returns a function whose result is a discriminated union type, supporting type narrowing / 返回一个函数,执行结果为判别联合类型,支持类型收窄
 *
 * 将函数转换为错误优先的函数
 * 支持同步和异步函数
 * ```
 */
export function tryit<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
  return async (...args: TArgs): Promise<[Error, null] | [null, Awaited<TResult>]> => {
    try {
      const result = await fn(...args)
      return [null, result]
    } catch (error) {
      return [error as Error, null]
    }
  }
}
