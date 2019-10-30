import {expect} from 'chai';
import {describe, it} from 'mocha';
import {Repository} from '../..';

export class Contact {

    public name: string = '';
    public lastName: string = '';
    public street: string = '';
    public age: number = 0;

}

describe('QueryPaginatorTest', async () => {

    const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

    before(async () => {
        for (let i = 0; i < 100; i++) {
            await repository.create({name: 'name', lastName: 'lastName', age: i});
        }
    })


    it('select with empty options and should return paginator', async () => {


        const select = repository.select();

        expect(select.getPaginator().getPageSize()).to.be.equal(0);
        expect(select.getPaginator().getPageIndex()).to.be.equal(0);
        expect(select.getPaginator().getPageSizeOptions()).to.be.lengthOf(0);
        expect(select.getResults()).to.be.lengthOf(100);
        expect(select.getPaginator().getLength()).to.be.equal(100);


    });

    it('select with default page sort options should return paginator', async () => {


        const select = repository.select({}, {
            pageSort: {
                active: 'name',
                direction: 'DESC',
            }
        });

        expect(select.getResults()[99].age).to.be.equal(99);


    });

    it('select with paginator default options should return paginator with correct pageSize and pageSize options', async () => {


        const select = repository.select({}, {
            pageSize: 1,
            pageSizeOptions: [1, 2, 3],
        });

        expect(select.getPaginator().getPageSize()).to.be.equal(1);
        expect(select.getPaginator().getPageSizeOptions()).to.be.deep.eq([1, 2, 3]);

        const select2 = repository.select({}, {
            pageSize: 10,
            pageSizeOptions: [1, 2, 3],
        });

        expect(select2.getPaginator().getPageSize()).to.be.equal(10);
        expect(select2.getPaginator().getPageSizeOptions()).to.be.deep.eq([1, 2, 3, 10]);


    });

    it('select with paginator should walk trough pages', async () => {

        const select = repository.select({}, {
            pageSize: 1,
            pageSizeOptions: [1, 2, 3],
        });

        expect(select.getPaginator().getPageIndex()).to.be.equal(0);

        select.getPaginator().setPageIndex(1, true);
        expect(select.getPaginator().getPageIndex()).to.be.equal(1);

        select.getPaginator().setPageIndex(2);
        expect(select.getPaginator().getPageIndex()).to.be.equal(2);

        select.getPaginator().setPage({pageIndex: 3, pageSize: 1, length: 100});
        expect(select.getPaginator().getPageIndex()).to.be.equal(3);

    });

    it('select with paginator page greater than result count should return last page index', async () => {

        const select = repository.select({}, {
            pageSize: 1,
            pageSizeOptions: [1, 2, 3],
        });

        expect(select.getResults()).to.be.lengthOf(1);
        expect(select.getPaginator().getLength()).to.be.equal(100);

        select.getPaginator().setPageIndex(9999);
        expect(select.getPaginator().getPageIndex()).to.be.equal(100);

    });


    it('select with paginator page size changes should return paginator', async () => {

        const select = repository.select({}, {
            pageSize: 1,
            pageSizeOptions: [1, 2, 3],
        });

        expect(select.getResults()).to.be.lengthOf(1);
        select.getPaginator().setPage({pageSize: 2});
        expect(select.getResults()).to.be.lengthOf(2);

        select.getPaginator().setPageSize(3);
        expect(select.getResults()).to.be.lengthOf(3);


    });


    it('toggle select state for query results item should be applicable', async () => {

        const repositorySelect: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        for (let i = 0; i < 100; i++) {
            repositorySelect.create({name: 'name', lastName: 'lastName', age: i});
        }

        const contacts = repositorySelect.select({}, {
            pageSize: 5
        });

        for (let i = 0; i < 5; i++) {
            contacts.getPaginator().toggleSelection(contacts.getResults()[i]);
        }

        expect(contacts.getPaginator().getSelected()).to.be.lengthOf(5);
        expect(contacts.getPaginator().getSelectedCount().getValue()).to.be.equal(5);

        contacts.getPaginator().toggleSelection();

        expect(contacts.getPaginator().getSelected()).to.be.lengthOf(100);
        expect(contacts.getPaginator().getSelectedCount().getValue()).to.be.equal(100);

        contacts.getPaginator().toggleSelection();

        expect(contacts.getPaginator().getSelected()).to.be.lengthOf(0);
        expect(contacts.getPaginator().getSelectedCount().getValue()).to.be.equal(0);

        for (let i = 0; i < 5; i++) {
            contacts.getPaginator().toggleSelection(contacts.getResults()[i]);
        }

        expect(contacts.getPaginator().getSelected()).to.be.lengthOf(5);
        expect(contacts.getPaginator().getSelectedCount().getValue()).to.be.equal(5);

        contacts.getPaginator().toggleSelection(contacts.getResults()[0]);
        expect(contacts.getPaginator().isSelected(contacts.getResults()[0])).to.be.false;

        contacts.getPaginator().toggleSelection(contacts.getResults()[0]);
        expect(contacts.getPaginator().isSelected(contacts.getResults()[0])).to.be.true;


    });

});
