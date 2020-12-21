export class Contact {
  name: string;
  lastName: string;
  street: string = '';
  age: number;

  constructor(name: string, lastName: string, age: number) {
    this.name = name;
    this.lastName = lastName;
    this.age = age;
  }
}
