import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { RoomImage } from './entities/room-image.entity';
import { Amenity } from './entities/amenity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomType, RoomImage, Amenity])],
  exports: [TypeOrmModule],
})
export class RoomsModule {}
