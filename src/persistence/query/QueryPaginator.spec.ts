import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Base, Repository } from '../..';
import { QueryCallback } from './QueryCallback';


export class Contact extends Base {

    public name: string = '';
    public lastName: string = '';
    public street: string = '';
    public age: number = 0;

}

describe('QueryPaginatorTest', async () => {

    const repository: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

    before(() => {
        for (let i = 0; i < 100; i++) {
            repository.create({ name: 'name', lastName: 'lastName', age: i });
        }
    })


    it('select with empty options and should return paginator', async () => {


        const select = repository.selectWithPaginator();

        expect(select.getPageSize()).to.be.equal(0);
        expect(select.getPageIndex()).to.be.equal(0);
        expect(select.getPageSizeOptions()).to.be.lengthOf(0);
        expect(select.getResults()).to.be.lengthOf(100);
        expect(select.getLength()).to.be.equal(100);


    });

    it('select with default page sort options should return paginator', async () => {


        const select = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSort: {
                    active: 'name',
                    direction: 'DESC',
                },
            },
        });


        expect(select.getResults()[99].age).to.be.equal(99);


    });

    it('select with paginator default options should return paginator with correct pageSize and pageSize options', async () => {


        const select = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSize: 1,
                pageSizeOptions: [1, 2, 3],
            },
        });

        expect(select.getPageSize()).to.be.equal(1);
        expect(select.getPageSizeOptions()).to.be.deep.eq([1, 2, 3]);

        const select2 = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSize: 10,
                pageSizeOptions: [1, 2, 3],
            },
        });

        expect(select2.getPageSize()).to.be.equal(10);
        expect(select2.getPageSizeOptions()).to.be.deep.eq([1, 2, 3, 10]);


    });

    it('select with paginator should walk trough pages', async () => {

        const select = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSize: 1,
                pageSizeOptions: [1, 2, 3],
            },
        });

        expect(select.getPageIndex()).to.be.equal(0);

        select.setPageIndex(1, true);
        expect(select.getPageIndex()).to.be.equal(1);

        select.setPageIndex(2);
        expect(select.getPageIndex()).to.be.equal(2);

        select.setPage({ pageIndex: 3, pageSize: 1, length: 100 });
        expect(select.getPageIndex()).to.be.equal(3);

    });

    it('select with paginator page greater than result count should return last page index', async () => {

        const select = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSize: 1,
                pageSizeOptions: [1, 2, 3],
            },
        });

        expect(select.getResults()).to.be.lengthOf(1);
        expect(select.getLength()).to.be.equal(100);

        select.setPageIndex(9999);
        expect(select.getPageIndex()).to.be.equal(100);

    });


    it('select with paginator page size changes should return paginator', async () => {

        const select = repository.selectWithPaginator({
            paginatorDefaults: {
                pageSize: 1,
                pageSizeOptions: [1, 2, 3],
            },
        });

        expect(select.getResults()).to.be.lengthOf(1);
        select.setPage({ pageSize: 2 });
        expect(select.getResults()).to.be.lengthOf(2);

        select.setPageSize(3);
        expect(select.getResults()).to.be.lengthOf(3);


    });

    it('select with paginator same page changes should not invoke updateQueryCallbackChanges', async () => {

        let counter = 0;
        const exec = async (): Promise<number> => new Promise<number>((resolve => {
            repository.select({}, (callback: QueryCallback<Contact>) => {
                if (callback.getResults().length === 0) {
                    counter++;
                }
                callback.paginator.setPage({ pageSize: 2 });
                callback.paginator.setPage({ pageSize: 2 });
                callback.paginator.setPage({ pageSize: 2 });
                callback.paginator.setPage({ pageSize: 2 });
                counter++;
            });

            setTimeout(() => {
                resolve(counter);
            }, 100);
        }));

        expect(await exec()).to.be.equal(2);

    });


    it('toggle select state for query results item should be applicable', async () => {

        const repositorySelect: Repository<Contact> = new Repository(Contact, 'test1', 'test2', 1);

        for (let i = 0; i < 100; i++) {
            repositorySelect.create({ name: 'name', lastName: 'lastName', age: i });
        }

        const contacts = repositorySelect.selectWithPaginator( { paginatorDefaults: { pageSize: 5}});

        for (let i = 0; i < 5; i++) {
            contacts.toggleSelection(contacts.getResults()[i]);
        }

        expect(contacts.getSelected()).to.be.lengthOf(5);
        expect(contacts.getSelectedCount().getValue()).to.be.equal(5);

        contacts.toggleSelection();

        expect(contacts.getSelected()).to.be.lengthOf(100);
        expect(contacts.getSelectedCount().getValue()).to.be.equal(100);

        contacts.toggleSelection();

        expect(contacts.getSelected()).to.be.lengthOf(0);
        expect(contacts.getSelectedCount().getValue()).to.be.equal(0);

        for (let i = 0; i < 5; i++) {
            contacts.toggleSelection(contacts.getResults()[i]);
        }

        expect(contacts.getSelected()).to.be.lengthOf(5);
        expect(contacts.getSelectedCount().getValue()).to.be.equal(5);

        contacts.toggleSelection(contacts.getResults()[0]);
        expect(contacts.isSelected(contacts.getResults()[0])).to.be.false;

        contacts.toggleSelection(contacts.getResults()[0]);
        expect(contacts.isSelected(contacts.getResults()[0])).to.be.true;


    });

});
