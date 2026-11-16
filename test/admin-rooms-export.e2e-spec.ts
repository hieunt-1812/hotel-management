import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Workbook } from 'exceljs';
import { createTestApp } from './utils/test-app.factory';
import { truncateDatabase } from './utils/database.helper';
import { createUser, SeededUser } from './utils/seed.helper';
import {
  createBooking,
  dayFromToday,
  seedRoomCatalog,
} from './utils/room-fixtures.helper';
import { Room } from '../src/rooms/entities/room.entity';
import { BookingStatus } from '../src/bookings/entities/booking.entity';
import { UserRole } from '../src/users/entities/user.entity';
import { today } from '../src/common/utils/stay-dates.util';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const collectBinaryBody = (
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

async function readSheetRows(content: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(content as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return { sheetName: sheet.name, rows };
}

describe('Admin rooms export (e2e)', () => {
  let app: INestApplication;
  let catalog: Awaited<ReturnType<typeof seedRoomCatalog>>;
  let admin: SeededUser;

  const api = () => request(app.getHttpServer());
  const exportRooms = (query: Record<string, string | number> = {}) =>
    api()
      .get('/api/admin/rooms/export')
      .query(query)
      .set('Authorization', `Bearer ${admin.token}`)
      .buffer(true)
      .parse(collectBinaryBody);
  const exportedNames = async (query: Record<string, string | number>) => {
    const res = await exportRooms(query).expect(200);
    const { rows } = await readSheetRows(res.body);
    return rows.slice(1).map((row) => row[1]);
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateDatabase(app);
    catalog = await seedRoomCatalog(app);
    admin = await createUser(app, {
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('is admin-only (401 / 403)', async () => {
    const user = await createUser(app, { email: 'user@example.com' });
    await api().get('/api/admin/rooms/export').expect(401);
    await api()
      .get('/api/admin/rooms/export')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);
  });

  it('downloads an xlsx file with a header row and one row per room', async () => {
    const res = await exportRooms().expect(200);

    expect(res.headers['content-type']).toBe(XLSX_MIME_TYPE);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="rooms-${today()}.xlsx"`,
    );

    const { sheetName, rows } = await readSheetRows(res.body);
    expect(sheetName).toBe('Danh sách phòng');
    expect(rows[0]).toEqual([
      'STT',
      'Tên phòng',
      'Loại phòng',
      'Giá / đêm (VND)',
      'Sức chứa',
      'Loại giường',
      'View',
      'Tiện nghi',
      'Mô tả',
      'Ngày tạo',
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toEqual([
      1,
      'Luxury',
      'Deluxe',
      2000000,
      4,
      'Giường đôi',
      'Biển',
      'air_conditioner, tv, wifi',
      '',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
    ]);
    expect(rows.slice(1).map((row) => row[1])).toEqual([
      'Luxury',
      'Mid',
      'Cheap',
    ]);
  });

  it('applies the same filters and sort as the room search', async () => {
    expect(
      await exportedNames({
        amenities: 'air_conditioner,wifi',
        sort: 'price_asc',
      }),
    ).toEqual(['Mid', 'Luxury']);
    expect(await exportedNames({ roomTypeId: catalog.standard.id })).toEqual([
      'Mid',
      'Cheap',
    ]);
    expect(
      await exportedNames({ minPrice: 500000, maxPrice: 1000000 }),
    ).toEqual(['Mid']);
  });

  it('leaves out rooms booked in the requested stay', async () => {
    await createBooking(catalog.ds, {
      room: catalog.mid,
      user: catalog.guest,
      checkIn: dayFromToday(5),
      checkOut: dayFromToday(7),
      status: BookingStatus.APPROVED,
    });

    expect(
      await exportedNames({
        checkIn: dayFromToday(6),
        checkOut: dayFromToday(8),
      }),
    ).toEqual(['Luxury', 'Cheap']);
  });

  it('leaves out soft-deleted rooms', async () => {
    await catalog.ds.getRepository(Room).softDelete(catalog.cheap.id);
    expect(await exportedNames({})).toEqual(['Luxury', 'Mid']);
  });

  it('returns only the header row when nothing matches', async () => {
    const res = await exportRooms({ view: 'garden' }).expect(200);
    const { rows } = await readSheetRows(res.body);
    expect(rows).toHaveLength(1);
  });

  it('rejects invalid filters with 400', async () => {
    await exportRooms({ minPrice: 2000000, maxPrice: 1000 }).expect(400);
    await exportRooms({ checkIn: dayFromToday(1) }).expect(400);
    await exportRooms({ sort: 'cheapest' }).expect(400);
    await exportRooms({ page: 1 }).expect(400);
  });
});
