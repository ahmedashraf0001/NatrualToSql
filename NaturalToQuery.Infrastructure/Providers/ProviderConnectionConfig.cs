using Microsoft.Data.SqlClient;

namespace NaturalToQuery.Infrastructure.Providers
{
    public class ProviderConnectionConfig
    {
        public string ConnectionString { get; }
        public string Server { get; }
        public string Database { get; }
        public int ConnectTimeout { get; }

        public ProviderConnectionConfig(string connectionString, int? connectTimeout = null)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentNullException(nameof(connectionString));

            var builder = new SqlConnectionStringBuilder(connectionString);

            if (connectTimeout.HasValue)
                builder.ConnectTimeout = connectTimeout.Value;

            Server = builder.DataSource
                ?? throw new ArgumentException("Connection string must contain a DataSource");

            Database = builder.InitialCatalog ?? string.Empty;
            ConnectionString = builder.ConnectionString;
        }


        public ProviderConnectionConfig(string server, string database, int? connectTimeout = null)
        {
            if (string.IsNullOrWhiteSpace(server))
                throw new ArgumentNullException(nameof(server));
            if (string.IsNullOrWhiteSpace(database))
                throw new ArgumentNullException(nameof(database));

            Server = server ;
            Database = database ;
            ConnectTimeout = connectTimeout ?? 15;

            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server,
                InitialCatalog = database,
                IntegratedSecurity = true,
                TrustServerCertificate = true,
                ConnectTimeout = ConnectTimeout
            };
            ConnectionString = builder.ConnectionString;
        }
    }
}