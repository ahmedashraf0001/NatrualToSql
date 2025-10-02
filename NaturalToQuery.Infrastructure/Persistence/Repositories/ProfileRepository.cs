using Microsoft.EntityFrameworkCore;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Persistence;


public class ProfileRepository : IProfileRepository
{
    private readonly ContextDB _dbContext;
    private readonly DbSet<Profile> _dbSet;

    public ProfileRepository(ContextDB dbContext)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _dbSet = _dbContext.Set<Profile>();
    }
    public async Task AddAsync(Profile profile, CancellationToken ct = default)
    {
        if (profile == null)
            throw new ArgumentNullException(nameof(profile));

        bool exists = await _dbContext.Profiles
            .AnyAsync(p =>p.DatabaseName.Equals(profile.DatabaseName), ct);

        if (exists)
            throw new InvalidOperationException($"A profile for {profile.Name} already exists.");

        await _dbSet.AddAsync(profile, ct);
    }
    public async Task DeleteAsync(Profile profile, CancellationToken ct = default)
    {
        if (profile == null) throw new ArgumentNullException(nameof(profile));
        _dbSet.Remove(profile);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
    {
        if (id == Guid.Empty) throw new ArgumentNullException(nameof(id));
        return await _dbSet.AsNoTracking().AnyAsync(p => p.Id == id, ct);
    }

    public async Task<bool> ExistsByNameAsync(string name, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        return await _dbSet.AsNoTracking().AnyAsync(p => p.Name == name, ct);
    }

    public async Task<Profile?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        if (id == Guid.Empty) throw new ArgumentNullException(nameof(id));
        return await _dbSet.Include(e => e.Queries).FirstOrDefaultAsync(e => e.Id.Equals(id));
    }

    public async Task<Profile?> GetByNameAsync(string name, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        return await _dbSet.Include(e => e.Queries).AsNoTracking().FirstOrDefaultAsync(p => p.Name == name, ct);
    }

    public async Task<Profile?> GetByTypeAsync(ProviderType type, CancellationToken ct = default)
    {
        return await _dbSet.FirstOrDefaultAsync(t => t.Provider == type);
    }

    public async Task<IReadOnlyList<Profile>> ListAllAsync(CancellationToken ct = default)
    {
        var list = await _dbSet.Include(e => e.Queries)
            .AsNoTracking()
            .OrderByDescending(p => p.CreatedUtc)
            .ToListAsync(ct);
        return list;
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await _dbContext.SaveChangesAsync(ct);
    }
    public async Task AddQueryAsync(Profile profile, Query query, CancellationToken ct = default)
    {
        if (profile == null) throw new ArgumentNullException(nameof(profile));
        if (query == null) throw new ArgumentNullException(nameof(query));

        await _dbContext.Queries.AddAsync(query, ct);

        await Task.CompletedTask;
    }
    public async Task UpdateAsync(Profile profile, CancellationToken ct = default)
    {
        if (profile == null) throw new ArgumentNullException(nameof(profile));

        if (await _dbContext.Profiles.AnyAsync(p => p.Provider == profile.Provider && p.Id != profile.Id, ct))
        {
            throw new InvalidOperationException($"A profile for {profile.Provider} already exists.");
        }
        _dbSet.Update(profile);
        await Task.CompletedTask;
    }
}
