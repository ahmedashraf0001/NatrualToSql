using FastEndpoints;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    public class GetLocalModel:EndpointWithoutRequest<LocalModelResponse>
    {
        private readonly IConfiguration _configuration;
        public GetLocalModel(IConfiguration configuration)
        {
            _configuration = configuration;
        }
        public override void Configure()
        {
            Get("api/userinfo/localllm");
            AllowAnonymous();
        }
        override public async Task HandleAsync(CancellationToken ct)
        {
            var Model = _configuration["Groq:LocalModel"];
            await Send.OkAsync(new LocalModelResponse { Model = Model }, ct);
        }
    }
}
