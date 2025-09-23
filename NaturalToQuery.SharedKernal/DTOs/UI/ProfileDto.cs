using NaturalToQuery.SharedKernal.DTOs.Providers;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.SharedKernal.DTOs.UI
{
    public class ProfileDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string DatabaseName { get; set; }
        public string ConnectionString { get; set; }
        public List<QueryDto> Queries { get; set; }
        public DateTimeOffset CreatedUtc { get; set; }
    }
    public class QueryDto
    {
        public Guid Id { get; set; }
        public string UserQuery { get; set; }
        public string SqlQuery { get; set; }
        public DateTime TimestampUtc { get; set; }
        public string ResultJson { get; set; }
    }
}
