import { createRefineQuery, RefineQueryExecutor, type CrudFilters, type RefineQueryDependencies } from '@monorepo/server-refine-query'
import type { PgTable } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

type QueryRole = { id: string; name: string; status: 'ENABLED' | 'DISABLED'; description: string }
type QueryExecutorTestContext = {
  db: RefineQueryDependencies['db']
  table: PgTable
  executeRefineQuery: ReturnType<typeof createRefineQuery>
  prepare: (rows: QueryRole[]) => Promise<void>
  cleanup: (prefix: string) => Promise<void>
}

export function defineQueryExecutorTests({ db, table: systemRoles, executeRefineQuery, prepare, cleanup }: QueryExecutorTestContext) {
  const Status = { ENABLED: 'ENABLED', DISABLED: 'DISABLED' } as const
  const TEST_PREFIX = `test_refine_${crypto.randomUUID().replaceAll('-', '')}_`
  const testRoles: QueryRole[] = [
    { id: `${TEST_PREFIX}role1`, name: '测试角色1', status: Status.ENABLED, description: '测试角色描述1' },
    { id: `${TEST_PREFIX}role2`, name: '测试角色2', status: Status.ENABLED, description: '测试角色描述2' },
    { id: `${TEST_PREFIX}role3`, name: '测试角色3', status: Status.DISABLED, description: '测试角色描述3' },
    { id: `${TEST_PREFIX}role4`, name: '搜索测试角色', status: Status.ENABLED, description: '测试搜索功能' },
    { id: `${TEST_PREFIX}role5`, name: '搜索测试角色2', status: Status.DISABLED, description: '测试搜索功能2' },
  ]

  describe('refine-query QueryExecutor', () => {
    beforeAll(async () => {
      await cleanup(TEST_PREFIX)
      await prepare(testRoles)
    })

    afterAll(async () => {
      await cleanup(TEST_PREFIX)
    })

    describe('RefineQueryExecutor', () => {
      describe('execute - 基本查询', () => {
        it('应该执行无条件查询', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(5)
          expect(result!.total).toBe(5)
        })

        it('应该执行带过滤条件的查询', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              { field: 'status', operator: 'eq', value: Status.ENABLED },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(3)
          expect(result!.data.every((r) => r.status === Status.ENABLED)).toBe(true)
        })

        it('应该执行带排序条件的查询', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            sorters: [{ field: 'id', order: 'asc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(5)
          expect(result!.data[0].id).toBe(`${TEST_PREFIX}role1`)
          expect(result!.data[4].id).toBe(`${TEST_PREFIX}role5`)
        })

        it('应该执行降序排序', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            sorters: [{ field: 'id', order: 'desc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data[0].id).toBe(`${TEST_PREFIX}role5`)
          expect(result!.data[4].id).toBe(`${TEST_PREFIX}role1`)
        })
      })

      describe('execute - 分页查询', () => {
        it('应该执行 server 模式分页', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            pagination: { current: 1, pageSize: 2, mode: 'server' },
            sorters: [{ field: 'id', order: 'asc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
          expect(result!.total).toBe(5) // Total should be the count of all records / 总数应该是所有记录数
          expect(result!.data[0].id).toBe(`${TEST_PREFIX}role1`)
        })

        it('应该执行 server 模式分页 - 第二页', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            pagination: { current: 2, pageSize: 2, mode: 'server' },
            sorters: [{ field: 'id', order: 'asc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
          expect(result!.total).toBe(5)
          expect(result!.data[0].id).toBe(`${TEST_PREFIX}role3`)
        })

        it('应该执行 client 模式分页', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            pagination: { current: 1, pageSize: 2, mode: 'client' },
            sorters: [{ field: 'id', order: 'asc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
          expect(result!.total).toBe(5)
        })

        it('应该执行 off 模式（不分页）', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            pagination: { current: 1, pageSize: 2, mode: 'off' },
            sorters: [{ field: 'id', order: 'asc' }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(5) // Return all / 返回全部
          expect(result!.total).toBe(5)
        })
      })

      describe('execute - 参数验证', () => {
        it('应该拒绝无效过滤字段', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'invalidField', operator: 'eq', value: 'test' }],
          })

          expect(error).toBeDefined()
          expect(error!.message).toContain('无效的过滤字段')
          expect(result).toBeNull()
        })

        it('应该拒绝无效排序字段', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            sorters: [{ field: 'invalidField', order: 'asc' }],
          })

          expect(error).toBeDefined()
          expect(error!.message).toContain('无效的排序字段')
          expect(result).toBeNull()
        })

        it('应该拒绝无效分页参数', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            pagination: { current: -1, pageSize: 10, mode: 'server' },
          })

          expect(error).toBeDefined()
          expect(result).toBeNull()
        })
      })

      describe('execute - 复杂过滤', () => {
        it('应该支持 OR 条件', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              {
                operator: 'or',
                value: [
                  { field: 'id', operator: 'eq', value: `${TEST_PREFIX}role1` },
                  { field: 'id', operator: 'eq', value: `${TEST_PREFIX}role2` },
                ],
              },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
        })

        it('应该支持 contains 操作符', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              { field: 'name', operator: 'contains', value: '搜索' },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
          expect(result!.data.every((r) => (r as { name: string }).name.includes('搜索'))).toBe(true)
        })

        it('应该支持 in 操作符', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              { field: 'status', operator: 'in', value: [Status.DISABLED] },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(2)
          expect(result!.data.every((r) => (r as { status: string }).status === Status.DISABLED)).toBe(true)
        })
      })

      describe('execute - allowedFields', () => {
        it('应该使用 allowedFields 白名单', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            allowedFields: ['id', 'name', 'status'],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
        })

        it('应该拒绝不在白名单中的过滤字段', async () => {
          const executor = new RefineQueryExecutor(systemRoles, { db })
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'description', operator: 'eq', value: 'test' }],
            allowedFields: ['id', 'name', 'status'],
          })

          expect(error).toBeDefined()
          expect(error!.message).toContain('无效的过滤字段')
          expect(result).toBeNull()
        })
      })
    })

    describe('executeRefineQuery 便捷函数', () => {
      it('应该执行查询', async () => {
        const [error, result] = await executeRefineQuery({
          table: systemRoles,
          queryParams: {
            filters: [{ field: 'id', operator: 'eq', value: `${TEST_PREFIX}role1` }],
          },
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(1)
        expect(result!.data[0].id).toBe(`${TEST_PREFIX}role1`)
      })

      it('应该支持自定义 db 实例', async () => {
        const executeWithCustomDb = createRefineQuery({ db })
        const [error, result] = await executeWithCustomDb({
          table: systemRoles,
          queryParams: {
            filters: [{ field: 'id', operator: 'eq', value: `${TEST_PREFIX}role1` }],
          },
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(1)
      })

      it('应该支持分页参数', async () => {
        const [error, result] = await executeRefineQuery({
          table: systemRoles,
          queryParams: {
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
            pagination: { current: 1, pageSize: 3, mode: 'server' },
            sorters: [{ field: 'id', order: 'asc' }],
          },
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(3)
        expect(result!.total).toBe(5)
      })

      it('应该返回错误当查询参数无效', async () => {
        const [error, result] = await executeRefineQuery({
          table: systemRoles,
          queryParams: {
            filters: [{ field: 'invalidField', operator: 'eq', value: 'test' }],
          },
        })

        expect(error).toBeDefined()
        expect(result).toBeNull()
      })
    })

    describe('边界情况', () => {
      it('应该处理空过滤条件', async () => {
        const executor = new RefineQueryExecutor(systemRoles, { db })
        const [error, result] = await executor.execute({
          resource: systemRoles,
          filters: [],
          pagination: { current: 1, pageSize: 100, mode: 'server' },
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBeGreaterThanOrEqual(5)
      })

      it('应该处理空排序条件', async () => {
        const executor = new RefineQueryExecutor(systemRoles, { db })
        const [error, result] = await executor.execute({
          resource: systemRoles,
          filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
          sorters: [],
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(5)
      })

      it('应该处理单条结果', async () => {
        const executor = new RefineQueryExecutor(systemRoles, { db })
        const [error, result] = await executor.execute({
          resource: systemRoles,
          filters: [{ field: 'id', operator: 'eq', value: `${TEST_PREFIX}role1` }],
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(1)
        expect(result!.total).toBe(1)
      })

      it('应该处理无结果', async () => {
        const executor = new RefineQueryExecutor(systemRoles, { db })
        const [error, result] = await executor.execute({
          resource: systemRoles,
          filters: [{ field: 'id', operator: 'eq', value: 'non_existent_id' }],
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(0)
        expect(result!.total).toBe(0)
      })

      it('应该处理最后一页（部分记录）', async () => {
        const executor = new RefineQueryExecutor(systemRoles, { db })
        const [error, result] = await executor.execute({
          resource: systemRoles,
          filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
          pagination: { current: 3, pageSize: 2, mode: 'server' },
          sorters: [{ field: 'id', order: 'asc' }],
        })

        expect(error).toBeNull()
        expect(result).toBeDefined()
        expect(result!.data.length).toBe(1) // Page 3 has only 1 record / 第3页只有1条记录
        expect(result!.total).toBe(5)
      })
    })

    describe('SQL 注入防护（集成测试）', () => {
      const executor = new RefineQueryExecutor(systemRoles, { db })

      describe('值注入尝试', () => {
        const sqlInjectionPayloads = [
          "'; DROP TABLE system_roles; --",
          "1' OR '1'='1",
          '1; DELETE FROM system_roles',
          "' UNION SELECT * FROM system_roles --",
          "admin'--",
          "1' OR 1=1--",
          "'; TRUNCATE TABLE system_roles; --",
        ]

        it.each(sqlInjectionPayloads)('eq 操作符应该安全处理恶意值并返回空结果: %s', async (payload) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'eq', value: payload }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(0)
        })

        it.each(sqlInjectionPayloads)('contains 操作符应该安全处理恶意值: %s', async (payload) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              { field: 'name', operator: 'contains', value: payload },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(0)
        })

        it.each(sqlInjectionPayloads)('in 操作符应该安全处理恶意值: %s', async (payload) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'in', value: [payload, 'another_value'] }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(0)
        })
      })

      describe('字段名注入尝试', () => {
        const fieldInjectionPayloads = ['id; DROP TABLE system_roles; --', "id' OR '1'='1", 'id UNION SELECT * FROM system_roles', 'id--', '1=1; --']

        it.each(fieldInjectionPayloads)('应该拒绝恶意过滤字段名: %s', async (maliciousField) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: maliciousField, operator: 'eq', value: 'test' }],
          })

          expect(error).toBeDefined()
          expect(error!.message).toContain('无效的过滤字段')
          expect(result).toBeNull()
        })

        it.each(fieldInjectionPayloads)('应该拒绝恶意排序字段名: %s', async (maliciousField) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            sorters: [{ field: maliciousField, order: 'asc' }],
          })

          expect(error).toBeDefined()
          expect(error!.message).toContain('无效的排序字段')
          expect(result).toBeNull()
        })
      })

      describe('特殊字符处理', () => {
        const specialCharValues = ["test'value", 'test"value', 'test\\value', 'test%value', 'test_value', 'test;value', 'test--value', '测试值']

        it.each(specialCharValues)('应该正确处理特殊字符并返回匹配结果: %s', async (value) => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'name', operator: 'contains', value }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
        })
      })

      describe('验证数据库完整性', () => {
        it('执行多个注入尝试后数据库数据应保持完整', async () => {
          const attacks: CrudFilters = [
            { field: 'id', operator: 'eq', value: "'; DROP TABLE system_roles; --" },
            { field: 'name', operator: 'contains', value: "'; DELETE FROM system_roles; --" },
            { field: 'status', operator: 'in', value: ["'; TRUNCATE TABLE system_roles; --"] },
          ]

          for (const attack of attacks) {
            await executor.execute({
              resource: systemRoles,
              filters: [attack],
            })
          }

          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [{ field: 'id', operator: 'startswith', value: TEST_PREFIX }],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(5)
        })
      })

      describe('复杂注入场景', () => {
        it('应该安全处理嵌套条件中的注入尝试', async () => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'startswith', value: TEST_PREFIX },
              {
                operator: 'or',
                value: [
                  { field: 'name', operator: 'eq', value: "'; DROP TABLE system_roles; --" },
                  { field: 'name', operator: 'contains', value: "' OR '1'='1" },
                ],
              },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(0)
        })

        it('应该安全处理多个过滤条件中的注入尝试', async () => {
          const [error, result] = await executor.execute({
            resource: systemRoles,
            filters: [
              { field: 'id', operator: 'eq', value: "' OR 1=1 --" },
              { field: 'name', operator: 'contains', value: "'; DELETE FROM system_roles; --" },
              { field: 'description', operator: 'contains', value: "' UNION SELECT * FROM system_roles --" },
            ],
          })

          expect(error).toBeNull()
          expect(result).toBeDefined()
          expect(result!.data.length).toBe(0)
        })
      })
    })
  })
}
