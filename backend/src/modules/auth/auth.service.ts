import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { User } from '../../database/entities/user.entity.js';
import { LoginDto } from './dto/login.dto.js';

const STAFF_ROLES = ['admin', 'manager', 'agent'];
const JWT_ISSUER = 'helpdesk-api';
const JWT_AUDIENCE = 'helpdesk-staff';

export interface AuthUser {
    user_id: string;
    full_name: string;
    email: string | null;
    role: string;
}

@Injectable()
export class AuthService {
    private readonly key: Uint8Array;
    private readonly lifetimeSeconds: number;

    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
        config: ConfigService,
    ) {
        const secret = config.get<string>('jwt.secret') ?? '';
        const expiresIn = config.get<string>('jwt.expiresIn') ?? '1h';

        if (!/^[0-9a-f]{64}$/i.test(secret)) {
            throw new Error(
                'JWT_SECRET phải là chuỗi hex 64 ký tự được tạo ngẫu nhiên',
            );
        }

        const duration = /^([1-9]\d*)(s|m|h|d)$/.exec(expiresIn);

        if (!duration) {
            throw new Error(
                'JWT_EXPIRES_IN không hợp lệ, ví dụ hợp lệ: 30m hoặc 1h',
            );
        }

        const units: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };

        this.lifetimeSeconds = Number(duration[1]) * units[duration[2]];

        if (
            !Number.isSafeInteger(this.lifetimeSeconds) ||
            this.lifetimeSeconds > 7 * 86400
        ) {
            throw new Error('Thời hạn JWT phải từ 1 giây đến 7 ngày');
        }

        this.key = Buffer.from(secret, 'hex');
    }

    private toAuthUser(user: User): AuthUser {
        return {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            role: user.role.role_name,
        };
    }

    async login(dto: LoginDto) {
        if (Buffer.byteLength(dto.password, 'utf8') > 72) {
            throw new UnauthorizedException(
                'Email hoặc mật khẩu không đúng',
            );
        }

        const user = await this.users
            .createQueryBuilder('user')
            .addSelect('user.password_hash')
            .leftJoinAndSelect('user.role', 'role')
            .where('user.email = :email', { email: dto.email })
            .getOne();

        const passwordMatches = user?.password_hash
            ? await compare(dto.password, user.password_hash)
            : false;

        if (
            !user ||
            !passwordMatches ||
            user.status !== 'active' ||
            !STAFF_ROLES.includes(user.role?.role_name)
        ) {
            throw new UnauthorizedException(
                'Email hoặc mật khẩu không đúng',
            );
        }

        const now = Math.floor(Date.now() / 1000);

        const accessToken = await new SignJWT({})
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setSubject(user.user_id)
            .setIssuer(JWT_ISSUER)
            .setAudience(JWT_AUDIENCE)
            .setIssuedAt(now)
            .setExpirationTime(now + this.lifetimeSeconds)
            .sign(this.key);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: this.lifetimeSeconds,
            user: this.toAuthUser(user),
        };
    }

    async authenticate(token: string): Promise<AuthUser> {
        let userId: string;

        try {
            const { payload } = await jwtVerify(token, this.key, {
                algorithms: ['HS256'],
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                requiredClaims: ['sub', 'iat', 'exp'],
            });

            if (
                typeof payload.sub !== 'string' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    payload.sub,
                )
            ) {
                throw new Error('Invalid token subject');
            }

            userId = payload.sub;
        } catch {
            throw new UnauthorizedException(
                'Token không hợp lệ hoặc đã hết hạn',
            );
        }

        const user = await this.users.findOne({
            where: { user_id: userId },
            relations: { role: true },
        });

        if (
            !user ||
            user.status !== 'active' ||
            !STAFF_ROLES.includes(user.role?.role_name)
        ) {
            throw new UnauthorizedException(
                'Tài khoản không còn quyền truy cập',
            );
        }

        return this.toAuthUser(user);
    }
}