import { Model, ModelAttributes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
// @ts-ignore
import * as sql from 'sql.js/dist/sql-wasm.js';

export interface IConfig {

    attributes: ModelAttributes;

}

export abstract class AbstractModel extends Model {

    public static CONFIG: IConfig;
    private _connected: boolean = false;

    public static connect<M extends Model = Model>(this: any): Promise<boolean> {

        return new Promise<any>((resolve) => {

            if (this._connected) {
                resolve(true);
                return;
            }

            const sequelize = new Sequelize({
                database: ':memory:',
                dialect: 'sqlite',
                username: 'root',
                password: '',
                storage: ':memory:',
                dialectModule: sql.Database,
                logging: false,
            });

            this.init(this.CONFIG.attributes, {
                modelName: this.TABLE,
                tableName: this.TABLE,
                sequelize: sequelize,

            });

            this.afterSave((t: any) => {
                console.log('save', t['dataValues']);
            })

            this.sync({ force: true }).then(() => {
                this._connected = true;
                resolve(true);
            });

        });


    }

}
