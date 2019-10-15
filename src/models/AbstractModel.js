"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sql = require("sql.js/dist/sql-wasm.js");
class AbstractModel extends sequelize_1.Model {
    constructor() {
        super(...arguments);
        this._connected = false;
    }
    static connect() {
        return new Promise(resolve => {
            if (this._connected) {
                resolve(true);
                return;
            }
            const sequelize = new sequelize_typescript_1.Sequelize({
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
            this.afterSave((t) => {
            });
            this.sync({ force: true }).then(() => {
                this._connected = true;
                resolve(true);
            });
        });
    }
}
exports.AbstractModel = AbstractModel;
