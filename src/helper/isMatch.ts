// <reference path="alasql.d.ts" />
// tslint:disable-next-line:no-var-requires
const alasql = require('alasql');

export class IsMatch {
    public static sql(whereStatement: string, object: any): boolean {

        const result = alasql('SELECT COUNT(*) as c FROM ? WHERE ' + whereStatement, [[object]]);
        return result[0]['c'] > 0;
    }
}