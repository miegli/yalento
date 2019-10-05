import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { BaseRepository } from '../../core/base-repository';
import { TestRelations } from '../model/test-relations';

@Injectable()
export class TestRelationsRepository extends BaseRepository {

    constructor(db: AngularFirestore) {
      super(db);
      this.model = TestRelations;
    }
}
