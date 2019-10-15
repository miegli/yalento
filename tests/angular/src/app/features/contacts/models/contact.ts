import { AbstractModel, Connect } from '@yalento';
import { DataTypes } from 'sequelize';

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
export class Contact extends AbstractModel {


  public id!: number; // Note that the `null assertion` `!` is required in strict mode.
  public name!: string;
  public preferredName!: string | null; // for nullable fields


}
