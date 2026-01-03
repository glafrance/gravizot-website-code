import { Component } from "@angular/core";
import { ViewportScroller } from "@angular/common";

import { ButtonComponent } from "../../shared/components/app-button/app-button";
import { Contact } from "../../components/contact/contact";
import { Gravizot } from "../../shared/components/gravizot/gravizot";

@Component({
  selector: 'home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [Contact, ButtonComponent, Gravizot]
})
export class HomePage {
  constructor(private scroller: ViewportScroller) {}

  scrollToContact = () => {
      this.scroller.scrollToAnchor('contact');
  }
}