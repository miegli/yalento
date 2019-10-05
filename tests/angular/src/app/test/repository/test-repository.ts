import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { BaseRepository } from '../../core/base-repository';
import { Test } from '../model/test';

@Injectable()
export class TestRepository extends BaseRepository {

    constructor(db: AngularFirestore) {
      super(db);
      this.model = Test;
    }
}
