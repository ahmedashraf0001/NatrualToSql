using Microsoft.Extensions.Options;
using NaturalToQuery.Application.DTOs.Groq;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Infrastructure.LLM
{
    public class LLMServiceFactory : ILLMServiceFactory
    {
        private readonly IOptions<LLMOptions> _opts;
        private readonly IAppLogger<LLMService> _logger;

        public LLMServiceFactory(IOptions<LLMOptions> opts, IAppLogger<LLMService> logger)
        {
            _opts = opts;
            _logger = logger;
        }

        public ILLMService Create(UserInfo user)
        {
            return new LLMService(user, _opts, _logger);
        }
    }

}
