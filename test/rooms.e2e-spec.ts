import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser } from './utils/seed.helper';
import {
  createBooking,
  dayFromToday,
  seedRoomCatalog,
} from './utils/room-fixtures.helper';
import { BookingStatus } from '../src/bookings/entities/booking.entity';
import { Room } from '../src/rooms/entities/room.entity';
import { Review, ReviewStatus } from '../src/reviews/entities/review.entity';

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;

  const api = () => request(app.getHttpServer());
  const names = (res: request.Response) =>
    res.body.data.map((room: { name: string }) => room.name);
  const search = (query: object) =>
    api().get('/api/rooms').query(query).expect(200);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/rooms', () => {
    it('lists rooms newest first with serialized relations and meta', async () => {
      const res = await search({});

      expect(names(res)).toEqual(['Luxury', 'Mid', 'Cheap']);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
      expect(res.body.data[0]).toEqual({
        id: catalog.luxury.id,
        name: 'Luxury',
        pricePerNight: 2000000,
        capacity: 4,
        bedType: 'double',
        view: 'sea',
        description: null,
        roomType: { id: catalog.deluxe.id, name: 'Deluxe' },
        amenities: ['air_conditioner', 'tv', 'wifi'],
        images: ['/uploads/lux.png'],
      });
    });

    it('paginates', async () => {
      const res = await search({ page: 2, limit: 2 });
      expect(names(res)).toEqual(['Cheap']);
      expect(res.body.meta).toMatchObject({ total: 3, totalPages: 2 });
    });

    it('sorts by price', async () => {
      expect(names(await search({ sort: 'price_asc' }))).toEqual([
        'Cheap',
        'Mid',
        'Luxury',
      ]);
      expect(names(await search({ sort: 'price_desc' }))).toEqual([
        'Luxury',
        'Mid',
        'Cheap',
      ]);
    });

    it('requires ALL listed amenities', async () => {
      expect(names(await search({ amenities: 'wifi' }))).toHaveLength(3);
      expect(
        names(await search({ amenities: 'air_conditioner, wifi' })),
      ).toEqual(['Luxury', 'Mid']);
      expect(names(await search({ amenities: 'tv,wifi' }))).toEqual(['Luxury']);
      expect(names(await search({ amenities: 'jacuzzi' }))).toEqual([]);
    });

    it.each([
      [{ bedType: 'single' }, ['Cheap']],
      [{ view: 'sea' }, ['Luxury']],
      [{ capacity: 2 }, ['Luxury', 'Mid']],
      [{ minPrice: 500000, maxPrice: 1000000 }, ['Mid']],
      [{ maxPrice: 300000 }, ['Cheap']],
    ])('filters by %o', async (query, expected) => {
      expect(names(await search(query))).toEqual(expected);
    });

    it('filters by roomTypeId', async () => {
      const res = await search({ roomTypeId: catalog.deluxe.id });
      expect(names(res)).toEqual(['Luxury']);
    });

    it('hides soft-deleted rooms', async () => {
      await catalog.ds.getRepository(Room).softDelete(catalog.mid.id);
      expect(names(await search({}))).toEqual(['Luxury', 'Cheap']);
    });

    describe('availability (checkIn/checkOut)', () => {
      const checkIn = dayFromToday(10);
      const checkOut = dayFromToday(12);
      const book = (
        room: Room,
        from: number,
        to: number,
        status?: BookingStatus,
      ) =>
        createBooking(catalog.ds, {
          room,
          user: catalog.guest,
          checkIn: dayFromToday(from),
          checkOut: dayFromToday(to),
          status,
        });

      it('excludes rooms with an overlapping pending/approved booking', async () => {
        await book(catalog.cheap, 9, 11); // overlaps start
        await book(catalog.mid, 11, 15, BookingStatus.APPROVED); // overlaps end

        expect(names(await search({ checkIn, checkOut }))).toEqual(['Luxury']);
      });

      it('keeps rooms whose bookings are rejected/cancelled or back-to-back', async () => {
        await book(catalog.cheap, 10, 12, BookingStatus.REJECTED);
        await book(catalog.mid, 10, 12, BookingStatus.CANCELLED);
        await book(catalog.luxury, 8, 10); // checks out the day we check in
        await book(catalog.luxury, 12, 14); // checks in the day we check out

        expect(names(await search({ checkIn, checkOut }))).toHaveLength(3);
      });
    });

    it.each([
      [{ checkIn: dayFromToday(1) }, 'only one date'],
      [
        { checkIn: dayFromToday(3), checkOut: dayFromToday(3) },
        'checkOut = checkIn',
      ],
      [
        { checkIn: dayFromToday(-1), checkOut: dayFromToday(1) },
        'checkIn in the past',
      ],
      [{ checkIn: '2026-02-30', checkOut: '2026-03-02' }, 'impossible date'],
      [{ checkIn: '01/11/2026', checkOut: '03/11/2026' }, 'wrong date format'],
      [{ minPrice: 2, maxPrice: 1 }, 'minPrice > maxPrice'],
      [{ bedType: 'king' }, 'unknown bedType'],
      [{ sort: 'name' }, 'unknown sort'],
      [{ roomTypeId: 'abc' }, 'non-uuid roomTypeId'],
      [{ capacity: 0 }, 'capacity < 1'],
    ])('returns 400 for %o (%s)', async (query: object, _reason: string) => {
      await api().get('/api/rooms').query(query).expect(400);
    });

    it('works for logged-in users and ignores an invalid token', async () => {
      const { token } = await createUser(app);
      await api()
        .get('/api/rooms')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await api()
        .get('/api/rooms')
        .set('Authorization', 'Bearer invalid')
        .expect(200);
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('returns the serialized room', async () => {
      const res = await api().get(`/api/rooms/${catalog.mid.id}`).expect(200);
      expect(res.body).toMatchObject({
        name: 'Mid',
        amenities: ['air_conditioner', 'wifi'],
        roomType: { name: 'Standard' },
      });
      expect(res.body.createdAt).toBeUndefined();
    });

    it('returns 404 for unknown or soft-deleted rooms and 400 for non-uuid', async () => {
      await catalog.ds.getRepository(Room).softDelete(catalog.mid.id);
      await api().get(`/api/rooms/${catalog.mid.id}`).expect(404);
      await api()
        .get('/api/rooms/00000000-0000-4000-8000-000000000000')
        .expect(404);
      await api().get('/api/rooms/abc').expect(400);
    });
  });

  describe('GET /api/rooms/:id/reviews', () => {
    it('returns only approved reviews with the reviewer name only', async () => {
      const reviews = catalog.ds.getRepository(Review);
      for (const [rating, status] of [
        [5, ReviewStatus.APPROVED],
        [1, ReviewStatus.PENDING],
        [2, ReviewStatus.REJECTED],
      ] as const) {
        const booking = await createBooking(catalog.ds, {
          room: catalog.mid,
          user: catalog.guest,
          checkIn: dayFromToday(-5),
          checkOut: dayFromToday(-3),
          status: BookingStatus.COMPLETED,
        });
        await reviews.save({ booking, rating, status, comment: 'ok' });
      }

      const res = await api()
        .get(`/api/rooms/${catalog.mid.id}/reviews`)
        .expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toEqual({
        id: expect.any(String),
        rating: 5,
        comment: 'ok',
        createdAt: expect.any(String),
        reviewer: 'Guest Reviewer',
      });
    });

    it('returns 404 for an unknown room', async () => {
      await api()
        .get('/api/rooms/00000000-0000-4000-8000-000000000000/reviews')
        .expect(404);
    });
  });

  it('GET /api/room-types and /api/amenities list lookups sorted by name', async () => {
    const types = await api().get('/api/room-types').expect(200);
    expect(types.body.map((t: { name: string }) => t.name)).toEqual([
      'Deluxe',
      'Standard',
    ]);

    const amenities = await api().get('/api/amenities').expect(200);
    expect(amenities.body.map((a: { name: string }) => a.name)).toEqual([
      'air_conditioner',
      'tv',
      'wifi',
    ]);
  });
});
