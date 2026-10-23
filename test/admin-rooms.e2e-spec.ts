import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import {
  createBooking,
  dayFromToday,
  seedRoomCatalog,
} from './utils/room-fixtures.helper';
import {
  PNG,
  smallImage,
  trackUploads,
  uploadExists,
  waitForCleanup,
} from './utils/uploads.helper';
import { Room } from '../src/rooms/entities/room.entity';
import { Amenity } from '../src/rooms/entities/amenity.entity';
import { BookingStatus } from '../src/bookings/entities/booking.entity';
import { UserRole } from '../src/users/entities/user.entity';

describe('Admin rooms (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;
  let amenityIds: Record<string, string>;
  let uploads: ReturnType<typeof trackUploads>;

  const uuid0 = '00000000-0000-4000-8000-000000000000';
  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${admin.token}`);
  const validRoom = () => ({
    name: 'Room 401',
    roomTypeId: catalog.deluxe.id,
    pricePerNight: 1500000,
    capacity: 3,
    bedType: 'double',
    view: 'sea',
    description: 'Ocean view',
    amenityIds: [amenityIds.wifi, amenityIds.tv],
  });
  const create = (body: object) =>
    asAdmin(api().post('/api/admin/rooms').send(body));
  const roomCount = () => catalog.ds.getRepository(Room).count();

  beforeAll(async () => {
    app = await createTestApp();
    uploads = trackUploads();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    admin = await createUser(app, {
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
    const amenities = await catalog.ds.getRepository(Amenity).find();
    amenityIds = Object.fromEntries(amenities.map((a) => [a.name, a.id]));
  });

  afterAll(async () => {
    uploads.cleanup();
    await app.close();
  });

  it('is admin-only (401 / 403)', async () => {
    const user = await createUser(app, { email: 'user@example.com' });
    await api().get('/api/admin/rooms').expect(401);
    await api()
      .get('/api/admin/rooms')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  describe('POST /api/admin/rooms', () => {
    it('creates a room with its type and amenities', async () => {
      const res = await create(validRoom()).expect(201);

      expect(res.body).toMatchObject({
        name: 'Room 401',
        pricePerNight: 1500000,
        capacity: 3,
        roomType: { id: catalog.deluxe.id, name: 'Deluxe' },
        amenities: ['tv', 'wifi'],
        images: [],
      });
      expect(res.body.createdAt).toEqual(expect.any(String));
      await api().get(`/api/rooms/${res.body.id}`).expect(200);
    });

    it('rolls back when an amenity does not exist (transaction)', async () => {
      const before = await roomCount();
      const res = await create({
        ...validRoom(),
        amenityIds: [amenityIds.wifi, uuid0],
      }).expect(400);

      expect(res.body.message).toContain(uuid0);
      expect(await roomCount()).toBe(before);
    });

    it.each([
      ['unknown roomTypeId', { roomTypeId: uuid0 }],
      ['blank name', { name: '   ' }],
      ['negative price', { pricePerNight: -1 }],
      ['price with 3 decimals', { pricePerNight: 1.234 }],
      ['capacity 0', { capacity: 0 }],
      ['unknown bedType', { bedType: 'king' }],
      ['duplicate amenityIds', { amenityIds: [uuid0, uuid0] }],
      ['missing view', { view: undefined }],
    ])('returns 400 for %s', async (_: string, override: object) => {
      await create({ ...validRoom(), ...override }).expect(400);
    });
  });

  describe('GET /api/admin/rooms', () => {
    it('lists rooms with image ids, timestamps and the search filters', async () => {
      const res = await asAdmin(
        api().get('/api/admin/rooms').query({ view: 'sea' }),
      ).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        name: 'Luxury',
        images: [{ id: expect.any(String), url: '/uploads/lux.png' }],
        updatedAt: expect.any(String),
      });
    });

    it('GET /:id returns 404 for unknown rooms', async () => {
      await asAdmin(api().get(`/api/admin/rooms/${uuid0}`)).expect(404);
    });
  });

  describe('PATCH /api/admin/rooms/:id', () => {
    const patch = (id: string, body: object) =>
      asAdmin(api().patch(`/api/admin/rooms/${id}`).send(body));

    it('updates only the sent fields', async () => {
      const res = await patch(catalog.mid.id, { pricePerNight: 900000 }).expect(
        200,
      );
      expect(res.body).toMatchObject({
        name: 'Mid',
        pricePerNight: 900000,
        capacity: 2,
        roomType: { name: 'Standard' },
        amenities: ['air_conditioner', 'wifi'],
      });
    });

    it('replaces amenities and room type', async () => {
      const res = await patch(catalog.mid.id, {
        amenityIds: [amenityIds.tv],
        roomTypeId: catalog.deluxe.id,
      }).expect(200);
      expect(res.body).toMatchObject({
        amenities: ['tv'],
        roomType: { name: 'Deluxe' },
      });

      const cleared = await patch(catalog.mid.id, { amenityIds: [] }).expect(
        200,
      );
      expect(cleared.body.amenities).toEqual([]);
    });

    it('keeps existing booking prices (snapshot)', async () => {
      const booking = await createBooking(catalog.ds, {
        room: catalog.mid,
        user: catalog.guest,
        checkIn: dayFromToday(10),
        checkOut: dayFromToday(12),
      });
      await patch(catalog.mid.id, { pricePerNight: 1 }).expect(200);

      const res = await asAdmin(
        api().get(`/api/admin/bookings/${booking.id}`),
      ).expect(200);
      expect(res.body.totalPrice).toBe(booking.totalPrice);
    });

    it('returns 404 / 400 for unknown room / room type', async () => {
      await patch(uuid0, { capacity: 2 }).expect(404);
      await patch(catalog.mid.id, { roomTypeId: uuid0 }).expect(400);
    });
  });

  describe('DELETE /api/admin/rooms/:id', () => {
    const remove = (id: string) =>
      asAdmin(api().delete(`/api/admin/rooms/${id}`));

    it('soft-deletes: hidden everywhere but kept in the DB', async () => {
      await remove(catalog.mid.id).expect(200);

      await api().get(`/api/rooms/${catalog.mid.id}`).expect(404);
      await asAdmin(api().get(`/api/admin/rooms/${catalog.mid.id}`)).expect(
        404,
      );
      const row = await catalog.ds
        .getRepository(Room)
        .findOne({ where: { id: catalog.mid.id }, withDeleted: true });
      expect(row?.deletedAt).toBeInstanceOf(Date);

      await remove(catalog.mid.id).expect(404);
    });

    it.each([BookingStatus.PENDING, BookingStatus.APPROVED])(
      'returns 409 while a future %s booking exists',
      async (status) => {
        await createBooking(catalog.ds, {
          room: catalog.mid,
          user: catalog.guest,
          checkIn: dayFromToday(5),
          checkOut: dayFromToday(7),
          status,
        });
        await remove(catalog.mid.id).expect(409);
      },
    );

    it('allows deleting when bookings are finished, rejected or cancelled', async () => {
      const book = (from: number, to: number, status: BookingStatus) =>
        createBooking(catalog.ds, {
          room: catalog.mid,
          user: catalog.guest,
          checkIn: dayFromToday(from),
          checkOut: dayFromToday(to),
          status,
        });
      await book(-5, -3, BookingStatus.APPROVED); // stay already over
      await book(5, 7, BookingStatus.REJECTED);
      await book(5, 7, BookingStatus.CANCELLED);
      await remove(catalog.mid.id).expect(200);
    });
  });

  describe('room images', () => {
    const upload = (roomId: string, count = 2) => {
      const req = asAdmin(api().post(`/api/admin/rooms/${roomId}/images`));
      for (let i = 0; i < count; i++) req.attach('images', smallImage, PNG);
      return req;
    };

    it('uploads several images and lists them on the room', async () => {
      const res = await upload(catalog.mid.id, 2).expect(201);

      expect(res.body).toHaveLength(2);
      res.body.forEach((img: { url: string }) =>
        expect(uploadExists(img.url)).toBe(true),
      );
      const room = await asAdmin(
        api().get(`/api/admin/rooms/${catalog.mid.id}`),
      ).expect(200);
      expect(room.body.images).toHaveLength(2);
    });

    it('deletes an image row and its file', async () => {
      const [image] = (await upload(catalog.mid.id, 1).expect(201)).body;

      await asAdmin(
        api().delete(`/api/admin/rooms/${catalog.mid.id}/images/${image.id}`),
      ).expect(200);
      expect(uploadExists(image.url)).toBe(false);

      // Gone, and an image can't be deleted through another room either
      await asAdmin(
        api().delete(`/api/admin/rooms/${catalog.mid.id}/images/${image.id}`),
      ).expect(404);
      const [other] = (await upload(catalog.cheap.id, 1).expect(201)).body;
      await asAdmin(
        api().delete(`/api/admin/rooms/${catalog.mid.id}/images/${other.id}`),
      ).expect(404);
    });

    it('leaves no files behind when the request fails', async () => {
      const before = uploads.newFiles().length;

      await upload(uuid0, 2).expect(404); // unknown room
      await upload(catalog.mid.id, 11).expect(400); // over the 10-file limit
      await asAdmin(api().post(`/api/admin/rooms/${catalog.mid.id}/images`))
        .attach('images', smallImage, PNG)
        .attach('images', Buffer.from('x'), {
          filename: 'a.txt',
          contentType: 'text/plain',
        })
        .expect(400); // one non-image in the batch
      await upload(catalog.mid.id, 0).expect(400); // no file at all

      await waitForCleanup();
      expect(uploads.newFiles()).toHaveLength(before);
    });
  });
});
