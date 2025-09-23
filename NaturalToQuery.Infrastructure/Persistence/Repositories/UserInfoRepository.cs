using Microsoft.EntityFrameworkCore;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Interfaces;

namespace NaturalToQuery.Infrastructure.Persistence.Repositories
{
    public class UserInfoRepository : IUserInfoRepository
    {
        private readonly ContextDB _dbContext;
        private readonly DbSet<UserInfo> _dbSet;

        public UserInfoRepository(ContextDB dbContext)
        {
            _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _dbSet = _dbContext.Set<UserInfo>();
        }
        public async Task AddAsync(UserInfo user, CancellationToken ct = default)
        {
            if (user == null)
                throw new ArgumentNullException(nameof(user));

            var exists = await _dbSet.ToListAsync(ct);

            if (exists.Count > 0)
                throw new InvalidOperationException("A user profile already exists.");

            await _dbSet.AddAsync(user, ct);
        }

        public async Task DeleteAsync(Guid id, CancellationToken ct = default)
        {
            if (id == Guid.Empty) throw new ArgumentNullException(nameof(id));
            var user = await _dbSet.FirstOrDefaultAsync (p => p.Id.Equals(id),ct);
            if (user == null)
                throw new InvalidOperationException("User does not exists");
            _dbSet.Remove(user);
        }
        public async Task DeleteAsync(UserInfo user, CancellationToken ct = default)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            _dbSet.Remove(user);
            await Task.CompletedTask;
        }

        public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        {
            if (id == Guid.Empty) throw new ArgumentNullException(nameof(id));
            return await _dbSet.AsNoTracking().AnyAsync(p => p.Id == id, ct);
        }


        public async Task<bool> ExistsByApiKeyAsync(string ApiKey, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(ApiKey)) throw new ArgumentNullException(nameof(ApiKey));
            return await _dbSet.AsNoTracking().AnyAsync(p => p.ApiKey.Equals(ApiKey), ct);
        }

        public async Task<UserInfo?> GetByIdAsync(Guid id, CancellationToken ct = default)
        {
            if (id == Guid.Empty) throw new ArgumentNullException(nameof(id));
            return await _dbSet.Include(p => p.Profiles).FirstOrDefaultAsync(e => e.Id.Equals(id));
        }

        public async Task<IReadOnlyList<UserInfo>> ListAllAsync(CancellationToken ct = default)
        {
            var list = await _dbSet.Include(p => p.Profiles).AsNoTracking().ToListAsync(ct);
            return list;
        }
        public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            return await _dbContext.SaveChangesAsync(ct);
        }

        public async Task UpdateAsync(UserInfo user, CancellationToken ct = default)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            _dbSet.Update(user);
            await Task.CompletedTask;
        }
    }
}
