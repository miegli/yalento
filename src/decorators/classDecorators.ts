import "reflect-metadata";
import { IConfig } from '..';


export function Connect(config: IConfig) {
    return <T extends { new(...args: any[]): {} }>(constructor: T) => {
        return class extends constructor {
            public static CONFIG = config;
            public static TABLE = constructor.toString().split( ' ')[1];
        }
    }
}

