import { EntityManager, In } from 'typeorm';
import { RoomType } from '../../rooms/entities/room-type.entity';
import { Amenity } from '../../rooms/entities/amenity.entity';
import { BedType, Room, RoomView } from '../../rooms/entities/room.entity';

const ROOM_TYPES = [
  { name: 'Standard', description: 'Phòng tiêu chuẩn' },
  { name: 'Deluxe', description: 'Phòng cao cấp' },
  { name: 'Suite', description: 'Phòng hạng sang' },
];

const AMENITIES = [
  'air_conditioner',
  'wifi',
  'tv',
  'minibar',
  'bathtub',
  'balcony',
];

// [name, type, price/night, capacity, bed, view, amenities]
const ROOMS: [string, string, number, number, BedType, RoomView, string[]][] = [
  [
    'Room 101',
    'Standard',
    500000,
    1,
    BedType.SINGLE,
    RoomView.CITY,
    ['air_conditioner', 'wifi'],
  ],
  [
    'Room 102',
    'Standard',
    600000,
    2,
    BedType.DOUBLE,
    RoomView.GARDEN,
    ['air_conditioner', 'wifi', 'tv'],
  ],
  [
    'Room 201',
    'Deluxe',
    1200000,
    2,
    BedType.DOUBLE,
    RoomView.CITY,
    ['air_conditioner', 'wifi', 'tv', 'minibar'],
  ],
  [
    'Room 202',
    'Deluxe',
    1400000,
    3,
    BedType.DOUBLE,
    RoomView.SEA,
    ['air_conditioner', 'wifi', 'tv', 'minibar', 'balcony'],
  ],
  ['Room 301', 'Suite', 2500000, 4, BedType.DOUBLE, RoomView.SEA, AMENITIES],
];

/** Seeds room types, amenities and rooms. Rows whose name already exists are skipped. */
export async function seedRooms(manager: EntityManager) {
  await manager
    .createQueryBuilder()
    .insert()
    .into(RoomType)
    .values(ROOM_TYPES)
    .orIgnore()
    .execute();
  await manager
    .createQueryBuilder()
    .insert()
    .into(Amenity)
    .values(AMENITIES.map((name) => ({ name })))
    .orIgnore()
    .execute();

  const types = await manager.find(RoomType);
  const amenities = await manager.find(Amenity);
  const existing = await manager.find(Room, {
    where: { name: In(ROOMS.map(([name]) => name)) },
    withDeleted: true,
  });
  const existingNames = new Set(existing.map((room) => room.name));

  const newRooms = ROOMS.filter(([name]) => !existingNames.has(name)).map(
    ([name, typeName, pricePerNight, capacity, bedType, view, amenityNames]) =>
      manager.create(Room, {
        name,
        pricePerNight,
        capacity,
        bedType,
        view,
        roomType: types.find((t) => t.name === typeName),
        amenities: amenities.filter((a) => amenityNames.includes(a.name)),
      }),
  );
  await manager.save(newRooms);
  return newRooms.length;
}
