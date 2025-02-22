import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_SENDER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendEmail(subject: string, message: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_SENDER'),
        to: this.configService.get<string>('EMAIL_RECEIVER'),
        subject,
        text: message,
      });
      console.log(`📧 Email sent: ${subject}`);
    } catch (error) {
      console.error('❌ Error sending email:', error);
    }
  }
}
