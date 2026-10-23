import { PartialType } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';

/** Every field optional; amenityIds, when sent, replaces the whole list. */
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
