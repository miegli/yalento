import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Contact } from '../../models/contact';

@Component({
  selector: 'app-contact-detail',
  templateUrl: './contact-detail.component.html',
  styleUrls: ['./contact-detail.component.css'],
})
export class ContactDetailComponent implements OnInit {

  contact$: BehaviorSubject<Contact>;

  constructor(private route: ActivatedRoute, private router: Router) {
  }

  ngOnInit() {

    this.route.paramMap.subscribe(params => {
      console.log(params);
    });

  }

  save(contact: Contact) {



  }

  cancel() {
    this.router.navigate(['/contacts']).then();
  }

}
