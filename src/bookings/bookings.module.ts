import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MeBookingsController } from './me-bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { MailModule } from '../mail/mail.module';
import { BookingCompletionService } from './booking-completion.service';
import { BookingCompletionCron } from './booking-completion.cron';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), MailModule],
  controllers: [
    BookingsController,
    MeBookingsController,
    AdminBookingsController,
  ],
  providers: [
    BookingsService,
    AdminBookingsService,
    BookingCompletionService,
    BookingCompletionCron,
  ],
  exports: [TypeOrmModule],
})
export class BookingsModule {}
