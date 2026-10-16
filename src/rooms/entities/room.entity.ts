import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { decimalTransformer } from '../../database/transformers/decimal.transformer';
import { Booking } from '../../bookings/entities/booking.entity';
import { RoomType } from './room-type.entity';
import { RoomImage } from './room-image.entity';
import { Amenity } from './amenity.entity';

export enum BedType {
  SINGLE = 'single',
  DOUBLE = 'double',
}

export enum RoomView {
  SEA = 'sea',
  CITY = 'city',
  GARDEN = 'garden',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    name: 'price_per_night',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  pricePerNight: number;

  /** Max number of guests. */
  @Column({ type: 'int' })
  capacity: number;

  @Column({ name: 'bed_type', type: 'varchar', length: 20 })
  bedType: BedType;

  @Column({ type: 'varchar', length: 20 })
  view: RoomView;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Soft delete: TypeORM filters out rows with deleted_at set. */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Index()
  @ManyToOne(() => RoomType, (roomType) => roomType.rooms, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @OneToMany(() => RoomImage, (image) => image.room)
  images: RoomImage[];

  @ManyToMany(() => Amenity, (amenity) => amenity.rooms)
  @JoinTable({
    name: 'room_amenities',
    joinColumn: { name: 'room_id' },
    inverseJoinColumn: { name: 'amenity_id' },
  })
  amenities: Amenity[];

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];
}
