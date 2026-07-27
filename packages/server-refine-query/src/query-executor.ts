import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { UnknownRecord } from 'type-fest'
import type { RefineLogger } from './converters.ts'
import type { PaginationCalculation, PaginationOptions } from './pagination.ts'
import type { JoinConfig, QueryExecutionParams, RefineQueryConfig, RefineQueryResult, Result } from './types.ts'
import { and, count } from 'drizzle-orm'
import { addDefaultSorting, convertFiltersToSQL, convertSortersToSQL, validateFilterFields, validateSorterFields } from './converters.ts'
import { PaginationHandler } from './pagination.ts'
import { RefineQueryError } from './types.ts'

export type DbInstance = PostgresJsDatabase

export type RefineQueryDependencies = {
  db: DbInstance
  logger?: RefineLogger
  pagination?: PaginationOptions
}

export class RefineQueryExecutor<T extends UnknownRecord = UnknownRecord> {
  private table: PgTable
  private db: DbInstance
  private logger?: RefineLogger
  private pagination: PaginationHandler

  constructor(table: PgTable, dependencies: RefineQueryDependencies) {
    this.table = table
    this.db = dependencies.db
    this.logger = dependencies.logger
    this.pagination = new PaginationHandler(dependencies.pagination)
  }

  async execute(params: QueryExecutionParams<T>): Promise<Result<RefineQueryResult<T>>> {
    try {
      const validationResult = this.validateParams(params)
      if (!validationResult.valid) {
        return [new RefineQueryError(validationResult.errors.join('; ')), null]
      }

      const baseConditions: SQL<unknown>[] = []
      if (params.filters && params.filters.length > 0) {
        const filterSql = convertFiltersToSQL(params.filters, this.table, this.logger)
        if (filterSql) baseConditions.push(filterSql)
      }

      const whereCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined
      const pagination = this.pagination.calculate(params.pagination)
      const finalSorters = pagination.mode === 'server' ? addDefaultSorting(params.sorters) : params.sorters
      const orderBy = convertSortersToSQL(finalSorters, this.table, this.logger)

      if (params.joinConfig) {
        return await this.executeJoinQuery(params.joinConfig, whereCondition, orderBy, pagination)
      }

      return await this.executeSimpleQuery(whereCondition, orderBy, pagination)
    } catch (error) {
      const message = error instanceof Error ? error.message : '查询执行失败'
      return [new RefineQueryError(message), null]
    }
  }

  private async executeSimpleQuery(whereCondition: SQL<unknown> | undefined, orderBy: SQL<unknown>[], pagination: PaginationCalculation): Promise<Result<RefineQueryResult<T>>> {
    let total = 0
    if (pagination.mode === 'server') {
      const countQuery = this.db.select({ count: count() }).from(this.table)
      if (whereCondition) countQuery.where(whereCondition)
      const countResult = await countQuery
      total = countResult[0]?.count ?? 0
    }

    let dataQuery = this.db.select().from(this.table).$dynamic()
    if (whereCondition) dataQuery = dataQuery.where(whereCondition)
    if (orderBy.length > 0) dataQuery = dataQuery.orderBy(...orderBy)
    if (pagination.mode === 'server') {
      dataQuery = dataQuery.limit(pagination.limit).offset(pagination.offset)
    }

    const data = (await dataQuery) as T[]
    return [null, this.finalizeData(data, total, pagination)]
  }

  private async executeJoinQuery(joinConfig: JoinConfig, whereCondition: SQL<unknown> | undefined, orderBy: SQL<unknown>[], pagination: PaginationCalculation): Promise<Result<RefineQueryResult<T>>> {
    let total = 0
    if (pagination.mode === 'server') {
      let countQuery = this.buildJoinCountQuery(joinConfig)
      if (whereCondition) countQuery = countQuery.where(whereCondition)
      if (joinConfig.groupBy?.length) {
        const result = await countQuery.groupBy(...joinConfig.groupBy)
        total = result.length
      } else {
        const result = await countQuery
        total = result[0]?.count ?? 0
      }
    }

    let dataQuery = this.buildJoinQuery(joinConfig)
    if (whereCondition) dataQuery = dataQuery.where(whereCondition)
    if (joinConfig.groupBy?.length) dataQuery = dataQuery.groupBy(...joinConfig.groupBy)
    if (orderBy.length > 0) dataQuery = dataQuery.orderBy(...orderBy)
    if (pagination.mode === 'server') {
      dataQuery = dataQuery.limit(pagination.limit).offset(pagination.offset)
    }

    const data = (await dataQuery) as T[]
    return [null, this.finalizeData(data, total, pagination)]
  }

  private finalizeData(data: T[], initialTotal: number, pagination: PaginationCalculation): RefineQueryResult<T> {
    if (pagination.mode === 'client') {
      return {
        data: data.slice(pagination.offset, pagination.offset + pagination.limit),
        total: data.length,
      }
    }
    return {
      data,
      total: pagination.mode === 'off' ? data.length : initialTotal,
    }
  }

  private validateParams(params: QueryExecutionParams<T>): Readonly<{ valid: boolean; errors: readonly string[] }> {
    const errors: string[] = []
    const paginationValidation = this.pagination.validate(params.pagination)
    if (!paginationValidation.valid) errors.push(...paginationValidation.errors)

    const allowedFields = params.allowedFields ? [...params.allowedFields] : undefined
    if (params.filters?.length) {
      const filterValidation = validateFilterFields(params.filters, this.table, allowedFields)
      if (!filterValidation.valid) {
        errors.push(`无效的过滤字段: ${filterValidation.invalidFields.join(', ')}`)
      }
    }
    if (params.sorters?.length) {
      const sorterValidation = validateSorterFields(params.sorters, this.table, allowedFields)
      if (!sorterValidation.valid) {
        errors.push(`无效的排序字段: ${sorterValidation.invalidFields.join(', ')}`)
      }
    }
    return { valid: errors.length === 0, errors }
  }

  private buildJoinQuery(joinConfig: JoinConfig) {
    let query = this.db
      .select(joinConfig.selectFields ?? {})
      .from(this.table)
      .$dynamic()
    for (const join of joinConfig.joins) {
      if (join.type === 'left') query = query.leftJoin(join.table, join.on)
      else if (join.type === 'right') query = query.rightJoin(join.table, join.on)
      else query = query.innerJoin(join.table, join.on)
    }
    return query
  }

  private buildJoinCountQuery(joinConfig: JoinConfig) {
    let query = this.db.select({ count: count() }).from(this.table).$dynamic()
    for (const join of joinConfig.joins) {
      if (join.type === 'left') query = query.leftJoin(join.table, join.on)
      else if (join.type === 'right') query = query.rightJoin(join.table, join.on)
      else query = query.innerJoin(join.table, join.on)
    }
    return query
  }
}

export function createRefineQuery(dependencies: RefineQueryDependencies) {
  return async function executeRefineQuery<T extends UnknownRecord = UnknownRecord>(config: RefineQueryConfig<T>): Promise<Result<RefineQueryResult<T>>> {
    const executor = new RefineQueryExecutor<T>(config.table, dependencies)
    return executor.execute({
      resource: config.table,
      filters: config.queryParams.filters,
      sorters: config.queryParams.sorters,
      pagination: config.queryParams.pagination,
      joinConfig: config.joinConfig,
      allowedFields: config.allowedFields,
    })
  }
}

export async function executeRefineQuery<T extends UnknownRecord = UnknownRecord>(config: RefineQueryConfig<T>, dependencies: RefineQueryDependencies): Promise<Result<RefineQueryResult<T>>> {
  return createRefineQuery(dependencies)(config)
}
