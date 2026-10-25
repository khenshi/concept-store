import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { Duplex } from 'node:stream';
import { Client, Pool } from 'pg';
import { HealthModule } from '../../modules/health/health.module';
import { HealthService } from '../../modules/health/health.service';
import { PrismaService } from './prisma.service';

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockAdapterConnect = jest.fn();
const mockPool = { connect: jest.fn() };

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {
    constructor(options: { adapter: { connect: () => Promise<unknown> } }) {
      mockConnect.mockImplementation(() => options.adapter.connect());
    }
    $connect = mockConnect;
    $disconnect = mockDisconnect;
  },
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    connect = mockAdapterConnect;
  },
}));

class SocketlessClient extends Client {
  constructor() {
    const stream = new Duplex({
      read() {
        return;
      },
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    Object.assign(stream, { ref: () => stream, unref: () => stream });
    super({ stream: () => stream });
    Object.assign(this, { readyForQuery: true });
    Object.assign(this.connection, { _connecting: true });
    stream.once('close', () => this.connection.emit('end'));
  }

  connect(): Promise<Client>;
  connect(
    callback: ((err: Error) => void) | ((err: null, client: Client) => void),
  ): void;
  connect(
    callback?: ((err: Error) => void) | ((err: null, client: Client) => void),
  ): Promise<Client> | void {
    if (callback) {
      (callback as (err: null, client: Client) => void)(null, this);
      return;
    }
    return Promise.resolve(this);
  }
}

describe('PrismaService readiness probe', () => {
  let service: PrismaService;
  const query = jest.fn();
  const release = jest.fn();
  const on = jest.fn();
  const removeListener = jest.fn();

  async function initialize(): Promise<void> {
    await service.onModuleInit();
    mockPool.connect.mockClear();
    query.mockClear();
    release.mockClear();
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
    mockAdapterConnect.mockResolvedValue({ underlyingDriver: () => mockPool });
    mockPool.connect.mockResolvedValue({ query, release, on, removeListener });
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const config = new ConfigService({
      LOG_DB_QUERIES: false,
      DATABASE_URL: 'postgresql://unused:unused@localhost:1/unused',
      DB_POOL_MAX: 10,
      DB_POOL_IDLE_TIMEOUT_MS: 30_000,
      DB_CONNECTION_TIMEOUT_MS: 10_000,
      DB_QUERY_TIMEOUT_MS: 30_000,
    });
    service = new PrismaService(config, {
      setContext: jest.fn(),
    } as unknown as PinoLogger);
  });

  it('does not probe before initialization', async () => {
    await expect(service.probeReadiness()).resolves.toBe(false);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('uses the connected adapter pool and only static SQL with a local timeout', async () => {
    await initialize();
    await expect(service.probeReadiness()).resolves.toBe(true);
    expect(mockAdapterConnect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({
      text: 'SELECT 1',
      query_timeout: 1_000,
    });
    expect(release).toHaveBeenCalledWith(false);
  });

  it('shares acquisition and query work across concurrent requests', async () => {
    await initialize();
    let finish!: (value: unknown) => void;
    query.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const probes = Array.from({ length: 100 }, () => service.probeReadiness());
    await Promise.resolve();
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(new Set(probes).size).toBe(1);
    finish({ rows: [] });
    await expect(Promise.all(probes)).resolves.toEqual(Array(100).fill(true));
    await service.probeReadiness();
    expect(mockPool.connect).toHaveBeenCalledTimes(2);
  });

  it('handles bounded acquisition failure and recovers on a later probe', async () => {
    await initialize();
    mockPool.connect.mockRejectedValueOnce(new Error('private connection URL'));
    await expect(service.probeReadiness()).resolves.toBe(false);
    expect(release).not.toHaveBeenCalled();
    await expect(service.probeReadiness()).resolves.toBe(true);
  });

  it.each(['Query read timeout', 'private SQL error'])(
    'destroys the checked-out connection on %s and then recovers',
    async (message) => {
      await initialize();
      query.mockRejectedValueOnce(new Error(message));
      await expect(service.probeReadiness()).resolves.toBe(false);
      expect(release).toHaveBeenCalledWith(true);
      await expect(service.probeReadiness()).resolves.toBe(true);
    },
  );

  it('marks draining before waiting for the probe and disconnecting', async () => {
    await initialize();
    let finish!: (value: unknown) => void;
    query.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const probe = service.probeReadiness();
    await Promise.resolve();
    const shutdown = service.onModuleDestroy();
    await expect(service.probeReadiness()).resolves.toBe(false);
    expect(mockDisconnect).not.toHaveBeenCalled();
    finish({ rows: [] });
    await expect(probe).resolves.toBe(false);
    await shutdown;
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not query a connection acquired after draining starts', async () => {
    await initialize();
    let acquire!: (value: unknown) => void;
    mockPool.connect.mockImplementationOnce(
      () => new Promise((resolve) => (acquire = resolve)),
    );
    const probe = service.probeReadiness();
    const shutdown = service.onModuleDestroy();
    acquire({ query, release, on, removeListener });
    await expect(probe).resolves.toBe(false);
    await shutdown;
    expect(query).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(true);
  });

  it('uses the installed pool timeout to remove a waiting acquisition', async () => {
    const pool = new Pool({
      Client: SocketlessClient,
      max: 1,
      connectionTimeoutMillis: 1_000,
    });
    const held = await pool.connect();
    mockAdapterConnect.mockResolvedValueOnce({ underlyingDriver: () => pool });
    jest.useFakeTimers();
    try {
      const startup = service.onModuleInit();
      const result = expect(startup).rejects.toThrow(
        'Database initialization failed',
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(pool.waitingCount).toBe(1);
      await jest.advanceTimersByTimeAsync(1_000);
      await result;
      expect(pool.waitingCount).toBe(0);
      await expect(service.probeReadiness()).resolves.toBe(false);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
      held.release(true);
      await pool.end();
    }
  });

  it('destroys the installed driver transport after the real query timeout', async () => {
    const pool = new Pool({ Client: SocketlessClient, max: 1 });
    const held = await pool.connect();
    const stream = (held as unknown as Client).connection.stream;
    held.release();
    mockAdapterConnect.mockResolvedValueOnce({ underlyingDriver: () => pool });
    jest.useFakeTimers();
    try {
      const startup = service.onModuleInit();
      const result = expect(startup).rejects.toThrow(
        'Database initialization failed',
      );
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(999);
      expect(stream.destroyed).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await result;
      expect(stream.destroyed).toBe(true);
      expect(pool.totalCount).toBe(0);
    } finally {
      await jest.advanceTimersByTimeAsync(1_001);
      jest.useRealTimers();
      await pool.end();
    }
  });

  it('runs health draining before Prisma disconnection in the Nest lifecycle', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(service)
      .compile();
    await moduleRef.init();
    mockPool.connect.mockClear();
    mockDisconnect.mockImplementationOnce(async () => {
      await expect(moduleRef.get(HealthService).isReady()).resolves.toBe(false);
      await expect(service.probeReadiness()).resolves.toBe(false);
    });
    await moduleRef.close();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('validates the actual bounded probe during startup', async () => {
    await service.onModuleInit();
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({
      text: 'SELECT 1',
      query_timeout: 1_000,
    });
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it.each(['acquire', 'query', 'connect'])(
    'disconnects and fails startup generically on %s failure',
    async (stage) => {
      if (stage === 'acquire') {
        mockPool.connect.mockRejectedValueOnce(
          new Error('private connection URL'),
        );
      } else if (stage === 'query') {
        query.mockRejectedValueOnce(new Error('private SQL failure'));
      } else {
        mockAdapterConnect.mockRejectedValueOnce(
          new Error('private adapter failure'),
        );
      }
      await expect(service.onModuleInit()).rejects.toThrow(
        new Error('Database initialization failed'),
      );
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      mockPool.connect.mockClear();
      await expect(service.probeReadiness()).resolves.toBe(false);
      expect(mockPool.connect).not.toHaveBeenCalled();
    },
  );

  it('conceals cleanup errors when startup dependency validation fails', async () => {
    query.mockRejectedValueOnce(new Error('private query failure'));
    mockDisconnect.mockRejectedValueOnce(new Error('private cleanup failure'));
    await expect(service.onModuleInit()).rejects.toThrow(
      new Error('Database initialization failed'),
    );
    await expect(service.probeReadiness()).resolves.toBe(false);
  });
});
