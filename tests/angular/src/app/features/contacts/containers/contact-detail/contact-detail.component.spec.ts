import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { CoreModule } from '../../../../core/core.module';
import { MaterialModule } from '../../../../material/material.module';
import { ContactComponent } from '../../components/contact/contact.component';
import { ContactRepository } from '../../repositories/contact-repository';
import { ContactDetailComponent } from './contact-detail.component';

describe('ContactDetailComponent', () => {
  let component: ContactDetailComponent;
  let fixture: ComponentFixture<ContactDetailComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ContactDetailComponent, ContactComponent ],
      imports: [ CoreModule, FormsModule, RouterModule.forRoot([]), MaterialModule, NoopAnimationsModule ],
      providers: [ ContactRepository ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
