import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MeBookingsController } from './me-bookings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [BookingsController, MeBookingsController],
  providers: [BookingsService],
  exports: [TypeOrmModule],
})
export class BookingsModule {}
