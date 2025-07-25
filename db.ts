import {
  Sequelize,
  DataTypes,
  Model,
  Optional,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

/**
 * Initialize Sequelize with MySQL database configuration
 */
export const sequelize = new Sequelize({
  dialect: 'mysql',
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
});

/**
 * Define the attributes of the Device table
 */
export interface DeviceAttributes {
  id: number;
  token: string;
  platform: string;
}

/**
 * Define the creation attributes of the Device model.
 * The `id` field is optional when creating a new Device instance.
 */
export type DeviceCreationAttributes = Optional<DeviceAttributes, 'id'>;

/**
 * Define the Device model class with proper typing
 */
export class DeviceModel
  extends Model<InferAttributes<DeviceModel>, InferCreationAttributes<DeviceModel>>
  implements DeviceAttributes
{
  declare id: CreationOptional<number>;
  declare token: string;
  declare platform: string;
}

/**
 * Create the Sequelize model instance for the Device table
 */
export const Device = sequelize.define<DeviceModel>('Device', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});


