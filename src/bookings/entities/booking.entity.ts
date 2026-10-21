import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { decimalTransformer } from '../../database/transformers/decimal.transformer';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Review } from '../../reviews/entities/review.entity';

export enum BookingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/** Bookings in these states hold the room; rejected/cancelled ones free it. */
export const ROOM_BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
];

@Entity('bookings')
// Speeds up the "room available?" overlap check on a room's date range
@Index(['room', 'checkIn', 'checkOut'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  /** Calculated on the server from the room price at booking time. */
  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalPrice: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index()
  @ManyToOne(() => User, (user) => user.bookings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Room, (room) => room.bookings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];

  @OneToOne(() => Review, (review) => review.booking)
  review: Review | null;
}
