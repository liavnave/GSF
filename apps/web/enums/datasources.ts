export enum DataModels {
	DB = 'db',
	SCHEMA = 'schema',
	TABLE = 'base table',
	VIEW = 'view',
	COLUMN = 'column',
}

export enum ConnectionType {
	NEO4J = 'neo4j',
	REDSHIFT = 'redshift',
	SNOWFLAKE = 'snowflake',
	BIG_QUERY = 'bigquery',
	DATABRIKS = 'databricks',
	TABLEAU = 'tableau',
	LOOKER = 'looker',
	ATHENA = 'athena',
	QUICKSIGHT = 'quicksight',
	MYSQL = 'mysql',
	MSSQL = 'mssql',
	POWER_BI = 'powerbi',
	SISENSE = 'sisense',
	ORACLE = 'oracle',
	VERTICA = 'vertica',
	TRINO = 'trino',
}

export enum Usage {
	HIGH = 'high',
	MEDIUM = 'medium',
	LOW = 'low',
	UNUSED = 'unused',
}
