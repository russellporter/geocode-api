# geocode-api

API for querying administrative boundary data from parquet files using DuckDB and Who's On First data.

## Setup

### Prerequisites
- Docker and Docker Compose (recommended)
- Or Node.js 22+ (for local development)

### Download Data

Download the latest Who's On First administrative boundary data:

```bash
npm run download
```

This will fetch the parquet file to `data/whosonfirst-data-admin.parquet`.

**Note:** The Who's On First data is available under the licenses described at https://whosonfirst.org/docs/licenses/

### Using Docker (Recommended)

1. Download the data (see above)
2. Build and run:

```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000`

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Run in development mode:

```bash
npm run dev
```

3. Or build and run:

```bash
npm run build
npm start
```

### Testing

Run integration tests against production data:

```bash
npm run integration-test
```

This will build the project, start the server, and run a suite of tests verifying API functionality with real parquet data.

## API Usage

### Reverse Geocode Endpoint

**GET** `/reverse?lon={longitude}&lat={latitude}&fields={field_list}`

Query parameters:
- `lon` (required): Longitude (-180 to 180)
- `lat` (required): Latitude (-90 to 90)
- `fields` (optional): Comma-separated list of fields to include in the response (e.g., `id,name,placetype`). Defaults to all fields except `geometry`. Use `*` to include all fields including geometry.

Examples:
```bash
# Basic query (returns all fields except geometry)
curl "http://localhost:3000/reverse?lon=-122.4194&lat=37.7749"

# Return only specific fields
curl "http://localhost:3000/reverse?lon=-122.4194&lat=37.7749&fields=id,name,placetype,lat,lon"

# Return all fields including geometry
curl "http://localhost:3000/reverse?lon=-122.4194&lat=37.7749&fields=*"
```

Response:
```json
{
  "geometries": [
    {
      "id": "...",
      "name": "...",
      "placetype": "...",
      ...
    }
  ]
}
```

### Health Check

**GET** `/health`

Returns:
```json
{
  "status": "ok"
}
```

## Configuration

Environment variables:
- `PORT` - Server port (default: 3000)
- `PARQUET_PATH` - Path to parquet file (default: data/whosonfirst-data-admin.parquet)
