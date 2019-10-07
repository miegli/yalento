import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';
import { ContactRepository } from '../../repositories/contact-repository';

@Component({
  selector: 'app-contact-detail',
  templateUrl: './contact-detail.component.html',
  styleUrls: ['./contact-detail.component.css'],
})
export class ContactDetailComponent implements OnInit {

  contact$: BehaviorSubject<Contact>;

  constructor(private route: ActivatedRoute, private router: Router, private contactRepository: ContactRepository) {
  }

  ngOnInit() {

    this.route.paramMap.subscribe(params => {
      this.contact$ = this.contactRepository.getOneByIdentifier(params.get('identifier'));
    });

  }

  save(contact: Contact) {

    contact.save(() => {
      this.cancel();
    });

  }

  cancel() {
    this.router.navigate(['/contacts']).then();
  }

}
