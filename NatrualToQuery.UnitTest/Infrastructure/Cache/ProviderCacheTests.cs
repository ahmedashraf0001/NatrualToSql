using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;
using Newtonsoft.Json;

namespace NatrualToQuery.UnitTest.Infrastructure.Cache
{
    public class ProviderCacheTests : TestBase, IDisposable
    {
        private readonly Mock<IAppLogger<ProviderCache>> _mockLogger;
        private readonly string _tempDirectory;
        private readonly ProviderCache _cache;

        public ProviderCacheTests()
        {
            _mockLogger = Common.MockExtensions.SetupLogger<ProviderCache>();
            _tempDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(_tempDirectory);
            _cache = new ProviderCache(_mockLogger.Object);
        }

        [Fact]
        public async Task SaveAndReplaceAsync_WithValidData_ShouldCreateFile()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "test-data.json");
            var testData = new { Name = "Test", Value = 42 };

            // Act
            await _cache.SaveAndReplaceAsync(filePath, testData);

            // Assert
            File.Exists(filePath).Should().BeTrue();

            var content = await File.ReadAllTextAsync(filePath);
            var deserializedData = JsonConvert.DeserializeObject<dynamic>(content);
            
            Assert.NotNull(deserializedData);
            Assert.Equal("Test", (string)deserializedData!.Name);
            Assert.Equal(42, (int)deserializedData.Value);
        }

        [Fact]
        public async Task SaveAndReplaceAsync_WithExistingFile_ShouldReplaceContent()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "existing-file.json");
            var originalData = new { Old = "data" };
            var newData = new { New = "data", Updated = true };

            // Create original file
            await File.WriteAllTextAsync(filePath, JsonConvert.SerializeObject(originalData));

            // Act
            await _cache.SaveAndReplaceAsync(filePath, newData);

            // Assert
            File.Exists(filePath).Should().BeTrue();

            var content = await File.ReadAllTextAsync(filePath);
            var deserializedData = JsonConvert.DeserializeObject<dynamic>(content);
            
            Assert.NotNull(deserializedData);
            Assert.Equal("data", (string)deserializedData!.New);
            Assert.True((bool)deserializedData.Updated);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task SaveAndReplaceAsync_WithInvalidFilePath_ShouldThrowArgumentNullException(string? filePath)
        {
            // Arrange
            var testData = new { Test = "data" };

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentNullException>(
                () => _cache.SaveAndReplaceAsync(filePath!, testData));

            exception.Message.Should().Be("No file path provided");
        }

        [Fact]
        public async Task SaveAndReplaceAsync_WithNullData_ShouldThrowArgumentNullException()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "test.json");

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentNullException>(
                () => _cache.SaveAndReplaceAsync<object>(filePath, null!));

            exception.Message.Should().Be("No Data provided");
        }

        [Fact]
        public async Task SaveAndReplaceAsync_WithComplexObject_ShouldSerializeCorrectly()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "complex-object.json");
            var complexData = new
            {
                Id = Guid.NewGuid(),
                Name = "Complex Object",
                Items = new[]
                {
                    new { Key = "item1", Value = 100 },
                    new { Key = "item2", Value = 200 }
                },
                Metadata = new Dictionary<string, object>
                {
                    { "created", DateTime.UtcNow },
                    { "version", "1.0" },
                    { "enabled", true }
                }
            };

            // Act
            await _cache.SaveAndReplaceAsync(filePath, complexData);

            // Assert
            File.Exists(filePath).Should().BeTrue();

            var content = await File.ReadAllTextAsync(filePath);
            content.Should().NotBeNullOrEmpty();

            var deserializedData = JsonConvert.DeserializeObject<dynamic>(content);
            Assert.NotNull(deserializedData);
            Assert.Equal(complexData.Name, (string)deserializedData!.Name);
            Assert.Equal(2, ((Newtonsoft.Json.Linq.JArray)deserializedData.Items).Count);
        }

        [Fact]
        public async Task SaveOrUpdateAsync_WithNewFile_ShouldCreateFileWithUpdatedData()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "update-test.json");
            var updateFunc = new Func<TestData, TestData>(existing =>
            {
                existing.Value = "Updated";
                existing.Count = 99;
                return existing;
            });

            // Act
            await _cache.SaveOrUpdateAsync(filePath, updateFunc);

            // Assert
            File.Exists(filePath).Should().BeTrue();

            var content = await File.ReadAllTextAsync(filePath);
            var result = JsonConvert.DeserializeObject<TestData>(content);
            
            result.Should().NotBeNull();
            result!.Value.Should().Be("Updated");
            result.Count.Should().Be(99);
        }

        [Fact]
        public async Task SaveOrUpdateAsync_WithExistingFile_ShouldUpdateExistingData()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "existing-update.json");
            var initialData = new TestData { Value = "Initial", Count = 1 };
            
            // Create initial file
            await File.WriteAllTextAsync(filePath, JsonConvert.SerializeObject(initialData));

            var updateFunc = new Func<TestData, TestData>(existing =>
            {
                existing.Value = $"{existing.Value} - Updated";
                existing.Count += 10;
                return existing;
            });

            // Act
            await _cache.SaveOrUpdateAsync(filePath, updateFunc);

            // Assert
            var content = await File.ReadAllTextAsync(filePath);
            var result = JsonConvert.DeserializeObject<TestData>(content);
            
            result.Should().NotBeNull();
            result!.Value.Should().Be("Initial - Updated");
            result.Count.Should().Be(11);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task SaveOrUpdateAsync_WithInvalidFilePath_ShouldThrowArgumentNullException(string? filePath)
        {
            // Arrange
            var updateFunc = new Func<TestData, TestData>(existing => existing);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentNullException>(
                () => _cache.SaveOrUpdateAsync(filePath!, updateFunc));

            exception.Message.Should().Be("No file path provided");
        }

        [Fact]
        public async Task SaveOrUpdateAsync_WithNullUpdateFunc_ShouldThrowArgumentNullException()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "test.json");

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentNullException>(
                () => _cache.SaveOrUpdateAsync<TestData>(filePath, null!));

            exception.Message.Should().Be("No update Func provided");
        }

        [Fact]
        public async Task LoadAsync_WithValidFile_ShouldReturnData()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "load-test.json");
            var testData = new TestData { Value = "LoadTest", Count = 5 };

            await File.WriteAllTextAsync(filePath, JsonConvert.SerializeObject(testData));

            // Act
            var result = await _cache.LoadAsync<TestData>(filePath);

            // Assert
            result.Should().NotBeNull();
            result!.Value.Should().Be("LoadTest");
            result.Count.Should().Be(5);
        }

        [Fact]
        public async Task LoadAsync_WithNonExistentFile_ShouldReturnDefault()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "non-existent.json");

            // Act
            var result = await _cache.LoadAsync<TestData>(filePath);

            // Assert
            result.Should().BeNull();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task LoadAsync_WithInvalidFilePath_ShouldReturnDefault(string? filePath)
        {
            // Act
            var result = await _cache.LoadAsync<TestData>(filePath!);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task LoadAsync_WithInvalidJson_ShouldReturnDefault()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "invalid-json.json");
            await File.WriteAllTextAsync(filePath, "{ invalid json content }");

            // Act
            var result = await _cache.LoadAsync<TestData>(filePath);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task LoadAsync_WithCorruptedFile_ShouldReturnDefault()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "corrupted.json");
            await File.WriteAllTextAsync(filePath, "not json at all");

            // Act
            var result = await _cache.LoadAsync<TestData>(filePath);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task SaveAndReplaceAsync_WithDirectoryCreation_ShouldCreateNestedDirectories()
        {
            // Arrange
            var nestedPath = Path.Combine(_tempDirectory, "level1", "level2", "level3", "test.json");
            var testData = new { Test = "nested" };

            // Act
            await _cache.SaveAndReplaceAsync(nestedPath, testData);

            // Assert
            File.Exists(nestedPath).Should().BeTrue();
            Directory.Exists(Path.GetDirectoryName(nestedPath)).Should().BeTrue();

            var content = await File.ReadAllTextAsync(nestedPath);
            var deserializedData = JsonConvert.DeserializeObject<dynamic>(content);
            Assert.NotNull(deserializedData);
            Assert.Equal("nested", (string)deserializedData!.Test);
        }

        [Fact]
        public async Task ConcurrentOperations_ShouldHandleMultipleThreadsCorrectly()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "concurrent-test.json");
            var tasks = new List<Task>();

            // Act
            for (int i = 0; i < 10; i++)
            {
                var index = i;
                tasks.Add(Task.Run(async () =>
                {
                    var data = new { ThreadId = index, Timestamp = DateTime.UtcNow };
                    await _cache.SaveAndReplaceAsync($"{filePath}-{index}", data);
                }));
            }

            await Task.WhenAll(tasks);

            // Assert
            for (int i = 0; i < 10; i++)
            {
                File.Exists($"{filePath}-{i}").Should().BeTrue();
            }
        }


        public override void Dispose()
        {
            if (Directory.Exists(_tempDirectory))
            {
                Directory.Delete(_tempDirectory, true);
            }
            base.Dispose();
        }

        public class TestData
        {
            public string Value { get; set; } = "";
            public int Count { get; set; } = 0;
        }
    }
}