import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ImapFlow } from 'imapflow';
import { EmailService } from './email.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { EmailProcessedMessage } from './email-processed.entity.js';

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(), writeFile: vi.fn(), rename: vi.fn(),
  mkdir: vi.fn(), rm: vi.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let moduleRef: TestingModule;
  let config: Record<string, string>;

  beforeEach(async () => {
    vi.resetAllMocks();
    config = {
      EMAIL_IMAP_HOST: 'imap.example.com',
      EMAIL_IMAP_PORT: '993',
      EMAIL_USER: 'support@company.test',
      EMAIL_PASSWORD: 'test-password',
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => config[key]),
            getOrThrow: vi.fn((key: string) => config[key]),
          },
        },
        {
          provide: TicketsService,
          useValue: {
            createFromWebForm: vi.fn().mockResolvedValue({
              ticket_id: 'ticket-id', ticket_code: 'TK-1234',
            }),
          },
        },
        {
          provide: getRepositoryToken(EmailProcessedMessage),
          useValue: {
            findOne: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            createQueryBuilder: vi.fn(() => ({
              insert: vi.fn().mockReturnThis(),
              values: vi.fn().mockReturnThis(),
              orIgnore: vi.fn().mockReturnThis(),
              returning: vi.fn().mockReturnThis(),
              execute: vi.fn().mockResolvedValue({
                raw: [{ id: 'test-id' }],
                identifiers: [{ id: 'test-id' }],
              }),
            })),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: vi.fn(async (cb) => {
              const mockManager = {
                getRepository: vi.fn(() => ({
                  createQueryBuilder: vi.fn(() => ({
                    insert: vi.fn().mockReturnThis(),
                    values: vi.fn().mockReturnThis(),
                    orIgnore: vi.fn().mockReturnThis(),
                    returning: vi.fn().mockReturnThis(),
                    execute: vi.fn().mockResolvedValue({
                      raw: [{ id: 'test-id' }],
                      identifiers: [{ id: 'test-id' }],
                    }),
                  })),
                  update: vi.fn(),
                })),
              };
              return cb(mockManager);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    moduleRef = module;
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['993', undefined, true],
    ['143', undefined, false],
    ['993', '', true],
    ['993', 'false', false],
    ['143', 'true', true],
  ])('uses port %s and TLS override %s => %s', async (port, override, secure) => {
    config.EMAIL_IMAP_PORT = port;
    if (override !== undefined) config.EMAIL_IMAP_SECURE = override;
    vi.mocked(ImapFlow).mockImplementation(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        usable: true, logout: vi.fn().mockResolvedValue(undefined),
      } as unknown as ImapFlow;
    });
    await expect(service.testImapConnection()).resolves.toBe(true);
    expect(ImapFlow).toHaveBeenLastCalledWith(expect.objectContaining({
      port: Number(port), secure,
    }));
    expect(service.getImapConfig().secure).toBe(secure);
  });

  function preparePoll(target = service) {
    vi.spyOn(target, 'getInboxSyncInfo').mockResolvedValue({
      uidValidity: '1', lastUid: 44,
    });
    vi.spyOn(target, 'getNewEmailUids').mockResolvedValue([43, 44]);
    return vi.spyOn(target, 'normalizeEmail').mockImplementation(async uid => ({
      messageId: `message-${uid}`, subject: 'Support request',
      fromEmail: 'customer@example.com', content: 'Please help with my order',
      receivedAt: null, imapUid: uid, channel: 'EMAIL',
    }));
  }

  function persistedState(initial: object) {
    let stored = JSON.stringify(initial);
    let temporary = stored;
    vi.mocked(readFile).mockImplementation(async () => stored);
    vi.mocked(writeFile).mockImplementation(async (_path, content) => {
      temporary = String(content);
    });
    vi.mocked(rename).mockImplementation(async () => { stored = temporary; });
    return () => JSON.parse(stored);
  }

  it('continues after an invalid email and retries it after a restart without new mail', async () => {
    const saved = persistedState({ uidValidity: '1', lastProcessedUid: 42 });
    const normalize = preparePoll();
    normalize.mockRejectedValueOnce(new Error('Missing sender'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await service.checkNewEmailsAutomatically();

    expect(normalize.mock.calls.map(([uid]) => uid)).toEqual([43, 44]);
    expect(moduleRef.get(TicketsService).createFromWebForm).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual({ uidValidity: '1', lastProcessedUid: 44, failedUids: [43] });
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('UID 43'), 'Missing sender');

    const restarted = new EmailService(
      moduleRef.get(ConfigService), moduleRef.get(TicketsService),
      moduleRef.get(getRepositoryToken(EmailProcessedMessage)), moduleRef.get(DataSource),
    );
    const retry = preparePoll(restarted);
    vi.mocked(restarted.getNewEmailUids).mockResolvedValue([]);
    await restarted.checkNewEmailsAutomatically();

    expect(retry.mock.calls.map(([uid]) => uid)).toEqual([43]);
    expect(moduleRef.get(TicketsService).createFromWebForm).toHaveBeenCalledTimes(2);
    expect(saved()).toEqual({ uidValidity: '1', lastProcessedUid: 44, failedUids: [] });
  });

  it('keeps a failed ticket transaction pending and processes subsequent emails', async () => {
    const saved = persistedState({ uidValidity: '1', lastProcessedUid: 42, failedUids: [] });
    preparePoll();
    vi.mocked(moduleRef.get(TicketsService).createFromWebForm)
      .mockRejectedValueOnce(new Error('DB unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.checkNewEmailsAutomatically();
    expect(moduleRef.get(TicketsService).createFromWebForm).toHaveBeenCalledTimes(2);
    expect(saved()).toEqual({ uidValidity: '1', lastProcessedUid: 44, failedUids: [43] });
  });

  it('processes overlapping new and failed UIDs once and retains persistent failures', async () => {
    const saved = persistedState({ uidValidity: '1', lastProcessedUid: 42, failedUids: [43] });
    const normalize = preparePoll();
    normalize.mockRejectedValueOnce(new Error('Still invalid'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.checkNewEmailsAutomatically();
    expect(normalize.mock.calls.map(([uid]) => uid)).toEqual([43, 44]);
    expect(saved().failedUids).toEqual([43]);
  });

  it('stops on a state write failure without advancing the durable cursor', async () => {
    const saved = persistedState({ uidValidity: '1', lastProcessedUid: 42, failedUids: [] });
    const normalize = preparePoll();
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('Disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.checkNewEmailsAutomatically();
    expect(normalize.mock.calls.map(([uid]) => uid)).toEqual([43]);
    expect(saved().lastProcessedUid).toBe(42);
  });

  it('initializes a missing state file with an empty retry list', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('Missing file'), { code: 'ENOENT' }));
    preparePoll();
    await service.checkNewEmailsAutomatically();
    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(JSON.parse(String(vi.mocked(writeFile).mock.calls[0][1]))).toEqual({
      uidValidity: null, lastProcessedUid: null, failedUids: [],
    });
    expect(service.getNewEmailUids).not.toHaveBeenCalled();
  });

  it('rejects corrupt retry state instead of losing failed messages', async () => {
    persistedState({ uidValidity: '1', lastProcessedUid: 42, failedUids: ['43'] });
    preparePoll();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.checkNewEmailsAutomatically();
    expect(service.getInboxSyncInfo).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    ['2026-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z')],
    [
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    ],
    [undefined, null],
    ['invalid-date', null],
  ])('normalizes inbox date %s', async (rawDate, expectedDate) => {
    const release = vi.fn();
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      getMailboxLock: vi.fn().mockResolvedValue({ release }),
      mailbox: { exists: 1 },
      fetch: vi.fn(async function* () {
        yield { uid: 1, envelope: { date: rawDate } };
      }),
      usable: true,
      logout: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ImapFlow).mockImplementation(function () {
      return client as unknown as ImapFlow;
    });

    const emails = await service.readInboxEmails();

    expect(emails).toEqual([
      expect.objectContaining({ uid: 1, date: expectedDate }),
    ]);
    expect(release).toHaveBeenCalledTimes(1);
    expect(client.logout).toHaveBeenCalledTimes(1);
  });
});
