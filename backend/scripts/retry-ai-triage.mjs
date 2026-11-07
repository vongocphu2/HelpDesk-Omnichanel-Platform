// Explicit retry only: never reprocess the entire ticket history.
const index = process.argv.indexOf('--ticket');
const code = index >= 0 ? process.argv[index + 1] : '';
if (!/^TK-\d{4}$/.test(code || '')) {
  console.error('Cách chạy: npm run ai:retry -- --ticket TK-1234');
  process.exitCode = 1;
} else {
  let dataSource;
  try {
    ({ default: dataSource } = await import('../dist/database/data-source.js'));
    await dataSource.initialize();
    const rows = await dataSource.query(
      `
      WITH retried AS (
        UPDATE tickets SET ai_status = 'pending', ai_attempts = 0,
          ai_error = NULL, ai_next_attempt_at = NULL
        WHERE ticket_code = $1 AND ai_status = 'failed' AND status NOT IN ('resolved', 'closed')
        RETURNING ticket_code, ai_status
      )
      SELECT * FROM retried
    `,
      [code],
    );
    console.log(
      rows.length
        ? rows
        : 'Không có ticket AI lỗi còn mở phù hợp; không thay đổi dữ liệu.',
    );
  } catch (error) {
    console.error(
      `Không thể đưa ticket vào lần thử lại (${error?.code || 'DB_OR_BUILD_ERROR'}). Kiểm tra build và kết nối DB.`,
    );
    process.exitCode = 1;
  } finally {
    if (dataSource?.isInitialized) await dataSource.destroy();
  }
}
