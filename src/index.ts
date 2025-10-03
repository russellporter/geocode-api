import express, { Request, Response } from 'express';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const PARQUET_PATH = process.env.PARQUET_PATH || path.join(__dirname, '../data/whosonfirst-data-admin.parquet');

let db: DuckDBInstance;
let conn: DuckDBConnection;
let validColumnNames: Set<string>;

async function initDatabase() {
  db = await DuckDBInstance.create(':memory:');
  conn = await db.connect();

  // Install and load spatial extension
  await conn.run('INSTALL spatial;');
  await conn.run('LOAD spatial;');

  // Get column names from parquet file for validation
  const schemaQuery = `SELECT * FROM read_parquet(?) LIMIT 0`;
  const schemaResult = await conn.run(schemaQuery, [PARQUET_PATH]);
  const columnNames = schemaResult.columnNames();
  validColumnNames = new Set(columnNames);

  console.log('DuckDB initialized with spatial extension');
  console.log(`Loaded ${validColumnNames.size} column names from parquet file`);
}

interface ReverseGeocodeQuery {
  lon?: string;
  lat?: string;
  fields?: string;
}

app.get('/reverse', async (req: Request<{}, {}, {}, ReverseGeocodeQuery>, res: Response) => {
  const { lon, lat, fields } = req.query;

  // Validate parameters
  if (typeof lon !== 'string' || lon.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'lon query parameter is required'
    });
  }

  if (typeof lat !== 'string' || lat.trim().length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'lat query parameter is required'
    });
  }

  const longitude = parseFloat(lon);
  const latitude = parseFloat(lat);

  if (isNaN(longitude)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'lon must be a valid number'
    });
  }

  if (isNaN(latitude)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'lat must be a valid number'
    });
  }

  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: 'Invalid coordinate',
      message: 'lon must be between -180 and 180'
    });
  }

  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: 'Invalid coordinate',
      message: 'lat must be between -90 and 90'
    });
  }

  // Parse fields to include
  let selectClause = '* EXCLUDE (geometry)'; // Default to all fields except geometry
  if (typeof fields === 'string' && fields.trim().length > 0) {
    const fieldList = fields.split(',').map(f => f.trim()).filter(f => f.length > 0);

    if (fieldList.length === 1 && fieldList[0] === '*') {
      // Special case: * means all fields including geometry
      selectClause = '*';
    } else {
      // Validate field names against whitelist to prevent sql injection attacks
      for (const field of fieldList) {
        if (!validColumnNames.has(field)) {
          return res.status(400).json({
            error: 'Invalid field name',
            message: `Field '${field}' does not exist in the data source.`
          });
        }
      }
      selectClause = fieldList.join(', ');
    }
  }

  try {
    // Use parameterized query for coordinate values to prevent SQL injection
    const query = `
      SELECT ${selectClause}
      FROM read_parquet(?)
      WHERE (
        geometry_bbox.xmin <= ? AND
        geometry_bbox.xmax >= ? AND
        geometry_bbox.ymin <= ? AND
        geometry_bbox.ymax >= ?
      )
      AND ST_ContainsProperly(geometry, ST_Point(?, ?))
    `;

    const params = [
      PARQUET_PATH,
      longitude,
      longitude,
      latitude,
      latitude,
      longitude,
      latitude
    ];

    const result = await conn.run(query, params);
    const geometries = await result.getRowObjects();

    res.json({ geometries });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({
      error: 'Database query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Using parquet file: ${PARQUET_PATH}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
