import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';

/** Lookup lists used to build the room search filters. */
@ApiTags('Rooms')
@Controller()
export class RoomCatalogController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('room-types')
  @ApiOperation({ summary: 'Danh sách loại phòng' })
  findRoomTypes() {
    return this.roomsService.findRoomTypes();
  }

  @Get('amenities')
  @ApiOperation({ summary: 'Danh sách tiện nghi' })
  findAmenities() {
    return this.roomsService.findAmenities();
  }
}
