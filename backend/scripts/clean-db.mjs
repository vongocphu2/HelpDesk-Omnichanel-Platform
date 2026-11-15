import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'helpdesk_db',
});

async function main() {
  console.log('🔄 Đang kết nối tới PostgreSQL (database: helpdesk_db)...');
  try {
    await client.connect();
    console.log('✅ Kết nối cơ sở dữ liệu thành công.');

    console.log('🧹 [1/3] Đang xóa tất cả vé yêu cầu (tickets) và tin nhắn liên quan...');
    const delTickets = await client.query('DELETE FROM tickets;');
    console.log(`   -> Đã dọn dẹp ${delTickets.rowCount || 0} vé trong bảng tickets.`);

    console.log('🧹 [2/3] Đang xóa lịch sử Telegram updates đã xử lý...');
    const delTg = await client
      .query('DELETE FROM telegram_processed_updates;')
      .catch(() => ({ rowCount: 0 }));
    console.log(`   -> Đã dọn dẹp ${delTg.rowCount || 0} bản ghi telegram_processed_updates.`);

    console.log('🧹 [3/3] Đang xóa tài khoản khách hàng test (giữ nguyên Admin & Agent)...');
    const delCust = await client
      .query(`
        DELETE FROM users 
        WHERE role_id IN (SELECT role_id FROM roles WHERE role_name = 'customer');
      `)
      .catch(() => ({ rowCount: 0 }));
    console.log(`   -> Đã dọn dẹp ${delCust.rowCount || 0} tài khoản khách hàng ảo.`);

    console.log('');
    console.log('====================================================');
    console.log('🎉 TOÀN BỘ DỮ LIỆU ẢO & TEST ĐÃ ĐƯỢC XÓA SẠCH SẼ 100%!');
    console.log('   Hệ thống sẵn sàng cho buổi review và kiểm thử thật.');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Lỗi khi dọn dẹp database:', err.message);
  } finally {
    await client.end();
  }
}

main();

