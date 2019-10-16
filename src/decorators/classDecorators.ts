import 'reflect-metadata';

export function Entity() {
  return <T extends new (...args: any[]) => {}>(constructor: T) => {
    return class extends constructor {

    };
  };
}
