import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { hash, compare } from 'bcryptjs';
import pg from 'pg';

await ConfigModule.forRoot({
    envFilePath: ['.env', '../.env'],
});

const password = process.env.AUTH_TEST_PASSWORD;

if (
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
) {
    throw new Error('Mat khau test can it nhat 12 ky tu va toi da 72 byte');
}

if (process.env.NODE_ENV === 'production') {
    throw new Error('Khong tao tai khoan test trong production');
}

if (!process.env.DB_PASSWORD) {
    throw new Error('Thieu DB_PASSWORD');
}

const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'helpdesk_db',
});

const results = [];

await client.connect();

try {
    await client.query('BEGIN');

    for (const role of ['admin', 'manager', 'agent']) {
        const email = `${role}@example.com`;

        await client.query(
            `INSERT INTO roles (role_id, role_name)
             VALUES ($1, $2)
             ON CONFLICT (role_name) DO NOTHING`,
            [randomUUID(), role],
        );

        const roleResult = await client.query(
            'SELECT role_id FROM roles WHERE role_name = $1',
            [role],
        );

        assert.equal(roleResult.rowCount, 1);

        const existing = await client.query(
            `SELECT u.user_id, u.password_hash, u.status, r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.email = $1`,
            [email],
        );

        if (existing.rowCount > 0) {
            const user = existing.rows[0];

            const matches =
                user.password_hash &&
                await compare(password, user.password_hash);

            if (
                !matches ||
                user.status !== 'active' ||
                user.role_name !== role
            ) {
                throw new Error(
                    `${email} da ton tai voi thong tin khac; khong ghi de`,
                );
            }

            results.push({ email, role, result: 'EXISTS_OK' });
            continue;
        }

        const passwordHash = await hash(password, 12);

        const inserted = await client.query(
            `INSERT INTO users (
                user_id, full_name, email,
                password_hash, role_id, status
             )
             VALUES ($1, $2, $3, $4, $5, 'active')
             RETURNING user_id, status`,
            [
                randomUUID(),
                `Sprint 4 Test ${role}`,
                email,
                passwordHash,
                roleResult.rows[0].role_id,
            ],
        );

        assert.equal(inserted.rowCount, 1);
        assert.equal(inserted.rows[0].status, 'active');

        results.push({ email, role, result: 'CREATED' });
    }

    assert.equal(results.length, 3);

    await client.query('COMMIT');
    console.table(results);
    console.log('PASS: 3 tai khoan test da san sang');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    await client.end();
}
