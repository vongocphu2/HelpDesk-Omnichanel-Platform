export default () => {
    const provider = process.env.LLM_PROVIDER || 'openai';
    return ({
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'helpdesk_db',
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
        logging: process.env.DB_LOGGING === 'true' || false,
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'helpdesk_plus_super_secret_jwt_key_2026',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    ai: {
        enabled: process.env.AI_TRIAGE_ENABLED === 'true',
        provider,
        apiKey: (provider === 'gemini'
            ? process.env.GEMINI_API_KEY
            : provider === 'openai' ? process.env.OPENAI_API_KEY : '')?.trim() || '',
        model: process.env.LLM_MODEL || (provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'gpt-4.1-mini'),
        timeoutMs: 60000,
        urgencyThreshold: 0.8,
    },
});
};
