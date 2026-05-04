import mysql from 'mysql2/promise'

let pool = null

export async function initDb(config) {
  if (pool) {
    await pool.end().catch(() => {})
  }
  pool = mysql.createPool({
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10
  })
  await initSchema()
}

async function initSchema() {
  const conn = await pool.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ssh_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        private_key TEXT NOT NULL,
        passphrase TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS servers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INT DEFAULT 22,
        username VARCHAR(100) NOT NULL,
        auth_type ENUM('password','key') DEFAULT 'password',
        password TEXT,
        key_id INT,
        group_id INT,
        tags VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  } finally {
    conn.release()
  }
}

export async function query(sql, params = []) {
  if (!pool) throw new Error('数据库未初始化')
  const [rows] = await pool.execute(sql, params)
  return rows
}
