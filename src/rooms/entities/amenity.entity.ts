import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Room } from './room.entity';

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @ManyToMany(() => Room, (room) => room.amenities)
  rooms: Room[];
}
