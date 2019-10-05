import { AngularFirestore } from '@angular/fire/firestore';
import { AbstractRepository } from '../../../../../src/abstractRepository';

export class BaseRepository extends AbstractRepository {
  constructor(db: AngularFirestore) {
    super(db);
  }
}
