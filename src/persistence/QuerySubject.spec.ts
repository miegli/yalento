import {expect} from 'chai';
import {describe, it} from 'mocha';
import {Repository} from '..';


export class Contact {

    public name: string;
    public lastName: string;
    public street: string = '';
    public age: number;

    constructor(name: string, lastName: string, age: number) {
        this.name = name;
        this.lastName = lastName;
        this.age = age;
    }

}


describe('QuerySubjectTest', async () => {


});
