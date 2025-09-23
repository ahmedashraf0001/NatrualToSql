using Moq;
using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.SharedKernal.Interfaces;
using Newtonsoft.Json;
using System.Threading.Tasks;

namespace NatrualToQuery.UnitTest.Cache
{
    public class ProviderCacheTests:IDisposable
    {
        private readonly Mock<IAppLogger<ProviderCache>> _mockLogger;
        private readonly string _tempDirectory;
        public ProviderCacheTests()
        {
            _mockLogger = new Mock<IAppLogger<ProviderCache>>();
            _tempDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(_tempDirectory);
        }
        private ProviderCache CreateCache()
        {
            return new ProviderCache(_mockLogger.Object);
        }
        [Fact]
        public async Task SaveAndReplaceAsync_WithNewFile_CreatesNewCacheAndReplace()
        {
            //arrange
            var filePath = Path.Combine(_tempDirectory, "test.json");
            List<string> data = new List<string>
            {
                "ahmed",
                "ashraf"
            };
            var cache = CreateCache();
            //act           
            await cache.SaveAndReplaceAsync(filePath, data);
            Assert.True(File.Exists(filePath));
            var content = await File.ReadAllTextAsync(filePath);
            var result = JsonConvert.DeserializeObject<List<string>>(content);
            //assert
            Assert.Equal(data, result);

        }
        [Fact]
        public async Task SaveAndReplaceAsync_WithNullFilePath_ReturnArgumentNullException() 
        {
            //arrange
            var path = "";
            var data = new Dictionary<string, object>();
            var cache = CreateCache();
            //act
            //assert
            var ex = await Assert.ThrowsAsync<ArgumentNullException>(() => cache.SaveAndReplaceAsync(path, data));
            Assert.Equal("No file path provided", ex.Message);
        }
        [Fact]
        public async Task SaveAndReplaceAsync_WithNullFile_ReturnArgumentNullException()
        {
            //arrange
            var path = "test";
            string data = null;
            var cache = CreateCache();
            //act
            //assert
            var ex = await Assert.ThrowsAsync<ArgumentNullException>(() => cache.SaveAndReplaceAsync(path, data));
            Assert.Equal("No Data provided", ex.Message);
        }
        public class TestData
        {
            public string Value { get; set; } = "";
            public int Count { get; set; } = 0;
        }
        [Fact]
        public async Task SaveOrUpdateAsync_WithNewFile_CreatesFileWithUpdatedData()
        {
            // Arrange
            var filePath = Path.Combine(_tempDirectory, "test.json");
            var updateFunc = new Func<TestData, TestData>(existing =>
            {
                existing.Value = "Updated";
                existing.Count = 42;
                return existing;
            });
            var _cache = CreateCache();
            // Act
            await _cache.SaveOrUpdateAsync(filePath, updateFunc);

            // Assert
            Assert.True(File.Exists(filePath));
            var content = await File.ReadAllTextAsync(filePath);
            var result = JsonConvert.DeserializeObject<TestData>(content);
            Assert.Equal("Updated", result.Value);
            Assert.Equal(42, result.Count);
        }
        [Fact]
        public async Task SaveOrUpdateAsync_WithNullFilePath_ReturnArgumentNullException()
        {
            //arrange
            string filePath = null;
            Func<TestData, TestData> updateFunc = existing =>
            {
                existing.Value = "FromNull";
                existing.Count = 123;
                return existing;
            };
            var _cache = CreateCache();
            //act
            //assert
            var ex = await Assert.ThrowsAsync<ArgumentNullException>(() => _cache.SaveOrUpdateAsync(filePath, updateFunc));
            Assert.Equal("No file path provided", ex.Message);
        }
        [Fact]
        public async Task SaveOrUpdateAsync_WithNullFile_ReturnArgumentNullException()
        {
            //arrange
            var filePath = Path.Combine(_tempDirectory, "test.json");
            Func<TestData, TestData> updateFunc = null;
            var _cache = CreateCache();
            //act
            //assert
            var ex = await Assert.ThrowsAsync<ArgumentNullException>(() => _cache.SaveOrUpdateAsync(filePath, updateFunc));
            Assert.Equal("No update Func provided", ex.Message);
        }

        [Fact]
        public async Task LoadAsync_WithNullFilePath_ReturnDefault()
        {
            //arrange
            string file  = null;
            var cache = CreateCache();
            //act
            var result = await cache.LoadAsync<string>(file);
            //assert
            Assert.Equal("", string.Empty);
        }
        [Fact]
        public async Task LoadAsync_WithInvalidJson_ReturnDefault()
        {
            //arrange
            var filedir =Path.Combine(Path.GetTempPath(), "mario".ToString());
            Directory.CreateDirectory(filedir);
            var filePath = Path.Combine(filedir, "mario.json");
            File.WriteAllTextAsync(filePath, "test");

            var cache = CreateCache();
            //act
            var result = await cache.LoadAsync<int>(filePath);
            //assert
            Assert.Equal("", string.Empty);
            Directory.Delete(filedir, true);
        }
        public void Dispose()
        {
            if (Directory.Exists(_tempDirectory))
            {
                Directory.Delete(_tempDirectory, true);
            }
        }
    }
}
