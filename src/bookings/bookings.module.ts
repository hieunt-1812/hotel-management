import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MeBookingsController } from './me-bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), MailModule],
  controllers: [
    BookingsController,
    MeBookingsController,
    AdminBookingsController,
  ],
  providers: [BookingsService, AdminBookingsService],
  exports: [TypeOrmModule],
})
export class BookingsModule {}
