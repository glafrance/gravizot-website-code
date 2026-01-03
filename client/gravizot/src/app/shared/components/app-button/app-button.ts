import { Component, input } from "@angular/core";

@Component({
  selector: 'app-button',
  templateUrl: './app-button.html',
  styleUrls: ['./app-button.scss']
})
export class ButtonComponent {
  label = input<string>('Button Text');
  type = input<string>('button');
  disabled = input<boolean>(false);
  onClick = input<() => void>(() => {});
}