import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ItemComponent} from './item.component';
import { Component, ViewChild } from "@angular/core";


describe('ItemComponent', () => {
  let testHostComponent: TestHostComponent;
  let testHostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ItemComponent, TestHostComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testHostFixture = TestBed.createComponent(TestHostComponent);
    testHostComponent = testHostFixture.componentInstance;
  });

  it('should show TEST INPUT', async() => {
    testHostComponent.name = 'test input';
    testHostFixture.detectChanges();
    expect(testHostFixture.nativeElement.querySelector('.name').innerText).toEqual('test input');
  });

  @Component({
    selector: `host-component`,
    template: `<app-item [name]="name"></app-item>`
  })
  class TestHostComponent {
    @ViewChild(ItemComponent, null)

    public name: string;

    public ItemComponent: ItemComponent;
  }
});
