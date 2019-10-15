import { expect } from 'chai';
import { after, describe, it } from 'mocha';
import { AbstractModel, Connect, DataTypes, Model } from '../../../../src';


@Connect({
    attributes: {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: new DataTypes.STRING(128),
            allowNull: false,
        },
        preferredName: {
            type: new DataTypes.STRING(128),
            allowNull: true,
        },
    },
})
class User extends AbstractModel {


    public id!: number; // Note that the `null assertion` `!` is required in strict mode.
    public name!: string;
    public preferredName!: string | null; // for nullable fields


}

export function modelTest(): Promise<void> {

    return new Promise((resolve) => {

        describe('RepositoryTest', async () => {

            after(async () => {
                resolve();
            });

            it('model extends abstractModel', async () => {

                expect(Object.getPrototypeOf(AbstractModel)).to.equal(Model);

            });

            it('model connect should initialize with given configuration', async () => {

                expect(await User.connect()).to.be.true;
                expect(User.getTableName()).to.be.equal('User');
                expect(User.sequelize.config.database).to.be.equal(':memory:');
                expect(User.hasHook('afterSave')).to.be.true;

                const newUser = await User.create({ name: 'test', preferredName: 'test2' });

                await User.create({ name: 'test', preferredName: 'test2' });

                expect((await User.findAll())[0].preferredName).to.be.equal('test2');

                newUser.preferredName = 'test-changed';

                await newUser.save();

                expect((await User.findAll())[0].preferredName).to.be.equal('test-changed');
                expect(await User.findAll()).to.be.length(2);

            });


        });

    });
}
