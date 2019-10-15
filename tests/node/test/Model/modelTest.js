"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const src_1 = require("../../../../src");
let User = class User extends src_1.AbstractModel {
};
User = __decorate([
    src_1.Connect({
        attributes: {
            id: {
                type: src_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: new src_1.DataTypes.STRING(128),
                allowNull: false,
            },
            preferredName: {
                type: new src_1.DataTypes.STRING(128),
                allowNull: true,
            },
        },
    })
], User);
function modelTest() {
    return new Promise((resolve) => {
        mocha_1.describe('RepositoryTest', () => __awaiter(this, void 0, void 0, function* () {
            mocha_1.after(() => __awaiter(this, void 0, void 0, function* () {
                resolve();
            }));
            mocha_1.it('model extends abstractModel', () => __awaiter(this, void 0, void 0, function* () {
                chai_1.expect(Object.getPrototypeOf(src_1.AbstractModel)).to.equal(src_1.Model);
            }));
            mocha_1.it('model connect should initialize with given configuration', () => __awaiter(this, void 0, void 0, function* () {
                chai_1.expect(yield User.connect()).to.be.true;
                chai_1.expect(User.getTableName()).to.be.equal('User');
                chai_1.expect(User.sequelize.config.database).to.be.equal(':memory:');
                chai_1.expect(User.hasHook('afterSave')).to.be.true;
                const newUser = yield User.create({ name: 'test', preferredName: 'test2' });
                yield User.create({ name: 'test', preferredName: 'test2' });
                chai_1.expect((yield User.findAll())[0].preferredName).to.be.equal('test2');
                newUser.preferredName = 'test-changed';
                yield newUser.save();
                chai_1.expect((yield User.findAll())[0].preferredName).to.be.equal('test-changed');
                chai_1.expect(yield User.findAll()).to.be.length(2);
            }));
        }));
    });
}
exports.modelTest = modelTest;
