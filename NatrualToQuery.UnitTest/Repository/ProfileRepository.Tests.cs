using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using NaturalToQuery.Infrastructure.Persistence;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using Moq;
using MediatR;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;

namespace NatrualToQuery.UnitTest.Repository
{
    public class ProfileRepositoryTests : IDisposable
    {
        private readonly Mock<IMediator> _mediatorMock = new();
        private ContextDB CreateContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<ContextDB>()
                .UseInMemoryDatabase(dbName)
                .Options;

            return new ContextDB(options, _mediatorMock.Object);
        }

        public void Dispose()
        {
            // contexts disposed per test by 'await using'
        }

        // Helper: set private setter property (CreatedUtc) via reflection.
        private static void SetCreatedUtc(Profile profile, DateTimeOffset value)
        {
            var prop = typeof(Profile).GetProperty(nameof(Profile.CreatedUtc), BindingFlags.Instance | BindingFlags.Public);
            if (prop == null) throw new InvalidOperationException("CreatedUtc property not found");
            var setter = prop.GetSetMethod(true);
            if (setter == null) throw new InvalidOperationException("No setter for CreatedUtc found");
            setter.Invoke(profile, new object[] { value });
        }

        [Fact]
        public async Task AddAsync_AddsProfile_WhenProviderNotExists()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);
            var repo = new ProfileRepository(ctx);

            var profile = Profile.Create(Guid.NewGuid(), "p1", dbName, ProviderType.SqlServer, "secret-ref", "cache-file");
            profile.Id = Guid.NewGuid();

            await repo.AddAsync(profile);
            await repo.SaveChangesAsync();

            var saved = await ctx.Profiles.ToListAsync();
            Assert.Single(saved);
            Assert.Equal("p1", saved[0].Name);
            Assert.Equal(ProviderType.SqlServer, saved[0].Provider);
        }

        [Fact]
        public async Task AddAsync_Throws_WhenProviderAlreadyExists()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var existing = Profile.Create(Guid.NewGuid(), "existing", dbName, ProviderType.SqlServer, "s", "c");
            existing.Id = Guid.NewGuid();
            ctx.Profiles.Add(existing);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);

            var newProfile = Profile.Create(Guid.NewGuid(),"new", dbName, ProviderType.SqlServer, "s2", "c2");
            newProfile.Id = Guid.NewGuid();

            await Assert.ThrowsAsync<InvalidOperationException>(() => repo.AddAsync(newProfile));
        }

        [Fact]
        public async Task DeleteAsync_RemovesProfile()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var profile = Profile.Create(Guid.NewGuid(), "to-delete", dbName, ProviderType.SqlServer, "sr", "cf");
            profile.Id = Guid.NewGuid();
            ctx.Profiles.Add(profile);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            await repo.DeleteAsync(profile);
            await repo.SaveChangesAsync();

            var exists = await ctx.Profiles.AnyAsync(p => p.Id == profile.Id);
            Assert.False(exists);
        }

        [Fact]
        public async Task ExistsAsync_ReturnsTrueWhenExists_FalseWhenNot()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var id = Guid.NewGuid();
            var p = Profile.Create(Guid.NewGuid(), "p", dbName, ProviderType.SqlServer, "sr", "cf");
            p.Id = id;
            ctx.Profiles.Add(p);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            Assert.True(await repo.ExistsAsync(id));
            Assert.False(await repo.ExistsAsync(Guid.NewGuid()));
        }

        [Fact]
        public async Task ExistsByNameAsync_ReturnsFalseForNullOrWhitespace_AndTrueIfFound()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var p = Profile.Create(Guid.NewGuid(), "Alice", dbName, ProviderType.SqlServer, "sr", "cf");
            p.Id = Guid.NewGuid();
            ctx.Profiles.Add(p);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            Assert.False(await repo.ExistsByNameAsync(null));
            Assert.False(await repo.ExistsByNameAsync("  "));
            Assert.True(await repo.ExistsByNameAsync("Alice"));
            Assert.False(await repo.ExistsByNameAsync("Bob"));
        }

        [Fact]
        public async Task GetByIdAsync_ReturnsProfileWithQueries()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var id = Guid.NewGuid();
            var profile = Profile.Create(Guid.NewGuid(), "with-queries", dbName, ProviderType.SqlServer, "sr", "cf");
            profile.Id = id;

            profile.Queries.Add(new Query { Id = Guid.NewGuid(), UserQuery = "q1" });
            profile.Queries.Add(new Query { Id = Guid.NewGuid(), UserQuery = "q2" });

            ctx.Profiles.Add(profile);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            var fetched = await repo.GetByIdAsync(id);

            Assert.NotNull(fetched);
            Assert.Equal("with-queries", fetched!.Name);
            Assert.NotNull(fetched.Queries);
            Assert.Equal(2, fetched.Queries.Count);
        }

        [Fact]
        public async Task GetByNameAsync_ReturnsProfile_WhenExists()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var p = Profile.Create(Guid.NewGuid(), "lookup", dbName, ProviderType.SqlServer, "s", "c");
            p.Id = Guid.NewGuid();
            ctx.Profiles.Add(p);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            var fetched = await repo.GetByNameAsync("lookup");

            Assert.NotNull(fetched);
            Assert.Equal("lookup", fetched!.Name);
        }

        [Fact]
        public async Task GetByTypeAsync_ReturnsProfile_WhenExists()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var p = Profile.Create(Guid.NewGuid(), "ptype", dbName, ProviderType.SqlServer, "s", "c");
            p.Id = Guid.NewGuid();
            ctx.Profiles.Add(p);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            var fetched = await repo.GetByTypeAsync(ProviderType.SqlServer);

            Assert.NotNull(fetched);
            Assert.Equal(ProviderType.SqlServer, fetched!.Provider);
        }

        [Fact]
        public async Task ListAllAsync_ReturnsAllOrderedByCreatedUtcDesc()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var older = Profile.Create(Guid.NewGuid(), "old", dbName, ProviderType.SqlServer, "s", "c");
            older.Id = Guid.NewGuid();
            SetCreatedUtc(older, DateTimeOffset.UtcNow.AddDays(-2));

            var newer = Profile.Create(Guid.NewGuid(), "new", dbName, ProviderType.SqlServer, "s2", "c2");
            newer.Id = Guid.NewGuid();
            SetCreatedUtc(newer, DateTimeOffset.UtcNow);

            ctx.Profiles.AddRange(older, newer);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);
            var list = await repo.ListAllAsync();

            Assert.Equal(2, list.Count);
            Assert.Equal("new", list.First().Name); // newest first
            Assert.Equal("old", list.Last().Name);
        }

        [Fact]
        public async Task SaveChangesAsync_CommitsChanges()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            var repo = new ProfileRepository(ctx);
            var profile = Profile.Create(Guid.NewGuid(), "save-test", dbName, ProviderType.SqlServer, "s", "c");
            profile.Id = Guid.NewGuid();

            await repo.AddAsync(profile);
            var count = await repo.SaveChangesAsync();

            Assert.True(count > 0);
            Assert.True(await ctx.Profiles.AnyAsync(p => p.Name == "save-test"));
        }

        [Fact]
        public async Task UpdateAsync_Throws_WhenProviderAlreadyExistsOnDifferentProfile()
        {
            var dbName = Guid.NewGuid().ToString();
            await using var ctx = CreateContext(dbName);

            // existing profile with same Provider
            var existing = Profile.Create(Guid.NewGuid(), "p1", dbName, ProviderType.SqlServer, "s", "c");
            existing.Id = Guid.NewGuid();

            var toUpdate = Profile.Create(Guid.NewGuid(), "p2", dbName, ProviderType.SqlServer, "s2", "c2");
            toUpdate.Id = Guid.NewGuid();

            ctx.Profiles.Add(existing);
            ctx.Profiles.Add(toUpdate);
            await ctx.SaveChangesAsync();

            var repo = new ProfileRepository(ctx);

            // Attempt to update 'toUpdate' (provider already exists in DB) -> repository's AnyAsync will be true and it will throw.
            await Assert.ThrowsAsync<InvalidOperationException>(() => repo.UpdateAsync(toUpdate));
        }
    }
}
