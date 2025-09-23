using MediatR;
using Microsoft.EntityFrameworkCore;
using NaturalToQuery.Core.Base;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;


namespace NaturalToQuery.Infrastructure.Persistence
{
    public class ContextDB : DbContext
    {
        private readonly IMediator _mediator;
        public DbSet<Profile> Profiles { get; set; }
        public DbSet<Query> Queries { get; set; }
        public DbSet<UserInfo> UserInfos { get; set; }
        public ContextDB(DbContextOptions<ContextDB> options, IMediator mediator) : base(options) 
        {
            _mediator = mediator;
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Ignore<DomainEventBase>();

            modelBuilder.Entity<Profile>(builder =>
            {
                builder.HasKey(p => p.Id);

                builder.Property(p => p.Name)
                       .IsRequired()
                       .HasMaxLength(200);

                builder.Property(p => p.SecretRef)
                       .IsRequired();

                builder.Property(p => p.Provider)
                       .IsRequired();

                builder.Property(p => p.CacheFile)
                       .HasMaxLength(500);

                builder.Property(p => p.CreatedUtc)
                       .IsRequired();

                modelBuilder.Entity<Query>(entity =>
                {
                    entity.HasKey(q => q.Id);
                    entity.Property(q => q.ResultJson).HasColumnType("TEXT");
                    entity.HasOne(q => q.Profile)
                          .WithMany(p => p.Queries)
                          .HasForeignKey(q => q.ProfileId);
                });
                modelBuilder.Entity<UserInfo>(entity =>
                {
                    entity.HasKey(u => u.Id);
                    entity.Property(u => u.ApiKey)
                          .HasMaxLength(200);
                    entity.Property(u => u.Mode)
                           .IsRequired();
                    entity.Property(u => u.CreatedUtc);
                    entity.Property(u => u.LastUpdatedUtc);
                    entity.HasMany(u => u.Profiles)
                          .WithOne()
                          .HasForeignKey(p => p.UserInfoId)
                          .OnDelete(DeleteBehavior.Cascade);
                });
            });
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var domainEntities = ChangeTracker.Entries<EntityBase>()
                .Where(e => e.Entity.DomainEvents != null && e.Entity.DomainEvents.Any())
                .Select(e => e.Entity)
                .ToList();

            var domainEvents = domainEntities
                .SelectMany(e => e.DomainEvents)
                .ToList();

            int result = await base.SaveChangesAsync(cancellationToken);

            foreach (var entity in domainEntities)
            {
                entity.ClearDomainEvents();
            }
            foreach (var domainEvent in domainEvents)
            {
                await _mediator.Publish(domainEvent, cancellationToken);
            }

            return result;
        }
    }
}
