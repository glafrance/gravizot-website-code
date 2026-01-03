import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from "rxjs";

import { ButtonComponent } from "../../shared/components/app-button/app-button";
import { Gravizot } from "../../shared/components/gravizot/gravizot";
import { ContactService } from "../../core/services/contact.service";

const EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

@Component({
  selector: "contact",
  templateUrl: "./contact.html",
  styleUrls: ["./contact.scss"],
  imports: [ButtonComponent, CommonModule, Gravizot, ReactiveFormsModule]
})
export class Contact {
  private fb = inject(FormBuilder);
  contactService = inject(ContactService);

  readonly contactForm = this.fb.group(
    {
      email: ['', [Validators.required, Validators.pattern(EMAIL_REGEX)]],
      topic: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(120)]],
      message: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(1000)]],
    },
  );

  submitting = signal(false);
  result = signal<any>(null);  
  errorMsg = signal<string | null>(null);

  get email() {
    return this.contactForm.get('email');
  }
  get topic() {
    return this.contactForm.get('topic');
  }
  get message() {
    return this.contactForm.get('message');
  }

  async submit() {
  if (this.contactForm.invalid) return;
      this.submitting.set(true);
      try {
        const res = await this.contactService.submitContactMessage({
          topic: this.contactForm.value.topic!,
          email: this.contactForm.value.email!,
          message: this.contactForm.value.message!
        });
        this.result.set(res);

        this.contactForm.reset();
        this.contactForm.markAsPristine();
        this.contactForm.markAsUntouched();
      } catch (err: any) {
        this.result.set(err.error || { error: 'Unexpected error' });
      } finally {
        this.submitting.set(false);
      }
  }

  // Template helper
  hasError(path: string, error: string) {
    const c = this.contactForm.get(path);
    return !!c && c.touched && c.hasError(error);
  }  
}