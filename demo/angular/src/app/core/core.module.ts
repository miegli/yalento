import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AngularFireModule} from '@angular/fire';
import {environment} from '../../environments/environment';

@NgModule({
  declarations: [],
  exports: [],
  imports: [
    CommonModule,
    AngularFireModule.initializeApp(environment.firebase)
  ]
})
export class CoreModule {

}
