import { CommonModule } from '@angular/common';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { CoreModule } from '../../../../core/core.module';
import { MaterialModule } from '../../../../material/material.module';
import { ContactComponent } from '../../components/contact/contact.component';
import { Contact } from '../../models/contact';
import { ContactDialogComponent } from './contact-dialog.component';

describe('ContactDialogComponent', () => {
  let component: ContactDialogComponent;
  let fixture: ComponentFixture<ContactDialogComponent>;

  const mockDialogRef = {
    close: jasmine.createSpy('close'),
  };

  const contact$: BehaviorSubject<Contact> = new BehaviorSubject<Contact>(new Contact());

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ContactDialogComponent, ContactComponent],
      imports: [MaterialModule, CommonModule, CoreModule, FormsModule, NoopAnimationsModule],
      providers: [
        {
          provide: MatDialogRef,
          useValue: mockDialogRef,
        }, {
          provide: MAT_DIALOG_DATA,
          useValue: contact$
        }
      ],
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
