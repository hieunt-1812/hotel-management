import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { RoomImage } from './entities/room-image.entity';
import { Amenity } from './entities/amenity.entity';
import { ReviewsModule } from '../reviews/reviews.module';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomCatalogController } from './room-catalog.controller';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';
import { AdminRoomImagesService } from './admin-room-images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomType, RoomImage, Amenity]),
    ReviewsModule,
  ],
  controllers: [RoomsController, RoomCatalogController, AdminRoomsController],
  providers: [RoomsService, AdminRoomsService, AdminRoomImagesService],
  exports: [TypeOrmModule],
})
export class RoomsModule {}
