import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitorService } from './monitor/monitor.service';
import { MailService } from './mail/mail.service';

@Module({
  imports: [ConfigModule.forRoot(), ScheduleModule.forRoot()],
  providers: [MonitorService, MailService],
})
export class AppModule {}
