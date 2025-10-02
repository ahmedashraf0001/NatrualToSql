using AutoFixture;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Domain;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NatrualToQuery.UnitTest.Common
{
    public static class TestDataBuilder
    {
        private static readonly IFixture _fixture = new Fixture();

        static TestDataBuilder()
        {
            // Configure AutoFixture to handle entity creation properly
            _fixture.Behaviors.OfType<ThrowingRecursionBehavior>()
                .ToList()
                .ForEach(b => _fixture.Behaviors.Remove(b));
            _fixture.Behaviors.Add(new OmitOnRecursionBehavior());
        }

        public static Profile CreateTestProfile(Guid? userId = null, ProviderType? providerType = null)
        {
            var profile = Profile.Create(
                userId ?? Guid.NewGuid(),
                _fixture.Create<string>(),
                _fixture.Create<string>(),
                providerType ?? ProviderType.SqlServer,
                _fixture.Create<string>(),
                _fixture.Create<string>()
            );
            
            // Set Id using reflection since it might be private setter
            var idProperty = typeof(Profile).GetProperty("Id");
            idProperty?.SetValue(profile, Guid.NewGuid());
            
            return profile;
        }

        public static Query CreateTestQuery(Guid? profileId = null)
        {
            return new Query
            {
                Id = Guid.NewGuid(),
                ProfileId = profileId ?? Guid.NewGuid(),
                UserQuery = _fixture.Create<string>(),
                SqlQuery = _fixture.Create<string>(),
                TimestampUtc = DateTime.UtcNow,
                ResultJson = _fixture.Create<string>()
            };
        }

        public static UserInfo CreateTestUserInfo()
        {
            return UserInfo.Create(
                _fixture.Create<string>(),
                AIMode.Groq
            );
        }

        public static UserInfo CreateBasicModeUserInfo()
        {
            return UserInfo.Create(
                _fixture.Create<string>(),
                AIMode.Basic
            );
        }

        public static ProviderConnectionConfig CreateTestConnectionConfig()
        {
            return new ProviderConnectionConfig(
                _fixture.Create<string>(),
                _fixture.Create<string>()
            );
        }

        public static QueryConversionResult CreateTestQueryConversionResult()
        {
            return new QueryConversionResult
            {
                Sql = "SELECT * FROM TestTable WHERE Id = @Id",
                Parameters = new List<Parameter>
                {
                    new Parameter { Name = "Id", Value = _fixture.Create<int>().ToString() }
                },
                Explanation = _fixture.Create<string>()
            };
        }

        public static ExecutionResult CreateTestExecutionResult()
        {
            return new ExecutionResult
            {
                Columns = new[] { "Id", "Name" },
                Rows = new object[][]
                {
                    new object[] { 1, "Test" },
                    new object[] { 2, "Test2" }
                },
                ExecutionMs = 100,
                AffectedRows = 2,
                ErrorMessage = "None"
            };
        }

        public static List<ServerInfo> CreateTestServerList()
        {
            return new List<ServerInfo>
            {
                new("TestServer1", "SqlServer", 5),
                new("TestServer2", "SqlServer", 3),
                new("TestServer3", "SqlServer", 1)
            };
        }

        public static List<DatabaseInfo> CreateTestDatabaseList()
        {
            return new List<DatabaseInfo>
            {
                new("TestDB1", 100),
                new("TestDB2", 200),
                new("TestDB3", 50)
            };
        }

        public static SchemaModel CreateTestDatabaseSchema()
        {
            var schema = new SchemaModel
            {
                Database = "TestDatabase"
            };

            // Create and add tables
            var usersTable = new TableInfo
            {
                Name = "Users",
                Schema = "dbo"
            };
            usersTable.Columns.Add(new ColumnInfo { Name = "Id", DataType = "int", IsNullable = false, IsPrimaryKey = true });
            usersTable.Columns.Add(new ColumnInfo { Name = "Name", DataType = "nvarchar", IsNullable = false });
            usersTable.Columns.Add(new ColumnInfo { Name = "Email", DataType = "nvarchar", IsNullable = true });

            var ordersTable = new TableInfo
            {
                Name = "Orders",
                Schema = "dbo"
            };
            ordersTable.Columns.Add(new ColumnInfo { Name = "Id", DataType = "int", IsNullable = false, IsPrimaryKey = true });
            ordersTable.Columns.Add(new ColumnInfo { Name = "UserId", DataType = "int", IsNullable = false });
            ordersTable.Columns.Add(new ColumnInfo { Name = "Amount", DataType = "decimal", IsNullable = false });
            ordersTable.Columns.Add(new ColumnInfo { Name = "OrderDate", DataType = "datetime2", IsNullable = false });

            schema.Tables.Add(usersTable);
            schema.Tables.Add(ordersTable);

            return schema;
        }

        public static T CreateRandomEntity<T>() where T : class
        {
            return _fixture.Create<T>();
        }

        public static List<T> CreateRandomEntities<T>(int count = 3) where T : class
        {
            return _fixture.CreateMany<T>(count).ToList();
        }
    }
}