import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Repository } from '../Repository';

export class Contact {
  public name: string = '';
  public lastName: string = '';
  public street: string = '';
  public age: number = 0;
}

describe('QueryPaginatorTest', async () => {
  it('select operation on repository should return query paginator with correct length', async () => {
    const repository: Repository<Contact> = new Repository(Contact);
    const select = repository.select({}, { pageSize: 1 });
    await repository.createMany([{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]);
    await select.getResultsAsPromise();
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(1);
  });

  it('paginator should work with page changes and default values', async () => {
    const repository: Repository<Contact> = new Repository(Contact);
    const select = repository.select({}, { pageSize: 1 });
    await repository.createMany([{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]);
    await select.getResultsAsPromise();
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(1);
    await select.getPaginator().setPageSize(2);
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(2);

    await select.getPaginator().setPage({ pageSize: 3, pageIndex: 1 });
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(3);

    await select.getPaginator().setPage({ pageSize: 3, pageIndex: 4 });
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(1);

    await select.getPaginator().setPage({});
    expect(select.getPaginator().getLength()).to.be.eq(10);
    expect(select.getPaginator().getResults()).to.be.lengthOf(1);
  });

  it('selecting item on paginators should return correct state', async () => {
    const repository: Repository<Contact> = new Repository(Contact);
    const select = repository.select({}, { pageSize: 1 });
    await repository.createMany([{ age: 1 }, { age: 2 }, { age: 3 }, { age: 4 }, { age: 5 }]);
    const results = await select.getResultsAsPromise();
    expect(
      select
        .getPaginator()
        .getSelectedCount()
        .getValue(),
    ).to.be.equal(0);

    select.getPaginator().toggleSelection(results[0]);
    expect(
      select
        .getPaginator()
        .getSelectedCount()
        .getValue(),
    ).to.be.equal(1);
    expect(select.getPaginator().getSelected()[0].age).to.be.equal(1);
    expect(select.getPaginator().isSelected(results[0])).to.be.true;

    select.getPaginator().toggleSelection();
    expect(
      select
        .getPaginator()
        .getSelectedCount()
        .getValue(),
    ).to.be.equal(5);
    expect(select.getPaginator().getSelected()).to.be.lengthOf(5);

    select.getPaginator().toggleSelection();
    expect(select.getPaginator().getSelected()).to.be.lengthOf(0);
  });
});
