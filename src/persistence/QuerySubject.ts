import { BehaviorSubject, of } from 'rxjs';
import { take, takeUntil, takeWhile, timeout, withLatestFrom } from 'rxjs/operators';
import { IClassProperty, IEntity, IRepositoryData, Repository } from '../persistence/Repository';
import { IPageEventSort, IQueryPaginatorDefaults, QueryPaginator } from './query/QueryPaginator';
/// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export interface IStatement {
  where?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
  params?: any[];
  excludeWhereIamOwner?: boolean;
  includeWhereIamOwner?: boolean;
  includeWhereIamViewer?: boolean;
}

export interface IStatementOne {
  where?: string;
  uuid?: string;
  params?: any[];
}

export interface IQueryCallbackChanges {
  count?: number;
  results?: any[];
  resultsAll?: any[];
  pageSize?: number;
  pageIndex?: number;
  pageSort?: IPageEventSort;
  dataAdded?: boolean;
  geoLocationChanged?: boolean;
  dataRemoved?: boolean;
  dataUpdated?: boolean;
  selectSqlStatement?: boolean;
}

/**
 * INTERNAL USE ONLY
 */
export class QuerySubject<T> {
  private readonly paginator: QueryPaginator<T>;
  private readonly queryCallbackChanges$: BehaviorSubject<IQueryCallbackChanges>;
  private readonly _sql: IStatement | undefined;
  private readonly _paginatorDefaults: IQueryPaginatorDefaults | undefined;
  private _lastExecStatement: string = '';
  private _subscriptions: any[] = [];
  private _repositoryLastCount: number = 0;
  private uuid: string = '';

  /**
   *
   * @param repository
   * @param sql
   * @param paginatorDefaults
   */
  constructor(private repository: Repository<T>, sql?: IStatement, paginatorDefaults?: IQueryPaginatorDefaults) {
    this.queryCallbackChanges$ = new BehaviorSubject<IQueryCallbackChanges>({});
    this.paginator = new QueryPaginator<T>(this);

    if (sql) {
      this._sql = sql;
    }

    if (paginatorDefaults) {
      this._paginatorDefaults = paginatorDefaults;
    }

    this.setPaginatorDefaults(this._paginatorDefaults, this._sql);
    this.observeStatement(this._sql);
    this.observeQueryCallbackChanges(this._sql)
      .then()
      .catch();
  }

  public unsubscribe() {
    this._subscriptions.forEach((sub: any) => {
      sub.unsubscribe();
    });
  }

  public getSql(): IStatement | undefined {
    return this._sql;
  }

  public getSqlSelectParsed(sql?: IStatement): string {
    let statement = '';
    const params = this.getEvaluatedSqlParams(sql);
    const querySelect = 'SELECT * FROM ' + this.repository.getClassName() + ' ';

    if (!sql) {
      sql = {};
    }

    if (sql.where) {
      statement += ' WHERE ' + sql.where;
    }

    let selectSqlStatement = alasql.parse(querySelect + statement, params).toString();
    if (params) {
      params.forEach((value: string, index: number) => {
        selectSqlStatement = selectSqlStatement.replace(
          '$' + index,
          typeof value === 'string' ? "'" + value + "'" : value,
        );
      });
    }

    let ownerWhere = '';
    if (this.getRepository().isPrivateMode()) {
      ownerWhere += '`__owner.' + this.getUserUuid() + '` = true ';
    } else {
      ownerWhere += ' ( `__owner.EVERYBODY` = true OR `__owner.' + this.getUserUuid() + '` = true )';
    }

    if (sql.includeWhereIamOwner === true) {
      ownerWhere += ' AND `__owner.' + this.getUserUuid() + '` = true ';
    }

    if (sql.includeWhereIamViewer) {
      ownerWhere += ' AND ( `__viewer.' + this.getUserUuid() + '` = true ';
      ownerWhere += ' OR  `__viewer.EVERYBODY` = true ) ';
    }

    if (sql.where) {
      selectSqlStatement =
        querySelect + ' WHERE (' + ownerWhere + ') AND (' + selectSqlStatement.substr(querySelect.length + 6) + ')';
    } else {
      selectSqlStatement = selectSqlStatement + ' WHERE ' + ownerWhere;
    }

    return selectSqlStatement;
  }

  /**
   *
   * @param sql
   */
  public async execStatement(sql?: IStatement): Promise<Array<IEntity<T>>> {
    this.uuid = this.getRepository().getUserUuid();

    if (this.uuid === null) {
      await this.getRepository()
        .getUserUuidObservable()
        .pipe(take(1))
        .toPromise();
      this.uuid = this.getRepository().getUserUuid();
    }

    let statement = '';
    const selectSqlStatement = this.getSqlSelectParsed(sql);
    const params = this.getEvaluatedSqlParams(sql);

    if (this._lastExecStatement !== selectSqlStatement) {
      this.repository.loadQueryFromConnectors(selectSqlStatement);
      this._lastExecStatement = selectSqlStatement;
    }

    if (this._repositoryLastCount === 0 && this.repository.count() === 0) {
      return of([]).toPromise();
    }

    this._repositoryLastCount = this.repository.count();

    if (!sql) {
      sql = {};
    }

    statement += ' WHERE __removed = false AND geo->status != 2 AND ( ';

    if (this.getRepository().isPrivateMode()) {
      statement += '"' + this.getUserUuid() + '" IN __owner ';
    } else {
      statement += '"EVERYBODY" IN __owner ';
      if (this.getUserUuid() !== 'null') {
        statement += ' OR "' + this.getUserUuid() + '" IN __owner ';
      }
    }

    statement += ' ) ';

    if (sql.where) {
      statement += ' AND (' + sql.where + ')';
    }

    if (sql.excludeWhereIamOwner === true) {
      statement += ' AND "' + this.getUserUuid() + '" IN __owner = false';
    }

    if (sql.includeWhereIamOwner === true) {
      statement += ' AND "' + this.getUserUuid() + '" IN __owner = true';
    }

    if (sql.includeWhereIamViewer) {
      //  statement += ' AND ( "' + this.getUserUuid() + '" IN __viewer = true';
      //   statement += ' OR "' + this.getUserUuid() + '" IN __viewer = true ) ';
    }

    if (this.getPaginator().getPageSortProperty() !== '' && this.getPaginator().getPageSortDirection() !== '') {
      statement +=
        ' ORDER BY ' + this.getPaginator().getPageSortProperty() + ' ' + this.getPaginator().getPageSortDirection();
    } else if (sql.orderBy) {
      statement += ' ORDER BY ' + sql.orderBy;
    }

    statement = this.replaceStatement(statement);

    const resultsAll = alasql('SELECT * FROM ' + this.repository.getTableName() + ' ' + statement, params).map(
      (d: IRepositoryData) => d._ref,
    );
    const count = alasql('SELECT COUNT(*) as c FROM ' + this.repository.getTableName() + ' ' + statement, params)[0][
      'c'
    ];

    if (sql.limit && !this.getPaginator().hasPageSizeChanges()) {
      statement += ' LIMIT ' + sql.limit;
    } else if (this.getPaginator().getPageSize()) {
      statement += ' LIMIT ' + this.getPaginator().getPageSize();
    }

    if (sql.offset) {
      if (sql.limit === undefined) {
        statement += ' LIMIT 1';
      }
      statement += ' OFFSET ' + sql.offset;
    } else {
      if (count && this.getPaginator().getPageIndex() * this.getPaginator().getPageSize() > count) {
        this.getPaginator().setPageIndex(Math.floor(count / this.getPaginator().getPageSize()));
      }
      if (this.getPaginator().getPageIndex() * this.getPaginator().getPageSize()) {
        statement += ' OFFSET ' + this.getPaginator().getPageIndex() * this.getPaginator().getPageSize();
      }
    }

    const results = alasql('SELECT _ref FROM ' + this.repository.getTableName() + ' ' + statement, params).map(
      (d: IRepositoryData) => d._ref,
    );

    this._lastExecStatement = selectSqlStatement;

    this.updateQueryCallbackChanges({
      resultsAll: resultsAll,
      results: results,
      count: count,
    });

    return of(results).toPromise();
  }

  /**
   * get behaviour subject
   */
  public getPaginator(): QueryPaginator<T> {
    return this.paginator;
  }

  /**
   * update query callback changes
   */
  public updateQueryCallbackChanges(changes: IQueryCallbackChanges) {
    this.queryCallbackChanges$.next(changes);
  }

  /**
   * get query callback changes observer
   */
  public getQueryCallbackChanges(): BehaviorSubject<IQueryCallbackChanges> {
    return this.queryCallbackChanges$;
  }

  /**
   *
   */
  public getRepository(): Repository<T> {
    return this.repository;
  }

  /**
   *
   */
  private getUserUuid(): string {
    return this.getRepository().getUserUuid();
  }

  /**
   *
   * @param sql
   */
  private getEvaluatedSqlParams(sql?: IStatement): any {
    let params = sql && sql.params !== undefined ? sql.params : null;

    if (params) {
      const tmpParams: any = [];
      params.forEach((param: any) => {
        if (
          typeof param === 'object' &&
          param.asObservable !== undefined &&
          typeof param.asObservable === 'function' &&
          typeof param.getValue === 'function'
        ) {
          tmpParams.push(param.getValue());
        } else {
          tmpParams.push(param);
        }
      });
      params = tmpParams;
    }

    return params;
  }

  /**
   *
   * @param paginatorDefaults
   * @param sql
   */
  private setPaginatorDefaults(paginatorDefaults?: IQueryPaginatorDefaults, sql?: IStatement) {
    if (paginatorDefaults && paginatorDefaults.pageSizeOptions) {
      this.getPaginator().setPageSizeOptions(paginatorDefaults.pageSizeOptions);
      if (paginatorDefaults.pageSize === undefined) {
        this.getPaginator().setPageSize(paginatorDefaults.pageSizeOptions[0]);
      }
    }

    if (paginatorDefaults && paginatorDefaults.pageSort) {
      this.getPaginator().setPageSort(paginatorDefaults.pageSort);
    }

    if (paginatorDefaults && paginatorDefaults.pageSize) {
      this.getPaginator().setPageSize(paginatorDefaults.pageSize, true);
      if (
        this.getPaginator()
          .getPageSizeOptions()
          .indexOf(this.getPaginator().getPageSize()) < 0
      ) {
        this.getPaginator().addPageSizeOption(paginatorDefaults.pageSize);
      }
    } else if (sql && sql.limit) {
      this.getPaginator().setPageSize(sql.limit, true);
    }
  }

  /**
   * observe and re-execute statement on any changes
   * @param sql
   */
  private observeStatement(sql?: IStatement) {
    if (sql && sql.params) {
      sql.params.forEach((param: any) => {
        if (typeof param === 'object' && param.asObservable !== undefined && typeof param.asObservable === 'function') {
          this._subscriptions.push(
            param.asObservable().subscribe(() => {
              this.updateQueryCallbackChanges({ selectSqlStatement: true });
            }),
          );
        }
      });
    }

    return;
  }

  /**
   * observe queryCallbackChanges$
   */
  private observeQueryCallbackChanges(sql?: IStatement): Promise<void> {
    return new Promise(resolve => {
      this._subscriptions.push(
        this.queryCallbackChanges$.subscribe(async (changes: IQueryCallbackChanges) => {
          if (
            changes.geoLocationChanged ||
            changes.dataAdded ||
            changes.dataRemoved ||
            changes.dataUpdated ||
            changes.pageSize !== undefined ||
            changes.pageIndex !== undefined ||
            changes.pageSort !== undefined ||
            changes.selectSqlStatement !== undefined
          ) {
            if (changes.geoLocationChanged) {
              this._lastExecStatement = '';
            }
            this.execStatement(sql);
          }
        }),
      );
    });
  }

  /**
   *
   * @param statement
   */
  private replaceStatement(statement: string): string {
    this.repository.getClassProperties().forEach((property: IClassProperty) => {
      statement = statement.replace(new RegExp('\\(' + property.name + '->', 'gm'), '(_ref->' + property.name + '->');
      statement = statement.replace(new RegExp(' ' + property.name + '->', 'gm'), ' _ref->' + property.name + '->');
      statement = statement.replace(new RegExp(' ' + property.name + ' ', 'gm'), ' _ref->' + property.name + ' ');
      statement = statement.replace(new RegExp('\\(' + property.name + ' ', 'gm'), '(_ref->' + property.name + ' ');
    });

    return statement;
  }
}
