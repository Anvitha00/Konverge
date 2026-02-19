# Run schema_updates.sql migration
# This adds the created_at column to users table for admin stats

$env:DATABASE_URL = "postgres://postgres:postgres123@localhost:5433/konverge"

# Extract connection details from DATABASE_URL
if ($env:DATABASE_URL) {
    $dbUrl = $env:DATABASE_URL
    Write-Host "Using DATABASE_URL: $dbUrl"
    
    # Run psql with the migration file
    $sqlFile = "schema_updates.sql"
    if (Test-Path $sqlFile) {
        Write-Host "Running migration: $sqlFile"
        # Parse DATABASE_URL: postgres://user:password@host:port/database
        if ($dbUrl -match "postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $dbUser = $matches[1]
            $dbPassword = $matches[2]
            $dbHost = $matches[3]
            $dbPort = $matches[4]
            $dbName = $matches[5]
            
            $env:PGPASSWORD = $dbPassword
            & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile
        } else {
            Write-Host "Could not parse DATABASE_URL. Please run manually:"
            Write-Host "psql -h localhost -p 5433 -U postgres -d konverge -f schema_updates.sql"
        }
    } else {
        Write-Host "Error: schema_updates.sql not found"
    }
} else {
    Write-Host "DATABASE_URL not set. Using defaults:"
    Write-Host "psql -h localhost -p 5433 -U postgres -d konverge -f schema_updates.sql"
    $env:PGPASSWORD = "postgres123"
    & psql -h localhost -p 5433 -U postgres -d konverge -f schema_updates.sql
}
