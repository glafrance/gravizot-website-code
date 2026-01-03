import { NgClass, NgStyle } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "gravizot",
  templateUrl: "./gravizot.html",
  styleUrls: ["./gravizot.scss"],
  imports: [NgClass, NgStyle]
})
export class Gravizot {
  variant = input<'light' | 'dark'>('dark');
  color = input<string>(null);
}