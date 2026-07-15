/**
 * 本地 SQLite 数据库模块
 * 用于持久化对话历史等数据
 */
import Database from '@tauri-apps/plugin-sql'

let _db = null

/**
 * 获取数据库实例（单例）
 */
async function getDb() {
    if (!_db) {
        _db = await Database.load('sqlite:app.db')
        await initSchema()
    }
    return _db
}

/**
 * 初始化表结构
 */
async function initSchema() {
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '新对话',
      provider_id TEXT,
      model_id    TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    )
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role            TEXT NOT NULL,
      content         TEXT,
      thinking        TEXT,
      images          TEXT,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)
    await _db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)
  `)
    await _db.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages(conversation_id, created_at DESC, id DESC)
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS recent_projects (
      path       TEXT NOT NULL,
      page       TEXT NOT NULL,
      used_at    INTEGER NOT NULL,
      PRIMARY KEY (path, page)
    )
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS db_connections (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      db_type    TEXT NOT NULL DEFAULT 'mysql',
      host       TEXT NOT NULL DEFAULT 'localhost',
      port       INTEGER NOT NULL DEFAULT 3306,
      username   TEXT NOT NULL DEFAULT 'root',
      password   TEXT NOT NULL DEFAULT '',
      database_name TEXT NOT NULL DEFAULT '',
      used_at    INTEGER NOT NULL
    )
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS doc_profiles (
      page       TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
    await _db.execute(`
    CREATE TABLE IF NOT EXISTS generation_history (
      id                TEXT PRIMARY KEY,
      type              TEXT NOT NULL,
      title             TEXT NOT NULL,
      summary           TEXT,
      status            TEXT NOT NULL DEFAULT 'completed',
      provider_id       TEXT,
      model_id          TEXT,
      source_snapshot   TEXT,
      settings_snapshot TEXT,
      result_snapshot   TEXT,
      artifact_snapshot TEXT,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    )
  `)
    await _db.execute(`
    CREATE INDEX IF NOT EXISTS idx_generation_history_type_time
    ON generation_history(type, updated_at DESC)
  `)
    await _db.execute(`
    CREATE INDEX IF NOT EXISTS idx_generation_history_time
    ON generation_history(updated_at DESC)
  `)
    // 一次性清理重复的历史连接（保留每组 host+port+username+db_type 中 used_at 最大的一条）
    await _db.execute(`
    DELETE FROM db_connections WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY host, port, username, db_type ORDER BY used_at DESC) as rn
        FROM db_connections
      ) WHERE rn = 1
    )
  `)
}

// ==================== 对话 CRUD ====================

/**
 * 创建新对话
 */
export async function createConversation(providerId, modelId) {
    const db = await getDb()
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    await db.execute(
        'INSERT INTO conversations (id, title, provider_id, model_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, '新对话', providerId || '', modelId || '', now, now]
    )
    return { id, title: '新对话', providerId, modelId, createdAt: now, updatedAt: now }
}

/**
 * 获取对话列表（最近的在前）
 */
export async function getConversations(limit = 50) {
    const db = await getDb()
    return await db.select(
        'SELECT id, title, provider_id as providerId, model_id as modelId, created_at as createdAt, updated_at as updatedAt FROM conversations ORDER BY updated_at DESC LIMIT $1',
        [limit]
    )
}

/**
 * 更新对话标题
 */
export async function updateConversationTitle(id, title) {
    const db = await getDb()
    await db.execute(
        'UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3',
        [title, Date.now(), id]
    )
}

/**
 * 更新对话时间戳
 */
export async function touchConversation(id) {
    const db = await getDb()
    await db.execute('UPDATE conversations SET updated_at = $1 WHERE id = $2', [Date.now(), id])
}

/**
 * 删除对话及其所有消息
 */
export async function deleteConversation(id) {
    const db = await getDb()
    await db.execute('DELETE FROM messages WHERE conversation_id = $1', [id])
    await db.execute('DELETE FROM conversations WHERE id = $1', [id])
}

// ==================== 消息 CRUD ====================

/**
 * 添加一条消息
 */
export async function addMessage(conversationId, role, content, thinking = null, images = null) {
    const db = await getDb()
    const now = Date.now()
    const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null
    await db.execute(
        'INSERT INTO messages (conversation_id, role, content, thinking, images, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [conversationId, role, content, thinking, imagesJson, now]
    )
    // 同步更新对话时间戳
    await db.execute('UPDATE conversations SET updated_at = $1 WHERE id = $2', [now, conversationId])
}

/**
 * 分页获取某个对话的消息。offset 从最新一条向前计算，返回值保持时间正序。
 */
export async function getMessages(conversationId, limit = 100, offset = 0) {
    const db = await getDb()
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100))
    const safeOffset = Math.max(0, Number(offset) || 0)
    const rows = await db.select(
        `SELECT * FROM (
          SELECT id, role, content, thinking, images, created_at as createdAt
          FROM messages
          WHERE conversation_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2 OFFSET $3
        ) ORDER BY createdAt ASC, id ASC`,
        [conversationId, safeLimit, safeOffset]
    )
    return rows.map(r => ({
        ...r,
        images: r.images ? JSON.parse(r.images) : undefined,
    }))
}

/**
 * 根据第一条用户消息自动生成对话标题（取前 20 字）
 */
export function generateTitle(firstUserMessage) {
    if (!firstUserMessage) return '新对话'
    const clean = firstUserMessage.replace(/\n/g, ' ').trim()
    return clean.length > 20 ? clean.slice(0, 20) + '...' : clean
}

// ==================== 最近项目 ====================

/**
 * 保存最近使用的项目目录
 * @param {string} path - 目录路径
 * @param {string} page - 页面标识 (sdd/srs/api-doc/copyright)
 */
export async function saveRecentProject(path, page) {
    const db = await getDb()
    await db.execute(
        'INSERT OR REPLACE INTO recent_projects (path, page, used_at) VALUES ($1, $2, $3)',
        [path, page, Date.now()]
    )
}

/**
 * 获取最近使用的项目目录
 * @param {string} page - 页面标识
 * @param {number} limit - 返回数量
 */
export async function getRecentProjects(page, limit = 10) {
    const db = await getDb()
    return await db.select(
        'SELECT path, used_at as usedAt FROM recent_projects WHERE page = $1 ORDER BY used_at DESC LIMIT $2',
        [page, limit]
    )
}

// ==================== 数据库连接 ====================

export async function saveDbConnection(conn) {
    const db = await getDb()
    // 按 host+port+username+db_type 去重
    const existing = await db.select(
        'SELECT id FROM db_connections WHERE host = $1 AND port = $2 AND username = $3 AND db_type = $4 LIMIT 1',
        [conn.host, conn.port, conn.username, conn.db_type || 'mysql']
    )
    const id = existing.length > 0 ? existing[0].id : `db_${Date.now()}`
    await db.execute(
        'INSERT OR REPLACE INTO db_connections (id, label, db_type, host, port, username, password, database_name, used_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [id, conn.label || `${conn.host}:${conn.port}`, conn.db_type || 'mysql', conn.host, conn.port, conn.username, conn.password || '', conn.database || '', Date.now()]
    )
    return id
}

export async function getDbConnections(limit = 20) {
    const db = await getDb()
    return await db.select(
        'SELECT id, label, db_type as dbType, host, port, username, password, database_name as "database", used_at as usedAt FROM db_connections ORDER BY used_at DESC LIMIT $1',
        [limit]
    )
}

export async function deleteDbConnection(id) {
    const db = await getDb()
    await db.execute('DELETE FROM db_connections WHERE id = $1', [id])
}

// ==================== 文档信息 / 配置存储 ====================

/**
 * 保存页面配置（文档信息、软著配置等）
 * @param {string} page - 页面标识 (sdd-doc-info / srs-doc-info / copyright-config)
 * @param {object} data - 配置对象
 */
export async function savePageConfig(page, data) {
    const db = await getDb()
    await db.execute(
        'INSERT OR REPLACE INTO doc_profiles (page, data, updated_at) VALUES ($1, $2, $3)',
        [page, JSON.stringify(data), Date.now()]
    )
}

/**
 * 加载页面配置
 */
export async function loadPageConfig(page) {
    const db = await getDb()
    const rows = await db.select('SELECT data FROM doc_profiles WHERE page = $1', [page])
    if (rows.length === 0) return null
    try { return JSON.parse(rows[0].data) } catch { return null }
}

// ==================== 应用设置 ====================

export async function setSetting(key, value) {
    const db = await getDb()
    await db.execute(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES ($1, $2)',
        [key, typeof value === 'string' ? value : JSON.stringify(value)]
    )
}

export async function getSetting(key, defaultValue = null) {
    const db = await getDb()
    const rows = await db.select('SELECT value FROM app_settings WHERE key = $1', [key])
    if (rows.length === 0) return defaultValue
    try { return JSON.parse(rows[0].value) } catch { return rows[0].value }
}

// ==================== 生成历史 ====================

function parseJsonField(value, fallback = null) {
    if (!value) return fallback
    try { return JSON.parse(value) } catch { return fallback }
}

function toJson(value) {
    return JSON.stringify(value == null ? null : value)
}

function normalizeHistoryRow(row) {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        summary: row.summary || '',
        status: row.status,
        providerId: row.providerId || '',
        modelId: row.modelId || '',
        source: parseJsonField(row.sourceSnapshot, {}),
        settings: parseJsonField(row.settingsSnapshot, {}),
        result: parseJsonField(row.resultSnapshot, {}),
        artifact: parseJsonField(row.artifactSnapshot, {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

function normalizeHistorySummaryRow(row) {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        summary: row.summary || '',
        status: row.status,
        providerId: row.providerId || '',
        modelId: row.modelId || '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

export async function saveGenerationHistory(record = {}) {
    const db = await getDb()
    const now = Date.now()
    const id = record.id || `gen_${now}_${Math.random().toString(36).slice(2, 8)}`
    await db.execute(
        `INSERT OR REPLACE INTO generation_history (
          id, type, title, summary, status, provider_id, model_id,
          source_snapshot, settings_snapshot, result_snapshot, artifact_snapshot,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
            id,
            record.type || 'unknown',
            record.title || '未命名生成记录',
            record.summary || '',
            record.status || 'completed',
            record.providerId || '',
            record.modelId || '',
            toJson(record.source || {}),
            toJson(record.settings || {}),
            toJson(record.result || {}),
            toJson(record.artifact || {}),
            record.createdAt || now,
            now,
        ]
    )
    return id
}

export async function getGenerationHistory({ type = '', limit = 100 } = {}) {
    const db = await getDb()
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100))
    const rows = type
        ? await db.select(
            `SELECT id, type, title, summary, status, provider_id as providerId, model_id as modelId,
                    created_at as createdAt, updated_at as updatedAt
             FROM generation_history
             WHERE type = $1
             ORDER BY updated_at DESC
             LIMIT $2`,
            [type, safeLimit]
        )
        : await db.select(
            `SELECT id, type, title, summary, status, provider_id as providerId, model_id as modelId,
                    created_at as createdAt, updated_at as updatedAt
             FROM generation_history
             ORDER BY updated_at DESC
             LIMIT $1`,
            [safeLimit]
        )
    return rows.map(normalizeHistorySummaryRow)
}

export async function getGenerationHistoryItem(id) {
    const db = await getDb()
    const rows = await db.select(
        `SELECT id, type, title, summary, status, provider_id as providerId, model_id as modelId,
                source_snapshot as sourceSnapshot, settings_snapshot as settingsSnapshot,
                result_snapshot as resultSnapshot, artifact_snapshot as artifactSnapshot,
                created_at as createdAt, updated_at as updatedAt
         FROM generation_history
         WHERE id = $1`,
        [id]
    )
    return rows.length ? normalizeHistoryRow(rows[0]) : null
}

export async function deleteGenerationHistory(id) {
    const db = await getDb()
    await db.execute('DELETE FROM generation_history WHERE id = $1', [id])
}

export async function clearGenerationHistory(type = '') {
    const db = await getDb()
    if (type) await db.execute('DELETE FROM generation_history WHERE type = $1', [type])
    else await db.execute('DELETE FROM generation_history')
}
