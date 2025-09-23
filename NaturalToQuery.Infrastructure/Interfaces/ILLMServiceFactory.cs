using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Infrastructure.LLM;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Infrastructure.Interfaces
{
    public interface ILLMServiceFactory
    {
        ILLMService Create(UserInfo user);
    }
}
